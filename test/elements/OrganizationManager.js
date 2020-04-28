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

    constructor(name, domainName, legacyId, rootDirectory, isOrderer, isMain, peersOptions) {
        this.name = name;
        this.domainName = domainName;
        this.legacyId = legacyId;
        this.rootDirectory = rootDirectory;
        this.isOrderer = isOrderer;
        this.isMain = isMain;
        this.peers = [];
        for (let peerOptions of peersOptions) {
            if (peerOptions.isOrderer) {
                this.peers.push(new OrdererPeerManager(peerOptions.name, this.name, this.domainName, peerOptions.isMain, peerOptions.ec2Type));
            }
            else {
                this.peers.push(new PeerManager(peerOptions.name, this.name, this.domainName, peerOptions.isMain, peerOptions.ec2Type));
            }
            if(peerOptions.isMain){  //TODO Should be useless if otherOrgs and Organization are linked somehow (with inheritance or something)
                this.mainPeerName = peerOptions.name;
            }
        }
        this.ip = null;
        this.otherOrgs = []
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

    async getMainPeer(){
        let mainPeers = this.peers.filter(peer => peer.isMain);
        assert(mainPeers.length == 1);
        return mainPeers[0];
    }

    async exportOthersOrgs() {  //TODO Chaque orga devrait pouvoir générer un object "sharable" aux autres orgas
        let promises = [];
        for (let peer of this.peers) {
            promises.push(peer.exportOthersOrgs(this.otherOrgs));
        }
        await Promise.all(promises);
    }

    async _generateOrdererArtifacts() {  //TODO Here the orderer will also initiate the network, but that won't always be true    
        let peer = await this.getMainPeer();
        await (new NetworkconfigGenerator(this).generate());
        await peer.scp(`${this.rootDirectory}/building/artifacts/network-config.json`, "/fabric-start/building/artifacts/network-config.json");

        await peer.ssh(`'mkdir -p "/fabric-start/building/artifacts/channel"'`);
        let channels = ["common"];
        for(let org_a of this.otherOrgs.filter(org => !org.isOrderer)){  //TODO Comme la distinction entre la classe PeerManager et OrdererPeerManager, on devrait avoir une distinction entre OrganizationManager et OrdererOrganizationManager
            for(let org_b of this.otherOrgs.filter(org => !org.isOrderer)){
                if(org_a.name < org_b.name){  // Unicity of orgs couples whatever the order is (in js, "a"<"b" is true while "b"<"a" is false)
                    channels.push(`${org_a.name}-${org_b.name}`);
                }
            }
        }
        await peer.generateChannelConfigTransaction(channels);
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
        await new DockercomposeGenerator(this).generate()
            .catch(e => {
                console.error(`Error while generating docker-compose for ${this.name}`);
                throw new Error(e.stack);
            });

        //Generating the configuration for Fabric CA Server
        await new CaserverconfigGenerator(this).generate()
            .catch(e => {
                console.error(`Error while generating CA server config for ${this.name}`);
                throw new Error(e.stack);
            });

        //Generating configtx and config.json files
        await new ConfigTxGenerator(this).generate()
            .catch(e => {
                console.error(`Error while generating configtx for ${this.name}`);
                throw new Error(e.stack);
            });

        //TODO Shouldn't the orderer should have retrieved all other orgs certificates before running that
        await this._execute(`\
            docker run --rm -v ${this.rootDirectory}/building/artifacts:/etc/hyperledger/artifacts -w /etc/hyperledger/artifacts hyperledger/fabric-tools:1.4.2 \
            /bin/bash -c "FABRIC_CFG_PATH=./ configtxgen  -printOrg ${this.name}MSP > ${this.name}Config.json"\
        `).catch(e => {
            console.error(`Error while generating configtx for ${this.name}`);
            throw new Error(e.stack);
        });
    }

    async _distributeArtifactsToPeer(){
        for(let peer of this.peers){
            await peer.scp(`${this.rootDirectory}/building/artifacts/crypto-config`, "/fabric-start/building/artifacts/crypto-config");  //TODO We shouldn't copy the whole dir, but only what is usefull for this specific peer
            await peer.scp(`${this.rootDirectory}/building/dockercompose`, "/fabric-start/building/dockercompose");  //TODO Same as above, we should only copy files that we need and not the whole directory
        }
    }

    async _servePeerArtifacts(){  // For peer only
        for(let peer of this.peers){
            //copyFilesToWWW
            await peer.cp(`/fabric-start/building/artifacts/crypto-config/peerOrganizations/${this.name}.${this.domainName}/tls/ca.crt`, `/www/ca.crt`);
            await peer.cp(`/fabric-start/building/artifacts/crypto-config/peerOrganizations/${this.name}.${this.domainName}/msp`, `/www`);
            await peer.cp(`/fabric-start/building/artifacts/${this.name}Config.json`, `/www/${this.name}Config.json`);

            //Up WWW server
            await peer.dockerUp("www");

            //Add orgs to hosts  //TODO From legacy files, do we have to keep this ?
            let ordererOrg = otherOrgs.filter(e => e.name=="orderer")[0];
            await peer.addOrgsToHosts(ordererOrg.domainName, ordererOrg.ip);
        }
    }

    async _downloadArtifacts(){  // For orderer only, from legacy downloadArtifactsOrderer in generate-orderer command in network.sh
        for(let peer of this.peers){  //TODO We suppose here that all peers of the orderer org are orderers peers, but it may be true
            await peer.downloadArtifacts();
        }
    }

    async generate() {
        //Organization host generate artifacts for himself and its peers
        await this._generatePeerArtifacts();
        await this._distributeArtifactsToPeer();
        await this._servePeerArtifacts();

        // Organization host distribute files to its peers
        // And Each peer serve its files via www  //TODO
        if(this.isOrderer){
            await this._downloadArtifacts();
            await this._generateOrdererArtifacts();
        }

        //TODO Each peer should up himself
        // let promisesUp = [];
        // for(let peer of this.peers){
        //     promisesUp.push(peer.up(this.legacyId));
        // }
        // await Promise.all(promisesUp);
    }

    async monitor() {
        await Monitor.run();
    }



}

module.exports = OrganizationManager;
