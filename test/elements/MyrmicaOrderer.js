const MyrmicaPeer = require("./MyrmicaPeer");

class MyrmicaOrderer extends MyrmicaPeer {

    async generate(){
        console.log(`==> ${this.name} generating...`);
        await this.ssh(`'\
        cd ~/fabric-start/building \
        && ./network.sh -m generate-orderer\
        '`)
        console.log(`==> ${this.name} generating... done`);
    }

}

module.exports = MyrmicaOrderer;