fs = require("fs");

const { ApiPromise, WsProvider } = require("@polkadot/api");

// const rpcProvider = 'wss://rpc.polkadot.io';
// blockNumber = 1000;
// const rpcProvider = "wss://karura.api.onfinality.io/public-ws";
// const blockNumber = 1702399;
// const rpcProvider = 'wss://kusama-rpc.polkadot.io/';
const rpcProvider = "wss://moonriver.api.onfinality.io/public-ws";
const blockNumber = 1652961; //1655170;

// We must wrap everything up in an async block
(async () => {
  // Connect to a node (this is a public one)
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
  const allRecords = await apiAt.query.system.events();

  // map between the extrinsics and events
  const xcmExtrinsicsWithEvents = [];
  signedBlock.block.extrinsics.forEach(
    ({ isSigned, meta, method: { method, section } }, index) => {
      // filter the specific events based on the phase and then the
      // index of our extrinsic in the block
      const events = allRecords.filter(
        ({ phase }) =>
          phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index)
      ); //.map(({ event }) => `${event.section}.${event.method}`);
      // Chose extrinsics with one of the events wich is 'xcmpQueue'
      // (possibly that 'xcmpQueue' is not most universal way to filter xcm transfers)
      // and store this extrinsic with all its events in the array
      events.forEach(({ event }) => {
        if (event.section == "xcmpQueue") {
          xcmExtrinsicsWithEvents.push({
            extrinsic: `${section}.${method}`,
            events: events,
          });
        }
      });

      // console.log(`${section}.${method}:: ${events.join(', ') || 'no events'}`);
    }
  );
  console.log(
    xcmExtrinsicsWithEvents[0].extrinsic,
    xcmExtrinsicsWithEvents[0].events.map(
      ({ event }) => `${event.section}.${event.method}`
    )
  );
  xcmExtrinsicsWithEvents[0].events.forEach(({ event }) => {
    if (event.section == "xTokens" && event.method == "Transferred") {
      const types = event.typeDef;
      event.data.forEach((data, index) => {
        console.log(`\t\t\t${types[index].type}: ${data.toString()}`);
      });
    }
  });

  // console.log(api.query);
  // console.log(api.query.system.allExtrinsicsLen);

  // const rpcMethodsList = await api.rpc.rpc.methods();
  // console.log(rpcMethodsList);

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
