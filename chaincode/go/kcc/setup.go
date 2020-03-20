package main

import (
	"fmt"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

// KycChaincode example simple Chaincode implementation
type KycChaincode struct {
}

// ========================================================================
// Asset Definitions - The ledger will store identity and kyc
// ========================================================================

//KYC gather all informations -key is mail or siren
type KYC struct {
	ObjectType          string    `json:"docType"`
	InsertionDate       time.Time `json:"insertion_date"`
	UpdateDate          time.Time `json:"update_date"`
	Items               []Item    `json:"items"`
}

//Item collect the answer for a specific field
type Item struct {
	ID         string    `json:"id"`
	Field      string    `json:"field"`
	Answer     string    `json:"answer"`
	Category   string    `json:"category"`
	Type       string    `json:"type"`
	LastUpdate time.Time `json:"update_date"`
}

//AuthorisationsList store all authorisations give. key is id-AuthorisationsList
type AuthorisationsList struct {
	Authorisations []Authorisations `json:"authorisations"`
}

//Authorisations store User and datas allowed
type Authorisations struct {
	User                string   `json:"user"`
	Questions           []string `json:"questions"`
}

// ========================================================================
// Main
// ========================================================================

func main() {
	err := shim.Start(new(KycChaincode))
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
func (kcc *KycChaincode) Init(stub shim.ChaincodeStubInterface) peer.Response {
	return shim.Success(nil)
}

// ========================================================================
// Invoke - Our entry point for invocations
// ========================================================================

// Invoke is called per transaction on the chaincode. Each transaction is
// either a 'get' or a 'set' on the asset created by Init function. The Set
// method may create a new asset by specifying a new key-value pair.
func (kcc *KycChaincode) Invoke(stub shim.ChaincodeStubInterface) peer.Response {
	// Extract the function and args from the transaction proposal
	fn, args := stub.GetFunctionAndParameters()

	if fn == "get" {
		return kcc.get(stub, args)
	} else if fn == "set" {
		return kcc.set(stub, args)
	} else if fn == "setAuthorisations" {
		return kcc.setAuthorisations(stub, args)
	} else if fn == "getForUser" {
		return kcc.getForUser(stub, args)
	} else if fn == "getAuthorisationsForUser" {
		return kcc.getAuthorisationsForUser(stub, args)
	} 

	return shim.Error("Invalid Smart Contract function name.")
}
