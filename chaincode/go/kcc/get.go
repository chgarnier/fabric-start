// methods to read ledger
package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

// GetKyc returns the value of the specified asset key. arg is id or id and id requested
func (kcc *KycChaincode) get(stub shim.ChaincodeStubInterface, args []string) peer.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect arguments.")
	}

	valAsBytes, _ := stub.GetState(args[0])
	//if valAsBytes == nil {                                                  //this part is commented, api handle the error if valAsBytes is nil on get kyc
	//	return shim.Error("Key " + args[0] + " does not have value")
	//}

	return shim.Success(valAsBytes)
}

//getKyc read the ledger and send only datas allowed by user. args ar id(siren) and id user
func (kcc *KycChaincode) getForUser(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var authorisationsList AuthorisationsList
	var authorisations Authorisations
	var err error
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments")
	}

	authorisationsList = getAuthorisationsList(stub, args[1])
	authorisations, err = queryAuthorisationsForUser(authorisationsList.Authorisations, args[0])
	if err != nil {
		return shim.Error("no authorisation found for this user")
	}

	var kyc KYC
	var kycAuthorized KYC
	kyc = getKycState(stub, args[1])

	//kycAuthorized = createAuthorizedKyc(authorisations, kyc)
	kycAuthorized = fillAuthorizedKyc(authorisations.Questions, kyc)
	fmt.Println(kycAuthorized)
	resultAsBytes, _ := json.Marshal(kycAuthorized)
	return shim.Success(resultAsBytes)

}

//getAuthorisationsForUser send a json with all items selected for an user. args ars : id, id authorized user
func (kcc *KycChaincode) getAuthorisationsForUser(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var authorisationsList AuthorisationsList
	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments")
	}

	authorisationsList = getAuthorisationsList(stub, args[0])

	result, err := queryAuthorisationsForUser(authorisationsList.Authorisations, args[1])
	if err != nil {
		return shim.Error("no authorisations found for this user")
	}

	resultAsBytes, _ := json.Marshal(result)
	return shim.Success(resultAsBytes)
}
