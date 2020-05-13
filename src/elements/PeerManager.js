var util = require('util');
const exec = util.promisify(require('child_process').exec);
var assert = require("assert");
const axios = require('axios');

class PeerManager {

    constructor(name, org, isMain, ec2Type) {
        this.name = name;
        this.org = org;
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
        this.ip = await this._getIp();
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

    async _getIp() {
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
                throw new Error(`Command ${cmd} failed on PeerManager ${this.name} with code ${e.code} and signal ${e.signal}.\nCaused By:\n${e.stack}`);
            });
        // if(stderr){
        //     console.error(`Command ${cmd} has stderr:\n${stderr}`);
        // }
    }

    async _copyFilesToWww(srcDir, srcFile) {  // srcFile can be "" to copy the whole dir. Copy with the hieararchy from artifacts/ in ~/fabric-start/building/www
        assert(!srcDir.endsWith("/"));
        let srcFilePath = `${srcDir}/${srcFile}`;
        let srcDirRightPart = srcDir.split("/building/").pop();
        let dstDir = `~/fabric-start/building/www/${srcDirRightPart}`;
        let dstFilePath = `${dstDir}/${srcFile.includes("*")?"":srcFile}`;

        await this.ssh(`'rm -rf ${dstFilePath}'`);  // We remove only the needed file
        await this.ssh(`'mkdir -p ${dstDir}'`);  // Create directory and hierarchy only if it does not exists
        await this.ssh(`'cp -r ${srcFilePath} ${dstFilePath}'`);  // We copy in the hierarchy the directory or the file
    }

    async servePeerArtifacts(ordererOrg) {  //TODO Should files only be served on the main peer of the org ? 
        //copyFilesToWWW
        await this._copyFilesToWww(`~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${this.org.name}/peers/${this.name}/tls`, `ca.crt`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${this.org.name}`, `msp`);
        await this._copyFilesToWww(`~/fabric-start/building/artifacts`, `${this.org.name}Config.json`);

        //Up WWW server
        let dockerComposeFilepath = `~/fabric-start/building/dockercompose/docker-compose-${this.org.name}-${this.name}.yaml`;
        await this.ssh(`'docker-compose --file ${dockerComposeFilepath} down'`);  //TODO There may be a better place to down the older network. Or we can just simply delete the machines each time we do a test
        await this.ssh(`'docker volume prune -f'`);
        await this.ssh(`'docker-compose --file ${dockerComposeFilepath} up -d "www"'`);  //TODO Check that it actually start with all that quotes  //TODO Also check that because we are multiple peers with all the same orgname.orgdomain it doesn't mess up

        //Add orgs to hosts  //TODO From legacy function addOrgToCliHosts, do we have to keep this ?
        await this.ssh(`'echo "${ordererOrg.ip} ${ordererOrg.name}" >> ~/fabric-start/building/artifacts/hosts/${this.org.name}/cli_hosts'`);
        await this.ssh(`'echo "${ordererOrg.ip} ${ordererOrg.name}" >> ~/fabric-start/building/artifacts/hosts/${this.org.name}/api_hosts'`);
    }

    async downloadArtifacts() {
        // Create directories to receive certificates artifacts
        for (let org of this.org.otherOrgs.filter(o => o.name != this.org.name)) {
            if (org.isOrderer) {
                await this.ssh(`'mkdir -p ~/fabric-start/building/artifacts/crypto-config/ordererOrganizations/${org.name}/orderers/${org.mainPeerName}/tls'`); //TODO Use node native mkdir instead of bash one ?
            }
            else {
                await this.ssh(`'mkdir -p ~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${org.name}/peers/${org.mainPeerName}/tls'`);  // Not sure if we need the domain here
            }
        }

        // Download member MSP
        let defaultWwwPort = 8080;
        for (let org of this.org.otherOrgs.filter(o => o.name != this.org.name)) {  //TODO The path should change if we download an orderer org artifacts
            await this.ssh(
                `'wget --directory-prefix ~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${org.name}/msp/admincerts \
                http://${org.ip}:${defaultWwwPort}/crypto-config/peerOrganizations/${org.name}/msp/admincerts/Admin@${org.name}-cert.pem'`
            );

            await this.ssh(
                `'wget --directory-prefix ~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${org.name}/msp/cacerts \
                http://${org.ip}:${defaultWwwPort}/crypto-config/peerOrganizations/${org.name}/msp/cacerts/ca.${org.name}-cert.pem'`
            );

            await this.ssh(
                `'wget --directory-prefix ~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${org.name}/msp/tlscacerts \
                http://${org.ip}:${defaultWwwPort}/crypto-config/peerOrganizations/${org.name}/msp/tlscacerts/tlsca.${org.name}-cert.pem'`
            );

            await this.ssh(
                `'wget --directory-prefix ~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${org.name}/peers/${org.mainPeerName}/tls \
                http://${org.ip}:${defaultWwwPort}/crypto-config/peerOrganizations/${org.name}/peers/${org.mainPeerName}/tls/ca.crt'`
            );
        }
        // That is different from the legacy downloadMemberMSP because here we do not use the docker container cli to retrieve the files as we have the ip in the nodejs environnement
    }

    async _changeOwnership(){
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.org.name}-${this.name}.yaml run --rm "cli" bash -c "chown -R $UID:$(id -g) ."'`);  //TODO Check that this change is working at the correct level
    }

    async _downloadArtifactsMember(){  // From legacy downloadArtifactsMember
        let ordererOrg = this.org.otherOrgs.find(o => o.isOrderer);  //TODO Find a way to always have the ordererOrg easily available instead of having to filter every time

        // Download channel tx files
        for(let channel of this.org.channels){
            await this.ssh(`'wget --directory-prefix ~/fabric-start/building/artifacts/channel http://${ordererOrg.ip}:8080/channel/${channel.name}.tx'`);
        }

        // Download network config file from main org //TODO orderer will not always be the main org, especially when there will be multiple orderer orgs
        await this.ssh(`'wget --directory-prefix ~/fabric-start/building/artifacts/ http://${ordererOrg.ip}:8080/network-config.json'`);

        // Download orderer cert file
        await this.ssh(`'wget --directory-prefix ~/fabric-start/building/artifacts/crypto-config/ordererOrganizations/${ordererOrg.name}/orderers/${ordererOrg.mainPeerName}/tls\
            http://${ordererOrg.ip}:8080/crypto-config/ordererOrganizations/${ordererOrg.name}/orderers/${ordererOrg.mainPeerName}/tls/ca.crt'`);  //TODO Have a way to specify the base path in the organizationManager class so that we don't have to rebuild it every time we need it

        // Download other orgs cert files
        for(let org of this.org.otherOrgs.filter(o => !o.isOrderer)){
            await this.ssh(`'wget --directory-prefix ~/fabric-start/building/artifacts/crypto-config/peerOrganizations/${org.name}/peers/${org.mainPeerName}/tls\
                http://${org.ip}:8080/crypto-config/peerOrganizations/${org.name}/peers/${org.mainPeerName}/tls/ca.crt'`);
        }

        await this._changeOwnership();
    }

    async _createChannel(channel){  // From legacy createChannel
        let ordererOrg = this.org.otherOrgs.find(o => o.isOrderer);

        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.org.name}-${this.name}.yaml\
            run --rm "cli" bash -c "peer channel create -o ${ordererOrg.ip}:7050 --ordererTLSHostnameOverride ${ordererOrg.mainPeerName} -c ${channel.name} -f /etc/hyperledger/artifacts/channel/${channel.name}.tx --tls --cafile /etc/hyperledger/crypto/orderer/tls/ca.crt"'`);  //TODO This could be done with the node sdk
        await this._changeOwnership();
        await this._copyFilesToWww(`~/fabric-start/building/artifacts`, `${channel.name}.block`);  //TODO Check that it is the correct place to put the file
    }

    async _downloadChannelBlockFile(channel){  // From legacy downloadChannelBlockFile
        let channelLeaderOrgName = channel.organizations.find(o => o.isLeader).name;
        let channelLeaderOrg = this.org.otherOrgs.find(o => o.name==channelLeaderOrgName);
        let channelBlockUrl = `http://${channelLeaderOrg.ip}:8080/${channel.name}.block`;

        var urlExists = false;
        while(!urlExists){
            urlExists = await axios.get(channelBlockUrl).catch(e => {
                console.log(`${channelBlockUrl} does not exist yet, performing a new request...`);
                return false;
            });
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        await this.ssh(`'wget --directory-prefix ~/fabric-start/building/artifacts ${channelBlockUrl}'`);
    }

    /**
     * Precondition: The peer should be in possession of the channel_name.block by running _downloadChannelBlockFile before running this
     * @param {*} channel 
     */
    async _joinChannel(channel){  // From legacy joinChannel
        await this.ssh(`'docker-compose --file ~/fabric-start/building/dockercompose/docker-compose-${this.org.name}-${this.name}.yaml\
            run --rm "cli" bash -c "CORE_PEER_ADDRESS=${this.ip}:7051 peer channel join -b ${channel.name}.block"'`);
    }

    async up() {
        await this._downloadArtifactsMember();
        let dockerComposeFilepath = `~/fabric-start/building/dockercompose/docker-compose-${this.org.name}-${this.name}.yaml`;
        await this.ssh(`'docker-compose --file ${dockerComposeFilepath} down'`);
        await this.ssh(`'docker volume prune -f'`);
        await this.ssh(`'docker-compose --file ${dockerComposeFilepath} up -d'`);
        console.log(`Waiting 60 seconds for ${this.name} to up...`);
        await new Promise((resolve) => setTimeout(resolve, 60000));  // Wait for a minute  //TODO Find a better way to wait until the services are ready
        console.log(`Waiting 60 seconds for ${this.name} to up... done`);
        //TODO We should add all the mechanics to install chaincodes

        for(let channel of this.org.channels){
            if(this.isMain && channel.organizations.find(o => o.name==this.org.name).isLeader){  // Only the main peer of the leading org has to create the channel
                await this._createChannel(channel);
            }
            else{  // Otherwise we should join
                await this._downloadChannelBlockFile(channel);
                await this._joinChannel(channel);
            }
        }
    }

}

module.exports = PeerManager;
