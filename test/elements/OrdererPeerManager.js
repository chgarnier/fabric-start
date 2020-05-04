const PeerManager = require("./PeerManager");

class OrdererPeerManager extends PeerManager {

    async generate(){
        console.log(`==> ${this.name} generating...`);
        await this.ssh(`'\
        cd ~/fabric-start/building \
        && ./network.sh -m generate-orderer\
        '`)
        console.log(`==> ${this.name} generating... done`);
    }

    async generateChannelConfigTransaction(channels){
        await this.ssh(`'rm -rf ~/fabric-start/building/artifacts/channel && mkdir ~/fabric-start/building/artifacts/channel'`);
        for(let channel of channels){
            await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.orgName}-${this.name}.yaml run --rm -e FABRIC_CFG_PATH=/etc/hyperledger/artifacts "cli.${this.orgDomain}" configtxgen -profile "${channel}" -outputCreateChannelTx "./channel/${channel}.tx" -channelID "${channel}"'`);
            await this._changeOwnership();
        }
    }

    async generateGenesis(){
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.orgName}-${this.name}.yaml run --rm -e FABRIC_CFG_PATH=/etc/hyperledger/artifacts "cli.${this.orgDomain}" configtxgen -profile OrdererGenesis -outputBlock ./channel/genesis.block'`);
        await this._changeOwnership();
    }

    async up(){
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.orgName}-${this.name}.yaml up -d'`);

        await this._copyFilesToWww(`~/fabric-start/building/artifacts/crypto-config/ordererOrganizations/${this.orgDomain}/orderers/${this.orgName}.${this.orgDomain}/tls"`, `ca.crt`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts/crypto-config/ordererOrganizations/${this.orgDomain}/orderers/${this.orgName}.${this.orgDomain}/msp/tlscacerts`, `tlsca.${this.orgDomain}-cert.pem`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts/channel`, `*.tx`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts`, `network-config.json`);

        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.orgName}-${this.name}.yaml up -d www.${this.orgDomain}'`);  // Legacy stuff in serveOrdererArtifacts, don't know if it is usefull as we are already upping the stack a few lines above

        await new Promise((resolve) => setTimeout(resolve, 60000));  // Wait for a minute  //TODO Find a better way to wait until the services are ready
    }

    async _changeOwnership(){
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.orgName}-${this.name}.yaml run --rm "cli.${this.orgDomain}" bash -c "chown -R $UID:$(id -g) ."'`);  //TODO Check that this change is working at the correct level
    }

}

module.exports = OrdererPeerManager;