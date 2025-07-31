// Example using fetch to invoke a LangGraph agent
//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
//ngrok http http://127.0.0.1:8501

import LinkedInAuth, { LinkedInAuthRef } from "../components/LinkedInAuth";
import { XAuthRef } from "../components/XAuth"
import { LANGCHAIN_API_KEY } from "../config";
import { Entity } from "../models/Entity";

export async function invokeLangGraphAgent({
  // parameters can be added here if needed
} = {}) {
  const response = await fetch('https://myorgwalletlang-7ced710fbd1a5b698d578945dc0f68bd.us.langgraph.app/threads', {
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
        LANGGRAPH_API_URL: 'https://myorgwalletlang-7ced710fbd1a5b698d578945dc0f68bd.us.langgraph.app'
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

  const text = await response.text();
  return text;
}

// Helper function to safely stringify objects that may contain BigInt values
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

export async function sendMessageToLangGraphAssistant(
  message: string,
  thread_id: string,
  tool: string,
  entities: Entity[] = [],
  options: Record<string, any> = {},
  linkedInAuthRef?: React.RefObject<LinkedInAuthRef>,
  XAuthRef?: React.RefObject<XAuthRef>
) {

  console.log('Sending message to LangChain:', {
    message,
    thread_id,
    tool,
    entitiesCount: entities.length
  });

  const data = await fetch('https://myorgwalletlang-7ced710fbd1a5b698d578945dc0f68bd.us.langgraph.app/threads/'+ thread_id +'/runs/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LANGCHAIN_API_KEY
    },
    body: safeStringify({
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
        LANGGRAPH_API_URL: 'https://myorgwalletlang-7ced710fbd1a5b698d578945dc0f68bd.us.langgraph.app'
      },
      config: {
        tags: [''],
        recursion_limit: 15,
        configurable: {
          entities: entities
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
    }, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    })
  })

  const data2 = await data.text();
  const dataList = data2.split("event: ");

  try {
    if (!dataList || dataList.length < 2) {
      console.error("Incomplete response from LangGraph agent");
      return {
        message: "I apologize, but I didn't receive a complete response. Could you please try your request again?",
        id: '', name: '', formDate: '', address: ''
      };
    }

    var completedMessage = dataList[dataList.length - 2];

    console.log('Raw completed message from LangChain:', completedMessage);

    if (!completedMessage) {
      console.error("No completed message found in response");
      return {
        message: "I apologize, but I couldn't process your request. Please try again.",
        id: '', name: '', formDate: '', address: ''
      };
    }


    var dataSplit = completedMessage.split('":');
    if (dataSplit.length < 2) {
      console.error("Invalid message format");
      return {
        message: "I received an invalid response format. Please try your request again.",
        id: '', name: '', formDate: '', address: ''
      };
    }

    var furtherSplit = dataSplit[1].split(',"');
    var furtherFurtherSplit = furtherSplit[0].replace(new RegExp(`^${'"'}+|${'"'}+$`, 'g'), '');
    var further3Split = furtherFurtherSplit.split('\\n');

    var finalMessage = further3Split.join(' ');
    console.log('Final processed message from LangChain:', finalMessage);
    /*
    if (tool == 'state_register') {
      var split = finalMessage.split('-');
      if (split.length < 6) {
        console.error("Invalid state registration data format");
        return {
          message: "I couldn't process the state registration data. Please try again.",
          id: '', name: '', formDate: '', address: ''
        };
      }


      var id = (split[1].split('** '))[1];
      var name = 'test';
      var formDate = (split[4].split('** '))[1];
      var address = (split[5].split('** '))[1];

      return { message: finalMessage, id, name, formDate, address };
    } else
    */
    if (tool == 'linkedin_verification') {
      console.log('Initiating LinkedIn OAuth...');

      if (linkedInAuthRef?.current) {
        linkedInAuthRef.current.openLinkedInPopup();
      } else {
        console.warn('LinkedIn auth ref not available');
        return {
          message: "LinkedIn authentication is not available at the moment. Please try again later.",
          id: '', name: '', formDate: '', address: ''
        };
      }

    } else if (tool == "x_verification") {
      console.log("Initiating X/Twitter auth...");

      if (XAuthRef?.current) {
        XAuthRef.current.openXPopup();
      } else {
        console.warn('X/Twitter auth ref not available');
        return {
          message: "X/Twitter authentication is not available at the moment. Please try again later.",
          id: '', name: '', formDate: '', address: ''
        };
      }
    }

    return { message: finalMessage, id: '', name: '', formDate: '', address: '' };

  } catch (error) {
    console.error("Error processing LangGraph response:", error);
    console.error("Response data:", { dataList });
    return {
      message: "I encountered an error processing your request. Please try again.",
      id: '', name: '', formDate: '', address: ''
    };
  }
}

// Example usage:
// invokeLangGraphAgent({});

export async function updateLangChainContext(
  thread_id: string,
  attestationContext: {
    name?: string;
    domain?: string;
    linkedin?: string;
    x?: string;
    state_registration?: string;
    ens_registration?: string;
    shopify?: string;
    insurance?: string;
    website?: string;
    email_org?: string;
    email_indiv?: string;
    indiv?: string;
    account_indiv?: string;
    accountOrg_org?: string;
    account_org?: string;
    orgIndiv_org?: string;
  }
) {
  try {
    const contextMessage = `Context Update: Current attestation status - Name: ${attestationContext.name || 'Not verified'}, Domain: ${attestationContext.domain || 'Not verified'}, LinkedIn: ${attestationContext.linkedin || 'Not verified'}, Twitter: ${attestationContext.x || 'Not verified'}, State Registration: ${attestationContext.state_registration || 'Not verified'}, ENS Registration: ${attestationContext.ens_registration || 'Not verified'}, Shopify: ${attestationContext.shopify || 'Not verified'}, Insurance: ${attestationContext.insurance || 'Not verified'}, Website: ${attestationContext.website || 'Not verified'}, Org Email: ${attestationContext.email_org || 'Not verified'}, Individual Email: ${attestationContext.email_indiv || 'Not verified'}`;

    console.log('Sending context update message to LangChain:', contextMessage);

    const response = await fetch(`https://myorgwalletlang-7ced710fbd1a5b698d578945dc0f68bd.us.langgraph.app/threads/${thread_id}/runs/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LANGCHAIN_API_KEY
      },
      body: safeStringify({
        assistant_id: 'fe096781-5601-53d2-b2f6-0d3403f7e9ca',
        checkpoint: {
          thread_id: thread_id,
        },
        input: {
          messages: { type: 'human', content: contextMessage }
        },
        metadata: {
          langgraph_auth_user_id: "f67be9df-f865-4e95-a8b5-e272ac95bc48",
          user_id: "f67be9df-f865-4e95-a8b5-e272ac95bc48",
          LANGGRAPH_API_URL: 'https://myorgwalletlang-7ced710fbd1a5b698d578945dc0f68bd.us.langgraph.app'
        },
        config: {
          tags: ['context_update'],
          recursion_limit: 15,
          configurable: {
            entities: []
          }
        },
        stream_mode: ['messages'],
        stream_subgraphs: false,
        on_disconnect: 'cancel',
        feedback_keys: [''],
        multitask_strategy: 'reject',
        if_not_exists: 'reject',
        after_seconds: 1,
        checkpoint_during: false
      })
    });

    const responseText = await response.text();
    console.log('LangChain context updated successfully');
    console.log('LangChain response:', responseText);
    return responseText;
  } catch (error) {
    console.error('Error updating LangChain context:', error);
    throw error;
  }
}
