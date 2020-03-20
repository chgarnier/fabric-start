// methods to use assets and datas containerd in the ledger

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

//toChainecodeAgrs change type of arguments in order to call other methods
func toChaincodeArgs(args ...string) [][]byte {
	bargs := make([][]byte, len(args))
	for i, arg := range args {
		bargs[i] = []byte(arg)
	}
	return bargs
}

func checkIdentity(stub shim.ChaincodeStubInterface, args string) peer.Response {
	queryArgs := toChaincodeArgs("get", args)
	response := stub.InvokeChaincode("icc", queryArgs, "")
	if response.Status != shim.OK {
		return shim.Error("no identity found")
	}
	return shim.Success(nil)
}

func toCamelCase(inputUnderScoreStr string) (camelCase string) {

	isToUpper := false
	for k, v := range inputUnderScoreStr {
		if k == 0 {
			camelCase = strings.ToUpper(string(inputUnderScoreStr[0]))
		} else {
			if isToUpper {
				camelCase += strings.ToUpper(string(v))
				isToUpper = false
			} else {
				if v == '_' {
					isToUpper = true
				} else {
					camelCase += string(v)
				}
			}
		}
	}
	return
}

//set a particulare field of a struct. v must be a pointer
func setField(v interface{}, name string, value string) error {
	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Ptr || rv.Elem().Kind() != reflect.Struct {
		return errors.New("v must be pointer to struct")
	}
	rv = rv.Elem()
	fv := rv.FieldByName(name)
	if !fv.IsValid() {
		return fmt.Errorf("not a field name: %s", name)
	}
	if !fv.CanSet() {
		return fmt.Errorf("cannot set field %s", name)
	}
	fmt.Println(fv.Kind())
	if fv.Kind() == reflect.Bool {
		boolean, _ := strconv.ParseBool(value)
		fv.SetBool(boolean)
	} else if fv.Kind() == reflect.String {
		fv.SetString(value)
	} else if fv.Kind() == reflect.Int {
		integ, _ := strconv.ParseInt(value, 10, 64)
		fv.SetInt(integ)
	} else if fv.Kind() == reflect.Slice {
		fv.Set(reflect.Append(fv, reflect.ValueOf(value)))
	}

	return nil
}

// new method
func createItems(array []string) []Item {
	var item Item
	var items []Item
	j := 0 //this flag will allow us to define the interval for setting array of items
	var interval int
	for i, v := range array {
		interval = 5 * j
		if i == (interval) {
			item.ID = v
		} else if i == (1 + interval) {
			item.Field = v
		} else if i == (2 + interval) {
			item.Answer = v
		} else if i == (3 + interval) {
			item.Category = v
		} else if i == (4 + interval) {
			item.Type = v
			item.LastUpdate = time.Now()
			items = append(items, item) // add the item in the array and start overt
			j++                         //increment the interval value for next array of 4 elements
		}
	}
	return items
}

func setItems(kycItems []Item, items []Item) []Item {
	if kycItems == nil {
		kycItems = append(kycItems, items[0])
		items = items[1:]
	}

	for j := len(kycItems) - 1; j >= 0; j-- {
		for i := len(items) - 1; i >= 0; i-- {
			if kycItems[j].ID == items[i].ID {
				kycItems[j] = items[i]                    //add element to the kyc
				items = append(items[:i], items[i+1:]...) //remove the added element from the array
			}
		}
	}
	kycItems = append(kycItems, items...) //add lefting elements

	return kycItems
}

func getKycState(stub shim.ChaincodeStubInterface, id string) KYC {
	var kyc KYC
	kycAsBytes, _ := stub.GetState(id)
	json.Unmarshal(kycAsBytes, &kyc)

	return kyc
}

func putKycState(stub shim.ChaincodeStubInterface, kyc KYC, id string) peer.Response {

	t := time.Now()

	kyc.UpdateDate = t
	if kyc.InsertionDate == (time.Time{}) {
		kyc.InsertionDate = t
	}

	kycAsBytes, _ := json.Marshal(kyc)
	err := stub.PutState(id, kycAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)
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

func fillAuthorizedKyc(authorisations []string, kyc KYC) KYC {
	var result KYC

	for i := 0; i < len(authorisations); i++ { //first we have to loop over authorisations struct using reflexion
		for j := 0; j < len(kyc.Items); j++ {
			if authorisations[i] == kyc.Items[j].ID {
				result.Items = append(result.Items, kyc.Items[j])
			}
		}
	}
	result.UpdateDate = kyc.UpdateDate
	result.InsertionDate = kyc.InsertionDate

	return result
}

// ========================================================================
// methods needs a query string in order to work
// ========================================================================
func getResultForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {
	fmt.Printf("Get query for : %s", queryString)

	resultsIterator, err := stub.GetQueryResult(queryString)

	if err != nil {
		return nil, err
	}

	defer resultsIterator.Close()

	//buffer is a JSON array containing query records
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		//Add coma before array members, except for the first one
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}

		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		//Records is a JSON object
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true

	}
	buffer.WriteString("]")

	fmt.Printf("Results : %s", buffer.String())

	return buffer.Bytes(), nil

}
