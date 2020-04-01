#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

source $DIR/scripts/env.sh
source $DIR/scripts/functions.sh

# Parse commandline args
while getopts "h?m:o:a:w:c:0:1:2:3:k:v:i:n:M:I:R:P:" opt; do
  case "$opt" in
    h|\?)
      printHelp
      exit 0
    ;;
    m)  MODE=$OPTARG
    ;;
    v)  CHAINCODE_VERSION=$OPTARG
    ;;
    o)  ORG=$OPTARG
    ;;
    M)  MAIN_ORG=$OPTARG
    ;;
    a)  API_PORT=$OPTARG
    ;;
    w)  WWW_PORT=$OPTARG
    ;;
    c)  CA_PORT=$OPTARG
    ;;
    0)  PEER0_PORT=$OPTARG
    ;;
    1)  PEER0_EVENT_PORT=$OPTARG
    ;;
    2)  PEER1_PORT=$OPTARG
    ;;
    3)  PEER1_EVENT_PORT=$OPTARG
    ;;
    k)  CHANNELS=$OPTARG
    ;;
    i) IP=$OPTARG
    ;;
    n) CHAINCODE=$OPTARG
    ;;
    I) CHAINCODE_INIT_ARG=$OPTARG
    ;;
    R) REMOTE_ORG=$OPTARG
    ;;
    P) ENDORSEMENT_POLICY=$OPTARG
    ;;
  esac
done

if [ "${MODE}" == "up" -a "${ORG}" == "" ]; then
  for org in ${DOMAIN} ${ORG1} ${ORG2} ${ORG3}
  do
    dockerComposeUp ${org}
  done

  for org in ${ORG1} ${ORG2} ${ORG3}
  do
    installAll ${org}
  done

  createJoinInstantiateWarmUp ${ORG1} common ${CHAINCODE_COMMON_NAME} ${CHAINCODE_COMMON_INIT}
  createJoinInstantiateWarmUp ${ORG1} "${ORG1}-${ORG2}" ${CHAINCODE_BILATERAL_NAME} ${CHAINCODE_BILATERAL_INIT}
  createJoinInstantiateWarmUp ${ORG1} "${ORG1}-${ORG3}" ${CHAINCODE_BILATERAL_NAME} ${CHAINCODE_BILATERAL_INIT}

  joinWarmUp ${ORG2} common ${CHAINCODE_COMMON_NAME}
  joinWarmUp ${ORG2} "${ORG1}-${ORG2}" ${CHAINCODE_BILATERAL_NAME}
  createJoinInstantiateWarmUp ${ORG2} "${ORG2}-${ORG3}" ${CHAINCODE_BILATERAL_NAME} ${CHAINCODE_BILATERAL_INIT}

  joinWarmUp ${ORG3} common ${CHAINCODE_COMMON_NAME}
  joinWarmUp ${ORG3} "${ORG1}-${ORG3}" ${CHAINCODE_BILATERAL_NAME}
  joinWarmUp ${ORG3} "${ORG2}-${ORG3}" ${CHAINCODE_BILATERAL_NAME}

elif [ "${MODE}" == "down" ]; then
  for org in ${DOMAIN} ${ORG1} ${ORG2} ${ORG3}
  do
    dockerComposeDown ${org}
  done

  removeUnwantedContainers
  removeUnwantedImages
elif [ "${MODE}" == "clean" ]; then
  clean
elif [ "${MODE}" == "generate" ]; then
  clean
  removeArtifacts

  generatePeerArtifacts ${ORG1} 4000 8081 7054 7051 7053 7056 7058 5984
  generatePeerArtifacts ${ORG2} 4001 8082 8054 8051 8053 8056 8058 6984
  generatePeerArtifacts ${ORG3} 4002 8083 9054 9051 9053 9056 9058 7984
  generateOrdererDockerCompose ${ORG1}
  generateOrdererArtifacts
  #generateWait
elif [ "${MODE}" == "generate-orderer" ]; then  # params: -M ORG (optional)
  generateOrdererDockerCompose ${MAIN_ORG}
  downloadArtifactsOrderer ${MAIN_ORG}
  generateOrdererArtifacts ${MAIN_ORG}
elif [ "${MODE}" == "generate-peer" ]; then # params: -o ORG -R true(optional- REMOTE_ORG)
  generatePeerArtifacts ${ORG} ${API_PORT} ${WWW_PORT} ${CA_PORT} ${PEER0_PORT} ${PEER0_EVENT_PORT} ${PEER1_PORT} ${PEER1_EVENT_PORT} ${COUCHDB_PORT}
  servePeerArtifacts ${ORG}
  if [ -n "$REMOTE_ORG" ]; then
    addOrgToCliHosts ${ORG} "orderer" ${IP_ORDERER}
    addOrgToCliHosts ${ORG} "www" ${IP_ORDERER}
    echo "$IP_ORDERER orderer.$DOMAIN" >> $GENERATED_ARTIFACTS_FOLDER/hosts/${thisOrg}/api_hosts
  fi
elif [ "${MODE}" == "up-orderer" ]; then
  dockerComposeUp ${DOMAIN}
  serveOrdererArtifacts
elif [ "${MODE}" == "up-one-org" ]; then # params: -o ORG -M mainOrg -k CHANNELS(optional)
  downloadArtifactsMember ${ORG} ${MAIN_ORG} "" $CHANNELS
  dockerComposeUp ${ORG}
  if [[ -n "$CHANNELS" ]]; then
    createChannel ${ORG} $CHANNELS
    joinChannel ${ORG} $CHANNELS
  fi
elif [ "${MODE}" == "update-sign-policy" ]; then # params: -o ORG -k common_channel
  updateSignPolicyForChannel $ORG $CHANNELS

elif [ "${MODE}" == "register-new-org" ]; then # params: -o ORG -M MAIN_ORG -i IP; example: ./network.sh -m register-new-org -o testOrg -i 172.12.34.56
  [[ -z "${ORG}" ]] && echo "missing required argument -o ORG: organization name to register in system" && exit 1
  [[ -z "${MAIN_ORG}" ]] && echo "missing required argument -M MAIN_ORG: main organization id" && exit 1
  [[ -z "${IP}" ]] && echo "missing required argument -i IP: ip address of the machine being registered" && exit 1
  addOrgToCliHosts ${MAIN_ORG} "www.${ORG}" ${IP}
  downloadArtifactsMember ${MAIN_ORG} ${MAIN_ORG} ${ORG}
  downloadMemberMSP ${ORG}

  registerNewOrg ${ORG} ${MAIN_ORG} ${IP} "$CHANNELS"
  addOrgToNetworkConfig ${ORG}
  copyNetworkConfigToWWW
  addOrgToApiHosts ${MAIN_ORG} ${ORG} ${IP}
  dockerContainerRestart ${MAIN_ORG} api
elif [ "${MODE}" == "add-org-connectivity" ]; then # params: -R remoteOrg -M mainOrg -o thisOrg -i IP
  [[ -z "${ORG}" ]] && echo "missing required argument -o ORG: organization name to register in system" && exit 1
  [[ -z "${MAIN_ORG}" ]] && echo "missing required argument -M MAIN_ORG: main organization id" && exit 1
  [[ -z "${REMOTE_ORG}" ]] && echo "missing required argument -R REMOTE_ORG: org id to define connection to" && exit 1
  [[ -z "${IP}" ]] && echo "missing required argument -i IP: ip address of the REMOTE_ORG (machine connection is established to)" && exit 1

  addOrgToCliHosts $ORG "www.$REMOTE_ORG" $IP
  downloadArtifactsMember ${ORG} ${MAIN_ORG} ${REMOTE_ORG}
  addOrgToApiHosts $ORG $REMOTE_ORG $IP
  dockerContainerRestart ${ORG} api
elif [ "${MODE}" == "restart-api" ]; then # params:  -o ORG
  dockerContainerRestart $ORG api
elif [ "${MODE}" == "create-channel" ]; then # params: mainOrg($3) channel_name org1 [org2] [org3]
  mainOrg=$3
  channel_name=$4
  generateChannelConfig ${@:3}
  createChannel $3 $channel_name
  joinChannel $3 $channel_name
  echo "Register Orgs in channel $channel_name: ${@:5}"
  for org in "${@:5}"; do
    sleep 1
    registerNewOrgInChannel $mainOrg $org $channel_name
  done

elif [ "${MODE}" == "register-org-in-channel" ]; then # params: mainOrg($3) channel_name org1 [org2] [org3]
  mainOrg=$3
  channel_name=$4
  echo "Register Orgs in channel $channel_name: ${@:5}"
  for org in "${@:5}"; do
    echo "Org ${org}"
    registerNewOrgInChannel $mainOrg $org $channel_name
  done

elif [ "${MODE}" == "join-channel" ]; then # params: thisOrg mainOrg channel
  downloadChannelBlockFile ${@:3}
  joinChannel ${3} $5
elif [ "${MODE}" == "install-chaincode" ]; then # example: install-chaincode -o nsd -v 2.0 -n book
  [[ -z "${ORG}" ]] && echo "missing required argument -o ORG: organization name to install chaincode into" && exit 1
  [[ -z "${CHAINCODE}" ]] && echo "missing required argument -n CHAINCODE: chaincode name to install" && exit 1
  [[ -z "${CHAINCODE_VERSION}" ]] && echo "missing required argument -v CHAINCODE_VERSION: chaincode version" && exit 1
  echo "Install chaincode: $ORG ${CHAINCODE} ${CHAINCODE_VERSION}"
  sleep 1
  installChaincode ${ORG} ${CHAINCODE} ${CHAINCODE_VERSION}

elif [ "${MODE}" == "instantiate-chaincode" ]; then # example: instantiate-chaincode -o nsd -k common -n book
  [[ -z "${ORG}" ]] && echo "missing required argument -o ORG: organization name to install chaincode into" && exit 1
  [[ -z "${CHAINCODE}" ]] && echo "missing required argument -d CHAINCODE: chaincode name to install" && exit 1
  [[ -z "${CHANNELS}" ]] && echo "missing required argument -k CHANNELS: channels list" && exit 1
  [[ -z "${CHAINCODE_INIT_ARG}" ]] && CHAINCODE_INIT_ARG=${CHAINCODE_COMMON_INIT}
  sleep 1
  instantiateChaincode ${ORG} "${CHANNELS}" ${CHAINCODE} ${CHAINCODE_INIT_ARG}

elif [ "${MODE}" == "warmup-chaincode" ]; then # example: instantiate-chaincode -o nsd -k common -n book
  [[ -z "${ORG}" ]] && echo "missing required argument -o ORG: organization name to install chaincode into" && exit 1
  [[ -z "${CHAINCODE}" ]] && echo "missing required argument -d CHAINCODE: chaincode name to install" && exit 1
  [[ -z "${CHANNELS}" ]] && echo "missing required argument -k CHANNELS: channels" && exit 1
  [[ -z "${CHAINCODE_INIT_ARG}" ]] && echo "missing required argument -I CHAINCODE_QUERY_ARG: chaincode query args" && exit 1
  sleep 3
  warmUpChaincode ${ORG} "${CHANNELS}" ${CHAINCODE} ${CHAINCODE_INIT_ARG}
elif [ "${MODE}" == "up-1" ]; then
  downloadArtifactsMember ${ORG1} "" "" common "${ORG1}-${ORG2}" "${ORG1}-${ORG3}"
  dockerComposeUp ${ORG1}
  installAll ${ORG1}

  createJoinInstantiateWarmUp ${ORG1} common ${CHAINCODE_COMMON_NAME} ${CHAINCODE_COMMON_INIT}

  createJoinInstantiateWarmUp ${ORG1} "${ORG1}-${ORG2}" ${CHAINCODE_BILATERAL_NAME} ${CHAINCODE_BILATERAL_INIT}

  createJoinInstantiateWarmUp ${ORG1} "${ORG1}-${ORG3}" ${CHAINCODE_BILATERAL_NAME} ${CHAINCODE_BILATERAL_INIT}

elif [ "${MODE}" == "up-2" ]; then
  downloadArtifactsMember ${ORG2} "" "" common "${ORG1}-${ORG2}" "${ORG2}-${ORG3}"
  dockerComposeUp ${ORG2}
  installAll ${ORG2}

  downloadChannelBlockFile ${ORG2} ${ORG1} common
  joinWarmUp ${ORG2} common ${CHAINCODE_COMMON_NAME}

  downloadChannelBlockFile ${ORG2} ${ORG1} "${ORG1}-${ORG2}"
  joinWarmUp ${ORG2} "${ORG1}-${ORG2}" ${CHAINCODE_BILATERAL_NAME}

  createJoinInstantiateWarmUp ${ORG2} "${ORG2}-${ORG3}" ${CHAINCODE_BILATERAL_NAME} ${CHAINCODE_BILATERAL_INIT}

elif [ "${MODE}" == "up-3" ]; then
  downloadArtifactsMember ${ORG3} "" "" common "${ORG1}-${ORG3}" "${ORG2}-${ORG3}"
  dockerComposeUp ${ORG3}
  installAll ${ORG3}

  downloadChannelBlockFile ${ORG3} ${ORG1} common
  joinWarmUp ${ORG3} common ${CHAINCODE_COMMON_NAME}

  downloadChannelBlockFile ${ORG3} ${ORG2} "${ORG2}-${ORG3}"
  joinWarmUp ${ORG3} "${ORG2}-${ORG3}" ${CHAINCODE_BILATERAL_NAME}

  downloadChannelBlockFile ${ORG3} ${ORG1} "${ORG1}-${ORG3}"
  joinWarmUp ${ORG3} "${ORG1}-${ORG3}" ${CHAINCODE_BILATERAL_NAME}

elif [ "${MODE}" == "addOrg" ]; then
  [[ -z "${ORG}" ]] && echo "missing required argument -o ORG" && exit 1
  [[ -z "${CHANNELS}" ]] && echo "missing required argument -k CHANNEL" && exit 1

  #./network.sh -m addOrg -o foo -k common -a 4003 -w 8084 -c 1054 -0 1051 -1 1053 -2 1056 -3 1058

  addOrg ${ORG} ${CHANNELS}

elif [ "${MODE}" == "logs" ]; then
  logs ${ORG}
elif [ "${MODE}" == "devup" ]; then
  devNetworkUp
elif [ "${MODE}" == "devinstall" ]; then
  devInstall
elif [ "${MODE}" == "devinstantiate" ]; then
  devInstantiate
elif [ "${MODE}" == "devinvoke" ]; then
  devInvoke
elif [ "${MODE}" == "devquery" ]; then
  devQuery
elif [ "${MODE}" == "devlogs" ]; then
  devLogs
elif [ "${MODE}" == "devdown" ]; then
  devNetworkDown
elif [ "${MODE}" == "printArgs" ]; then
  printArgs
elif [ "${MODE}" == "iterateChannels" ]; then
  iterateChannels
elif [ "${MODE}" == "removeArtifacts" ]; then
  removeArtifacts
elif [ "${MODE}" == "generateNetworkConfig" ]; then
  [[ -z "$3" ]] && generateNetworkConfig ${ORG1} ${ORG2} ${ORG3}
  [[ -n "$3" ]] && generateNetworkConfig ${@:3}
elif [ "${MODE}" == "addOrgToNetworkConfig" ]; then # -o ORG
  addOrgToNetworkConfig ${ORG}
elif [ "${MODE}" == "upgradeChaincode" ]; then #deprecated
  for org in ${ORG1} ${ORG2} ${ORG3}
  do
    upgradeChaincode ${org} ${CHAINCODE_COMMON_NAME} ${CHAINCODE_VERSION}
  done
elif [ "${MODE}" == "upgrade-chaincode" ]; then
  [[ -z "${ORG}" ]] && echo "missing required argument -o ORG: organization name to install chaincode into" && exit 1
  [[ -z "${CHAINCODE}" ]] && echo "missing required argument -d CHAINCODE: chaincode name to install" && exit 1
  [[ -z "${CHAINCODE_VERSION}" ]] && echo "missing required argument -v CHAINCODE_VERSION: chaincode version" && exit 1
  [[ -z "${CHAINCODE_INIT_ARG}" ]] && echo "missing required argument -I CHAINCODE_INIT_ARG: chaincode initialization arguments" && exit 1
  [[ -z "${CHANNELS}" ]] && echo "missing required argument -k CHANNEL" && exit 1
  echo "Upgrading with endorsement policy: ${ENDORSEMENT_POLICY}"
  upgradeChaincode ${ORG} ${CHAINCODE} ${CHAINCODE_VERSION} ${CHAINCODE_INIT_ARG} ${CHANNELS} ${ENDORSEMENT_POLICY}
else
  printHelp
  exit 1
fi

endtime=$(date +%s)
info "Finished in $(($endtime - $starttime)) seconds"
