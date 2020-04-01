const MyrmicaPeer = require("./MyrmicaPeer");

class MyrmicaOrderer extends MyrmicaPeer {

    async generate(){
        await this.ssh(`'\
        cd ~/fabric-start/building \
        && ./network.sh -m generate-orderer\
        '`)
    }

}