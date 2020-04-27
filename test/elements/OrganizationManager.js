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
                this.peers.push(new OrdererPeerManager(peerOptions.name, this.name, peerOptions.isMain, peerOptions.ec2Type));
            }
            else {
                this.peers.push(new PeerManager(peerOptions.name, this.name, peerOptions.isMain, peerOptions.ec2Type));
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
        let mainPeers = this.peers.filter(peer => peer.isMain);
        assert(mainPeers.length == 1);
        return mainPeers[0].ip;
    }

    async exportOthersOrgs() {  //TODO Chaque orga devrait pouvoir générer un object "sharable" aux autres orgas
        let promises = [];
        for (let peer of this.peers) {
            promises.push(peer.exportOthersOrgs(this.otherOrgs));
        }
        await Promise.all(promises);
    }

    async getMainPeer() {
        return this.peers.filter(p => p.isMain)[0];
    }

    async _generatePeerArtifacts() {  //TODO Impossible de faire avec ça, parce que en fait il faut splitter le generate-peer qui est fait sur chaque peer
        // Generating crypto material with cryptogen"
        await (new CryptoconfigGenerator(this).generate());
        let uid = (await this._execute("echo $(id -u)")).stdout.trim();
        let gid = (await this._execute("echo $(id -g)")).stdout.trim();
        await this._execute(`\
            docker run --rm -v ${this.rootDirectory}/building/artifacts:/etc/hyperledger/artifacts -w /etc/hyperledger/artifacts hyperledger/fabric-tools:1.4.2\
             /bin/bash -c "cryptogen generate --config=./cryptogen-${this.name}.yaml --output=crypto-temp\
             &&  cp -r -f crypto-temp/. crypto-config\
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

        //TODO The orderer should have retrieved all other orgs certificates before running that
        await this._execute(`\
            docker run --rm -v ${this.rootDirectory}/building/artifacts:/etc/hyperledger/artifacts -w /etc/hyperledger/artifacts hyperledger/fabric-tools:1.4.2 \
            /bin/bash -c "FABRIC_CFG_PATH=./ configtxgen  -printOrg ${this.name}MSP > ${this.name}Config.json"\
        `).catch(e => {
            console.error(`Error while generating configtx for ${this.name}`);
            throw new Error(e.stack);
        });
        

        //Distribute files to organization peers
        //TODO 

        //Serve files to www of peers by action of the peers
        //TODO Continue here
    }

    async generateAndUp() {
        await this._generatePeerArtifacts();

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
