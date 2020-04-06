const PeerManager = require("./PeerManager");
const OrdererPeerManager = require("./OrdererPeerManager");
const Monitor = require("../monitoring/Monitor");
const CryptoconfigGenerator = require("../generators/CryptoconfigGenerator");
const DockercomposeGenerator = require("../generators/DockercomposeGenerator");
const CaserverconfigGenerator = require("../generators/CaserverconfigGenerator");
const ConfigTxGenerator = require("../generators/ConfigTxGenerator");
var assert = require("assert");
var util = require('util');
const exec = util.promisify(require('child_process').exec);
var fs = require("fs-extra");
const yaml = require("js-yaml");

class OrganizationManager {

    constructor(name, domainName, legacyId, rootDirectory, isOrderer, peersOptions){
        this.name = name;
        this.domainName = domainName;
        this.legacyId = legacyId;
        this.rootDirectory = rootDirectory;
        this.isOrderer = isOrderer;
        this.peers = [];
        for(let peerOptions of peersOptions){
            if(peerOptions.isOrderer){
                this.peers.push(new OrdererPeerManager(peerOptions.name, this.name, peerOptions.isMain, peerOptions.ec2Type));
            }
            else{
                this.peers.push(new PeerManager(peerOptions.name, this.name, peerOptions.isMain, peerOptions.ec2Type));
            }
        }
        this.ip = null;
        this.otherOrgs = []
    }

    async init(){
        let promises = [];
        for(let peer of this.peers){
            promises.push(peer.init());
        }
        await Promise.all(promises);
        this.ip = await this.getIp();
    }

    async pushEnvironnement(){
        let archivePath = `/tmp/fabric-start-${this.name}.tar.gz`;
        await exec(`tar -czf ${archivePath} -C ${this.rootDirectory} .`, {maxBuffer: Infinity});

        let promises = [];
        for(let peer of this.peers){
            promises.push(peer.pushEnvironnement(archivePath));
        }
        await Promise.all(promises);
    }

    async getIp(){
        let mainPeers = this.peers.filter(peer => peer.isMain);
        assert(mainPeers.length == 1);
        return mainPeers[0].ip;
    }

    async exportOthersOrgs(){  //TODO Chaque orga devrait pouvoir générer un object "sharable" aux autres orgas
        let promises = [];
        for(let peer of this.peers){
            promises.push(peer.exportOthersOrgs(this.otherOrgs));
        }
        await Promise.all(promises);
    }

    async getMainPeer(){
        return this.peers.filter(p => p.isMain)[0];
    }

    async _generate(){  //TODO Impossible de faire avec ça, parce que en fait il faut splitter le generate-peer qui est fait sur chaque peer
        // Generating crypto material with cryptogen"
        await CryptoconfigGenerator(this).generate();
        let uid = await exec("echo $UID");
        let gid = await exec("echo $GID");
        await exec(`\
            docker run --rm -v ${this.rootDirectory/artifacts}:/etc/hyperledger/artifacts -w /etc/hyperledger/artifacts hyperledger/fabric-tools:1.4.2\
             cryptogen generate --config=./crypto-config.yaml --output=crypto-temp\
             &&  cp -r -f crypto-temp/. crypto-config\
             && chown -R ${uid}:${gid} .\
        `, {maxBuffer: Infinity});

        //Copying files
        fs.copySync(`${this.rootDirectory}/artifacts-templates/default_hosts`, `${this.rootDirectory}/artifacts/hosts/${this.name}/api_hosts`);
        fs.copySync(`${this.rootDirectory}/artifacts-templates/default_hosts`, `${this.rootDirectory}/artifacts/hosts/${this.name}/cli_hosts`);

        //Generating docker-compose files for peers  //TODO Push the files to the peers
        await DockercomposeGenerator(this).generate();

        //Generating the configuration for Fabric CA Server
        await CaserverconfigGenerator(this).generate();

        //Generating configtx and config.json files
        await ConfigTxGenerator(this).generate();
        await exec(`\
            docker run --rm -v ${this.rootDirectory/artifacts}:/etc/hyperledger/artifacts -w /etc/hyperledger/artifacts hyperledger/fabric-tools:1.4.2\
             bash -c "FABRIC_CFG_PATH=./ configtxgen  -printOrg ${this.name}MSP > ${this.name}Config.json"\
        `, {maxBuffer: Infinity});

        //Serve files to WWW
        //TODO Continue here
    }

    async generateAndUp(){
        await this._generate();

        let promisesUp = [];
        for(let peer of this.peers){
            promisesUp.push(peer.up(this.legacyId));
        }
        await Promise.all(promisesUp);
    }

    async monitor(){
        await Monitor.run();
    }

    

}

module.exports = OrganizationManager;
