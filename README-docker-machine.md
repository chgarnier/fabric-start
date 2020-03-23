```bash
export AWS_PROFILE=myrmica
export AWS_REGION=eu-west-2

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
 myrmica-orderer
# Then install docker-compose
docker-machine ssh myrmica-orderer 'sudo usermod -aG docker $(whoami)'  # To run docker as non-root
docker-machine ssh myrmica-orderer 'sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose'
docker-machine ssh myrmica-orderer 'sudo chmod +x /usr/local/bin/docker-compose'

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
 myrmica-addeo
# Then install docker-compose
docker-machine ssh myrmica-addeo 'sudo usermod -aG docker $(whoami)'  # To run docker as non-root
docker-machine ssh myrmica-addeo 'sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose'
docker-machine ssh myrmica-addeo 'sudo chmod +x /usr/local/bin/docker-compose'

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
 myrmica-shoyo
 # Then install docker-compose
docker-machine ssh myrmica-shoyo 'sudo usermod -aG docker $(whoami)'  # To run docker as non-root
docker-machine ssh myrmica-shoyo 'sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose'
docker-machine ssh myrmica-shoyo 'sudo chmod +x /usr/local/bin/docker-compose'

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
 myrmica-aucoffre
# Then install docker-compose
docker-machine ssh myrmica-aucoffre 'sudo usermod -aG docker $(whoami)'  # To run docker as non-root
docker-machine ssh myrmica-aucoffre 'sudo curl -L "https://github.com/docker/compose/releases/download/1.25.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose'
docker-machine ssh myrmica-aucoffre 'sudo chmod +x /usr/local/bin/docker-compose'

export IP_ORDERER=$(docker-machine ip myrmica-orderer)
export IP1=$(docker-machine ip myrmica-addeo)
export IP2=$(docker-machine ip myrmica-shoyo)
export IP3=$(docker-machine ip myrmica-aucoffre)

tar -czf /tmp/fabric-start.tar.gz .

docker-machine scp /tmp/fabric-start.tar.gz myrmica-orderer:/tmp/fabric-start.tar.gz
docker-machine ssh myrmica-orderer "rm -rf ~/fabric-start/ && mkdir ~/fabric-start/ && tar -xvzf /tmp/fabric-start.tar.gz -C ~/fabric-start/"

docker-machine scp /tmp/fabric-start.tar.gz myrmica-addeo:/tmp/fabric-start.tar.gz
docker-machine ssh myrmica-addeo "rm -rf ~/fabric-start/ && mkdir ~/fabric-start/ && tar -xvzf /tmp/fabric-start.tar.gz -C ~/fabric-start/"
docker-machine ssh myrmica-addeo "cd ~/fabric-start && ./network.sh -m generate-peer -o addeo"

docker-machine scp /tmp/fabric-start.tar.gz myrmica-shoyo:/tmp/fabric-start.tar.gz
docker-machine ssh myrmica-shoyo "rm -rf ~/fabric-start/ && mkdir ~/fabric-start/ && tar -xvzf /tmp/fabric-start.tar.gz -C ~/fabric-start/"
docker-machine ssh myrmica-shoyo "cd ~/fabric-start && ./network.sh -m generate-peer -o shoyo"

docker-machine scp /tmp/fabric-start.tar.gz myrmica-aucoffre:/tmp/fabric-start.tar.gz
docker-machine ssh myrmica-aucoffre "rm -rf ~/fabric-start/ && mkdir ~/fabric-start/ && tar -xvzf /tmp/fabric-start.tar.gz -C ~/fabric-start/"
docker-machine ssh myrmica-aucoffre "cd ~/fabric-start && ./network.sh -m generate-peer -o aucoffre"

docker-machine ssh myrmica-orderer "cd ~/fabric-start && ./network.sh -m generate-orderer"
docker-machine ssh myrmica-orderer "cd ~/fabric-start && ./network.sh -m up-orderer"

docker-machine ssh myrmica-addeo "cd ~/fabric-start &&  ./network.sh -m up-1"
docker-machine ssh myrmica-shoyo "cd ~/fabric-start &&  ./network.sh -m up-2"

```