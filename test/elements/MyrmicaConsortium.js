const MyrmicaOrganization = require("./MyrmicaOrganization");

class MyrmicaConsortium {

    constructor(name, orgsOptions){
        this.name = name;
        this.orgs = []
        for(let orgOptions of orgsOptions){
            this.orgs.push(new MyrmicaOrganization(orgOptions.name, orgsOptions.isOrderer, orgOptions.peersOptions));
        }
        
    }

    async init(){
        let promises = [];
        for(let org of this.orgs){
            promises.push(org.init());
        }
        await Promise.all(promises);
    }

    async shareOrgsIps(){
        ips = [];
        for(let org of this.orgs){
            if(org.isOrderer){
                ips.push({key: 'IP_ORDERER', value:org.ip});
            }
            else{
                ips.push({key: `IP${org.legacyId}`, value:org.ip});
            }
        }
        for(let org of this.orgs){
            org.otherOrgsIps = ips;
            org.exportOthersOrgsIps();
        }
    }

    async generateAndUp(){
        for(let org of this.orgs){
            await org.generateAndUp();
        }
    }

}

module.exports = MyrmicaConsortium;
