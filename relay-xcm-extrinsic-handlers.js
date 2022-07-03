const { ApiPromise, WsProvider } = require("@polkadot/api");

const rpcProvider = "wss://kusama-rpc.polkadot.io/";
const blockNumber = 12034878;

(async () => {
  // Connect to a node (this is ak public one)
  const provider = new WsProvider(rpcProvider);
  const api = await ApiPromise.create({ provider });

  // Make a call to the chain and get its name.
  const chain = await api.rpc.system.chain();
  // Print out the chain to which we connected.
  console.log(`You are connected to ${chain} !`);

  // Get block hash
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  // Get block by hash
  const signedBlock = await api.rpc.chain.getBlock(blockHash);

  // Get a decorated api instance at a specific block
  const apiAt = await api.at(signedBlock.block.header.hash);

  const allBlockEvents = await apiAt.query.system.events();
  const allBlockExtrinsics = signedBlock.block.extrinsics;

  // const paraInherentExtrinsic = allBlockExtrinsics
  //   .toHuman()
  //   .filter(
  //     ({ ext }) =>
  //       ext.method.section == "paraInherent" && ext.method.mehtod == "enter"
  //   );
  // console.log(allBlockExtrinsics.toHuman()[1].method.section);

  console.log(api.consts.multisig.depositBase.toHuman());

  process.exit();
})();
