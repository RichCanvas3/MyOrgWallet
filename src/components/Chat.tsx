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
  chatBlocks: ChatMessage[] | undefined;
  onChatScroll: (isAtBottom: boolean) => void;
  allowAutoScroll: boolean;
  model: string | null;
  onModelChange: (value: string | null) => void;
  conversation: Conversation | null;
  loading: boolean;
}

const Chat: React.FC<Props> = ({
  introductionMessage,
  chatBlocks,
  onChatScroll,
  allowAutoScroll,
  model,
  onModelChange,
  conversation,
  loading
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

  // Always scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (chatDivRef.current) {
        const chatDiv = chatDivRef.current;
        chatDiv.scrollTo({
          top: chatDiv.scrollHeight,
          behavior: 'smooth'
        });
      }
    };

    // Scroll immediately and after a delay to ensure content is rendered
    scrollToBottom();
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [chatBlocks, loading]); // Also trigger on loading changes

  const handleScroll = () => {
    if (chatDivRef.current) {
      const chatDiv = chatDivRef.current;
      const isAtBottom = chatDiv.scrollHeight - chatDiv.scrollTop <= chatDiv.clientHeight + 50;
      onChatScroll(isAtBottom);
    }
  };

  return (
    <div
      id="chat-container"
      ref={chatDivRef}
      className="chat-container-outer"
      onScroll={handleScroll}
      style={{ overflowY: 'auto', height: '100%' }}
    >
      <div id="chat-container-inner" className="chat-container-inner">
        <ChatBlock
          key="chat-block-0"
          block={introductionMessage}
          loading={false}
          isLastBlock={false}
        />

        {chatBlocks?.map((block, index) => (
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
