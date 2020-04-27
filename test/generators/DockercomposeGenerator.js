var util = require('util');
const glob = util.promisify(require('glob'));
const fs = require('fs');
yaml = require('js-yaml');
var path = require('path');

class DockercomposeGenerator{

    //Prerequisites: Cryptogen has been already run

    constructor(organizationManager){
        this.organizationManager = organizationManager;
        this.orgExtension = `${this.organizationManager.name}.${this.organizationManager.domainName}`;
    }

    async generate(){
        for(let peer of this.organizationManager.peers){  //TODO The generate should on wether the peer is the main for the org or not, and wether it is an orderer or not (and also if orderer AND main org ?)
            let config = this.organizationManager.isOrderer?await this.generateForOrdererPeer(peer):await this.generateForPeer(peer);
            fs.writeFileSync(`${this.organizationManager.rootDirectory}/building/dockercompose/docker-compose-${this.organizationManager.name}-${peer.name}.yaml`, yaml.safeDump(config));
        }
    }

    async generateForOrdererPeer(peer){
        let config = {
            version: 2,
            volumes: await this.getVolumeBlock(peer),
            services: []
        }
        config.services.push(await this.getOrdererServiceBlock(peer));
        config.services.push(await this.getCliServiceBlock());
        config.services.push(await this.getWwwServiceBlock());
        return config;
    }

    async generateForPeer(peer){
        let config = {
            version: 2,
            volumes: await this.getVolumeBlock(peer),
            services: []
        }
        config.services.push(await this.getCaServiceBlock());
        config.services.push(await this.getPeerServiceBlock(peer));
        config.services.push(await this.getCouchdbServiceBlock());
        config.services.push(await this.getApiServiceBlock(peer));
        config.services.push(await this.getCliDomainServiceBlock());
        config.services.push(await this.getCliServiceBlock());
        config.services.push(await this.getWwwServiceBlock());
        return config;
    }

    async getVolumeBlock(peer){
        let volumeBlock = {
            [`${peer.name}`]: null
        };
        return volumeBlock;
    }

    /**
     * Only called for a peer and not an orderer
     */
    async getCaServiceBlock(){
        let globString = `${this.organizationManager.rootDirectory}/building/artifacts/crypto-config/peerOrganizations/${this.orgExtension}/ca/*_sk`;
        let files = await glob(globString, {absolute: true});  //TODO Check that it returns the correct filename
        let caPrivateKeyName = path.basename(files[0]);

        let block = {
            [`ca.${this.orgExtension}`]: {
                "container_name": `ca.${this.orgExtension}`,
                "image": "hyperledger/fabric-ca:1.4.0",
                "environment": [
                    "FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server",
                    `FABRIC_CA_SERVER_CA_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.${this.orgExtension}-cert.pem`,
                    `FABRIC_CA_SERVER_CA_KEYFILE=/etc/hyperledger/fabric-ca-server-config/${caPrivateKeyName}`,
                    "FABRIC_CA_SERVER_TLS_ENABLED=true",
                    `FABRIC_CA_SERVER_CA_NAME=ca.${this.orgExtension}`,
                    `FABRIC_CA_SERVER_TLS_CERTFILE=/etc/hyperledger/fabric-ca-server-config/ca.${this.orgExtension}-cert.pem`,
                    `FABRIC_CA_SERVER_TLS_KEYFILE=/etc/hyperledger/fabric-ca-server-config/${caPrivateKeyName}`
                ],
                "ports": [
                    "CA_PORT:7054"
                ],
                "command": "sh -c 'fabric-ca-server start -b admin:adminpw -d'",
                "volumes": [
                    `../artifacts/crypto-config/peerOrganizations/${this.orgExtension}/ca/:/etc/hyperledger/fabric-ca-server-config`,
                    `../artifacts/fabric-ca-server-config-${this.organizationManager.name}.yaml:/etc/hyperledger/fabric-ca-server/fabric-ca-server-config.yaml`
                ]
            }
        }
        return block;
    }

    async getOrdererServiceBlock(peer){
        let block = {
            [peer.name]: {
                "container_name": peer.name,
                "image": "hyperledger/fabric-orderer:1.4.0",
                "environment": [
                    "ORDERER_GENERAL_LOGLEVEL=debug",
                    "ORDERER_GENERAL_LISTENADDRESS=0.0.0.0",
                    "ORDERER_GENERAL_GENESISMETHOD=file",
                    "ORDERER_GENERAL_GENESISFILE=/etc/hyperledger/configtx/genesis.block",
                    `ORDERER_GENERAL_LOCALMSPID=${this.organizationManager.name}MSP`,
                    `ORDERER_GENERAL_LOCALMSPDIR=/etc/hyperledger/crypto/${this.organizationManager.name}/msp`,  //TODO Should it be organization name or "orderer" ?
                    "ORDERER_GENERAL_TLS_ENABLED=true",
                    `ORDERER_GENERAL_TLS_PRIVATEKEY=/etc/hyperledger/crypto/${this.organizationManager.name}/tls/server.key`,
                    `ORDERER_GENERAL_TLS_CERTIFICATE=/etc/hyperledger/crypto/${this.organizationManager.name}/tls/server.crt`,
                    `ORDERER_GENERAL_TLS_ROOTCAS=[/etc/hyperledger/crypto/${this.organizationManager.name}/tls/ca.crt]`
                ],
                "working_dir": "/etc/hyperledger",
                "command": "orderer",
                "ports": [
                    "ORDERER_PORT:7050"
                ],
                "volumes": [
                    "../artifacts/channel:/etc/hyperledger/configtx",
                    `../artifacts/crypto-config/ordererOrganizations/${this.organizationManager.domainName}/orderers/${peer.name}/:/etc/hyperledger/crypto/orderer`,
                    "orderer.DOMAIN:/var/hyperledger/production/orderer"
                ]
            }
        }
        return block;
    }

    async getPeerServiceBlock(peer){
        let defaults = {
            peerPort:7051,
            peerEventPort:7053
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
                    `CORE_PEER_ADDRESS=${peer.name}:7051`,
                    `CORE_PEER_CHAINCODELISTENADDRESS=${peer.name}:7052`,
                    "CORE_LEDGER_STATE_STATEDATABASE=CouchDB",
                    "CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE:true",
                    `CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb.${this.orgExtension}:5984`,
                    "CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=",
                    "CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD="
                ],
                "ports": [
                    `${defaults.peerPort}:7051`,
                    `${defaults.peerEventPort}:7053`
                ],
                "volumes": [
                    `../artifacts/crypto-config/peerOrganizations/${this.orgExtension}/peers/${peer.name}/:/etc/hyperledger/crypto/peer`,
                    `${peer.name}:/var/hyperledger/production`,
                    "/var/run/docker.sock:/var/run/docker.sock"
                ],
                "depends_on": [
                    `ca.${this.orgExtension}`,
                    `couchdb.${this.orgExtension}`
                ],
                "extra_hosts": [
                        `orderer.${this.orgExtension}": ${this.organizationManager.otherOrgs.filter(e => e.name=="orderer")[0].value}`,  //TODO Change with orderer full adress  //TODO Shouldn't it be .ip instead of .value ?
                        `couchdb.${this.orgExtension}: ${this.organizationManager.ip}`  //TODO Ici on suppose que couchDB tourne sur la mainPeer
                ]
            }
        }
        return block;
    }

    async getCouchdbServiceBlock(){
        let defaults = {
            "couchDbPort": 5984
        }
        let block = {
            [`couchdb.${this.orgExtension}`]: {
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "couchdb-base"
                },
                "container_name": `couchdb.${this.orgExtension}`,
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

    async getApiServiceBlock(peer){
        let block = {
            [`api.${this.orgExtension}`]: {
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "api-base"
                },
                "container_name": `api.${this.orgExtension}`,
                "ports": [
                    "API_PORT:4000"
                ],
                "environment": [
                    "ORG=ORG",
                    "PORT=4000"
                ],
                "depends_on": [
                    peer.name
                ],
                "extra_hosts": [
                    `couchdb.${this.orgExtension}: ${this.organizationManager.ip}`
                ]
            }
        }
        for(let org of this.organizationManager.otherOrgs){
            block[`api.${this.orgExtension}`]["extra_hosts"].push(`${org.mainPeerName}: ${org.ip}`);
        }
        return block;
    }

    async getCliDomainServiceBlock(){
        let block = {
            [`cli.${this.organizationManager.domainName}`]: {
                "container_name": `cli.${this.organizationManager.domainName}`,
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "cli-base"
                },
                "volumes": [
                    `../artifacts/crypto-config/ordererOrganizations/${this.organizationManager.domainName}/orderers/${this.organizationManager.otherOrgs.filter(e => e.name=="orderer")[0].mainPeerName}/tls:/etc/hyperledger/crypto/orderer/tls`
                ],
                "extra_hosts": [  //TODO This needs to be dynamically set
                    `orderer.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="orderer")[0].ip}`,
                    `www.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="orderer")[0].ip}`,
                    `www.addeo.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="addeo")[0].ip}`,
                    `www.aucoffre.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="aucoffre")[0].ip}`,
                    `www.shoyo.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="shoyo")[0].ip}`
                ]
            }
        }
        return block;
    }

    async getCliServiceBlock(){
        let block = {
            [`cli.${this.orgExtension}`]: {
                "container_name": `cli.${this.orgExtension}`,
                "extends": {
                    "service": `cli.${this.organizationManager.domainName}`
                },
                "environment": [
                    `CORE_PEER_LOCALMSPID=${this.organizationManager.name}MSP`
                ],
                "volumes": [
                    `../artifacts/crypto-config/peerOrganizations/${this.orgExtension}/users/Admin@${this.orgExtension}:/etc/hyperledger/crypto/peer`
                ],
                "extra_hosts": [  //TODO This needs to be dynamically set
                    `orderer.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="orderer")[0].ip}`,
                    `www.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="orderer")[0].ip}`,
                    `www.addeo.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="addeo")[0].ip}`,
                    `www.aucoffre.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="aucoffre")[0].ip}`,
                    `www.shoyo.myrmica.com: ${this.organizationManager.otherOrgs.filter(e => e.name=="shoyo")[0].ip}`
                ]
            }
        }
        return block;
    }

    async getWwwServiceBlock(){
        let defaults = {
            wwwPort: 8080
        }
        let block = {
            [`www.${this.orgExtension}`]: {
                "extends": {
                    "file": "base-intercept.yaml",
                    "service": "www-base"
                },
                "container_name": `www.${this.orgExtension}`,
                "ports": [
                    `${defaults.wwwPort}:80`
                ]
            }
        }
        return block;
    }

}

module.exports = DockercomposeGenerator;