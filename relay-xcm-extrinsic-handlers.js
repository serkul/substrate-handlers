const { ApiPromise, WsProvider } = require("@polkadot/api");
const { blake2AsU8a, blake2AsHex } = require("@polkadot/util-crypto");
const { u8aToHex, stringToU8a } = require("@polkadot/util");

const rpcProvider = "wss://kusama-rpc.polkadot.io/";
const blockNumber = 12034879; //ump

// const blockNumber = 12034825; //dmp

(async () => {
  // Connect to a node (this is ak public one)
  const provider = new WsProvider(rpcProvider);
  const api = await ApiPromise.create({ provider });

  // Make a call to the chain and get its name.
  const chain = await api.rpc.system.chain();
  // Print out the chain to which we connected.
  console.log(`You are connected to ${chain} !`);

  // const para = api.createType("ParaId", 2023); // ts as any
  // console.log(para);
  // The hash for each extrinsic in the block

  transfer = {
    // id: ID! #id is a required field
    blockNumber: blockNumber,
    timestamp: "",

    fromAddress: "",
    fromParachainId: "",

    toAddress: "",
    toParachainId: "",

    assetParachainId: "",
    assetId: "",
    amount: "",
    multiAssetJSON: "",

    xcmpMessageStatus: "", //change to union for threes statuses: sent, received, notfound
    xcmpMessageHash: "",
    xcmpInstructions: [],

    fees: "",
    warnings: "",
  };

  await decodeRelayUMP(api, blockNumber, transfer);
  // decodeRelayDMP(allBlockExtrinsics, apiAt, transfer);
  delete transfer["xcmpInstructions"];
  console.log(transfer);

  process.exit();
})();

async function decodeRelayDMP(transfer) {
  // Get block hash
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  // Get block by hash
  const signedBlock = await api.rpc.chain.getBlock(blockHash);

  // Get a decorated api instance at a specific block
  const apiAt = await api.at(signedBlock.block.header.hash);

  const allBlockEvents = await apiAt.query.system.events();
  const allBlockExtrinsics = signedBlock.block.extrinsics;
  // Get block with upm info
  const umpInfoblockHash = await api.rpc.chain.getBlockHash(blockNumber - 1);
  const umpInfoblockHashsignedBlock = await api.rpc.chain.getBlock(
    umpInfoblockHash
  );

  allBlockExtrinsics.method.args[0].downwardMessages.forEach((message) => {
    // Print the Blake2 Hash of the message
    console.log(
      `Blake2 hash of message is: ${u8aToHex(blake2AsU8a(message.msg))}\n`
    );

    // We recover all instructions
    let instructions = apiAt.reistry.createType("XcmVersionedXcm", message.msg);
    if (instructions.isV1) {
      // Print V1 Message
      console.log(instructions.asV1.toHuman());
      if (instructions.isDepositAsset) {
        console.log("Beneficiary Located At");
        console.log(instructions.toHuman().DepositAsset.beneficiary);
      }
    } else if (instructions.isV2) {
      instructions.asV2.forEach((instruction) => {
        // Print V2 Message
        console.log(instruction.toHuman());
        if (instruction.isWithdrawAsset) {
          console.log("Withdraw Asset Located At");
          console.log(instruction.toHuman().WithdrawAsset[0].beneficiary);
        }
      });
    }
  });

  // .forEach((extrinsic) => {
  //   if (
  //     extrinsic.method.section == "xcmPallet" &&
  //     extrinsic.method.method == "limitedReserveTransferAssets"
  //   ) {
  //     console.log("tut");
  //     extrinsic.method.args[0].backedCandidates.forEach((candidate) => {
  //       const fromParaId = candidate.candidate.descriptor.paraId.toString();
  //       // Check upward messages (from parachain to relay chain)
  //       candidate.candidate.commitments.upwardMessages.forEach((message) => {
  //         const messageHash = blake2AsHex(Uint8Array.from(message));
  //         if (messageHash == transfer.xcmpMessageHash) {
  //           transfer.fromParachainId = fromParaId;

  //           const instructionsHuman = intrustionsFromBytesXCMP(message, apiAt);
  //           console.log(instructionsHuman);
  //           if (typeof instructionsHuman == "string") {
  //             transfer.warnings += instructionsHuman;
  //           } else {
  //             console.log("tut");

  //             transfer.xcmpInstructions = instructionsHuman.map((instruction) =>
  //               JSON.stringify(instruction, undefined, 2)
  //             );
  //             parceRelayUMP(instructionsHuman, transfer);
  //           }
  //         }
  //       });
  //     });
  //   } //if (paraIngetern.enter)
  // });
}

async function decodeRelayUMP(api, blockNumber, transfer) {
  // Get block hash
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  // Get block by hash
  const signedBlock = await api.rpc.chain.getBlock(blockHash);

  // Get a decorated api instance at a specific block
  const apiAt = await api.at(signedBlock.block.header.hash);

  const allBlockEvents = await apiAt.query.system.events();
  // Get block with upm info
  const umpInfoblockHash = await api.rpc.chain.getBlockHash(blockNumber - 1);
  const umpInfoblockHashsignedBlock = await api.rpc.chain.getBlock(
    umpInfoblockHash
  );

  const upmsExecutedUpward = allBlockEvents.filter(
    (el) => el.event.section == "ump" && el.event.method == "ExecutedUpward"
  );
  // upmsExecutedUpward.length === 0
  //   ? (transfer.warnings += "ump.ExecutedUpward not found")
  //   : upmsExecutedUpward.length > 1
  //   ? (transfer.warnings += "more tnan one ump.ExecutedUpward event")
  //   : decodeRelayInboundXcmpMessage(upmsExecutedUpward[0]);
  if (upmsExecutedUpward.length === 0) {
    console.log("ump.ExecutedUpward not found");
  } else if (upmsExecutedUpward.length > 1) {
    console.log("more tnan one ump.ExecutedUpward event");
  } else {
    transfer.xcmpMessageHash = upmsExecutedUpward[0].toHuman().event.data[0];

    const allUmpInfoBlockExtrinsics =
      umpInfoblockHashsignedBlock.block.extrinsics;

    allUmpInfoBlockExtrinsics.forEach((extrinsic) => {
      if (
        extrinsic.method.section == "paraInherent" &&
        extrinsic.method.method == "enter"
      ) {
        extrinsic.method.args[0].backedCandidates.forEach((candidate) => {
          const fromParaId = candidate.candidate.descriptor.paraId.toString();
          // Check upward messages (from parachain to relay chain)
          candidate.candidate.commitments.upwardMessages.forEach((message) => {
            const messageHash = blake2AsHex(Uint8Array.from(message));
            if (messageHash == transfer.xcmpMessageHash) {
              transfer.fromParachainId = fromParaId;

              const instructionsHuman = intrustionsFromBytesXCMP(
                message,
                apiAt
              );
              console.log(instructionsHuman);
              if (typeof instructionsHuman == "string") {
                transfer.warnings += instructionsHuman;
              } else {
                console.log("tut");

                transfer.xcmpInstructions = instructionsHuman.map(
                  (instruction) => JSON.stringify(instruction, undefined, 2)
                );
                parceRelayUMP(instructionsHuman, transfer);
              }
            }
          });
        });
      } //if (paraIngetern.enter)
    });
  }
}

function intrustionsFromBytesXCMP(messageData, apiAt) {
  // // We recover all instructions
  let instructions = apiAt.registry.createType("XcmVersionedXcm", messageData); //ts as any

  // choose appropriate xcm version
  let asVersion = "not found";
  for (const versionNum of ["0", "1", "2"]) {
    if (instructions["isV" + versionNum]) {
      asVersion = "asV" + versionNum;
    }
  }
  if (asVersion === "not found") {
    return " - xcmp version not found";
  } else {
    let instructionsHuman = [];
    instructions[asVersion].forEach((instruction) => {
      instructionsHuman.push(instruction.toHuman());
    });
    return instructionsHuman;
  }
}

function parceRelayUMP(instructions, transfer) {
  instructions.forEach((instruction) => {
    Object.keys(instruction).forEach((key) => {
      switch (key) {
        case "WithdrawAsset":
          transfer.amount =
            instruction.WithdrawAsset[0].fun.Fungible.toString();
          transfer.assetId = JSON.stringify(instruction.WithdrawAsset[0].id);
          break;
        case "BuyExecution":
          transfer.fees = JSON.stringify(instruction.BuyExecution);
          break;
        case "DepositAsset":
          transfer.toAddress =
            instruction.DepositAsset.beneficiary.interior.X1.AccountId32.id;
          break;
      }
    });
  });
}

// if (instruction.isWithdrawAsset) {
//   // console.log(instruction.toHuman().WithdrawAsset[0]);
//   transfer.amount = instruction
//     .toHuman()
//     .WithdrawAsset[0].fun.Fungible.toString();
//   transfer.assetId = JSON.stringify(
//     instruction.toHuman().WithdrawAsset[0].id
//   );
// }
// if (instruction.isBuyExecution) {
//   transfer.fees = JSON.stringify(
//     instruction.toHuman().BuyExecution
//   );
// }
// if (instruction.isDepositAsset) {
//   transfer.toAddress =
//     instruction.toHuman().DepositAsset.beneficiary.interior.X1.AccountId32.id;
// }
