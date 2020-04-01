// methods to use assets and datas containerd in the ledger

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
)

//toChainecodeAgrs change type of arguments in order to call other methods
func toChaincodeArgs(args ...string) [][]byte {
	bargs := make([][]byte, len(args))
	for i, arg := range args {
		bargs[i] = []byte(arg)
	}
	return bargs
}

// ========================================================================
// Get methods that return an asset
// ========================================================================

func getPerson(stub shim.ChaincodeStubInterface, id string) (Person, error) {
	var person Person
	personAsBytes, err := stub.GetState(id)
	if err != nil {
		return person, errors.New("Failed to find identity - " + id)
	}

	json.Unmarshal(personAsBytes, &person)

	if person.ID != id { //test if identity is actually here or just nil
		return person, errors.New("Identity does not exist - " + id)
	}

	if person.ObjectType != "person" {
		return person, errors.New("This is related to a Person")
	}

	return person, nil
}

func getCompany(stub shim.ChaincodeStubInterface, id string) (Company, error) {
	var company Company
	companyAsBytes, err := stub.GetState(id)
	if err != nil {
		return company, errors.New("Failed to find identity - " + id)
	}

	json.Unmarshal(companyAsBytes, &company)

	if company.ID != id { //test if identity is actually here or just nil
		return company, errors.New("Identity does not exist - " + id)
	}

	if company.ObjectType != "company" {
		return company, errors.New("This is related to a Person")
	}

	return company, nil
}

func createDocuments(array []string) []Document {
	var document Document
	var documents []Document
	j := 0
	var interval int
	for i, v := range array {
		interval = 3 * j
		if i == interval {
			document.Name = v
		} else if i == (interval + 1) {
			document.Type = v
		} else if i == (interval + 2) {
			document.Hash = v
			document.LastUpdate = time.Now()
			documents = append(documents, document)
			j++
		}
	}
	return documents
}

func setDocument(userDocuments []Document, documents []Document) []Document {
	if userDocuments == nil {
		userDocuments = append(userDocuments, documents[0])
		documents = documents[1:]
	}

	fmt.Println(userDocuments)
	fmt.Println(documents)

	for i := 0; i < len(userDocuments); i++ {
		for j := len(documents) - 1; j >= 0; j-- {
			if userDocuments[i].Type == documents[j].Type { //if type match, replace the document
				userDocuments[i] = documents[j]
				documents = append(documents[:j], documents[j+1:]...) // remove the document form array
			}
		}
	}

	userDocuments = append(userDocuments, documents...) // add lefting documents

	return userDocuments

}

func getAuthorisationsList(stub shim.ChaincodeStubInterface, id string) AuthorisationsList {
	var authorisationsList AuthorisationsList
	AuthorisationsListAsBytes, _ := stub.GetState(id + "-authorisationsList")
	json.Unmarshal(AuthorisationsListAsBytes, &authorisationsList)

	return authorisationsList
}

func queryAuthorisationsForUser(authorisationsList []Authorisations, id string) (Authorisations, error) {
	var authorisations Authorisations
	for _, elem := range authorisationsList {
		if elem.User == id {
			authorisations = elem
			return authorisations, nil
		}
	}
	return authorisations, errors.New("no authorisations found for this user")
}
