export AWS_PROFILE=myrmica
export AWS_REGION=eu-west-2

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source $DIR/scripts/functions.sh

# machineCreate myrmica-addeo
# machineCreate myrmica-shoyo
# machineCreate myrmica-aucoffre
# machineCreate myrmica-orderer

machinePushEnv myrmica-addeo
machinePushEnv myrmica-shoyo
machinePushEnv myrmica-aucoffre
machinePushEnv myrmica-orderer

export IP_ORDERER=$(docker-machine ip myrmica-orderer)
export IP1=$(docker-machine ip myrmica-addeo)
export IP2=$(docker-machine ip myrmica-shoyo)
export IP3=$(docker-machine ip myrmica-aucoffre)

machineGeneratePeer myrmica-addeo addeo
machineGeneratePeer myrmica-shoyo shoyo
machineGeneratePeer myrmica-aucoffre aucoffre
machineGenerateOrderer myrmica-orderer

machineUpOrderer myrmica-orderer
machineUpPeer myrmica-addeo 1
machineUpPeer myrmica-shoyo 2
machineUpPeer myrmica-aucoffre 3
