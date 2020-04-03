const MyrmicaConsortium = require("./elements/MyrmicaConsortium");
const fs = require('fs');
require('dotenv').config();

(async () => {
    let conf = JSON.parse(fs.readFileSync(`${process.cwd()}/test/conf.json`));
    console.log(conf);
    let consortium = new MyrmicaConsortium("myrmica", conf);
    console.log("Consortium: init");
    await consortium.init();
    console.log("Consortium: pushEnvironment");
    await consortium.pushEnvironnement();
    console.log("Consortium: shareOrgsIps");
    await consortium.shareOrgsIps();
    console.log("Consortium: generateAndUp");
    await consortium.generateAndUp();
    console.log("Consortium: done");

    // await consortium.orgs[1].monitor();  //TODO Not working yet, as it's still the peers that generate their certificates
})();
