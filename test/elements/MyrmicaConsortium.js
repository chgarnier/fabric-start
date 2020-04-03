const MyrmicaOrganization = require("./MyrmicaOrganization");
var fs = require("fs-extra");
var rimraf = require("rimraf");

class MyrmicaConsortium {

    constructor(name, orgsOptions){
        this.name = name;
        this.orgs = []
        for(let orgOptions of orgsOptions){
            this.orgs.push(new MyrmicaOrganization(orgOptions.name, orgOptions.legacyId, orgOptions.rootDirectory, orgOptions.isOrderer, orgOptions.peersOptions));
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
        if(fs.existsSync(org.rootDirectory)){
            rimraf.sync(org.rootDirectory);  // As fs recursive option is experimental and doesn't seem to work in my case, rimraf seems to be an alternative
            //fs.rmdirSync(org.rootDirectory, {recursive: true});
        }
        console.log(`Consortium copying files for ${org.name}...`);
        fs.copySync(process.cwd(), org.rootDirectory);
        console.log(`Consortium copying files for ${org.name}... done`);
    }

    async pushEnvironnement(){
        let promises = [];
        for(let org of this.orgs){
            promises.push(org.pushEnvironnement());
        }
        await Promise.all(promises);
    }

    async shareOrgsIps(){
        let ips = [];
        for(let org of this.orgs){
            if(org.isOrderer){
                ips.push({key: 'IP_ORDERER', value:org.ip});
            }
            else{
                ips.push({key: `IP${org.legacyId}`, value:org.ip});
            }
        }
        let promises = [];
        for(let org of this.orgs){
            org.otherOrgsIps = ips;
            promises.push(org.exportOthersOrgsIps());
        }
        await Promise.all(promises);
    }

    async generateAndUp(){
        let promises = [];
        for(let org of this.orgs){
            promises.push(org.generateAndUp());
        }
        await Promise.all(promises);
    }

}

module.exports = MyrmicaConsortium;
