const fs = require('fs-extra');
yaml = require('js-yaml');

class CryptoconfigGenerator {

    constructor(organizationManager){
        this.organizationManager = organizationManager;
    }

    async generate(){
        //TODO Générer les fichiers (un cryptogen pour l'orga, un docker-composer par peer de l'orga) et ensuite il faudra les distribuer aux différentes peers.
        let cryptoconfig = {
            PeerOrgs: [{
                Name: this.organizationManager.name,
                Domain: this.organizationManager.domainName,
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
        console.log(`Writing cryptogen file for ${this.organizationManager.name} ...`);
        await fs.writeFile(`${this.organizationManager.rootDirectory}/building/artifacts/cryptogen-${this.organizationManager.name}.yaml`, yaml.safeDump(cryptoconfig));
        console.log(`Writing cryptogen file for ${this.organizationManager.name} ... done`);
    }

}

module.exports = CryptoconfigGenerator;