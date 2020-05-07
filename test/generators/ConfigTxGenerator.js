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
                `${this.organizationManager.otherOrgs.find(e => e.isOrderer).ip}:7050`
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
            MSPDir: org.isOrderer?`crypto-config/ordererOrganizations/${org.name}/msp`:`crypto-config/peerOrganizations/${org.name}/msp`,
            AnchorPeers: [{
                Host: org.ip,
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
                        ...{Organizations: [this.getOrganizationBlock(this.organizationManager.otherOrgs.find(e => e.isOrderer))]}
                    },
                    Consortiums: {
                        SampleConsortium: {
                            Organizations: this.organizationManager.otherOrgs.filter(e => !e.isOrderer).map(org => this.getOrganizationBlock(org))
                        }
                    }
                },
                common: {
                    Consortium: "SampleConsortium",
                    Application: {
                        ...this.getApplicationDefaultsBlock(),
                        ...{Organizations: this.organizationManager.otherOrgs.filter(e => !e.isOrderer).map(org => this.getOrganizationBlock(org))}}
                }
            },
            ...this.organizationManager.channels.reduce((acc, channel) => ({...acc,
                [`${channel.name}`]: {
                    Consortium: "SampleConsortium",
                    Application: {
                        Organizations: channel.organizations.map(o => this.getOrganizationBlock(this.organizationManager.otherOrgs.find(oO => oO.name==o.name)))
                    }
                }
            }), {})
        }
        return block;
    }
}

module.exports = ConfigTxGenerator;
