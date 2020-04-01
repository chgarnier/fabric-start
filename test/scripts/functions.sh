function machineCreate(){ # Create a docker-machine
  name=$1
  docker-machine create --driver amazonec2 --amazonec2-region $AWS_REGION --amazonec2-instance-type "m5.large"\
   --amazonec2-open-port 2377\
   --amazonec2-open-port 7946\
   --amazonec2-open-port 7946/udp\
   --amazonec2-open-port 4789\
   --amazonec2-open-port 4789/udp\
   --amazonec2-open-port 9000\
   --amazonec2-open-port 7050\
   --amazonec2-open-port 7051\
   --amazonec2-open-port 8080\
   --amazonec2-open-port 8090\
   --amazonec2-open-port 4000\
   $name
  # Then install docker-compose
  docker-machine ssh $name 'sudo usermod -aG docker $(whoami)'  # To run docker as non-root
  docker-machine ssh $name 'sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose'
  docker-machine ssh $name 'sudo chmod +x /usr/local/bin/docker-compose'
}

function machinePushEnv(){ # scp local repository to the docker-machine
  name=$1
  tar -czf /tmp/fabric-start.tar.gz .
  docker-machine scp /tmp/fabric-start.tar.gz $name:/tmp/fabric-start.tar.gz
  docker-machine ssh $name "rm -rf ~/fabric-start/ && mkdir ~/fabric-start/ && tar -xvzf /tmp/fabric-start.tar.gz -C ~/fabric-start/"
}

function machineGeneratePeer(){
  name=$1
  org=$2
  docker-machine ssh $name\
   "\
   export IP_ORDERER=$IP_ORDERER IP1=$IP1 IP2=$IP2 IP3=$IP3 \
   && cd ~/fabric-start/building \
   && ./network.sh -m generate-peer -o $org\
   "
}

function machineGenerateOrderer(){
  name=$1
  docker-machine ssh $name\
   "\
   export IP_ORDERER=$IP_ORDERER IP1=$IP1 IP2=$IP2 IP3=$IP3 \
   && cd ~/fabric-start/building \
   && ./network.sh -m generate-orderer\
   "
}

function machineUpPeer(){
  name=$1
  number=$2
  docker-machine ssh $name \
   "\
   export IP_ORDERER=$IP_ORDERER IP1=$IP1 IP2=$IP2 IP3=$IP3 \
   && cd ~/fabric-start/building \
   && ./network.sh -m up-$number\
   "
}

function machineUpOrderer(){
  name=$1
  docker-machine ssh $name \
   "\
   export IP_ORDERER=$IP_ORDERER IP1=$IP1 IP2=$IP2 IP3=$IP3 \
   && cd ~/fabric-start/building \
   && ./network.sh -m up-orderer\
   "
}
