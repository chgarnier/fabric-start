var util = require('util');
const exec = util.promisify(require('child_process').exec);
var assert = require("assert");

class PeerManager {

    constructor(name, orgName, orgDomain, isMain, ec2Type) {
        this.name = name;
        this.orgName = orgName;  //TODO Reference organizationManager object instead ?
        this.orgDomain = orgDomain;
        this.isMain = isMain;
        this.ec2Type = ec2Type;
        this.ip = null;
    }

    async init() {
        await exec(`docker-machine status ${this.name}`, { maxBuffer: Infinity })
            .catch(async e => {
                if (e.stack.includes(`Docker machine "${this.name}" does not exist`)) {
                    await this.createMachine(this.name);
                }
                else {
                    throw Error(e.stack);
                }
            });
        this.ip = await this.getIp();
    }

    async createMachine() {
        const cmd = [
            'docker-machine', 'create',
            '--driver', 'amazonec2',
            '--amazonec2-region', 'eu-west-2',
            '--amazonec2-instance-type', this.ec2Type,
            '--amazonec2-open-port', "2377",
            '--amazonec2-open-port', "7946",
            '--amazonec2-open-port', "7946/udp",
            '--amazonec2-open-port', "4789",
            '--amazonec2-open-port', "4789/udp",
            '--amazonec2-open-port', "9000",
            '--amazonec2-open-port', "7050",
            '--amazonec2-open-port', "7051",
            '--amazonec2-open-port', "8080",
            '--amazonec2-open-port', "8090",
            '--amazonec2-open-port', "4000",
            this.name
        ].join(" ")
        await exec(cmd, { maxBuffer: Infinity });
        await this.ssh(`'sudo usermod -aG docker $(whoami)'`);  // To run docker as non-root
        await this.ssh(`'sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose'`);
        await this.ssh(`'sudo chmod +x /usr/local/bin/docker-compose'`);
    }

    async pushEnvironnement(archivePath) {
        console.log(`${this.name} scping...`);
        await exec(`docker-machine scp ${archivePath} ${this.name}:/tmp/fabric-start.tar.gz`, { maxBuffer: Infinity });
        console.log(`${this.name} scping... done, untaring...`);
        await exec(`docker-machine ssh ${this.name} "sudo rm -rf ~/fabric-start/ && mkdir ~/fabric-start/ && tar -xvzf /tmp/fabric-start.tar.gz -C ~/fabric-start/"`, { maxBuffer: Infinity });
        console.log(`${this.name} scping... done, untaring... done`);
    }

    async scp(src, dst) {  //TODO Use this instead of the pushEnvironnement ?
        await exec(`docker-machine scp -r ${src} ${this.name}:${dst}`, { maxBuffer: Infinity });
    }

    async getIp() {
        const { stdout, stderr } = await exec(`docker-machine ip ${this.name}`, { maxBuffer: Infinity });
        if (stderr) {
            throw Error(stderr);
        }
        else {
            return stdout.trim();
        }
    }

    async ssh(cmd) {
        const { stdout, stderr } = await exec(`docker-machine ssh ${this.name} ${cmd}`, { timeout: 120000, maxBuffer: Infinity })
            .catch(e => {
                console.error(`Error with code ${e.code} and signal ${e.signal} on PeerManager ${this.name} with cmd ${cmd}`);
                throw new Error(e.stack);
            });
        // if(stderr){
        //     console.error(`Command ${cmd} has stderr:\n${stderr}`);
        // }
    }

    async exportOthersOrgs(otherOrgs) {
        for (let otherOrg of otherOrgs) {
            await exec(`docker-machine ssh ${this.name} 'echo "export ${otherOrg.ipLegacyEnvName}=${otherOrg.ip}" >> ~/.bashrc'`, { maxBuffer: Infinity });
        }
    }

    // async generate(){ // TODO This is to be replaced by peer name when 
    //     console.log(`==> ${this.name} generating...`);
    //     await this.ssh(`'\
    //         cd ~/fabric-start/building \
    //         && ./network.sh -m generate-peer -o ${this.orgName}\
    //     '`)
    //     console.log(`==> ${this.name} generating... done`);
    // }

    async _copyFilesToWww(srcDir, srcFile){  // srcFile can be "" to copy the whole dir. Copy with the hieararchy from artifacts/ in ~/fabric-start/building/www
        assert(!srcDir.endsWith("/"));
        let srcFilePath = `${srcDir}/${srcFile}`;
        let srcDirRightPart = srcDir.split("/building/").pop();
        let dstDir = `~/fabric-start/building/www/${srcDirRightPart}`;
        let dstFilePath = `${dstDir}/${srcFile}`;

        await this.ssh(`'rm -f ${dstFilePath}'`);  // We remove only the needed file
        await this.ssh(`'mkdir -p ${dstDir}'`);  // Create directory and hierarchy only if it does not exists
        await this.ssh(`'cp -r ${srcFilePath} ${dstFilePath}'`);  // We copy in the hierarchy the directory or the file
    }

    async servePeerArtifacts(ordererOrg) {  //TODO Should files only be served on the main peer of the org ? 
        //copyFilesToWWW
        await this._copyFilesToWww(`~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${this.orgName}.${this.orgDomain}/peers/${this.name}/tls`, `ca.crt`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${this.orgName}.${this.orgDomain}`, `msp`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts`, `${this.orgName}Config.json`);

        //Up WWW server
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.orgName}-${this.name}.yaml up -d "www.${this.orgName}.${this.orgDomain}"'`);  //TODO Check that it actually start with all that quotes  //TODO Also check that because we are multiple peers with all the same orgname.orgdomain it doesn't mess up

        //Add orgs to hosts  //TODO From legacy function addOrgToCliHosts, do we have to keep this ?
        await this.ssh(`'echo "${ordererOrg.ip} orderer.${ordererOrg.domainName}" >> ~/fabric-start/building/artifacts/hosts/${this.orgName}/cli_hosts'`);
        await this.ssh(`'echo "${ordererOrg.ip} www.${ordererOrg.domainName}" >> ~/fabric-start/building/artifacts/hosts/${this.orgName}/cli_hosts'`);
        await this.ssh(`'echo "${ordererOrg.ip} orderer.${ordererOrg.domainName}" >> ~/fabric-start/building/artifacts/hosts/${this.orgName}/api_hosts'`);
    }

    async downloadArtifacts(organizationManager) {  //TODO We shouldn't pass the organizationManager as it should be accessible through this instance attributes  //TODO This should be put inside the OrdererPeerManager as its aim is to only be used from the orderer
        // Create directories to receive certificates artifacts
        for (let org of organizationManager.otherOrgs.filter(o => o.name != this.orgName)) {
            if (org.isOrderer) {
                await this.ssh(`'mkdir -p ~/fabric-start/building/artifacts/crypto-config/ordererOrganizations/${org.domainName}/orderers/orderer.${org.domainName}/tls'`); //TODO Use node native mkdir instead of bash one ?
            }
            else {
                await this.ssh(`'mkdir -p ~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${org.name}.${org.domainName}/peers/${org.mainPeerName}.${org.domainName}/tls'`);  // Not sure if we need the domain here
            }
        }

        // Download member MSP
        let defaultWwwPort = 8080
        for (let org of organizationManager.otherOrgs.filter(o => o.name != this.orgName)) {  //TODO The path should change if we download an orderer org artifacts
            await this.ssh(
                `'wget --directory-prefix crypto-config/peerOrganizations/${org.name}.${org.domainName}/msp/admincerts \
                http://${org.ip}:${defaultWwwPort}/crypto-config/peerOrganizations/${org.name}.${org.domainName}/msp/admincerts/Admin@${org.name}.${org.domainName}-cert.pem'`
            );

            await this.ssh(
                `'wget --directory-prefix crypto-config/peerOrganizations/${org.name}.${org.domainName}/msp/cacerts \
                http://${org.ip}:${defaultWwwPort}/crypto-config/peerOrganizations/${org.name}.${org.domainName}/msp/cacerts/ca.${org.name}.${org.domainName}-cert.pem'`
            );

            await this.ssh(
                `'wget --directory-prefix crypto-config/peerOrganizations/${org.name}.${org.domainName}/msp/tlscacerts \
                http://${org.ip}:${defaultWwwPort}/crypto-config/peerOrganizations/${org.name}.${org.domainName}/msp/tlscacerts/tlsca.${org.name}.${org.domainName}-cert.pem'`
            );

            await this.ssh(
                `'wget --directory-prefix crypto-config/peerOrganizations/${org.name}.${org.domainName}/peers/${org.mainPeerName}/tls \
                http://${org.ip}:${defaultWwwPort}/crypto-config/peerOrganizations/\${ORG}.$DOMAIN/peers/peer0.\${ORG}.$DOMAIN/tls/ca.crt'`
            );
        }
        // That is different from the legacy downloadMemberMSP because here we do not use the docker container cli to retrieve the files as we have the ip in the nodejs environnement
    }

    async up(legacyId) {
        console.log(`==> ${this.name} uping...`);
        await this.ssh(`'\
            cd ~/fabric-start/building \
            && ./network.sh -m up-${legacyId}\
        '`)
        console.log(`==> ${this.name} uping... done`);
    }

}

module.exports = PeerManager;
