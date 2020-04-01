// methods to read ledgerwearewildbordeaux

package main

import (
	"encoding/json"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//ENHANCEMENT : ALWAYS HAVE TWO ARGS FOR GET METHOD ? OR MAKE GET METHOD FOR EACH NEEDS///////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// GetPerson returns the value of the specified asset key.args : id  /OR/  args : id,  id requested.
func (icc *IdentityChaincode) get(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var valAsBytes []byte
	var authorisationsList AuthorisationsList

	var err error
	if len(args) != 1 && len(args) != 2 {
		return shim.Error("Incorrect arguments. Check number of arguments")
	}

	if len(args) == 2 {
		authorisationsList = getAuthorisationsList(stub, args[1])
		_, err = queryAuthorisationsForUser(authorisationsList.Authorisations, args[0])
		if err != nil {
			return shim.Error("no authorisation found for this user")
		}

		valAsBytes, _ = stub.GetState(args[1])

	}

	//TODO : this part can be deleted to disable the possibility to get an information without checking authorisations
	if len(args) == 1 {
		valAsBytes, _ = stub.GetState(args[0])
	}

	if valAsBytes == nil {
		return shim.Error("Could not find item")
	}

	return shim.Success(valAsBytes)

}

//getAuthorisationsForUser send a json with all items selected for an user. args ars : id, id authorized user
func (icc *IdentityChaincode) getAuthorisationsForUser(stub shim.ChaincodeStubInterface, args []string) peer.Response {
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

//getDocuments returns all document for user in args[0]
func (icc *IdentityChaincode) getDocuments(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	if len(args) != 1 {
		return shim.Error("1 arguments expected")
	}

	binderAsBytes, _ := stub.GetState(args[0] + "-documents")

	return shim.Success(binderAsBytes)
}

//get Documents for User return all Documents for an user having authorisations to access. args are : id, id requested
func (icc *IdentityChaincode) getDocumentsForUser(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var authorisationsList AuthorisationsList
	var authorisations Authorisations
	var err error
	if len(args) != 2 {
		return shim.Error("2 arguments expected")
	}

	authorisationsList = getAuthorisationsList(stub, args[1])
	authorisations, err = queryAuthorisationsForUser(authorisationsList.Authorisations, args[0])
	if err != nil {
		return shim.Error("no authorisations found for this user")
	}

	var binder Binder
	binderAsBytes, _ := stub.GetState(args[1] + "-documents")
	json.Unmarshal(binderAsBytes, &binder)

	var binderAuthorized Binder
	for i := 0; i < len(authorisations.Documents); i++ {
		for j := 0; j < len(binder.Documents); j++ {
			if authorisations.Documents[i] == binder.Documents[j].Type {
				binderAuthorized.Documents = append(binderAuthorized.Documents, binder.Documents[j])
				break
			}
		}
	}
	binderAuthorizedAsBytes, _ := json.Marshal(binderAuthorized)
	return shim.Success(binderAuthorizedAsBytes)

}

//getDocument returns a document for user in args[0] corresponding to the type in args[1]
func (icc *IdentityChaincode) getDocument(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	if len(args) != 2 {
		return shim.Error("2 arguments expected")
	}
	var document Document
	var binder Binder
	binderAsBytes, _ := stub.GetState(args[0] + "-documents")
	json.Unmarshal(binderAsBytes, &binder)

	for i := 0; i < len(binder.Documents); i++ {
		if binder.Documents[i].Type == args[1] {
			document = binder.Documents[i]
			break
		}
	}

	documentAsBytes, _ := json.Marshal(document)
	return shim.Success(documentAsBytes)
}
