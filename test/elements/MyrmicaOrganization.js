const MyrmicaPeer = require("./MyrmicaPeer");
var assert = require("assert");

class MyrmicaOrganization {

    constructor(name, legacyId, isOrderer, peersOptions){
        this.name = name;
        this.legacyId = legacyId;
        this.isOrderer = isOrderer;
        this.peers = [];
        for(let peerOptions of peersOptions){
            if(peerOptions.isOrderer){
                this.peers.push(new MyrmicaOrderer(peerOptions.name, this.name, peerOptions.isMain));
            }
            else{
                this.peers.push(new MyrmicaPeer(peerOptions.name, this.name, peerOptions.isMain));
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

    async pushEnvironnement(peers){
        await exec(`tar -czf /tmp/fabric-start.tar.gz ${process.env.PROJECT_ROOT}.`);
        for(let peer of peers){
            peer.pushEnvironnement();
        }
    }

    async getIp(){
        let mainPeers = this.peers.filter(peer => peer.isMain);
        assert(mainPeers.length == 1);
        return mainPeers[0].ip;
    }

    async exportOthersOrgsIps(){
        for(let peer of this.peers){
            await peer.exportOthersOrgsIps(this.otherOrgsIps)
        }
    }

    async _generate(){
        //TODO Récuperer le generate qui est pour l'instant délégué aux peers. Là on va certainement générer tous les certificats et les docker-compose sur cet host et les distribuer ensuite sur chacune des peers.
    }

    async generateAndUp(){
        for(let peer of this.peers){  //TODO En fait, puisqu'on va avoir plusieurs peers par organization, c'est l'organization qui génère les certificats et qui les distribue aux peers. Et pas les peers qui génèrent leurs propres certificats.
            await peer.generate();
        }
        for(let peer of this.peers){
            await peer.up(this.legacyId);
        }
    }

}

module.exports = MyrmicaOrganization;
