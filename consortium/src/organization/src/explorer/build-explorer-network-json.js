const { renderString, renderTemplateFile } = require('template-file')
const util = require('util');
const glob = util.promisify(require('glob'));
fs = require('fs');
const path = require('path');

// const conf = require("./conf.json") //TODO Fill addeo (organization name) dynamically

async function getAdminPrivateKeyPath(){
    let files = await glob("../artifacts/crypto-config/peerOrganizations/addeo.myrmica.com/users/Admin@addeo.myrmica.com/msp/keystore/*_sk", {absolute: true});
    return files[0];
}

(async() => {
    const data = {
        adminPrivateKeyPath: await getAdminPrivateKeyPath(),
        projectRoot: path.resolve(process.cwd(), "..")
    }
    console.log(data.adminPrivateKeyPath);
    let filename = './explorer/explorer-network.template.json';
    let renderedString = await renderTemplateFile(filename, data);
    fs.writeFile(filename.replace(".template", ""), renderedString, (err)=>{console.error(err)});
})();
