const ConsortiumManager = require("./elements/ConsortiumManager");
const fs = require('fs');
require('dotenv').config();

(async () => {
    let conf = JSON.parse(fs.readFileSync(`${process.cwd()}/test/conf.json`));
    console.log(conf);
    let consortium = new ConsortiumManager("myrmica", conf);
    console.log("Consortium: init");
    await consortium.init();
    console.log("Consortium: shareOtherOrgs");
    await consortium.shareOtherOrgs();
    console.log("Consortium: pushEnvironment");
    await consortium.pushEnvironnement();
    console.log("Consortium: generate");
    await consortium.generate();
    console.log("Consortium: up");
    await consortium.up();
    console.log("Consortium: done");

    // await consortium.orgs[1].monitor();  //TODO Not working yet, as it's still the peers that generate their certificates
})();
