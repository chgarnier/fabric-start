const fs = require('fs');
yaml = require('js-yaml');

class CaserverconfigGenerator{

    constructor(organizationManager){
        this.organizationManager = organizationManager;
    }

    async generate(){
        let config = {
            "port": 7054,
            "debug": false,
            "tls": {
                "enabled": false,
                "certfile": "ca-cert.pem",
                "keyfile": "ca-key.pem",
                "clientauth": {
                    "type": "noclientcert",
                    "certfiles": null
                }
            },
            "ca": {
                "name": null,
                "keyfile": "ca-key.pem",
                "certfile": "ca-cert.pem",
                "chainfile": "ca-chain.pem"
            },
            "registry": {
                "maxenrollments": -1,
                "identities": [
                    {
                        "name": "admin",
                        "pass": "adminpw",
                        "type": "client",
                        "affiliation": "",
                        "maxenrollments": -1,
                        "attrs": {
                            "hf.Registrar.Roles": "client,user,peer,validator,auditor",
                            "hf.Registrar.DelegateRoles": "client,user,validator,auditor",
                            "hf.Revoker": true,
                            "hf.IntermediateCA": true
                        }
                    }
                ]
            },
            "db": {
                "type": "sqlite3",
                "datasource": "fabric-ca-server.db",
                "tls": {
                    "enabled": false,
                    "certfiles": [
                        "db-server-cert.pem"
                    ],
                    "client": {
                        "certfile": "db-client-cert.pem",
                        "keyfile": "db-client-key.pem"
                    }
                }
            },
            "ldap": {
                "enabled": false,
                "url": "ldap://<adminDN>:<adminPassword>@<host>:<port>/<base>",
                "tls": {
                    "certfiles": [
                        "ldap-server-cert.pem"
                    ],
                    "client": {
                        "certfile": "ldap-client-cert.pem",
                        "keyfile": "ldap-client-key.pem"
                    }
                }
            },
            "affiliations": {
                [`${this.organizationManager.name}`]: [
                    "department1"
                ]
            },
            "signing": {
                "default": {
                    "usage": [
                        "digital signature"
                    ],
                    "expiry": "8760h"
                },
                "profiles": {
                    "ca": {
                        "usage": [
                            "cert sign"
                        ],
                        "expiry": "43800h",
                        "caconstraint": {
                            "isca": true,
                            "maxpathlen": 0
                        }
                    }
                }
            },
            "csr": {
                "cn": "fabric-ca-server",
                "names": [
                    {
                        "C": "US",
                        "ST": "North Carolina",
                        "L": null,
                        "O": "Hyperledger",
                        "OU": "Fabric"
                    }
                ],
                "hosts": [
                    "localhost"
                ],
                "ca": {
                    "expiry": "131400h",
                    "pathlength": 1
                }
            },
            "bccsp": {
                "default": "SW",
                "sw": {
                    "hash": "SHA2",
                    "security": 256,
                    "filekeystore": {
                        "keystore": "msp/keystore"
                    }
                }
            },
            "cacount": null,
            "cafiles": null,
            "intermediate": {
                "parentserver": {
                    "url": null,
                    "caname": null
                },
                "enrollment": {
                    "hosts": null,
                    "profile": null,
                    "label": null
                },
                "tls": {
                    "certfiles": null,
                    "client": {
                        "certfile": null,
                        "keyfile": null
                    }
                }
            }
        }
        fs.writeFileSync(`${this.organizationManager.rootDirectory}/building/artifacts/fabric-ca-server-config-${this.organizationManager.name}.yaml`, yaml.safeDump(config));
    }

}

module.exports = CaserverconfigGenerator;