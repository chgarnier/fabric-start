const PeerManager = require("./PeerManager");
const OrdererManager = require("./OrdererManager");
const Monitor = require("../monitoring/Monitor");
var assert = require("assert");
var util = require('util');
const exec = util.promisify(require('child_process').exec);

class OrganizationManager {

    constructor(name, legacyId, rootDirectory, isOrderer, peersOptions){
        this.name = name;
        this.legacyId = legacyId;
        this.rootDirectory = rootDirectory;
        this.isOrderer = isOrderer;
        this.peers = [];
        for(let peerOptions of peersOptions){
            if(peerOptions.isOrderer){
                this.peers.push(new OrdererManager(peerOptions.name, this.name, peerOptions.isMain, peerOptions.ec2Type));
            }
            else{
                this.peers.push(new PeerManager(peerOptions.name, this.name, peerOptions.isMain, peerOptions.ec2Type));
            }
        }
        this.ip = null;
        this.otherOrgsIps = []
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

    async exportOthersOrgsIps(){
        let promises = [];
        for(let peer of this.peers){
            promises.push(peer.exportOthersOrgsIps(this.otherOrgsIps));
        }
        await Promise.all(promises);
    }

    async generate(){  //TODO Impossible de faire avec ça, parce que en fait il faut splitter le generate-peer qui est fait sur chaque peer
        let cmd = `'\
            cd ${this.rootDirectory} \
            && ./network.sh -m generate-peer -o ${this.name}\
        '`
        await exec(cmd, {timeout: 120000, maxBuffer: Infinity})
            .catch(e => {
                console.error(`Error with code ${e.code} and signal ${e.signal} on OrganizationManager ${this.name} with cmd ${cmd}`);
                throw new Error(e.stack);
            });
        
    }

    async generateAndUp(){
        let promisesGenerate = [];
        for(let peer of this.peers){  //TODO En fait, puisqu'on va avoir plusieurs peers par organization, c'est l'organization qui génère les certificats et qui les distribue aux peers. Et pas les peers qui génèrent leurs propres certificats.
            promisesGenerate.push(peer.generate());
        }
        await Promise.all(promisesGenerate);

        let promisesUp = [];
        for(let peer of this.peers){
            promisesUp.push(peer.up(this.legacyId));
        }
        await Promise.all(promisesUp);
    }

    async monitor(){
        await Monitor.run();
    }

    async _generateCryptogen(){
        cliExtraHosts = {  //TODO Auto-generer en fonction des orgas
            "orderer.myrmica.com": this.otherOrgsIps.filter(e => e.key=="orderer")[0].value,
            "www.myrmica.com": this.otherOrgsIps.filter(e => e.key=="orderer")[0].value,
            "www.addeo.myrmica.com": this.otherOrgsIps.filter(e => e.key=="addeo")[0].value,
            "www.aucoffre.myrmica.com": this.otherOrgsIps.filter(e => e.key=="aucoffre")[0].value,
            "www.shoyo.myrmica.com": this.otherOrgsIps.filter(e => e.key=="shoyo")[0].value
        }
        peerExtraHosts = {
            "orderer.myrmica.com": this.otherOrgsIps.filter(e => e.key=="orderer")[0].value,
            `couchdb.${this.name}.myrmica.com`: this.ip
        }
        apiExtraHosts = {  //TODO Remplacer tous les peer0 par les noms dynamiques des main-peers des autres orgas
            "orderer.myrmica.com": this.otherOrgsIps.filter(e => e.key=="orderer")[0].value,
            "peer0.myrmica.com": this.otherOrgsIps.filter(e => e.key=="orderer")[0].value,
            "peer0.addeo.myrmica.com": this.otherOrgsIps.filter(e => e.key=="addeo")[0].value,
            "peer0.aucoffre.myrmica.com": this.otherOrgsIps.filter(e => e.key=="aucoffre")[0].value,
            "peer0.shoyo.myrmica.com": this.otherOrgsIps.filter(e => e.key=="shoyo")[0].value,
            `couchdb.${this.name}.myrmica.com`: this.ip
        }
        //TODO Générer les fichiers (un cryptogen pour l'orga, un docker-composer par peer de l'orga) et ensuite il faudra les distribuer aux différentes peers.
    }

}

module.exports = OrganizationManager;
