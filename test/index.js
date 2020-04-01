const MyrmicaConsortium = require("./elements/MyrmicaConsortium");
const fs = require('fs');
require('dotenv').config();

(async () => {
    let conf = JSON.parse(fs.readFileSync(`${process.env.PROJECT_ROOT}/test/conf.json`));
    console.log(conf);
    let consortium = new MyrmicaConsortium("myrmica", conf);
    await consortium.init();
    await consortium.shareOrgsIps();
    await consortium.generateAndUp();
})();
