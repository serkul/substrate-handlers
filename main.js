fs = require("fs");

const { ApiPromise, WsProvider } = require("@polkadot/api");
const { blake2AsU8a } = require("@polkadot/util-crypto");
const { u8aToHex } = require("@polkadot/util");

// const rpcProvider = 'wss://rpc.polkadot.io';
// blockNumber = 1000;
const rpcProvider = "wss://karura.api.onfinality.io/public-ws";
const blockNumber = 1702399;
// const rpcProvider = 'wss://kusama-rpc.polkadot.io/';
// const rpcProvider = "wss://moonriver.api.onfinality.io/public-ws";
// const rpcProvider = "wss://moonriver.public.blastapi.io";
// const blockNumber = 1655170;

const chainIDs = {
  Karura: "2000",
};
// We must wrap everything up in an async block
(async () => {
  // Connect to a node (this is ak public one)
  const provider = new WsProvider(rpcProvider);
  const api = await ApiPromise.create({ provider });

  // Make a call to the chain and get its name.
  const chain = await api.rpc.system.chain();
  // Print out the chain to which we connected.
  console.log(`You are connected to ${chain} !`);
  //   //Store chain methadata and its version in a file
  //   logChainMethadata(api);

  // Get block hash
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  // Get block by hash
  const signedBlock = await api.rpc.chain.getBlock(blockHash);

  // Queries at specific hash
  // Get a decorated api instance at a specific block
  // const now = await apiAt.query.timestamp.now();
  // console.log(now.toHuman());
  const apiAt = await api.at(signedBlock.block.header.hash);

  const allBlockEvents = await apiAt.query.system.events();
  const allBlockExtrinsics = signedBlock.block.extrinsics;

  console.log();

  transfer = {
    // id: ID! #id is a required field
    blockNumber: "",
    timestamp: "",
    fromAddress: "",
    fromParachainId: "",
    toAddress: "",
    toParachainId: "",
    currencyId: "",
    amount: "",
    xcmpMessageStatus: "", //change to union for threes statuses: sent, received, notfound
    xcmpMessageHash: "",
    warnings: "",
  };

  const xcmpExtrinsicsWithEvents = mapXcmpEventsToExtrinsics(
    allBlockExtrinsics,
    allBlockEvents
  );
  if (xcmpExtrinsicsWithEvents.length < 1) {
    transfer.warnings += " - no xcmpQueue.<events> are found";
  } else if (xcmpExtrinsicsWithEvents.length > 2) {
    transfer.warnings += " - more than one xcmpQueue.<events> are found";
  } else {
    transfer.xcmpMessageStatus = xcmpExtrinsicsWithEvents[0].status;
    transfer.xcmpMessageHash = xcmpExtrinsicsWithEvents[0].hash;
  }

  switch (xcmpExtrinsicsWithEvents[0].status) {
    case "received":
      await decodeInboundXcmp(xcmpExtrinsicsWithEvents[0], apiAt, transfer);
      break;
    case "sent":
      await decodeOutboundXcmp(
        xcmpExtrinsicsWithEvents[0],
        apiAt,
        chainIDs,
        transfer
      );
      break;
  }
  console.log(transfer);

  // console.log(
  //   xcmpExtrinsicsWithEvents[0].events.map(
  //     ({ event }) => `${event.section}.${event.method}`
  //   )
  // );
  // xcmExtrinsicsWithEvents[0].events.forEach(({ event }) => {
  //   if (event.section == "xTokens" && event.method == "Transferred") {
  //     const types = event.typeDef;
  //     event.data.forEach((data, index) => {
  //       console.log(`\t\t\t${types[index].type}: ${data.toString()}`);
  //     });
  //   }
  // });
  // const xcmpMessageSent = [];
  // xcmExtrinsicsWithEvents[0].events.forEach(({ event }) => {
  //   if (event.section == "xcmpQueue" && event.method == "XcmpMessageSent") {
  //     const types = event.typeDef;
  //     event.data.forEach((data, index) => {
  //       xcmpMessageSent.push({
  //         type: types[index].type,
  //         data: data.toString(),
  //       });
  //     });
  //   }
  // });

  // Exit the process.
  process.exit();
})();

function logChainMethadata(api) {
  const runtimeVersion = api.runtimeVersion;
  const runtimeMetadata = api.runtimeMetadata;
  const logFile =
    "runtime-metadata-" +
    runtimeVersion.implName.toString() +
    "-" +
    runtimeVersion.authoringVersion.toString() +
    "-" +
    runtimeVersion.specVersion.toString() +
    "-" +
    runtimeVersion.implVersion.toString() +
    ".json";
  console.log(`logging RUNTIME VERSION and RUNTIME METADATA
    to file ${logFile}`);
  fs.writeFileSync(logFile, JSON.stringify(runtimeVersion, null, 2), "utf-8");
  fs.appendFileSync(logFile, JSON.stringify(runtimeMetadata, null, 2), "utf-8");
}

function mapXcmpEventsToExtrinsics(allBlockExtrinsics, allBlockEvents) {
  // Function takes all extrinsics and events in a block
  // searches for events with "xcmpQueue" section (seems to be the most universal way to filter for xcmp events),
  // puts corresponding extrinsic and all its events in an object,
  // together with xcmp message hash and status (received, sent and unknown).
  // This object is pushed in an array.This array is returned by the function, array contains
  // as many elements as many xcmpQueue.events are found in a block

  const xcmpExtrinsicsWithEvents = [];
  let xcmpStatus = "unknown";
  let xcmpHash = "unknown";
  allBlockExtrinsics.forEach((extrinsic, index) => {
    // filter the specific events based on the phase and then the
    // index of our extrinsic in the block
    const events = allBlockEvents.filter(
      ({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index)
    );
    events.forEach(({ event }) => {
      if (event.section == "xcmpQueue") {
        if (event.method == "XcmpMessageSent") {
          xcmpStatus = "sent";
          xcmpHash = event.data[0].toString();
        } else if (event.method == "Success") {
          xcmpStatus = "received";
          xcmpHash = event.data[0].toString();
        }
        xcmpExtrinsicsWithEvents.push({
          extrinsic: extrinsic,
          events: events,
          status: xcmpStatus,
          hash: xcmpHash,
        });
      }
    });
  });
  return xcmpExtrinsicsWithEvents;
}

async function decodeOutboundXcmp(
  xcmpExtrinsicWithEvents,
  apiAt,
  chainIDs,
  transfer
) {
  transfer.fromParachainId = (
    await apiAt.query.parachainInfo.parachainId()
  ).toString();
  if (transfer.fromParachainId === chainIDs.Karura) {
    xcmpExtrinsicWithEvents.events.forEach(({ event }) => {
      if (
        event.section == "xTokens" &&
        event.method == "TransferredMultiAssets"
      ) {
        const [account, otherReserve, amount, extra] = event.data.toJSON(); //ts as any
        // console.log(extra.interior.x2[1].accountKey20.key);
        transfer.amount = amount.fun.fungible;
        transfer.toAddress = extra.interior.x2[1].accountKey20.key;
        transfer.fromAddress = account;
        transfer.toParachainId = extra.interior.x2[0].parachain.toString();
        transfer.currencyId = {
          parachaiId: amount.id.concrete.interior.x2[0].parachain,
          assetId: amount.id.concrete.interior.x2[1].generalKey,
        };
      }
    });
  }
}
async function decodeInboundXcmp(xcmpExtrinsicWithEvents, apiAt, transfer) {
  transfer.toParachainId = (
    await apiAt.query.parachainInfo.parachainId()
  ).toString();
  xcmpExtrinsicWithEvents.extrinsic.method.args[0].horizontalMessages.forEach(
    (paraMessage, paraId) => {
      if (paraMessage.length >= 1) {
        paraMessage.forEach((message) => {
          const messageHash = u8aToHex(blake2AsU8a(message.data.slice(1)));
          if (messageHash == transfer.xcmpMessageHash) {
            transfer.fromParachainId = paraId.toString();
            // let instructions = api.createType(
            let instructions = apiAt.registry.createType(
              "XcmVersionedXcm",
              message.data.slice(1)
            ); //ts as any
            // choose appropriate xcm version
            let asVersion = "not found";
            for (const versionNum of ["0", "1", "2"]) {
              if (instructions["isV" + versionNum]) {
                asVersion = "asV" + versionNum;
              }
            }
            if (asVersion === "not found") {
              transfer.warnings += " - xcmp version not found";
            }
            instructions[asVersion].forEach((instruction) => {
              if (instruction.isReserveAssetDeposited) {
                transfer.amount =
                  instruction.toHuman().ReserveAssetDeposited[0].fun.Fungible;
                transfer.currencyId = {
                  parachainId:
                    instruction.toHuman().ReserveAssetDeposited[0].id.Concrete
                      .interior.X2[0].Parachain,
                  assetId:
                    instruction.toHuman().ReserveAssetDeposited[0].id.Concrete
                      .interior.X2[1].GeneralKey,
                };
              }
              // if (instruction.isBuyExecution) { //contains weight limit and asset ID
              //   console.log(
              //     instruction.toHuman().BuyExecution.fees.id.Concrete.interior.X2
              //   );
              // }
              if (instruction.isDepositAsset) {
                transfer.toAddress =
                  instruction.toHuman().DepositAsset.beneficiary.interior.X1.AccountKey20.key;
              }
            });
          }
        });
      }
    }
  );
}
