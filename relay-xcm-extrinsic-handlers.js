const { ApiPromise, WsProvider } = require("@polkadot/api");
const {
  blake2AsU8a,
  blake2AsHex,
  encodeAddress,
  decodeAddress,
} = require("@polkadot/util-crypto");
const { u8aToHex, stringToU8a } = require("@polkadot/util");
const {
  intrustionsFromBytesXCMP,
} = require("./common/instructions-from-bytes-xcmp");

const rpcProvider = "wss://kusama-rpc.polkadot.io/";
const blockNumber = 12034879; //ump
// const blockNumber = 12034825; //dmp

// const rpcProvider = "wss://rpc.polkadot.io";
// blockNumber = 1000;

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

    feesAssit: "",
    feeLimit: "",

    warnings: "",
  };

  // await decodeRelayUMP(api, blockNumber, transfer);
  // await decodeRelayDMP(api, blockNumber, transfer);
  delete transfer["xcmpInstructions"];
  // console.log(transfer);

  console.log(calcSovereignAddress(api, "2000", "para", 2));
  console.log(
    u8aToHex(
      decodeAddress(
        "a3d4zPpCqjQLhdrvRZpHHmZcBizveD1PUuboSdnWyRZbhm59p",
        false,
        2092
      )
    )
  );
  process.exit();
})();

async function decodeRelayDMP(api, blockNumber, transfer) {
  // Get block hash
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  // Get block by hash
  const signedBlock = await api.rpc.chain.getBlock(blockHash);
  // Get a decorated api instance at a specific block
  const apiAt = await api.at(signedBlock.block.header.hash);
  const allBlockExtrinsics = signedBlock.block.extrinsics;
  allBlockExtrinsics.forEach((extrinsic) => {
    if (
      extrinsic.method.section == "xcmPallet" &&
      extrinsic.method.method == "limitedReserveTransferAssets"
    ) {
      const {
        dest,
        beneficiary,
        assets,
        fee_asset_item: feeAsset,
        weight_limit: weightLimit,
      } = extrinsic.toHuman().method.args; //ts as any
      transfer.toParachainId = dest.V1.interior.X1.Parachain.toString();
      transfer.toAddress =
        beneficiary.V1.interior.X1.AccountKey20.key.toString();
      transfer.assetId = assets.V0[0].ConcreteFungible.id.toString();
      transfer.amount = assets.V0[0].ConcreteFungible.amount.toString();
      transfer.feeAsset = feeAsset.toString();
      transfer.feeLimit = weightLimit.Limited.toString();
    }
  });
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

function calcSovereignAddress(api, parachainId, paraOrSibl, prefix) {
  return encodeAddress(
    u8aToHex(
      Uint8Array.from([
        ...new TextEncoder().encode(paraOrSibl),
        ...api.createType("ParaId", parachainId).toU8a(),
      ])
    ).padEnd(66, "0"),
    prefix
  );
}
