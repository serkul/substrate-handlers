fs = require("fs");

const { ApiPromise, WsProvider } = require("@polkadot/api");
const { blake2AsU8a, blake2AsHex } = require("@polkadot/util-crypto");
const { u8aToHex, stringToU8a, stringToHex } = require("@polkadot/util");
const { type } = require("os");

// const rpcProvider = "wss://rpc.polkadot.io";
// blockNumber = 1000;
// const rpcProvider = "wss://karura.api.onfinality.io/public-ws";
// const blockNumber = 1702399; //outbound
// 1702412; //inbound
// const rpcProvider = "wss://kusama-rpc.polkadot.io/";
// const blockNumber = 12034825;
// const rpcProvider = "wss://moonriver.api.onfinality.io/public-ws";
const rpcProvider = "wss://moonriver.public.blastapi.io";
const blockNumber = //1655240;
  // 1652961; // (outbound)
  1655170; //(inbound)
// const rpcProvider = "wss://basilisk.api.onfinality.io/public-ws";
// const blockNumber = 1400000;

const chainIDs = {
  Karura: "2000",
  Moonriver: "2023",
};
// We must wrap everything up in an async block
async function main() {
  // Connect to a node (this is ak public one)
  const provider = new WsProvider(rpcProvider);
  const api = await ApiPromise.create({ provider });

  // Make a call to the chain and get its name.
  const chain = await api.rpc.system.chain();
  // Print out the chain to which we connected.
  console.log(`You are connected to ${chain} !`);
  //   //Store chain methadata and its version in a file
  // logChainMethadata(api);

  // Get block hash
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  // Get block by hash
  const signedBlock = await api.rpc.chain.getBlock(blockHash);

  // Get a decorated api instance at a specific block
  const apiAt = await api.at(signedBlock.block.header.hash);

  const allBlockEvents = await apiAt.query.system.events();
  const allBlockExtrinsics = signedBlock.block.extrinsics;

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
  }

  // console.log(await api.registry.getChainProperties());
  // console.log(api.registry.chainDecimals);
  // console.log(api.registry.chainSS58);
  // console.log(api.registry.chainTokens);
  // console.log(api.call.parachainHost.dmqContents);

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
}

main()
  .catch(console.error)
  .finally(() => process.exit());

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
  switch (transfer.fromParachainId) {
    case chainIDs.Karura:
      xcmpExtrinsicWithEvents.events.forEach(({ event }) => {
        if (
          event.section == "xTokens" &&
          event.method == "TransferredMultiAssets"
        ) {
          const [account, otherReserve, amount, extra] = event.data.toJSON(); //ts as any
          // console.log(extra.interior.x2[1].accountKey20.key);
          transfer.amount = amount.fun.fungible.toString();
          transfer.toAddress = extra.interior.x2[1].accountKey20.key;
          transfer.fromAddress = account;
          transfer.toParachainId = extra.interior.x2[0].parachain.toString();
          transfer.assetParachainId =
            amount.id.concrete.interior.x2[0].parachain.toString();
          transfer.assetId = amount.id.concrete.interior.x2[1].generalKey;
        }
      });
      break;
    case chainIDs.Moonriver:
      xcmpExtrinsicWithEvents.events.forEach(({ event }) => {
        if (event.section == "xTokens" && event.method == "Transferred") {
          const [account, otherReserve, amount, extra] = event.data.toJSON(); //ts as any
          transfer.amount = amount.toString();
          transfer.toAddress = extra.interior.x2[1].accountId32.id;
          transfer.fromAddress = account;
          transfer.toParachainId = extra.interior.x2[0].parachain;
          transfer.assetParachainId = "NA";
          // console.log(otherReserve.selfReserve.toString());
          if (otherReserve.otherReserve) {
            transfer.assetId = otherReserve.otherReserve.toString();
          } else {
            transfer.assetId = "null";
          }
        }
      });
      break;
    default:
      transfer.warnings +=
        " - decodeOutboundXcmp format is not known for parachain: " +
        transfer.fromParachainId;
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
          // const messageHash = u8aToHex(
          //   blake2AsU8a(message.data.slice(1))
          // );
          const messageHash = blake2AsHex(
            Uint8Array.from(message.data).slice(1)
          );
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
              switch (transfer.toParachainId) {
                case chainIDs.Moonriver:
                  if (instruction.isReserveAssetDeposited) {
                    console.log(
                      JSON.stringify(
                        instruction.toHuman().ReserveAssetDeposited,
                        undefined,
                        2
                      )
                    );
                    transfer.amount = instruction
                      .toHuman()
                      .ReserveAssetDeposited[0].fun.Fungible.toString();
                    transfer.assetParachainId = instruction
                      .toHuman()
                      .ReserveAssetDeposited[0].id.Concrete.interior.X2[0].Parachain.toString();
                    transfer.assetId =
                      instruction.toHuman().ReserveAssetDeposited[0].id.Concrete.interior.X2[1].GeneralKey;
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
                  break;
                case chainIDs.Karura:
                  // console.log(instruction.toHuman());
                  if (instruction.isWithdrawAsset) {
                    transfer.amount = instruction
                      .toHuman()
                      .WithdrawAsset[0].fun.Fungible.toString();
                    transfer.assetParachainId = "NA";
                    transfer.assetId =
                      instruction.toHuman().WithdrawAsset[0].id.Concrete.interior.X1.GeneralKey;
                  }
                  // // if (instruction.isBuyExecution) { //contains weight limit and asset ID
                  // // }
                  if (instruction.isDepositAsset) {
                    transfer.toAddress =
                      instruction.toHuman().DepositAsset.beneficiary.interior.X1.AccountId32.id;
                  }

                  break;
                default:
                  transfer.warnings +=
                    " - decodeInboundXcmp format is not known for parachain: " +
                    transfer.fromParachainId;
              }
            });
          }
        });
      }
    }
  );
}
