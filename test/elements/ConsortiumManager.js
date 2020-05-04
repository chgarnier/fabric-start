const OrganizationManager = require("./OrganizationManager");
var fs = require("fs-extra");
// const fs = require('fs').promises;
var rimraf = require("rimraf");
var assert = require("assert");

class ConsortiumManager {

    constructor(name, orgsOptions){
        this.name = name;
        this.orgs = []
        for(let orgOptions of orgsOptions){
            this.orgs.push(new OrganizationManager(orgOptions.name, `${this.name}.com`, orgOptions.legacyId, orgOptions.rootDirectory, orgOptions.isOrderer
            , orgOptions.isMain, orgOptions.peersOptions));
        }
    }

    async init(){
        let rootDirPromises = []
        for(let org of this.orgs){
            rootDirPromises.push(this.createOrganizationRootDirectory(org));
        }
        await Promise.all(rootDirPromises);

        let orgInitPromises = [];
        for(let org of this.orgs){
            orgInitPromises.push(org.init());
        }
        await Promise.all(orgInitPromises);
    }

    async createOrganizationRootDirectory(org){
        console.log(`Consortium copying files for ${org.name}...`);
        if(await fs.exists(org.rootDirectory)){
            rimraf.sync(org.rootDirectory);  // As fs recursive option is experimental and doesn't seem to work in my case, rimraf seems to be an alternative
            //fs.rmdirSync(org.rootDirectory, {recursive: true});
        }
        await fs.copy(process.cwd(), org.rootDirectory, {filter: (src, dest)=>{
           return !src.includes("node_modules");  //TODO Should filter .gitignore files
        }});
        console.log(`Consortium copying files for ${org.name}... done`);
    }

    async pushEnvironnement(){
        let promises = [];
        for(let org of this.orgs){
            promises.push(org.pushEnvironnement());
        }
        await Promise.all(promises);
    }

    async shareOtherOrgs(){
        let otherOrgs = [];
        for(let org of this.orgs){
            otherOrgs.push({  //TODO This should be a public purified version of the org object, without all the fonctionnalities (maybe only the attributes ?)  //TODO There should be a way to retrieve this info on an already running network
                ip: org.ip,
                ipLegacyEnvName: org.isOrderer?'IP_ORDERER':`IP${org.legacyId}`,
                name: org.name,
                domainName: org.domainName,
                mainPeerName: org.peers.filter(p => p.isMain)[0].name,
                isOrderer: org.isOrderer,
                peers: org.peers.map(peer => {
                    return {
                        name: peer.name,
                        ip: peer.ip
                    }
                })
            })
        }
        let promises = [];
        for(let org of this.orgs){
            org.otherOrgs = otherOrgs;
            promises.push(org.exportOthersOrgs());
        }
        await Promise.all(promises);
    }

    async generate(){
        //First we generate all standard orgs
        let promises = [];
        for(let org of this.orgs.filter(org => !org.isOrderer)){
            promises.push(org.generate());
        }
        await Promise.all(promises);

        //Then we generate the orderer org //TODO For now, there can only be one orderer org
        let ordererOrgs = this.orgs.filter(org => org.isOrderer);
        assert(ordererOrgs.length == 1);
        await ordererOrgs[0].generate();
    }

    async up(){
        //TODO
        let ordererOrgs = this.orgs.filter(org => org.isOrderer);
        assert(ordererOrgs.length == 1);
        await ordererOrgs[0].up();
    }

}

module.exports = ConsortiumManager;
