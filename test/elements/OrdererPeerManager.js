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
        for(let channel of channels){
            await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.name}.yaml run --rm -e FABRIC_CFG_PATH=/etc/hyperledger/artifacts "cli.${this.orgDomain}" configtxgen -profile "${channel}" -outputCreateChannelTx "./channel/${channel}.tx" -channelID "${channel}"'`);
            await this._changeOwnership();
        }
    }

    async generateGenesis(){
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.name}.yaml run --rm -e FABRIC_CFG_PATH=/etc/hyperledger/artifacts "cli.${this.orgDomain}" configtxgen -profile OrdererGenesis -outputBlock ./channel/genesis.block'`);
        await this._changeOwnership();
    }

    async _changeOwnership(){
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.name}.yaml run --rm "cli.${this.orgDomain}" bash -c "chown -R $UID:$GID ."'`);  //TODO Check that this change is working at the correct level
    }

}

module.exports = OrdererPeerManager;