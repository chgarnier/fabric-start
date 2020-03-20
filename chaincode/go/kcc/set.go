// methods to write the ledger

package main

import (
	"encoding/json"
	"reflect"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

func (kcc *KycChaincode) set(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var kyc KYC
	var items []Item
	if ((len(args) - 1) % 5) != 0 {
		return shim.Error("Incorrect arguments")
	}
	checkIdentity(stub, args[0])
	kyc = getKycState(stub, args[0])

	array := args[1:]
	items = createItems(array)

	v := reflect.ValueOf(&kyc).Elem().FieldByName("Items")

	if v.IsValid() {
		vItems := v.Interface().([]Item)
		setted := setItems(vItems, items)
		v.Set(reflect.ValueOf(setted))
	}

	putKycState(stub, kyc, args[0])

	return shim.Success(nil)

}


//setAuthorisations will store authorisations. args are id, user, data, data, data... data is a string : idQuestion
func (kcc *KycChaincode) setAuthorisations(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var err error
	var authorisationsList AuthorisationsList
	var authorisations Authorisations
	if len(args) < 3 {
		return shim.Error("Not enough arguments")
	}

	authorisations.User = args[1]
	authorisations.Questions = append(authorisations.Questions, args[2:]...)

	authorisationsList = getAuthorisationsList(stub, args[0])

	flag := false
	for i, elem := range authorisationsList.Authorisations {
		if elem.User == authorisations.User {
			authorisationsList.Authorisations[i] = authorisations
			flag = true
			break
		}
	}

	if flag == false { // a false flag means that the user whose receive the autorisations is not setted at this point. We have to add him.
		authorisationsList.Authorisations = append(authorisationsList.Authorisations, authorisations)
	}

	AuthorisationsListAsBytes, _ := json.Marshal(authorisationsList)
	err = stub.PutState(args[0]+"-authorisationsList", AuthorisationsListAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)

}
