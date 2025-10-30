import {modelDetails, OpenAIModel} from "../models/model";
import {ChatCompletion, ChatCompletionMessage, ChatCompletionRequest, ChatMessage, ChatMessagePart, Role} from "../models/ChatCompletion";
import {OPENAI_API_KEY} from "../config";
import OpenAI from 'openai';
import {CustomError} from "./CustomError";
import {CHAT_COMPLETIONS_ENDPOINT, MODELS_ENDPOINT} from "../constants/apiEndpoints";
import {ChatSettings} from "../models/ChatSettings";
import {CHAT_STREAM_DEBOUNCE_TIME, DEFAULT_MODEL} from "../constants/appConstants";
import {NotificationService} from '../service/NotificationService';
import { FileData, FileDataRef } from "../models/FileData";

interface CompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: CompletionChunkChoice[];
}

interface CompletionChunkChoice {
  index: number;
  delta: {
    content: string;
    tool_calls: [{
      function: {
        arguments: string
      }
    }]
  };
  
  finish_reason: null | string; // If there can be other values than 'null', use appropriate type instead of string.
}

export class ChatService {
  private static models: Promise<OpenAIModel[]> | null = null;
  static abortController: AbortController | null = null;


  static async mapChatMessagesToCompletionMessages(modelId: string, messages: ChatMessage[]): Promise<ChatCompletionMessage[]> {
    const model = await this.getModelById(modelId); // Retrieve the model details
    if (!model) {
      throw new Error(`Model with ID '${modelId}' not found`);
    }

    return messages.map((message) => {
      const contentParts: ChatMessagePart[] = [{
        type: 'text',
        text: message.content
      }];

      if (model.image_support && message.fileDataRef) {
        message.fileDataRef.forEach((fileRef) => {
          const fileUrl = fileRef.fileData!.data;
          if (fileUrl) {
            const fileType = (fileRef.fileData!.type.startsWith('image')) ? 'image_url' : fileRef.fileData!.type;
            contentParts.push({
              type: fileType,
              image_url: {
                url: fileUrl
              }
            });
          }
        });
      }
      return {
        role: message.role,
        content: contentParts,
      };
    });
  }



  private static lastCallbackTime: number = 0;
  private static callDeferred: number | null = null;
  private static accumulatedContent: string = ""; // To accumulate content between debounced calls
  private static accumulatedArguments: string = ""; // To accumulate content between debounced calls
  private static done: boolean = false

  static debounceCallback(callback: (content: string, args: string, fileDataRef: FileDataRef[], done: boolean) => void, delay: number = CHAT_STREAM_DEBOUNCE_TIME) {
    return (content: string, args: string, done: boolean) => {
      this.done = done;
      this.accumulatedContent += content; // Accumulate content on each call
      this.accumulatedArguments += args; // Accumulate arguments on each call
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCallbackTime;

      if (this.callDeferred !== null) {
        clearTimeout(this.callDeferred);
      }

      this.callDeferred = window.setTimeout(() => {
        callback(this.accumulatedContent,this.accumulatedArguments,[], done); // Pass the accumulated content to the original callback
        this.lastCallbackTime = Date.now();
        this.accumulatedContent = ""; // Reset the accumulated content after the callback is called
        this.accumulatedArguments = ""; // Reset the accumulated content after the callback is called
      }, delay - timeSinceLastCall < 0 ? 0 : delay - timeSinceLastCall);  // Ensure non-negative delay

      this.lastCallbackTime = timeSinceLastCall < delay ? this.lastCallbackTime : now; // Update last callback time if not within delay
    };
  }

  

  static cancelStream = (): void => {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  static getModels = (): Promise<OpenAIModel[]> => {
    return ChatService.fetchModels();
  }

  static async getModelById(modelId: string): Promise<OpenAIModel | null> {
    try {
      const models = await ChatService.getModels();

      const foundModel = models.find(model => model.id === modelId);
      if (!foundModel) {
        throw new CustomError(`Model with ID '${modelId}' not found.`, {
          code: 'MODEL_NOT_FOUND',
          status: 404
        });
      }

      return foundModel;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to get models:', error.message);
        throw new CustomError('Error retrieving models.', {
          code: 'FETCH_MODELS_FAILED',
          status: (error as any).status || 500
        });
      } else {
        console.error('Unexpected error type:', error);
        throw new CustomError('Unknown error occurred.', {
          code: 'UNKNOWN_ERROR',
          status: 500
        });
      }
    }

  }


  static fetchModels = (): Promise<OpenAIModel[]> => {
    if (this.models !== null) {
      return Promise.resolve(this.models);
    }
    this.models = fetch(MODELS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.error.message);
            });
          }
          return response.json();
        })
        .catch(err => {
          throw new Error(err.message || err);
        })
        .then(data => {
          const models: OpenAIModel[] = data.data;
          // Filter, enrich with contextWindow from the imported constant, and sort
          return models
              .filter(model => model.id.startsWith("gpt-"))
              .map(model => {
                const details = modelDetails[model.id] || {
                  contextWindowSize: 0,
                  knowledgeCutoffDate: '',
                  imageSupport: false,
                  preferred: false,
                  deprecated: false,
                };
                return {
                  ...model,
                  context_window: details.contextWindowSize,
                  knowledge_cutoff: details.knowledgeCutoffDate,
                  image_support: details.imageSupport,
                  preferred: details.preferred,
                  deprecated: details.deprecated,
                };
              })
              .sort((a, b) => b.id.localeCompare(a.id));
        });
    return this.models;
  };
}

