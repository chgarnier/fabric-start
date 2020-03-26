starttime=$(date +%s)

# defaults; export these variables before executing this script
composeTemplatesFolder="docker-compose-templates"
artifactsTemplatesFolder="artifact-templates"
: ${FABRIC_STARTER_HOME:=$PWD}
: ${TEMPLATES_ARTIFACTS_FOLDER:=$FABRIC_STARTER_HOME/$artifactsTemplatesFolder}
: ${TEMPLATES_DOCKER_COMPOSE_FOLDER:=$FABRIC_STARTER_HOME/$composeTemplatesFolder}
: ${GENERATED_ARTIFACTS_FOLDER:=./artifacts}
: ${GENERATED_DOCKER_COMPOSE_FOLDER:=./dockercompose}

: ${DOMAIN:="myrmica.com"}
: ${IP_ORDERER:="20.188.39.7"}
: ${ORG1:=" "}
: ${ORG2:="shoyo"}
: ${ORG3:="aucoffre"}
: ${IP1:="20.188.37.77"}
: ${IP2:="40.89.187.109"}
: ${IP3:="52.143.174.104"}

echo "Use Fabric-Starter home: $FABRIC_STARTER_HOME"
echo "Use docker compose template folder: $TEMPLATES_DOCKER_COMPOSE_FOLDER"
echo "Use target artifact folder: $GENERATED_ARTIFACTS_FOLDER"
echo "Use target docker-compose folder: $GENERATED_DOCKER_COMPOSE_FOLDER"

[[ -d $GENERATED_ARTIFACTS_FOLDER ]] || mkdir $GENERATED_ARTIFACTS_FOLDER
[[ -d $GENERATED_DOCKER_COMPOSE_FOLDER ]] || mkdir $GENERATED_DOCKER_COMPOSE_FOLDER
cp -f "$TEMPLATES_DOCKER_COMPOSE_FOLDER/base.yaml" "$GENERATED_DOCKER_COMPOSE_FOLDER"
cp -f "$TEMPLATES_DOCKER_COMPOSE_FOLDER/base-intercept.yaml" "$GENERATED_DOCKER_COMPOSE_FOLDER"
if [[ -d ./$composeTemplatesFolder ]]; then cp -f "./$composeTemplatesFolder/base-intercept.yaml" "$GENERATED_DOCKER_COMPOSE_FOLDER"; fi


WGET_OPTS="--verbose -N"
CLI_TIMEOUT=10000
COMPOSE_TEMPLATE=$TEMPLATES_DOCKER_COMPOSE_FOLDER/docker-composetemplate.yaml
COMPOSE_FILE_DEV=$TEMPLATES_DOCKER_COMPOSE_FOLDER/docker-composedev.yaml

CHAINCODE_COMMON_NAME=icc
CHAINCODE_BILATERAL_NAME=med-app
CHAINCODE_COMMON_INIT='{"Args":["initLedger",""]}'
CHAINCODE_BILATERAL_INIT='{"Args":["initLedger",""]}'


DEFAULT_ORDERER_PORT=7050
DEFAULT_WWW_PORT=8080
DEFAULT_API_PORT=4000
DEFAULT_CA_PORT=7054
DEFAULT_PEER0_PORT=7051
DEFAULT_PEER0_EVENT_PORT=7053
DEFAULT_PEER1_PORT=7056
DEFAULT_PEER1_EVENT_PORT=7058
DEFAULT_COUCHDB_PORT=5984

DEFAULT_PEER_EXTRA_HOSTS1="extra_hosts:[newline]      - orderer.$DOMAIN:$IP_ORDERER[newline]      - couchdb.$ORG1.$DOMAIN:$IP1[newline]"
DEFAULT_PEER_EXTRA_HOSTS2="extra_hosts:[newline]      - orderer.$DOMAIN:$IP_ORDERER[newline]      - couchdb.$ORG2.$DOMAIN:$IP2[newline]"
DEFAULT_PEER_EXTRA_HOSTS3="extra_hosts:[newline]      - orderer.$DOMAIN:$IP_ORDERER[newline]      - couchdb.$ORG3.$DOMAIN:$IP3[newline]"
DEFAULT_CLI_EXTRA_HOSTS="extra_hosts:[newline]      - orderer.$DOMAIN:$IP_ORDERER[newline]      - www.$DOMAIN:$IP_ORDERER[newline]      - www.$ORG1.$DOMAIN:$IP1[newline]      - www.$ORG2.$DOMAIN:$IP2[newline]      - www.$ORG3.$DOMAIN:$IP3"
DEFAULT_API_EXTRA_HOSTS1="extra_hosts:[newline]      - orderer.$DOMAIN:$IP_ORDERER[newline]      - peer0.$ORG2.$DOMAIN:$IP2[newline]      - peer0.$ORG3.$DOMAIN:$IP3[newline]      - couchdb.$ORG1.$DOMAIN:$IP1[newline]"
DEFAULT_API_EXTRA_HOSTS2="extra_hosts:[newline]      - orderer.$DOMAIN:$IP_ORDERER[newline]      - peer0.$ORG1.$DOMAIN:$IP1[newline]      - peer0.$ORG3.$DOMAIN:$IP3[newline]      - couchdb.$ORG2.$DOMAIN:$IP2[newline]"
DEFAULT_API_EXTRA_HOSTS3="extra_hosts:[newline]      - orderer.$DOMAIN:$IP_ORDERER[newline]      - peer0.$ORG1.$DOMAIN:$IP1[newline]      - peer0.$ORG2.$DOMAIN:$IP2[newline]      - couchdb.$ORG3.$DOMAIN:$IP3[newline]"
GID=$(id -g)