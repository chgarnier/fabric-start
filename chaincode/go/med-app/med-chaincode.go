/* Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*
 * The sample smart contract for documentation topic:
 * Writing Your First Blockchain Application
 */

package main

/* Imports
 * 4 utility libraries for formatting, handling bytes, reading and writing JSON, and string manipulation
 * 2 specific Hyperledger Fabric specific libraries for Smart Contracts
 */
import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
)

// Define the Smart Contract structure
type SmartContract struct {
}

// Define the med structure, with 4 properties.  Structure tags are used by encoding/json library
type Med struct {
	DataMatrix  string `json:"dataMatrix"`
	Designation string `json:"designation"`
	Laboratory  string `json:"laboratory"`
	Owner       string `json:"owner"`
}

/*
 * The Init method is called when the Smart Contract "med" is instantiated by the blockchain network
 * Best practice is to have any Ledger initialization in separate function -- see initLedger()
 */
func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

/*
 * The Invoke method is called as a result of an application request to run the Smart Contract "med"
 * The calling application program has also specified the particular smart contract function to be called, with arguments
 */
func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {

	// Retrieve the requested Smart Contract function and arguments
	function, args := APIstub.GetFunctionAndParameters()
	// Route to the appropriate handler function to interact with the ledger appropriately
	if function == "queryMedByDataMatrix" {
		return s.queryMedByDataMatrix(APIstub, args)
	} else if function == "initLedger" {
		return s.initLedger(APIstub)
	} else if function == "createMed" {
		return s.createMed(APIstub, args)
	} else if function == "changeMedOwner" {
		return s.changeMedOwner(APIstub, args)
	} else if function == "queryAllMeds" {
		return s.queryAllMeds(APIstub)
	} else if function == "deleteMedByDataMatrix" {
		return s.deleteMedByDataMatrix(APIstub, args)
	} else if function == "queryMedHistoryByDatamatrix" {
		return s.queryMedHistoryByDatamatrix(APIstub, args)
	}

	return shim.Error("Invalid Smart Contract function name.")
}

func (s *SmartContract) queryMedByDataMatrix(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	if len(args[0]) != 31 {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. Not enought data")
	}

	out := []rune(args[0])

	if string(out[0:3]) != "010" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 010 before CIP13")
	}

	if string(out[16:18]) != "17" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 17 before expiration date")
	}

	if string(out[24:26]) != "10" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 10 before lot id")
	}
	MedAsBytes, _ := APIstub.GetState(args[0])
	return shim.Success(MedAsBytes)
}

func (s *SmartContract) initLedger(APIstub shim.ChaincodeStubInterface) sc.Response {
	meds := []Med{
		Med{DataMatrix: "01034009216800581718063010P7919", Designation: "ALLOPURINOL CRISTERS 300 mg, comprimé", Laboratory: "CRISTERS", Owner: "CRISTERS"},
		Med{DataMatrix: "01034009216036371718052510P7897", Designation: "PEDIAVEN AP-HP G25, solution pour perfusion", Laboratory: "ASSISTANCE PUBLIQUE - HOPITAUX DE PARIS - AP-HP", Owner: "ASSISTANCE PUBLIQUE - HOPITAUX DE PARIS - AP-HP"},
		Med{DataMatrix: "01034009349037001719052610P1512", Designation: "CARBOSYMAG, gélule", Laboratory: "GRIMBERG", Owner: "GRIMBERG"},
	}

	i := 0
	for i < len(meds) {
		fmt.Println("i is ", i)
		MedAsBytes, _ := json.Marshal(meds[i])

		APIstub.PutState(meds[i].DataMatrix, MedAsBytes)
		fmt.Println("Added", meds[i])
		i = i + 1
	}

	return shim.Success(nil)
}

func (s *SmartContract) createMed(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 4 {
		return shim.Error("Incorrect number of arguments. Expecting 4 argument : DataMatrix, Designation, Laboratory, Owner")
	}

	var med = Med{DataMatrix: args[0], Designation: args[1], Laboratory: args[2], Owner: args[3]}

	if len(args[0]) != 31 {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. Not enought data")
	}

	out := []rune(args[0])

	if string(out[0:3]) != "010" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 010 before CIP13")
	}

	if string(out[16:18]) != "17" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 17 before expiration date")
	}

	if string(out[24:26]) != "10" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 10 before lot id")
	}

	MedAsBytes, _ := json.Marshal(med)
	err := APIstub.PutState(args[0], MedAsBytes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to register  in the blockchain ledger new drug with dataMatrix: %s", args[0]))
	}

	return shim.Success(nil)
}

func (s *SmartContract) deleteMedByDataMatrix(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1 argument : DataMatrix")
	}

	if len(args[0]) != 31 {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. Not enought data")
	}

	out := []rune(args[0])

	if string(out[0:3]) != "010" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 010 before CIP13")
	}

	if string(out[16:18]) != "17" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 17 before expiration date")
	}

	if string(out[24:26]) != "10" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 10 before lot id")
	}

	err := APIstub.DelState(args[0])
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to delete drug with dataMatrix: %s", args[0]))
	}
	return shim.Success(nil)
}

func (s *SmartContract) queryMedHistoryByDatamatrix(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	if len(args[0]) != 31 {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. Not enought data")
	}

	out := []rune(args[0])

	if string(out[0:3]) != "010" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 010 before CIP13")
	}

	if string(out[16:18]) != "17" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 17 before expiration date")
	}

	if string(out[24:26]) != "10" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 10 before lot id")
	}
	resultsIterator, err := APIstub.GetHistoryForKey(args[0])

	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	var record string
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.TxId)
		buffer.WriteString("\"")
		record = string(queryResponse.Value)
		if queryResponse.IsDelete == true {
			record = "{\"DataMatrix\":\"delete\", \"Designation\":\"delete\", \"Laboratory\":\"delete\", \"Owner\":\"delete\"}"
		}
		buffer.WriteString(", \"Record\":")
		buffer.WriteString(record)
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- queryMedHistoryByDatamatrix:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

func (s *SmartContract) queryAllMeds(APIstub shim.ChaincodeStubInterface) sc.Response {

	startKey := "0100000000000000000000000000000"
	endKey := "0199999999999999999999999999999"

	resultsIterator, err := APIstub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- queryAllMeds:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

func (s *SmartContract) changeMedOwner(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}
	if len(args[0]) != 31 {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. Not enought data")
	}

	out := []rune(args[0])

	if string(out[0:3]) != "010" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 010 before CIP13")
	}

	if string(out[16:18]) != "17" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 17 before expiration date")
	}

	if string(out[24:26]) != "10" {
		return shim.Error("Incorrect DataMatrix. DataMatrix need to be in this form 010XXXXXXXXXXXXX17XXXXXX10XXXXX. 10 before lot id")
	}

	medAsBytes, _ := APIstub.GetState(args[0])
	med := Med{}

	json.Unmarshal(medAsBytes, &med)
	med.Owner = args[1]

	medAsBytes, _ = json.Marshal(med)
	err := APIstub.PutState(args[0], medAsBytes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to change drug owner: %s", args[0]))
	}
	return shim.Success(nil)
}

// The main function is only relevant in unit test mode. Only included here for completeness.
func main() {

	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}
