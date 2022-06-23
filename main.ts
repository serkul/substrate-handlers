import fs from 'fs';

import { ApiPromise, WsProvider } from '@polkadot/api';

// const rpcProvider = 'wss://rpc.polkadot.io';
// blockNumber = 1000;
// const rpcProvider = 'wss://karura.api.onfinality.io/public-ws';
// const blockNumber = 1702399;
// const rpcProvider = 'wss://kusama-rpc.polkadot.io/';
const rpcProvider = 'wss://moonriver.api.onfinality.io/public-ws';
const blockNumber = 1652961; //1655170; 

// We must wrap everything up in an async block
(async () => {

    // Connect to a node (this is a public one)
    const provider = new WsProvider(rpcProvider);
    const api = await ApiPromise.create({ provider })

    // Make a call to the chain and get its name.
    const chain = await api.rpc.system.chain();
    // Print out the chain to which we connected.
    console.log(`You are connected to ${chain} !`);
    // console.log(`!!! RUNTIME METADATA !!!
    //     ${typeof(api.runtimeMetadata)}`);
    // fs.writeFileSync('./runtime-metadata.json', JSON.stringify(api.runtimeMetadata, null, 2) , 'utf-8');
    // console.log(`!!! RUNTIME VERSION
    //     ${api.runtimeVersion}`);
        

    // Get block hash
    const blockHash = (await api.rpc.chain.getBlockHash(blockNumber));
    // Get block by hash
    const signedBlock = (await api.rpc.chain.getBlock(blockHash));
    // signedBlock.block.extrinsics.forEach((ex, index) => {
    //     // console.log(index, ex.method._meta['name']);
    //     
    // });
    // Queries at specific hash
    // Get a decorated api instance at a specific block
    // const now = await apiAt.query.timestamp.now();
    // console.log(now.toHuman());
    const apiAt = await api.at(signedBlock.block.header.hash);
    const allRecords = await apiAt.query.system.events();
    // map between the extrinsics and events
    signedBlock.block.extrinsics.forEach(({isSigned, meta, method: { method, section } }, index) => {
    // filter the specific events based on the phase and then the
    // index of our extrinsic in the block
    const events = allRecords
        .filter(({ phase }) =>
        phase.isApplyExtrinsic &&
        phase.asApplyExtrinsic.eq(index)
        );
        // .filter(event => event.section.eq('xcmpQueue'));
        // .map(({ event }) => `${event.section}.${event.method}`);
        events.map(({ event }) => console.log(event.section.eq('xcmpQueue')));
        // const xcmEvents = events.find(event => );

    // console.log(`${section}.${method}:: ${events.join(', ') || 'no events'}`);
    }); 
    // console.log(api.query);
    // console.log(api.query.system.allExtrinsicsLen);

    // const rpcMethodsList = await api.rpc.rpc.methods();
    // console.log(rpcMethodsList);

    // Exit the process.
    process.exit()
})()
