var util = require('util');
const exec = util.promisify(require('child_process').exec);

class MyrmicaPeer {

    constructor(name, orgName, isMain, ec2Type){
        this.name = name;
        this.orgName = orgName;
        this.isMain = isMain;
        this.ec2Type = ec2Type;
        this.ip = null;
    }

    async init(){
        await exec(`docker-machine status ${this.name}`, {maxBuffer: Infinity})
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
        await exec(cmd, {maxBuffer: Infinity});
        await this.ssh(`'sudo usermod -aG docker $(whoami)'`);  // To run docker as non-root
        await this.ssh(`'sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose'`);
        await this.ssh(`'sudo chmod +x /usr/local/bin/docker-compose'`);
    }

    async pushEnvironnement(archivePath){
        console.log(`${this.name} scping...`);
        await exec(`docker-machine scp ${archivePath} ${this.name}:/tmp/fabric-start.tar.gz`, {maxBuffer: Infinity});
        console.log(`${this.name} scping... done, untaring...`);
        await exec(`docker-machine ssh ${this.name} "sudo rm -rf ~/fabric-start/ && mkdir ~/fabric-start/ && tar -xvzf /tmp/fabric-start.tar.gz -C ~/fabric-start/"`, {maxBuffer: Infinity});
        console.log(`${this.name} scping... done, untaring... done`);
    }

    async getIp(){
        const { stdout, stderr } = await exec(`docker-machine ip ${this.name}`, {maxBuffer: Infinity});
        if(stderr){
            throw Error(stderr);
        }
        else{
            return stdout.trim();
        }
    }

    async ssh(cmd){
        const { stdout, stderr } = await exec(`docker-machine ssh ${this.name} ${cmd}`, {timeout: 120000, maxBuffer: Infinity})
            .catch(e => {
                console.error(`Error with code ${e.code} and signal ${e.signal} on MyrmicaPeer ${this.name} with cmd ${cmd}`);
                throw new Error(e.stack);
            });
        // if(stderr){
        //     console.error(`Command ${cmd} has stderr:\n${stderr}`);
        // }
    }

    async exportOthersOrgsIps(otherOrgsIps){
        for(let otherOrgIp of otherOrgsIps){
            await exec(`docker-machine ssh ${this.name} 'echo "export ${otherOrgIp.key}=${otherOrgIp.value}" >> ~/.bashrc'`, {maxBuffer: Infinity});
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

    async up(legacyId){
        console.log(`==> ${this.name} uping...`);
        await this.ssh(`'\
            cd ~/fabric-start/building \
            && ./network.sh -m up-${legacyId}\
        '`)
        console.log(`==> ${this.name} uping... done`);
    }

}

module.exports = MyrmicaPeer;
