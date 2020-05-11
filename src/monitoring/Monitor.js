const Client = require('fabric-client');
const TemplateGenerator = require("./explorer/TemplateGenerator");

class Monitor {
    
    static async run(){
        await TemplateGenerator.generateExplorerNetwork();

        const client = Client.loadFromConfig(`${process.cwd()}/test/monitoring/explorer/explorer-network.json`);
        const channel = client.getChannel("addeo-aucoffre");
        await channel.initialize({discover:true, asLocalhost:true});
        // console.log(channel.getChannelPeers())
        // console.log(await channel.getDiscoveryResults());
        console.log(channel.getOrganizations());
        console.log(await channel.queryInstantiatedChaincodes(null, true));
        // console.log(channel.getPeers());
        // let peers = channel.getPeersForOrg("addeo")
        // for(let peer of peers){
        //     console.log(peer.getUrl());
        // }
    }

}

module.exports = Monitor;