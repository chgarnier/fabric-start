const ConsortiumManager = require("../src/elements/ConsortiumManager");
const fs = require('fs');
require('dotenv').config();

(async () => {
    let conf = JSON.parse(fs.readFileSync(`${process.cwd()}/test/conf.json`));
    console.log(conf);
    let consortium = new ConsortiumManager("myrmica", conf);
    await consortium.build();
})();
