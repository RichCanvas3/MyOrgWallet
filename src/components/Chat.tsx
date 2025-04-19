import React, {useContext, useEffect, useRef, useState} from 'react';
import ChatBlock from "./ChatBlock";
import ModelSelect from "./ModelSelect";
import {OpenAIModel} from "../models/model";
import {ChatService} from "../service/ChatService";
import {ChatMessage, MessageType, Role} from "../models/ChatCompletion";
import {useTranslation} from 'react-i18next';
import Tooltip from "./Tooltip";
import {Conversation} from "../service/ConversationService";
import {OPENAI_DEFAULT_SYSTEM_PROMPT} from "../config";
import {OPENAI_DEFAULT_ASSISTANT_PROMPT} from "../config";
import {DEFAULT_INSTRUCTIONS, DEFAULT_INTRODUCTIONS} from "../constants/appConstants";
import {UserContext} from '../UserContext';
import {InformationCircleIcon} from "@heroicons/react/24/outline";
import {NotificationService} from '../service/NotificationService';

interface Props {
  introductionMessage: ChatMessage;
  chatBlocks: ChatMessage[];
  onChatScroll: (isAtBottom: boolean) => void;
  allowAutoScroll: boolean;
  model: string | null;
  onModelChange: (value: string | null) => void;
  conversation: Conversation | null;
  loading: boolean;
}



const Chat: React.FC<Props> = ({
                                introductionMessage,
                                 chatBlocks, onChatScroll, allowAutoScroll, model,
                                 onModelChange, conversation, loading
                               }) => {
  
  
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const chatDivRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    
    ChatService.getModels()
        .then(models => {
          setModels(models);
        })
        .catch(err => {
          NotificationService.handleUnexpectedError(err, 'Failed to get list of models');
        });

  }, []);

  useEffect(() => {
    if (chatDivRef.current && allowAutoScroll) {
      chatDivRef.current.scrollTop = chatDivRef.current.scrollHeight;
    }
  }, [chatBlocks]);

  useEffect(() => {
    const chatContainer = chatDivRef.current;
    if (chatContainer) {
      const isAtBottom =
          chatContainer.scrollHeight - chatContainer.scrollTop ===
          chatContainer.clientHeight;

      // Initially hide the button if chat is at the bottom
      onChatScroll(isAtBottom);
    }
  }, []);

  const findModelById = (id: string | null): OpenAIModel | undefined => {
    return models.find(model => model.id === id);
  };

  const formatContextWindow = (context_window: number | undefined) => {
    if (context_window) {
      return Math.round(context_window / 1000) + 'k';
    }
    return '?k';
  }

  const handleScroll = () => {
    if (chatDivRef.current) {
      const scrollThreshold = 20;
      const isAtBottom =
          chatDivRef.current.scrollHeight -
          chatDivRef.current.scrollTop <=
          chatDivRef.current.clientHeight + scrollThreshold;

      // Notify parent component about the auto-scroll status
      onChatScroll(isAtBottom);

      // Disable auto-scroll if the user scrolls up
      if (!isAtBottom) {
        onChatScroll(false);
      }
    }
  };




  return (
    <div
    id="chat-container"
    ref={chatDivRef}
    className="chat-container-outer"
    onScroll={handleScroll}
  >
    <div id="chat-container-inner" className="chat-container-inner">
      <ChatBlock
        key="chat-block-0"
        block={introductionMessage}
        loading={false}
        isLastBlock={false}
      />

      {chatBlocks.map((block, index) => (
        <ChatBlock
          key={`chat-block-${block.id}`}
          block={block}
          loading={index === chatBlocks.length - 1 && loading}
          isLastBlock={index === chatBlocks.length - 1}
        />
      ))}
      <div className="spacer" />
    </div>
  </div>
  );
};

export default Chat;
