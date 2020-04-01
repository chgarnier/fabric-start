var util = require('util');
const exec = util.promisify(require('child_process').exec);

class MyrmicaPeer {

    constructor(name, orgName, isMain){
        this.name = name;
        this.orgName = orgName;
        this.isMain = isMain;
        this.ip = null;
    }

    async init(){
        await exec(`docker-machine status ${this.name}`)
            .catch(async e => {
                if(e.stack.includes(`Docker machine "${this.name}" does not exist`)){
                    await this.createMachine(this.name);
                }
                else{
                    throw Error(e.stack);
                }
            });
        this.ip = await this.getIp();
    }

    async createMachine(){
        const cmd = [
            'docker-machine', 'create',
            '--driver', 'amazonec2',
            '--amazonec2-region', 'eu-west-2',
            '--amazonec2-instance-type', 'm5.large',
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
        await exec(cmd);
        await this.ssh(`'sudo usermod -aG docker $(whoami)'`);  // To run docker as non-root
        await this.ssh(`'sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose'`);
        await this.ssh(`'sudo chmod +x /usr/local/bin/docker-compose'`);
    }

    async pushEnvironnement(){
        await exec(`docker-machine scp /tmp/fabric-start.tar.gz ${this.name}:/tmp/fabric-start.tar.gz`);
        await exec(`docker-machine ssh ${this.name} "rm -rf ~/fabric-start/ && mkdir ~/fabric-start/ && tar -xvzf /tmp/fabric-start.tar.gz -C ~/fabric-start/"`);
    }

    async getIp(){
        const { stdout, stderr } = await exec(`docker-machine ip ${this.name}`);
        if(stderr){
            throw Error(stderr);
        }
        else{
            return stdout.trim();
        }
    }

    async ssh(cmd){
        await exec(`docker-machine ssh ${this.name} ${cmd}`);
    }

    async exportOthersOrgsIps(otherOrgsIps){
        for(otherOrgIp of otherOrgsIps){
            await this.ssh(`'"export ${otherOrgIp.key}=${otherOrgIp.value}" >> ~/.bashrc'`);
        }
    }

    async generate(){
        await this.ssh(`'\
            cd ~/fabric-start/building \
            && ./network.sh -m generate-peer -o ${this.name}\
        '`)
    }

    async up(legacyId){
        await this.ssh(`'\
            cd ~/fabric-start/building \
            && ./network.sh -m up-${legacyId}\
        '`)
    }

}

module.exports = MyrmicaPeer;
