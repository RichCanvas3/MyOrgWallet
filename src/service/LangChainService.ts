// Example using fetch to invoke a LangGraph agent
//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
//ngrok http http://127.0.0.1:8501

import LinkedInAuth, { LinkedInAuthRef } from "../components/LinkedInAuth";
import { XAuthRef } from "../components/XAuth"
import { LANGCHAIN_API_KEY } from "../config";
import { Entity } from "../models/Entity";

// Task status tracking
let isTaskRunning = false;
let taskStatusListeners: ((isRunning: boolean) => void)[] = [];

export const LangGraphTaskManager = {
  isTaskRunning: () => isTaskRunning,
  addStatusListener: (listener: (isRunning: boolean) => void) => {
    taskStatusListeners.push(listener);
  },
  removeStatusListener: (listener: (isRunning: boolean) => void) => {
    taskStatusListeners = taskStatusListeners.filter(l => l !== listener);
  },
  setTaskRunning: (running: boolean) => {
    isTaskRunning = running;
    taskStatusListeners.forEach(listener => listener(running));
  }
};

export async function invokeLangGraphAgent({
  // parameters can be added here if needed
} = {}) {
  try {
    console.log('Attempting to create LangGraph thread...');
    console.log('API Key (first 10 chars):', LANGCHAIN_API_KEY.substring(0, 10) + '...');

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LangGraph thread creation failed:', response.status, errorText);
      throw new Error(`LangGraph API error: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    console.log('LangGraph thread created successfully');
    return text;
  } catch (error) {
    console.error('Error creating LangGraph thread:', error);
    // Return a mock thread ID to prevent the app from breaking
    return "'mock-thread-id-12345'";
  }
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

  // Check if a task is already running
  if (LangGraphTaskManager.isTaskRunning()) {
    throw new Error('A LangGraph task is already running. Please wait for it to complete before sending another message.');
  }

  // Set task as running
  LangGraphTaskManager.setTaskRunning(true);

  // Set a timeout to prevent tasks from running indefinitely
  const taskTimeout = setTimeout(() => {
    console.warn('LangGraph task timeout - forcing task to complete');
    LangGraphTaskManager.setTaskRunning(false);
  }, 300000); // 5 minutes timeout

  try {
    console.log('Attempting to send message to LangGraph assistant...');
    console.log('Thread ID:', thread_id);
    console.log('Message:', message.substring(0, 50) + '...');

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
    });

    if (!data.ok) {
      const errorText = await data.text();
      console.error('LangGraph message sending failed:', data.status, errorText);

      // Handle specific 409 error
      if (data.status === 409) {
        throw new Error('A LangGraph task is already running. Please wait for it to complete before sending another message.');
      }

      throw new Error(`LangGraph API error: ${data.status} - ${errorText}`);
    }

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

    //console.log('Raw completed message:', completedMessage);

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
} catch (error) {
  console.error("Error in sendMessageToLangGraphAssistant:", error);
  return {
    message: "I'm having trouble connecting to my assistant service right now. Please try again in a moment.",
    id: '', name: '', formDate: '', address: ''
  };
} finally {
  // Clear the timeout
  clearTimeout(taskTimeout);
  // Always set task as not running when function completes
  LangGraphTaskManager.setTaskRunning(false);
}

// Example usage:
// invokeLangGraphAgent({});
}
