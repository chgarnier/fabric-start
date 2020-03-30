//Put "icc" as name when you install or instantiate the chaincode

package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

// IdentityChaincode example simple Chaincode implementation
type IdentityChaincode struct {
}

// ========================================================================
// Asset Definitions - The ledger will store identity and kyc
// ========================================================================

// Person implements a simple chaincode to manage an asset -- Key is the mail
type Person struct {
	ObjectType    string    `json:"docType"` //field for couchdb
	ID            string    `json:"id"`      // insert mail
	Firstname     string    `json:"firstname"`
	Lastname      string    `json:"lastname"`
	Phone         string    `json:"phone"`
	InsertionDate time.Time `json:"insertion_date"`
	Address       Address   `json:"address"`
}

// Address implements a simple chaincode to manage an asset
type Address struct {
	Address string `json:"address"`
	ZIP     string `json:"zip"`
	City    string `json:"city"`
	Country string `json:"country"`
}

// Company implements a simple chaincode to manage an asset -- Key is the "siren"
type Company struct {
	ObjectType    string    `json:"docType"` //field for couchdb
	ID            string    `json:"ID"`
	Name          string    `json:"name"`
	Address       Address   `json:"address"`
	InsertionDate time.Time `json:"insertion_date"`
	Director      []string  `json:"director"`
	Employee      []string  `json:"employee"`
}

//Binder store encrypted hash - key is "id"+"-documents"
type Binder struct {
	Documents []Document `json:"documents"`
}

//Document store the hash of the document
type Document struct {
	Hash       string    `json:"hash"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	LastUpdate time.Time `json:"last_update"`
}

//AuthorisationsList store all users authorized to access datas for a struct.Key is "id"+"authorisations"
type AuthorisationsList struct {
	Authorisations []Authorisations `json:"authorisations"`
}

//Authorisations store user which have access to element of identity. the documents array store document access granted to this user.
type Authorisations struct {
	User      string   `json:"user"`
	Documents []string `json:"documents"` //string must correspond to selected type.
}

// ========================================================================
// Main
// ========================================================================

func main() {
	err := shim.Start(new(IdentityChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode - %s", err)
	}
}

// ========================================================================
// Init Method
// ========================================================================

// Init is called during chaincode instantiation to initialize any
// data. Note that chaincode upgrade also calls this function to reset
// or to migrate data.
func (icc *IdentityChaincode) Init(stub shim.ChaincodeStubInterface) peer.Response {
	return shim.Success(nil)
}

// ========================================================================
// Invoke - Our entry point for invocations
// ========================================================================

// Invoke is called per transaction on the chaincode. Each transaction is
// either a 'get' or a 'set' on the asset created by Init function. The Set
// method may create a new asset by specifying a new key-value pair.
func (icc *IdentityChaincode) Invoke(stub shim.ChaincodeStubInterface) peer.Response {
	// Extract the function and args from the transaction proposal
	fn, args := stub.GetFunctionAndParameters()

	if fn == "setPerson" {
		return icc.setPerson(stub, args)
	} else if fn == "initLedger" {
		return icc.initLedger(stub)
	} else if fn == "get" {
		return icc.get(stub, args)
	} else if fn == "setCompany" {
		return icc.setCompany(stub, args)
	} else if fn == "setCompanyPerson" {
		return icc.setCompanyPerson(stub, args)
	} else if fn == "addDocuments" {
		return icc.addDocuments(stub, args)
	} else if fn == "getDocuments" {
		return icc.getDocuments(stub, args)
	} else if fn == "getDocument" {
		return icc.getDocument(stub, args)
	} else if fn == "getDocumentsForUser" {
		return icc.getDocumentsForUser(stub, args)
	} else if fn == "removeDocument" {
		return icc.removeDocument(stub, args)
	} else if fn == "setAuthorisations" {
		return icc.setAuthorisations(stub, args)
	} else if fn == "getAuthorisationsForUser" {
		return icc.getAuthorisationsForUser(stub, args)
	}

	return shim.Error("Invalid Smart Contract function name.")
}

// ========================================================================
// Init Ledger
// ========================================================================

func (icc *IdentityChaincode) initLedger(stub shim.ChaincodeStubInterface) peer.Response {
	persons := []Person{
		Person{ObjectType: "person", ID: "p.dupont@mail.com", Firstname: "Paul", Lastname: "Dupont", Phone: "0605040302"},
		Person{ObjectType: "person", ID: "m.dupond@mail.com", Firstname: "Mireille", Lastname: "Dupond", Phone: "0102030405"},
		Person{ObjectType: "person", ID: "m.durand@mail.com", Firstname: "Marc", Lastname: "Durand", Phone: "0304050607"},
		Person{ObjectType: "person", ID: "j.duss@mail.com", Firstname: "Jean", Lastname: "Dusse", Phone: "0908070605"},
		Person{ObjectType: "person", ID: "m.jeanne@mail.com", Firstname: "Muriel", Lastname: "Jeanne", Phone: "0103050709"},
	}

	//allow us to add IDs
	mails := [5]string{"p.dupont@mail.com", "m.dupond@mail.com", "m.durand@mail.com", "j.duss@mail.com", "m.jeanne@mail.com"}

	i := 0
	for i < len(persons) {
		fmt.Println("i is ", i)
		personAsBytes, _ := json.Marshal(persons[i])
		stub.PutState(mails[i], personAsBytes)
		fmt.Println("Added", persons[i])
		i = i + 1
	}

	return shim.Success(nil)
}
