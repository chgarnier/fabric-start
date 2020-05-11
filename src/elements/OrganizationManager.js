const PeerManager = require("./PeerManager");
const OrdererPeerManager = require("./OrdererPeerManager");
const Monitor = require("../monitoring/Monitor");
const CryptoconfigGenerator = require("../generators/CryptoconfigGenerator");
const DockercomposeGenerator = require("../generators/DockercomposeGenerator");
const CaserverconfigGenerator = require("../generators/CaserverconfigGenerator");
const ConfigTxGenerator = require("../generators/ConfigTxGenerator");
const NetworkconfigGenerator = require("../generators/NetworkconfigGenerator");
var assert = require("assert");
var util = require('util');
const exec = util.promisify(require('child_process').exec);
var fs = require("fs-extra");

class OrganizationManager {

    constructor(name, rootDirectory, isOrderer, isMain, peers, channels) {
        this.configurationFilepath = null; //TODO
        this.name = name;
        this.rootDirectory = rootDirectory;
        this.isOrderer = isOrderer;
        this.isMain = isMain;
        this.peers = [];
        this.channels = channels;
        for (let [index, peerOptions] of peers.entries()) {
            let peerName = this.isOrderer ? `orderer${index}.${this.name}` : `peer${index}.${this.name}`;  //Necessary to match certificates generated by cryptogen
            if (peerOptions.isOrderer) {
                this.peers.push(new OrdererPeerManager(peerName, this, peerOptions.isMain, peerOptions.ec2Type));
            }
            else {
                this.peers.push(new PeerManager(peerName, this, peerOptions.isMain, peerOptions.ec2Type));
            }
            if (peerOptions.isMain) {  //TODO Should be useless if otherOrgs and Organization are linked somehow (with inheritance or something)
                this.mainPeerName = peerName;
            }
        }
        this.otherOrgs = [];
    }

    static async instantiateFromConfiguration(configurationFilepath) {
        let conf = JSON.parse(fs.readFileSync(configurationFilepath));
        let org = new OrganizationManager(
            conf.name,
            conf.rootDirectory,
            conf.isOrderer,
            conf.isMain,
            conf.peers,
            conf.channels
        );
        org.ip = await org.getIp();
        if (conf.otherOrganizations) {
            for (let otherOrg of conf.otherOrganizations) {
                org.otherOrgs.push(otherOrg);
            }
        }
        return org;
    }

    get(key){
        let conf = fs.readFileSync(this.configurationFilepath);
        return conf[key];
    }

    set(key, value){
        let conf = fs.readFileSync(this.configurationFilepath);
        conf[key] = value;
        fs.writeFileSync(this.configurationFilepath, JSON.stringify(conf));
    }

    async init() {
        let promises = [];
        for (let peer of this.peers) {
            promises.push(peer.init());
        }
        await Promise.all(promises);
        this.ip = await this.getIp();
    }

    async _execute(cmd) {
        let { stdout, stderr } = await exec(cmd, { timeout: 120000, maxBuffer: Infinity })
            .catch(e => {
                console.error(`Error with code ${e.code} and signal ${e.signal} on OrganizationManager ${this.name} with cmd ${cmd}`);
                throw new Error(e);
            });
        return {
            stdout: stdout,
            stderr: stderr
        }
    }

    async pushEnvironnement() {
        let archivePath = `/tmp/fabric-start-${this.name}.tar.gz`;
        await exec(`tar -czf ${archivePath} -C ${this.rootDirectory} .`, { maxBuffer: Infinity });

        let promises = [];
        for (let peer of this.peers) {
            promises.push(peer.pushEnvironnement(archivePath));
        }
        await Promise.all(promises);
    }

    async getIp() {
        return (await this.getMainPeer()).ip;
    }

    async getMainPeer() {
        let mainPeers = this.peers.filter(peer => peer.isMain);
        assert(mainPeers.length == 1);
        return mainPeers[0];
    }

    async _generateOrdererArtifacts() {  //TODO Here the orderer will also initiate the network, but that won't always be true    
        let peer = await this.getMainPeer();
        await (new NetworkconfigGenerator(this).generate());
        await peer.scp(`${this.rootDirectory}/building/artifacts/network-config.json`, "~/fabric-start/building/artifacts/network-config.json");

        await peer.ssh(`'rm -rf ~/fabric-start/building/artifacts/channel && mkdir -p ~/fabric-start/building/artifacts/channel'`);
        await peer.generateGenesis();  // We need that the docker-compose.yaml file have been generated before running this
        await peer.generateChannelConfigTransaction(this.channels);
    }

    async _generatePeerArtifacts() {  //TODO Impossible de faire avec ça, parce que en fait il faut splitter le generate-peer qui est fait sur chaque peer
        // Generating crypto material with cryptogen"
        await (new CryptoconfigGenerator(this).generate());
        let uid = (await this._execute("echo $(id -u)")).stdout.trim();
        let gid = (await this._execute("echo $(id -g)")).stdout.trim();
        await this._execute(`\
            docker run --rm -v ${this.rootDirectory}/building/artifacts:/etc/hyperledger/artifacts -w /etc/hyperledger/artifacts hyperledger/fabric-tools:1.4.2 \
            /bin/bash -c "cryptogen generate --config=./cryptogen-${this.name}.yaml --output=crypto-temp \
            &&  cp -r -f crypto-temp/. crypto-config \
            && chown -R ${uid}:${gid} ."\
        `);

        //Copying files
        fs.copySync(`${this.rootDirectory}/building/artifact-templates/default_hosts`, `${this.rootDirectory}/building/artifacts/hosts/${this.name}/api_hosts`);
        fs.copySync(`${this.rootDirectory}/building/artifact-templates/default_hosts`, `${this.rootDirectory}/building/artifacts/hosts/${this.name}/cli_hosts`);

        //Generating docker-compose files for peers  //TODO Push the files to the peers
        await (new DockercomposeGenerator(this).generate())
            .catch(e => {
                console.error(`Error while generating docker-compose for ${this.name}`);
                throw new Error(e.stack);
            });

        //Generating the configuration for Fabric CA Server
        await (new CaserverconfigGenerator(this).generate())
            .catch(e => {
                console.error(`Error while generating CA server config for ${this.name}`);
                throw new Error(e.stack);
            });

        //Generating configtx and config.json files  //TODO Sometimes, it seems that the file isn't created right after the end of these instructions, resulting on the configtxgen below to fail
        let configTxGenerator = new ConfigTxGenerator(this);
        await configTxGenerator.generate()
            .catch(e => {
                console.error(`Error while generating configtx for ${this.name}`);
                throw new Error(e.stack);
            });
        await new Promise((resolve) => setTimeout(resolve, 2000));  //TODO Because it seems that sometimes the file isn't generated

        //TODO Shouldn't the orderer should have retrieved all other orgs certificates before running that
        await this._execute(`\
            ls ${this.rootDirectory}/building/artifacts && docker run --rm -v ${this.rootDirectory}/building/artifacts:/etc/hyperledger/artifacts -w /etc/hyperledger/artifacts hyperledger/fabric-tools:1.4.2 \
            /bin/bash -c "FABRIC_CFG_PATH=./ configtxgen  -printOrg ${this.name}MSP > ${this.name}Config.json"\
        `).catch(e => {
            console.error(`Error while generating Config.json for ${this.name}`);
            throw new Error(e.stack);
        });
    }

    async _distributeArtifactsToPeer() {
        for (let peer of this.peers) {
            await peer.scp(`${this.rootDirectory}/building/artifacts`, "~/fabric-start/building");  //TODO We shouldn't copy the whole crypto-config dir, but only what is usefull for this specific peer
            await peer.scp(`${this.rootDirectory}/building/dockercompose`, "~/fabric-start/building");  //TODO Same as above, we should only copy files that we need and not the whole directory
        }
    }

    async _servePeerArtifacts() {  // For peer only
        let ordererOrg = this.otherOrgs.find(e => e.isOrderer);
        for (let peer of this.peers) {
            await peer.servePeerArtifacts(ordererOrg);
        }
    }

    async _downloadArtifacts() {  // For orderer only, from legacy downloadArtifactsOrderer in generate-orderer command in network.sh
        for (let peer of this.peers) {  //TODO We suppose here that all peers of the orderer org are orderers peers, but it may be true
            await peer.downloadArtifacts(this);
        }
    }

    async generate() {
        //Organization host generate artifacts for himself and its peers
        await this._generatePeerArtifacts();
        await this._distributeArtifactsToPeer();

        // Organization host distribute files to its peers
        // And Each peer serve its files via www  //TODO
        if (this.isOrderer) {
            await this._downloadArtifacts();
            await this._generateOrdererArtifacts();
        }
        else {  // Orderer serve its artifacts after being up ?
            await this._servePeerArtifacts();
        }
    }

    async up() {
        let promisesUp = [];
        for (let peer of this.peers) {
            promisesUp.push(peer.up());
        }
        await Promise.all(promisesUp);
    }

    async monitor() {
        await Monitor.run();
    }



}

module.exports = OrganizationManager;