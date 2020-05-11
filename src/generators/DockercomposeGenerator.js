var util = require('util');
const glob = util.promisify(require('glob'));
const fs = require('fs');
yaml = require('js-yaml');
var path = require('path');

class DockercomposeGenerator {

    //Prerequisites: Cryptogen has been already run

    constructor(organizationManager) {
        this.organizationManager = organizationManager;
    }

    async generate() {
        for (let peer of this.organizationManager.peers) {  //TODO The generate should on wether the peer is the main for the org or not, and wether it is an orderer or not (and also if orderer AND main org ?)
            let config = this.organizationManager.isOrderer ? await this.generateForOrdererPeer(peer) : await this.generateForPeer(peer);
            fs.writeFileSync(`${this.organizationManager.rootDirectory}/building/dockercompose/docker-compose-${this.organizationManager.name}-${peer.name}.yaml`, yaml.safeDump(config));
        }
    }

    async generateForOrdererPeer(peer) {  // No disctinction here between main and secondary org
        let config = {
            version: "2",
            volumes: await this.getVolumeBlock(peer),
            services: {
                ...await this.getOrdererServiceBlock(peer),
                ...await this.getCliServiceBlock(),
                ...await this.getWwwServiceBlock()
            }
        }
        return config;
    }

    async generateForPeer(peer) {
        let config = {
            version: "2",
            volumes: await this.getVolumeBlock(peer),
            services: {
                ...await this.getCaServiceBlock(),
                ...await this.getPeerServiceBlock(peer),
                ...await this.getCouchdbServiceBlock(),
                ...await this.getApiServiceBlock(peer),
                ...await this.getCliServiceBlock(),
                ...await this.getWwwServiceBlock()
            }
        }
        return config;
    }

    async getVolumeBlock(peer) {
        let volumeBlock = {
            [`${peer.name}`]: null
        };
        return volumeBlock;
    }

    /**
     * Only called for a peer and not an orderer
     */
    async getCaServiceBlock() {
        let globString = `${this.organizationManager.rootDirectory}/building/artifacts/crypto-config/peerOrganizations/${this.organizationManager.name}/ca/*_sk`;
        let files = await glob(globString, { absolute: true });  //TODO Check that it returns the correct filename
        let caPrivateKeyName = path.basename(files[0]);

        let block = {
            [`ca.${this.organizationManager.name}`]: {
                "container_name": `ca.${this.organizationManager.name}`,
                "image": "hyperledger/fabric-ca:1.4.0",
                "environment": [
                    "FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server",
                    `FABRIC_CA_SERVER_CA_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.${this.organizationManager.name}-cert.pem`,
                    `FABRIC_CA_SERVER_CA_KEYFILE=/etc/hyperledger/fabric-ca-server-config/${caPrivateKeyName}`,
                    "FABRIC_CA_SERVER_TLS_ENABLED=true",
                    `FABRIC_CA_SERVER_CA_NAME=ca.${this.organizationManager.name}`,
                    `FABRIC_CA_SERVER_TLS_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.${this.organizationManager.name}-cert.pem`,
                    `FABRIC_CA_SERVER_TLS_KEYFILE=/etc/hyperledger/fabric-ca-server-config/${caPrivateKeyName}`
                ],
                "ports": [
                    "7054:7054"
                ],
                "command": "sh -c 'fabric-ca-server start -b admin:adminpw -d'",
                "volumes": [
                    `../artifacts/crypto-config/peerOrganizations/${this.organizationManager.name}/ca/:/etc/hyperledger/fabric-ca-server-config`,
                    `../artifacts/fabric-ca-server-config-${this.organizationManager.name}.yaml:/etc/hyperledger/fabric-ca-server/fabric-ca-server-config.yaml`
                ]
            }
        }
        return block;
    }

    async getOrdererServiceBlock(peer) {
        let block = {
            [peer.name]: {
                "container_name": peer.name,
                "image": "hyperledger/fabric-orderer:1.4.2",
                "environment": [
                    "ORDERER_GENERAL_LOGLEVEL=debug",
                    "ORDERER_GENERAL_LISTENADDRESS=0.0.0.0",
                    "ORDERER_GENERAL_GENESISMETHOD=file",
                    "ORDERER_GENERAL_GENESISFILE=/etc/hyperledger/configtx/genesis.block",
                    `ORDERER_GENERAL_LOCALMSPID=${this.organizationManager.name}MSP`,
                    `ORDERER_GENERAL_LOCALMSPDIR=/etc/hyperledger/crypto/orderer/msp`,
                    "ORDERER_GENERAL_TLS_ENABLED=true",
                    `ORDERER_GENERAL_TLS_PRIVATEKEY=/etc/hyperledger/crypto/orderer/tls/server.key`,
                    `ORDERER_GENERAL_TLS_CERTIFICATE=/etc/hyperledger/crypto/orderer/tls/server.crt`,
                    `ORDERER_GENERAL_TLS_ROOTCAS=[/etc/hyperledger/crypto/orderer/tls/ca.crt]`
                ],
                "working_dir": "/etc/hyperledger",
                "command": "orderer",
                "ports": [
                    "7050:7050"
                ],
                "volumes": [
                    "../artifacts/channel:/etc/hyperledger/configtx",
                    `../artifacts/crypto-config/ordererOrganizations/${this.organizationManager.name}/orderers/${peer.name}/:/etc/hyperledger/crypto/orderer`,
                    `${peer.name}:/var/hyperledger/production/orderer`
                ]
            }
        }
        return block;
    }

    async getPeerServiceBlock(peer) {
        let defaults = {
            peerPort: 7051,
            peerEventPort: 7053
        }
        let block = {
            [peer.name]: {
                "container_name": peer.name,
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "peer-base"
                },
                "environment": [
                    `CORE_PEER_ID=${peer.name}`,
                    `CORE_PEER_LOCALMSPID=${this.organizationManager.name}MSP`,
                    `CORE_PEER_ADDRESS=${peer.ip}:7051`,
                    `CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052`,
                    "CORE_LEDGER_STATE_STATEDATABASE=CouchDB",
                    "CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE:true",
                    `CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.${this.organizationManager.name}:5984`,
                    "CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=",
                    "CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD="
                ],
                "ports": [
                    `${defaults.peerPort}:7051`,
                    `${defaults.peerEventPort}:7053`
                ],
                "volumes": [
                    `../artifacts/crypto-config/peerOrganizations/${this.organizationManager.name}/peers/${peer.name}/:/etc/hyperledger/crypto/peer`,
                    `${peer.name}:/var/hyperledger/production`,
                    "/var/run/docker.sock:/var/run/docker.sock"
                ],
                "depends_on": [
                    `ca.${this.organizationManager.name}`,
                    `couchdb.${this.organizationManager.name}`
                ],
                // "extra_hosts": [
                //     `${this.organizationManager.mainPeerName}": ${this.organizationManager.otherOrgs.find(e => e.isOrderer).ip}`,  //TODO Change with orderer full adress  //TODO Shouldn't it be .ip instead of .value ?
                //     `couchdb.${this.organizationManager.name}: ${this.organizationManager.ip}`  //TODO Ici on suppose que couchDB tourne sur la mainPeer
                // ]
            }
        }
        return block;
    }

    async getCouchdbServiceBlock() {
        let defaults = {
            "couchDbPort": 5984
        }
        let block = {
            [`couchdb.${this.organizationManager.name}`]: {
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "couchdb-base"
                },
                "container_name": `couchdb.${this.organizationManager.name}`,
                "environment": [
                    "COUCHDB_USER=",
                    "COUCHDB_PASSWORD="
                ],
                "ports": [
                    `${defaults.couchDbPort}:5984`
                ]
            }
        }
        return block;
    }

    async getApiServiceBlock(peer) {
        let block = {
            [`api.${this.organizationManager.name}`]: {
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "api-base"
                },
                "container_name": `api.${this.organizationManager.name}`,
                "ports": [
                    "4000:4000"
                ],
                "environment": [
                    `ORG=${this.organizationManager.name}`,
                    "PORT=4000"
                ],
                "depends_on": [
                    peer.name
                ],
                // "extra_hosts": [
                //     `couchdb.${this.organizationManager.name}: ${this.organizationManager.ip}`
                // ]
            }
        }
        // for (let org of this.organizationManager.otherOrgs) {
        //     block[`api.${this.organizationManager.name}`]["extra_hosts"].push(`${org.mainPeerName}: ${org.ip}`);
        // }
        return block;
    }

    async getCliServiceBlock() {
        let block = {
            [`cli`]: {
                "container_name": `cli`,
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "cli-base"
                },
                "environment": [
                    `CORE_PEER_LOCALMSPID=${this.organizationManager.name}MSP`
                ],
                "volumes": [
                    `../artifacts/crypto-config/ordererOrganizations/${this.organizationManager.otherOrgs.find(e => e.isOrderer).name}/orderers/${this.organizationManager.otherOrgs.find(e => e.isOrderer).mainPeerName}/tls:/etc/hyperledger/crypto/orderer/tls`,
                    `../artifacts/crypto-config/peerOrganizations/${this.organizationManager.name}/users/Admin@${this.organizationManager.name}:/etc/hyperledger/crypto/peer`
                ],
                // "extra_hosts": [  //TODO This needs to be dynamically set
                //     `orderer.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.isOrderer).ip}`
                // ]
            }
        }
        return block;
    }

    async getWwwServiceBlock() {
        let defaults = {
            wwwPort: 8080
        }
        let block = {
            [`www`]: {
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "www-base"
                },
                "container_name": `www`,
                "ports": [
                    `${defaults.wwwPort}:80`
                ]
            }
        }
        return block;
    }

}

module.exports = DockercomposeGenerator;