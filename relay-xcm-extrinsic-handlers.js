const { ApiPromise, WsProvider } = require("@polkadot/api");
const {
  blake2AsU8a,
  blake2AsHex,
  encodeAddress,
  decodeAddress,
} = require("@polkadot/util-crypto");
const { u8aToHex, stringToU8a } = require("@polkadot/util");
const {
  intrustionsFromXcmU8Array,
} = require("./common/instructions-from-xcmp-msg-u8array");
const { parceXcmpInstrustions } = require("./common/parce-xcmp-instructions");

const chainPrefixList = {
  polkadot: 0,
  kusama: 2,
  karura: 8,
  moonriver: 1285,
  basilisk: 10041,
  kintsugi: 2092,
};

const rpcProvider = "wss://kusama-rpc.polkadot.io/";
const blockNumber = 12034879; //ump
// const blockNumber = 12034825; //dmp
// const blockNumber = 12265870; //xcmp loss to sovereign
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

  await decodeRelayUMP(api, blockNumber, transfer);
  // await decodeRelayDMP(api, blockNumber, transfer);
  delete transfer["xcmpInstructions"];
  console.log(transfer);

  // console.log(
  //   "moonriver sibl",
  //   calcSovereignAddress(api, "2023", "sibl", chainPrefixList.karura)
  // );
  // console.log(
  //   "karura sibl",
  //   calcSovereignAddress(api, "2000", "sibl", chainPrefixList.karura)
  // );
  // console.log(
  //   encodeAddress(
  //     u8aToHex(
  //       Uint8Array.from([
  //         ...new TextEncoder().encode("sibl"),
  //         ...api.createType("ParaId", "2000").toU8a(),
  //       ])
  //     ).padEnd(66, "0"),
  //     chainPrefixList.kintsugi
  //   )
  // );

  // console.log(
  //   u8aToHex(
  //     decodeAddress(
  //       "a3d4zPpCqjQLhdrvRZpHHmZcBizveD1PUuboSdnWyRZbhm59p",
  //       false,
  //       2092
  //     )
  //   )
  // );
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

  const dmpQuery = await apiAt.query.dmp.downwardMessageQueues(2023);
  // console.log(blake2AsHex(Uint8Array.from(dmpQuery[0].msg)));

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
      console.log(
        Number(dest.V1.interior.X1.Parachain.replace(/,/g, "")),
        typeof dest.V1.interior.X1.Parachain
      );
      transfer.toParachainId = dest.V1.interior.X1.Parachain.toString();
      transfer.toAddress =
        beneficiary.V1.interior.X1.AccountKey20.key.toString();
      transfer.assetId = assets.V0[0].ConcreteFungible.id.toString();
      transfer.amount = assets.V0[0].ConcreteFungible.amount.toString();
      transfer.feeAsset = feeAsset.toString();
      transfer.feeLimit = weightLimit.Limited.toString();
    }
  });

  // play with balance deposite/withdraw balances.Withdraw
  const allBlockEvents = await apiAt.query.system.events();
  const depositEvents = allBlockEvents.filter(
    (el) => el.event.section == "balances" && el.event.method == "Withdraw"
  );
  depositEvents.forEach(({ event }) => {
    if (event.toHuman().data.amount === transfer.amount) {
      console.log(event.data.amount.toHuman());
      // console.log(u8aToHex(decodeAddress(ev.toHuman().event.data.who)));
      transfer.fromAddress = u8aToHex(event.data.who);
    }
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

          const notEmptyUpwardMessages =
            candidate.candidate.commitments.upwardMessages.filter(
              (message) => message.length > 0
            );
          notEmptyUpwardMessages.forEach((message) => {
            // console.log(message.toU8a());
            const messageHash = blake2AsHex(Uint8Array.from(message));
            if (messageHash == transfer.xcmpMessageHash) {
              transfer.fromParachainId = fromParaId;
              const instructionsHuman = intrustionsFromXcmU8Array(
                message,
                apiAt
              );

              // calculate "custom" UMP hash, since parachain side
              // doesn't knows the "real" XCMP hash
              let hashStr = "";
              instructionsHuman.forEach((inst) => {
                if (Object.keys(inst) == "WithdrawAsset")
                  hashStr += inst.WithdrawAsset[0].fun.Fungible;
                if (Object.keys(inst) == "DepositAsset")
                  hashStr += JSON.stringify(
                    inst.DepositAsset.beneficiary.interior,
                    undefined
                  );
              });
              const customUpmHash = blake2AsHex(Uint8Array.from(hashStr));
              transfer.xcmpMessageHash = customUpmHash;

              if (typeof instructionsHuman == "string") {
                transfer.warnings += instructionsHuman;
              } else {
                // safe all instruction as array of JSON objects, if things
                // don't parce correctly, the user still can check the original
                // instructions
                transfer.xcmpInstructions = instructionsHuman.map(
                  (instruction) => JSON.stringify(instruction, undefined)
                );
                parceXcmpInstrustions(instructionsHuman, transfer);
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

//registry
[
  ({
    prefix: 0,
    network: "polkadot",
    displayName: "Polkadot Relay Chain",
    symbols: ["DOT"],
    decimals: [10],
    standardAccount: "*25519",
    website: "https://polkadot.network",
  },
  {
    prefix: 2,
    network: "kusama",
    displayName: "Kusama Relay Chain",
    symbols: ["KSM"],
    decimals: [12],
    standardAccount: "*25519",
    website: "https://kusama.network",
  },
  {
    prefix: 8,
    network: "karura",
    displayName: "Karura",
    symbols: ["KAR"],
    decimals: [12],
    standardAccount: "*25519",
    website: "https://karura.network/",
  },
  {
    prefix: 10041,
    network: "basilisk",
    displayName: "Basilisk",
    symbols: ["BSX"],
    decimals: [12],
    standardAccount: "*25519",
    website: "https://bsx.fi",
  },
  {
    prefix: 1285,
    network: "moonriver",
    displayName: "Moonriver",
    symbols: ["MOVR"],
    decimals: [18],
    standardAccount: "secp256k1",
    website: "https://moonbeam.network",
  }),
];
