# Fabric-start - Myrmica

The following scripts allow you to start a complete network for your own usage, or join an existing one.

The scripts are, at the time of writing, implementing the following specs:
* Hyperledger fabric network, version 1.4.
* Use cryptogen to generate the certificates.
* Use one solo orderer.

If you want to use your own architecture, you can jump directly to [the alternatives section](#alternative).

## 0. Requirements

### 0.1 Softwares
- docker: https://docs.docker.com/engine/install/ubuntu/
- docker-compose: https://docs.docker.com/compose/install/
- docker-machine: https://docs.docker.com/machine/install-machine/
- npm and nodejs: https://github.com/tj/n

### 0.2 Cloud instances

Two different options here:
- You have AWS environment variables configured with a role that allow you to create EC2 instances. Thus the scripts in this repository will create docker-machines.
- Or you want to use your own cloud provider.

For the latter, you can create your own cloud instances as long as they are referenced by docker-machine (see https://docs.docker.com/machine/get-started-cloud/).  
The created machines need to:
- Have open ports: `2377, 7946, 7946/udp, 4789, 4789/udp, 9000, 7050, 7051, 8080, 8090, 4000`.
- Have their names referenced in your `conf.json` in the `organization.peers[i].name` properties and remove the `organization.peers[i].ec2Type` properties.

## 1. Usage {: #usage }

Let's call *prototype network* the network in which we'll all join and that is not the final version of the Myrmica network.  
Starting the prototype network will roughly follow the same steps as you can find in `test/index.js`, except that it will need coordination of all the partners.

Coordination for starting the first prototype network will occur in the following issue : *TODO create the issue*.

## 2. Alternative : use your own scripts {: #alternative }

Instead of using the provided scripts, you can use your own management of your peers/certificates. You'll still need, however, to implement the requirements in order to be reachable in the network:
- Hyperledger fabric version 1.4.
- Use the $ORG_NAME that will be given to your organization.
- Share your main peer IP address.
- Expose the following file on http://$MAIN_PEER_IP:8080 :
  - The `$CHANNEL_NAME.block` on `/` if you are the main org (i.e. creator) of a channel.
  - The certificate of your admin (`Admin@$ORG_NAME-cert.pem`) in `/crypto-config/peerOrganizations/$ORG_NAME/msp/admincerts/`.
  - The certificate of your CA (`ca.$ORG_NAME-cert.pem`) in `/crypto-config/peerOrganizations/$ORG_NAME/msp/cacerts/`.
  - The TLS certificate of your CA (`tlsca.$ORG_NAME-cert.pem`) in `/crypto-config/peerOrganizations/addeo/msp/tlscacerts/`.
  - The TLS certificate of your main peer (`ca.crt`) in `/crypto-config/peerOrganizations/$ORG_NAME/peers/$MAIN_PEER_NAME/tls/`.
- Retrieve certificates of other orgs that follow the same schema as above, except for the orderer that expose :
  - The `$CHANNEL_NAME.tx` files in `/channel/`.
  - The TLS certificate (`tlsca.$ORG_NAME-cert.pem`) of its CA in `/crypto-config/ordererOrganizations/$ORDERER_ORG_NAME/orderers/$ORDERER_MAIN_PEER_NAME/msp/tlscacerts/`. 
  - The TLS certificate (`ca.crt`) of its CA in `/crypto-config/ordererOrganizations/$ORDERER_ORG_NAME/orderers/$ORDERER_MAIN_PEER_NAME/tls/`. *TODO: What is the difference with the above ?*
  - TODO: The `network-config.json` file seems to be useless as it is bad rendered and the network still work.

You can still follow the steps on #usage in order to collaborate with other partners for starting/joining the network.
