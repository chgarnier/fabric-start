export AWS_PROFILE=myrmica
export AWS_REGION=eu-west-2

./network.sh -m machine-create -o addeo
./network.sh -m machine-create -o shoyo
./network.sh -m machine-create -o aucoffre
./network.sh -m machine-create -o orderer

./network.sh -m machine-push-env -o addeo
./network.sh -m machine-push-env -o shoyo
./network.sh -m machine-push-env -o aucoffre
./network.sh -m machine-push-env -o orderer

export IP_ORDERER=$(docker-machine ip myrmica-orderer)
export IP1=$(docker-machine ip myrmica-addeo)
export IP2=$(docker-machine ip myrmica-shoyo)
export IP3=$(docker-machine ip myrmica-aucoffre)

./network.sh -m machine-generate-peer -o addeo
./network.sh -m machine-generate-peer -o shoyo
./network.sh -m machine-generate-peer -o aucoffre
./network.sh -m machine-generate-orderer -o orderer

./network.sh -m machine-up-orderer -o orderer
./network.sh -m machine-up-peer -o addeo 1
./network.sh -m machine-up-peer -o shoyo 2
./network.sh -m machine-up-peer -o aucoffre 3
