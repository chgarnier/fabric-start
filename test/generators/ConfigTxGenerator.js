const fs = require('fs').promises;
yaml = require('js-yaml');
var assert = require("assert");

class ConfigTxGenerator {

    constructor(organizationManager){
        this.organizationManager = organizationManager;
    }

    async generate(){  //TODO We still need to generate the configtx of the Orderer
        let config = this.organizationManager.isMain?await this.getMainConfig():await this.getSecondaryConfig();
        let yamlData = yaml.safeDump(config);
        let filepath = `${this.organizationManager.rootDirectory}/building/artifacts/configtx.yaml`;
        await fs.writeFile(filepath, yamlData);
    }

    async getMainConfig(){
        return {
            "Organizations": this.organizationManager.otherOrgs.map(org => this.getOrganizationBlock(org)),
            "Orderer": await this.getOrdererDefaultsBlock(),
            "Application": this.getApplicationDefaultsBlock(),
            "Profiles": await this.getProfilesBlock()
        }
    }

    async getSecondaryConfig(){
        return {
            "Organizations": [
                this.getOrganizationBlock(this.organizationManager)  // Either the organizationManager or this org otherOrg because they share the same attributes
                //TODO But maybe that otherOrgs should just be a superClass, with less details, of the organizationManager class
            ]
        }
    }

    async getOrdererDefaultsBlock(){  //TODO Should not be async if it is not usefull.
        //TODO And should be private
        return {
            "OrdererType": "solo",
            "Addresses": [
                `orderer.${this.organizationManager.otherOrgs.filter(e => e.name=="orderer")[0].domainName}:7050`
            ],
            "BatchTimeout": "2s",
            "BatchSize": {
                "MaxMessageCount": 10,
                "AbsoluteMaxBytes": "98 MB",
                "PreferredMaxBytes": "512 KB"
            },
            "Kafka": {
                "Brokers": [
                    "127.0.0.1:9092"
                ]
            },
            "Organizations": null
        }
    }

    getOrganizationBlock(org){  //TODO It is needed to retrieve all orgs certificates beforehand. But how was it achieved in the first version of fabric-start ?
        return {
            Name: `${org.name}MSP`,
            ID: `${org.name}MSP`,
            MSPDir: org.isOrderer?`crypto-config/ordererOrganizations/${org.domainName}/msp`:`crypto-config/peerOrganizations/${org.name}.${org.domainName}/msp`,
            AnchorPeers: [{
                Host: org.mainPeerName,
                Port: 7051  // TODO State in some document that the peers need to be opened on 7051
            }]
        };
    }

    getApplicationDefaultsBlock(){
        return {
            "Organizations": null
        }
    }

    async getProfilesBlock(){
        let block = {
            ... {
                OrdererGenesis: {
                    Orderer: {
                        ...await this.getOrdererDefaultsBlock(),
                        ...{Organizations: [this.getOrganizationBlock(this.organizationManager.otherOrgs.filter(e => e.name=="orderer")[0])]}
                    },
                    Consortiums: {
                        SampleConsortium: {
                            Organizations: this.organizationManager.otherOrgs.filter(e => e.name!="orderer").map(org => this.getOrganizationBlock(org))
                        }
                    }
                },
                common: {
                    Consortium: "SampleConsortium",
                    Application: {
                        ...this.getApplicationDefaultsBlock(),
                        ...{Organizations: this.organizationManager.otherOrgs.filter(e => e.name!="orderer").map(org => this.getOrganizationBlock(org))}}
                }
            },
            ...pairArray(this.organizationManager.otherOrgs.filter(e => e.name!="orderer")).reduce((acc, orgs) => ({...acc,
                [`${orgs[0].name}-${orgs[1].name}`]: {
                    Consortium: "SampleConsortium",
                    Application: {
                        Organizations: [
                            this.getOrganizationBlock(orgs[0]),
                            this.getOrganizationBlock(orgs[1])
                        ]
                    }
                }
            }), {})
        }
        return block;
    }
}

module.exports = ConfigTxGenerator;

/**
 * 
 * @param {*} arr e.g. [1, 2, 3]
 * @returns All pairs, e.g. [ [ 1, 2 ], [ 1, 3 ], [ 2, 3 ] ] 
 */
function pairArray(arr){
    let unflattenedPairs = arr.map(a => {
        return arr.filter(b => b != a).map(b => [a, b]);
    })
    let flattenedPairs = [].concat(...unflattenedPairs);
    let uniquePairs = flattenedPairs.filter(p => p[0].name<p[1].name);  // Remove duplicates
    return uniquePairs;
}