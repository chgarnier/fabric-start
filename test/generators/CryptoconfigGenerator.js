const fs = require('fs-extra');
yaml = require('js-yaml');

class CryptoconfigGenerator {

    constructor(organizationManager){
        this.organizationManager = organizationManager;
    }

    async generate(){
        //TODO Générer les fichiers (un cryptogen pour l'orga, un docker-composer par peer de l'orga) et ensuite il faudra les distribuer aux différentes peers.
        let cryptoconfig = this.organizationManager.isOrderer?await this.getOrdererConfig():await this.getPeerConfig();
        console.log(`Writing cryptogen file for ${this.organizationManager.name} ...`);
        await fs.writeFile(`${this.organizationManager.rootDirectory}/building/artifacts/cryptogen-${this.organizationManager.name}.yaml`, yaml.safeDump(cryptoconfig));
        console.log(`Writing cryptogen file for ${this.organizationManager.name} ... done`);
    }

    async getPeerConfig(){
        let block = {
            PeerOrgs: [{
                Name: this.organizationManager.name,
                Domain: `${this.organizationManager.name}`,
                CA: {
                    Hostname: "ca"
                },
                Template: {
                    Count: this.organizationManager.peers.length,
                    SANS: ["localhost"]
                },
                Users: {
                    Count: 1
                }
            }]
        }
        for(let peer of this.organizationManager.peers){
            block.PeerOrgs[0].Template.SANS.push(peer.ip);  //TODO Check that it shouldn't be ip of other orgs instead ?
        }
        return block;
    }

    async getOrdererConfig(){
        let block = {
            "OrdererOrgs": [
                {
                    "Name": this.organizationManager.name,  // Initially, it was "Orderer" with a capital O
                    "Domain": this.organizationManager.name,
                    // "Specs": [
                    //     {
                    //         "Hostname": this.organizationManager.name  // Initially, it was "orderer"
                    //     }
                    // ],
                    Template: {
                        Count: this.organizationManager.peers.length,
                        SANS: ["localhost"]
                    }
                }
            ]
        }
        for(let org of this.organizationManager.otherOrgs){
            block["OrdererOrgs"][0]["Template"]["SANS"].push(org.ip);  //TODO We should add all ip of all peers of all orgs instead of only the main ip of the orgs
        }
        return block;
    }

}

module.exports = CryptoconfigGenerator;