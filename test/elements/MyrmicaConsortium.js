const MyrmicaOrganization = require("./MyrmicaOrganization");

class MyrmicaConsortium {

    constructor(name, orgsOptions){
        this.name = name;
        this.orgs = []
        for(let orgOptions of orgsOptions){
            this.orgs.push(new MyrmicaOrganization(orgOptions.name, orgOptions.legacyId, orgOptions.isOrderer, orgOptions.peersOptions));
        }
        
    }

    async init(){
        let promises = [];
        for(let org of this.orgs){
            promises.push(org.init());
        }
        await Promise.all(promises);
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
