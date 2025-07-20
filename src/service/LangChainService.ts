// Example using fetch to invoke a LangGraph agent
//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
//ngrok http http://127.0.0.1:8501

import LinkedInAuth, { LinkedInAuthRef } from "../components/LinkedInAuth";
import { XAuthRef } from "../components/XAuth"
import { LANGCHAIN_API_KEY } from "../config";


export async function invokeLangGraphAgent({
  // parameters can be added here if needed
} = {}) {
  const response = await fetch('https://myorgagentrichcanvas-fda39097be375d0f9756d03ee4c93846.us.langgraph.app/threads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LANGCHAIN_API_KEY
    },
    body: JSON.stringify({
      thread_id: '',
      metadata: {
        langgraph_auth_user_id: "f67be9df-f865-4e95-a8b5-e272ac95bc48",
        user_id: "f67be9df-f865-4e95-a8b5-e272ac95bc48",
        session_type: "test",
        custom_note: "Created via API",
        LANGGRAPH_API_URL: 'https://myorgagentrichcanvas-fda39097be375d0f9756d03ee4c93846.us.langgraph.app'
      },
      if_exists: 'do_nothing',
      ttl: {
        strategy: 'delete',
        ttl: 15
      },
      supersteps: [
        {
          updates: [
            {
              values: [
                // values can be added here
              ],
              command: {
                update: null,
                resume: null,
                goto: {
                  node: '',
                  input: null
                }
              },
              as_node: ''
            }
          ]
        }
      ]
    })
  });

  console.log('Response: ', response);
  const text = await response.text();
  return text;
}



export async function sendMessageToLangGraphAssistant(
  message: string,
  thread_id: string,
  tool: string,
  options: Record<string, any> = {},
  linkedInAuthRef?: React.RefObject<LinkedInAuthRef>,
  XAuthRef?: React.RefObject<XAuthRef>
) {
  console.log('*************** send message with config set to RichCanvas')
  const data = await fetch('https://myorgagentrichcanvas-fda39097be375d0f9756d03ee4c93846.us.langgraph.app/threads/'+ thread_id +'/runs/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LANGCHAIN_API_KEY
    },
    body: JSON.stringify({
      assistant_id: 'fe096781-5601-53d2-b2f6-0d3403f7e9ca',
      checkpoint: {
        thread_id: thread_id,
        //checkpoint_ns: '',
        //checkpoint_id: '',
        //checkpoint_map: {
    
        //}
      },
      input: {
        messages: {type: 'human', content: message}
      },
      metadata: {
        langgraph_auth_user_id: "f67be9df-f865-4e95-a8b5-e272ac95bc48",
        user_id: "f67be9df-f865-4e95-a8b5-e272ac95bc48",
        LANGGRAPH_API_URL: 'https://myorgagentrichcanvas-fda39097be375d0f9756d03ee4c93846.us.langgraph.app'
      },
      config: {
        tags: [''],
        recursion_limit: 15,
        configurable: {
          company: {
            name: 'RichCanvas'
          }
        }
      },
      //webhook: '',
      //interrupt_before: '*',
      //interrupt_after: '*',
      stream_mode: ['messages'],
      stream_subgraphs: false,
      on_disconnect: 'cancel',
      feedback_keys: [''],
      multitask_strategy: 'reject',
      if_not_exists: 'reject',
      after_seconds: 1,
      checkpoint_during: false
    })
  })
  
  console.log('Unjsoned Data: ', JSON.stringify(data));
  const data2 = await data.text();
  const dataList = data2.split("event: ");
  console.log('dataList: ',dataList)
  try {
    var completedMessage = dataList[dataList.length - 2];
    console.log(completedMessage);
    var dataSplit = completedMessage.split('":');
    var furtherSplit = dataSplit[1].split(',"');
    var furtherFurtherSplit = furtherSplit[0].replace(new RegExp(`^${'"'}+|${'"'}+$`, 'g'), '');
    var further3Split = furtherFurtherSplit.split('\\n');
    var finalMessage = further3Split.join(' ');  
    console.log(finalMessage);
    if (tool == 'state_register') {
      console.log('state data being jsoned');
      var split = finalMessage.split('-');
      console.log(split)
      var id = (split[1].split('** '))[1];
      var name = 'test';
      var formDate = (split[4].split('** '))[1];
      var address = (split[5].split('** '))[1];
      console.log(id, formDate, address)
      return {message: finalMessage, id: id, name: name, formDate: formDate, address: address}
    } else if (tool == 'linkedin_verification') {
      console.log('linkedin Oauth being done')
      if (linkedInAuthRef?.current) {
        linkedInAuthRef.current.openLinkedInPopup();
      } else {
        console.warn('linkedInAuthRef is not available or not attached to a component instance.');
      }
      console.log('response: ', 'response')
    } else if (tool == "x_verification") {
      console.log("x auth being done")
      if (XAuthRef?.current) {
        XAuthRef.current.openXPopup();
      }
    }
    //return finalMessage
    return {message: finalMessage, id: 'test', name:'test', formDate:'test', address: 'test'}
  } catch {
    console.error("Error processing dataList in LangChainService");
    return {message: 'message not completed', id: 'test', name:'test', formDate:'test', address: 'test'}
  }
}

// Example usage:
// invokeLangGraphAgent({});
