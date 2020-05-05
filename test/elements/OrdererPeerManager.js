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
            await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.org.name}-${this.name}.yaml run --rm -e FABRIC_CFG_PATH=/etc/hyperledger/artifacts "cli.${this.org.domainName}" configtxgen -profile "${channel.name}" -outputCreateChannelTx "./channel/${channel.name}.tx" -channelID "${channel.name}"'`);
            await this._changeOwnership();
        }
    }

    async generateGenesis(){
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.org.name}-${this.name}.yaml run --rm -e FABRIC_CFG_PATH=/etc/hyperledger/artifacts "cli.${this.org.domainName}" configtxgen -profile OrdererGenesis -outputBlock ./channel/genesis.block'`);
        await this._changeOwnership();
    }

    async up(){
        let dockerComposeFilepath = `~/fabric-start/building/dockercompose/docker-compose-${this.org.name}-${this.name}.yaml`;
        await this.ssh(`'docker-compose --file ${dockerComposeFilepath} down'`);
        await this.ssh(`'docker-compose --file ${dockerComposeFilepath} up -d'`);

        await this._copyFilesToWww(`~/fabric-start/building/artifacts/crypto-config/ordererOrganizations/${this.org.domainName}/orderers/${this.org.name}.${this.org.domainName}/tls`, `ca.crt`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts/crypto-config/ordererOrganizations/${this.org.domainName}/orderers/${this.org.name}.${this.org.domainName}/msp/tlscacerts`, `tlsca.${this.org.domainName}-cert.pem`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts/channel`, `*.tx`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts`, `network-config.json`);

        await this.ssh(`'docker-compose --file ${dockerComposeFilepath} up -d www.${this.org.name}.${this.org.domainName}'`);  // Legacy stuff in serveOrdererArtifacts, don't know if it is usefull as we are already upping the stack a few lines above

        console.log(`Waiting 60 seconds for ${this.name} to up...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));  // Wait for a minute  //TODO Find a better way to wait until the services are ready
        console.log(`Waiting 60 seconds for ${this.name} to up... done`);
    }

}

module.exports = OrdererPeerManager;