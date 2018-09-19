// methods to write the ledger

package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

//setPerson needs args : idUser(mail or Siren), firstname, lastname, phone, address(street), zip, city, country
func (icc *IdentityChaincode) setPerson(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var err error
	if len(args) != 8 {
		return shim.Error("Setting Person - Incorrect arguments. Expecting 8")
	}

	var person Person
	person.ObjectType = "person"
	person.ID = args[0]
	person.Firstname = strings.ToLower(args[1])
	person.Lastname = strings.ToLower(args[2])
	person.Phone = args[3]
	person.InsertionDate = time.Now()

	var address Address
	address.Address = string(args[4])
	address.ZIP = string(args[5])
	address.City = string(args[6])
	address.Country = string(args[7])

	person.Address = address

	//checking and set insertion date
	var previousPerson Person
	previousPersonAsBytes, _ := stub.GetState(args[0])
	json.Unmarshal(previousPersonAsBytes, &previousPerson)

	if previousPerson.InsertionDate == (time.Time{}) {
		person.InsertionDate = time.Now()
	} else {
		person.InsertionDate = previousPerson.InsertionDate
	}

	personAsBytes, _ := json.Marshal(person)
	err = stub.PutState(person.ID, personAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)
}

//args expected : siren, name, Person status, person's mail,firstname, lastname and IP
func (icc *IdentityChaincode) setCompany(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var err error
	if len(args) != 10 {
		return shim.Error("Incorrect arguments.Expecting 10")
	}

	var company Company
	company.ObjectType = "company"
	company.ID = args[0]
	company.Name = strings.ToLower(args[1])
	company.InsertionDate = time.Now()

	var address Address
	address.Address = string(args[2])
	address.ZIP = string(args[3])
	address.City = string(args[4])
	address.Country = string(args[5])

	company.Address = address

	if strings.ToLower(args[6]) == "director" {
		company.Director = append(company.Director, args[7])
	} else if strings.ToLower(args[6]) == "employee" {
		company.Employee = append(company.Employee, args[7])
	}

	//checking and set insertion date
	var previousCompany Person
	previousCompanyAsBytes, _ := stub.GetState(args[0])
	json.Unmarshal(previousCompanyAsBytes, &previousCompany)

	if previousCompany.InsertionDate == (time.Time{}) {
		company.InsertionDate = time.Now()
	} else {
		company.InsertionDate = previousCompany.InsertionDate
	}

	companyAsBytes, _ := json.Marshal(company)
	err = stub.PutState(company.ID, companyAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	shim.Success(nil)

	var person Person
	person, err = getPerson(stub, args[7])
	if err != nil {
		id := string(args[7])
		firstname := string(args[8])
		lastname := string(args[9])
		argsForPerson := []string{id, firstname, lastname, "null", "null", "null", "null", "null"}
		defer icc.setPerson(stub, argsForPerson)

	}
	fmt.Print(person)

	return shim.Success(nil)
}

// args expected : siren, person's status(director or employee), mail, firstname, lastname and IP
func (icc *IdentityChaincode) setCompanyPerson(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var err error
	var person Person
	if len(args) != 5 {
		return shim.Error("Incorrect arguments. Expecting 5")
	}

	company, err := getCompany(stub, args[0])
	if err != nil {
		return shim.Error("failed to get Company")
	}
	if strings.ToLower(args[1]) == "director" {
		company.Director = append(company.Director, args[2])
	} else if strings.ToLower(args[1]) == "employee" {
		company.Employee = append(company.Employee, args[2])
	}

	companyAsBytes, _ := json.Marshal(company)
	err = stub.PutState(company.ID, companyAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	person, err = getPerson(stub, args[2])
	if err != nil {
		id := string(args[2])
		firstname := string(args[3])
		lastname := string(args[4])
		argsForPerson := []string{id, firstname, lastname, "null"}
		defer icc.setPerson(stub, argsForPerson)

	}
	fmt.Print(person)

	return shim.Success(nil)

}

//setCredentials key is id"-documents".need args : id, name, type, hash, name, type, hash, name, type, hash...
func (icc *IdentityChaincode) addDocuments(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var err error
	var binder Binder
	if len(args) < 3 {
		return shim.Error("Incorrect arguments. Expecting at least 4")
	}

	//if exists, get the struct if corresponding to the key
	binderAsBytes, _ := stub.GetState(args[0] + "-documents")
	json.Unmarshal(binderAsBytes, &binder)

	array := args[1:]
	fmt.Println(array)
	documents := createDocuments(array)

	v := reflect.ValueOf(&binder).Elem().FieldByName("Documents")

	if v.IsValid() {
		vDocuments := v.Interface().([]Document)
		setted := setDocument(vDocuments, documents)
		v.Set(reflect.ValueOf(setted))
	}

	//persist the struct
	binderAsBytes, _ = json.Marshal(binder)
	err = stub.PutState(args[0]+"-documents", binderAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)

}

func (icc *IdentityChaincode) removeDocument(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	if len(args) != 2 {
		return shim.Error("2 arguments expected")
	}

	var binder Binder
	binderAsytes, _ := stub.GetState(args[0] + "-documents")
	json.Unmarshal(binderAsytes, &binder)
	for i := (len(binder.Documents) - 1); i >= 0; i-- {
		if binder.Documents[i].Type == args[1] {
			binder.Documents = append(binder.Documents[:i], binder.Documents[i+1:]...)
		}
	}

	binderAsytes, _ = json.Marshal(binder)
	err := stub.PutState(args[0]+"-documents", binderAsytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)

}

//setAuthorisations will store authorisations. args are id, user, data, data, data... data is a string : idQuestion
func (icc *IdentityChaincode) setAuthorisations(stub shim.ChaincodeStubInterface, args []string) peer.Response {
	var err error
	var authorisationsList AuthorisationsList
	var authorisations Authorisations
	if len(args) < 2 {
		return shim.Error("Not enough arguments")
	}

	authorisations.User = args[1]
	authorisations.Documents = append(authorisations.Documents, args[2:]...)

	authorisationsList = getAuthorisationsList(stub, args[0])

	flag := false
	for i, elem := range authorisationsList.Authorisations {
		if elem.User == authorisations.User {
			authorisationsList.Authorisations[i].Documents = authorisations.Documents
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
