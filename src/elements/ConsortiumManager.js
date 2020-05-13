const OrganizationManager = require('./OrganizationManager');
let fs = require('fs-extra');
const fsPromises = require('fs').promises;
let rimraf = require('rimraf');

class ConsortiumManager {

    constructor(name, conf) {
        this.name = name;
        this.orgsConfs = conf.organizations.map(orgConf => ({
            ...orgConf,
            channels: orgConf.isOrderer?conf.channels:conf.channels.filter(c => c.organizations.filter(o => o.name==orgConf.name).length >= 1),  //Only add channels in which the organization is in or all if orderer.
        }));
    }

    async build() {
        console.log('Consortium: init');
        await this._init();

        console.log('Consortium: shareOtherOrgs');
        await this._shareOtherOrgs();

        console.log('Consortium: pushEnvironment');
        await this._pushEnvironnement();

        console.log('Consortium: generate');
        await this._generate();

        console.log('Consortium: up');
        await this._up();

        console.log('Consortium: done');
        // await this.orgs[1].monitor();  //TODO Not working yet, as it's still the peers that generate their certificates
    }

    async _init() {
        let rootDirPromises = [];
        for (let orgConf of this.orgsConfs) {
            rootDirPromises.push(this._createOrganizationRootDirectory(orgConf));
        }
        await Promise.all(rootDirPromises);

        let orgInitPromises = [];
        for (let orgConf of this.orgsConfs) {
            let org = await OrganizationManager.instantiateFromConfiguration(`${orgConf.rootDirectory}/conf.json`);
            orgInitPromises.push(org.init());
        }
        await Promise.all(orgInitPromises);
    }

    async _createOrganizationRootDirectory(orgConf) {
        console.log(`Consortium copying files for ${orgConf.name}...`);
        if (await fs.exists(orgConf.rootDirectory)) {
            rimraf.sync(orgConf.rootDirectory);  // As fs recursive option is experimental and doesn't seem to work in my case, rimraf seems to be an alternative
            //fs.rmdirSync(org.rootDirectory, {recursive: true});
        }
        await fs.copy(process.cwd(), orgConf.rootDirectory, {filter: (src)=>
            !src.includes('node_modules')  //TODO Should filter .gitignore files
        });
        
        // Writing configuration file for org
        await fsPromises.writeFile(`${orgConf.rootDirectory}/conf.json`, JSON.stringify(orgConf));
        console.log(`Consortium copying files for ${orgConf.name}... done`);
    }

    async _pushEnvironnement() {
        let promises = [];
        for (let orgConf of this.orgsConfs) {
            let org = await OrganizationManager.instantiateFromConfiguration(`${orgConf.rootDirectory}/conf.json`);
            promises.push(org.pushEnvironnement());
        }
        await Promise.all(promises);
    }

    /**
     * Enrich the conf.json for the organization with other orgs parameters.
     * When creating a multi-host network, each of the otherOrg should give org its main ip.
     */
    async _shareOtherOrgs() {
        for (const orgConf of this.orgsConfs) {
            orgConf.otherOrganizations = await Promise.all(this.orgsConfs.map(async otherOrgConf => {  // We include our org aswell so we can easily loop through all orgs
                let otherOrg = await OrganizationManager.instantiateFromConfiguration(`${otherOrgConf.rootDirectory}/conf.json`);
                return {
                    ip: await otherOrg.ip,  // Should be done manually when creating a multi-host network
                    name: otherOrg.name,
                    mainPeerName: otherOrg.peers.filter(p => p.isMain)[0].name,
                    isOrderer: otherOrg.isOrderer,
                    peers: otherOrg.peers.map(peer => ({
                        name: peer.name,
                        ip: peer.ip,
                    })),
                };
            }));
            await fsPromises.writeFile(`${orgConf.rootDirectory}/conf.json`, JSON.stringify(orgConf));
        }
    }

    async _generate() {
        //First we generate all standard orgs
        let promises = [];
        for (let orgConf of this.orgsConfs.filter(orgConf => !orgConf.isOrderer)) {
            let org = await OrganizationManager.instantiateFromConfiguration(`${orgConf.rootDirectory}/conf.json`);
            promises.push(org.generate());
        }
        await Promise.all(promises);

        //Then we generate the orderer org //TODO For now, there can only be one orderer org
        let ordererOrgConf = this.orgsConfs.find(orgConf => orgConf.isOrderer);
        let ordererOrg = await OrganizationManager.instantiateFromConfiguration(`${ordererOrgConf.rootDirectory}/conf.json`);
        await ordererOrg.generate();
    }

    async _up() {
        let ordererOrgConf = this.orgsConfs.find(orgConf => orgConf.isOrderer);
        let ordererOrg = await OrganizationManager.instantiateFromConfiguration(`${ordererOrgConf.rootDirectory}/conf.json`);
        await ordererOrg.up();

        let promisesUp = [];
        for (let orgConf of this.orgsConfs.filter(orgConf => !orgConf.isOrderer)) {
            let org = await OrganizationManager.instantiateFromConfiguration(`${orgConf.rootDirectory}/conf.json`);
            promisesUp.push(org.up());
        }
        await Promise.all(promisesUp);
    }

}

module.exports = ConsortiumManager;
