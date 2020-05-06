class NetworkconfigGenerator {  //Only used by an ordererOrg that will generate the network

    constructor(organizationManager){
        this.organizationManager = organizationManager;
        this.orgExtension = `${this.organizationManager.name}`;  //TODO Useless now that we deleted the domain
    }

    async generate(){
        let config = {"network-config": {}};
        for(let org of this.organizationManager.otherOrgs){
            config["network-config"][org.name] = org.isOrderer?await this.getOrdererBlock(org):await this.getPeerBlock(org);
        }
        fs.writeFileSync(`${this.organizationManager.rootDirectory}/building/artifacts/network-config.json`, config);
    }

    async getOrdererBlock(org){
        return {
			"url": `grpcs://${org.ip}:7050`,
			"server-hostname": `${org.mainPeerName}`,
			"tls_cacerts": `crypto-config/ordererOrganizations/${org.name}/orderers/${org.mainPeerName}/tls/ca.crt`
		};
    }

    async getPeerBlock(org){
        let block = {
			"name":  `peer${org.name}`,
			"mspid": `${org.name}MSP`,
			"ca": `https://ca.${org.name}:7054`,  //TODO Remplacer le cryptogen par un CA
			"admin": {
				"key":  "crypto-config/peerOrganizations/ORG.DOMAIN/users/Admin@ORG.DOMAIN/msp/keystore",
				"cert": "crypto-config/peerOrganizations/ORG.DOMAIN/users/Admin@ORG.DOMAIN/msp/signcerts"
			}
        };
        for(let peer of org.peers){
            block[peer.name] = {
                "requests": `grpcs://${peer.name}:7051`,  //TODO Does peer.name really contains the full address to reach the peer ? It should because it kind of DNS resolve...
				"events": 	`grpcs://${peer.name}:7053`,
				"server-hostname": peer.name,
				"tls_cacerts": `crypto-config/peerOrganizations/${org.name}/peers/${peer.name}/tls/ca.crt`
            }
            if(peer.isMain){
                block[peer.name]["couchdb-ip-addr"] = `http://couchdb.${org.name}`;
                block[peer.name]["couchdb-port"] = "5984";
                block[peer.name]["key-value-store"] = "fabric-client/lib/impl/CouchDBKeyValueStore.js";
            }
        }
        return block;
    }

}

module.exports = NetworkconfigGenerator;