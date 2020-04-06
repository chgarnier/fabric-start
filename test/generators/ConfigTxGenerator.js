const fs = require('fs');

class ConfigTxGenerator {

    constructor(organizationManager){
        this.organizationManager = organizationManager;
    }

    async generate(){  //TODO We still need to generate the configtx of the Orderer
        let config = {
            "Organizations": [
                {
                    "Name": `${this.organizationManager.name}MSP`,
                    "ID": `${this.organizationManager.name}MSP`,
                    "MSPDir": `crypto-config/peerOrganizations/${$this.organizationManager.name}.${this.organizationManager.domainName}/msp`,
                    "AnchorPeers": [
                        {
                            "Host": await this.organizationManager.getMainPeer(),
                            "Port": 7051
                        }
                    ]
                }
            ]
        }
        fs.writeFileSync(`${this.organizationManager.rootDirectory}/building/artifacts/configtx.yaml`, config);
    }

    // async getOrganizationsBlock(){  //TODO It is needed to retrieve all orgs certificates beforehand. But how was it achieved in the first version of fabric-start ?
    //     let block = [];
    //     for(let org of this.mainOrganizationManager.otherOrgs){
    //         block.push({
    //             Name: `${org.name}MSP`,
    //             ID: `${org.name}MSP`,
    //             MSPDir: org.isOrderer?`crypto-config/ordererOrganizations/${org.domain}/msp`:`crypto-config/peerOrganizations/${org.name}.${org.domainName}/msp`,
    //             AnchorPeers: [{
    //                 Host: org.mainPeerName,
    //                 Port: 7051  // TODO State in some document that the peers need to be opened on 7051
    //             }]
    //         });
    //     }
    //     return block;
    // }

    // async getOrdererBlock(){
    //     let block = {
    //         "OrdererType": "solo",
    //         "Addresses": [
    //             `orderer.${this.otherOrgs.fiter(o => o.name=="orderer")[0].domainName}:7050`
    //         ],
    //         "BatchTimeout": "2s",
    //         "BatchSize": {
    //             "MaxMessageCount": 10,
    //             "AbsoluteMaxBytes": "98 MB",
    //             "PreferredMaxBytes": "512 KB"
    //         },
    //         "Kafka": {
    //             "Brokers": [
    //                 "127.0.0.1:9092"
    //             ]
    //         },
    //         "Organizations": null
    //     }
    //     return block;
    // }

}

module.exports = ConfigTxGenerator;
