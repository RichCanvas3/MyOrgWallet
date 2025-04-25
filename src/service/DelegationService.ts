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
    static snapId : string = "local:http://localhost:8080"


    static async saveDelegation(walletClient: WalletClient, delegator: string, delegate: string, delegation: DelegationStruct) {
        
        const delegationJSON = JSON.stringify(delegation);
        const snapDel = { id: delegator + "-" + delegate, delegation: delegationJSON}

        walletClient.request({
            method: 'wallet_invokeSnap',
            params: {
            snapId: DelegationService.snapId,
            request: { method: "storeDel", params: { snapDel } }
            },
        }).then((resp) => {
            //console.info("save call successful, ", resp)
        })

    }

    static async getDelegations(walletClient: WalletClient): Promise<DelegationStruct[]> {

        console.info("......... get delegations ......")
        if (DelegationService.delegations == undefined) {
            DelegationService.delegations = []

            let delegations : DelegationStruct[] = []
            const resp = await walletClient.request({
                method: 'wallet_invokeSnap',
                params: {
                    snapId: DelegationService.snapId,
                    request: { method: "getDels", params: {}},
                }
            })
        }
        

        return DelegationService.delegations
    }

    static async getDelegation(walletClient: WalletClient, delegator: string, delegate: string): Promise<DelegationStruct | undefined> {
    
        let del : DelegationStruct | undefined

        const id = delegator + "-" + delegate
        console.info("get del: ", id)

        const response : any = await walletClient.request({
            method: 'wallet_invokeSnap',
            params: {
                snapId: DelegationService.snapId,
                request: { method: "getDel", params: {id: id}},
            },
        })
        console.info(">>>>>>>>>>>> response for get delegation: ", response)
        //console.info(" id: ", response?.id)
        //console.info(" credential: ", response?.credential)
        if (response?.id && response?.id == id) {
            if (response?.delegation) {

                const delStr = response?.delegation
                del = JSON.parse(delStr)



            }
        }

        return del

    }

}

export default DelegationService;