import { WalletClient } from "viem";

import {
  Implementation,
  toMetaMaskSmartAccount,
  type MetaMaskSmartAccount,
  type DelegationStruct,
  createDelegation,
  DelegationFramework,
  SINGLE_DEFAULT_MODE,
  getExplorerTransactionLink,
  getExplorerAddressLink,
  createExecution,
  Delegation
} from "@metamask/delegation-toolkit";


class DelegationService {

    static delegations : DelegationStruct[] | undefined
    //static snapId : string = "local:http://localhost:8080"


    static async saveDelegationToStorage(walletClient: WalletClient, owner: string, delegator: string, delegate: string, delegation: DelegationStruct) {
        
        const id = owner + "-" + delegator + "-" + delegate
        const delegationJSON = JSON.stringify(delegation);

        localStorage.setItem(id, delegationJSON)

        /*
        const snapDel = { id: id, delegation: delegationJSON}
        walletClient.request({
            method: 'wallet_invokeSnap',
            params: {
            snapId: DelegationService.snapId,
            request: { method: "storeDel", params: { snapDel } }
            },
        }).then((resp) => {
            //console.info("save call successful, ", resp)
        })
        */

    }


    static async getDelegationFromStorage(walletClient: WalletClient, owner: string, delegator: string, delegate: string): Promise<DelegationStruct | undefined> {
    
        let del : DelegationStruct | undefined

        const id = owner + "-" + delegator + "-" + delegate
        //console.info("get del: ", id)

        const store = localStorage.getItem(id)
        if (store) {
            //console.info("got delegation from store")
            del = JSON.parse(store)
        }

        /*
        const response : any = await walletClient.request({
            method: 'wallet_invokeSnap',
            params: {
                snapId: DelegationService.snapId,
                request: { method: "getDel", params: {id: id}},
            },
        })

        if (response?.id && response?.id == id) {
            if (response?.delegation) {
                const delStr = response?.delegation
                del = JSON.parse(delStr)
            }
        }
        */

        return del

    }

}

export default DelegationService;