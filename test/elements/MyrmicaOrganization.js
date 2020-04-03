const MyrmicaPeer = require("./MyrmicaPeer");
const MyrmicaOrderer = require("./MyrmicaOrderer");
const Monitor = require("../monitoring/Monitor");
var assert = require("assert");
var util = require('util');
const exec = util.promisify(require('child_process').exec);

class MyrmicaOrganization {

    constructor(name, legacyId, rootDirectory, isOrderer, peersOptions){
        this.name = name;
        this.legacyId = legacyId;
        this.rootDirectory = rootDirectory;
        this.isOrderer = isOrderer;
        this.peers = [];
        for(let peerOptions of peersOptions){
            if(peerOptions.isOrderer){
                this.peers.push(new MyrmicaOrderer(peerOptions.name, this.name, peerOptions.isMain, peerOptions.ec2Type));
            }
            else{
                this.peers.push(new MyrmicaPeer(peerOptions.name, this.name, peerOptions.isMain, peerOptions.ec2Type));
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

    async _generate(){
        let cmd = `'\
            cd ${this.rootDirectory} \
            && ./network.sh -m generate-peer -o ${this.name}\
        '`
        await exec(cmd, {timeout: 120000, maxBuffer: Infinity})
            .catch(e => {
                console.error(`Error with code ${e.code} and signal ${e.signal} on MyrmicaOrganization ${this.name} with cmd ${cmd}`);
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

}

module.exports = MyrmicaOrganization;
