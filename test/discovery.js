const Client = require('fabric-client');

(async () => {
    const client = Client.loadFromConfig("./explorer/network.json");
    const channel = client.getChannel("addeo-aucoffre");
    await channel.initialize({discover:true, asLocalhost:true});
    // console.log(channel.getChannelPeers())
    // console.log(await channel.getDiscoveryResults());
    console.log(channel.getOrganizations());
    // console.log(channel.getPeers());
    // let peers = channel.getPeersForOrg("addeo")
    // for(let peer of peers){
    //     console.log(peer.getUrl());
    // }

})()