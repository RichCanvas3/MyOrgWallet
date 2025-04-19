import React, {ChangeEvent, KeyboardEvent, useContext, useEffect, useRef, useState} from 'react';
import {SparklesIcon, UserCircleIcon} from "@heroicons/react/24/outline";
import MarkdownBlock from './MarkdownBlock';

import {ChatMessage, MessageType, Role} from "../models/ChatCompletion";
import UserContentBlock from "./UserContentBlock";
import { UserContext } from "../UserContext";

interface Props {
  block: ChatMessage;
  loading: boolean;
  isLastBlock: boolean;
}

const ChatBlock: React.FC<Props> = ({block, loading, isLastBlock}) => {
  const [isEdit, setIsEdit] = useState(false);
  const [editedBlockContent, setEditedBlockContent] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [savedHeight, setSavedHeight] = useState<string | null>(null);
  const { userSettings } = useContext(UserContext);

  const errorStyles = block.messageType === MessageType.Error ? {
    backgroundColor: userSettings.theme === 'dark' ? 'rgb(50, 36, 36)' : '#F5E6E6',
    borderColor: 'red',
    borderWidth: '1px',
    borderRadius: '8px',
    padding: '10px'
  } : {};


  useEffect(() => {
    if (isEdit) {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(0, 0);
    }
  }, [isEdit]);


  const handleRegenerate = () => {
  }

  const handleEdit = () => {
    if (contentRef.current) {
      setSavedHeight(`${contentRef.current.offsetHeight}px`);
    }
    setIsEdit(true);
    setEditedBlockContent(block.content);
  }
  const handleEditSave = () => {
    // todo: notify main to change content block
    setIsEdit(false);
  }

  const handleEditCancel = () => {
    setIsEdit(false);
  }

  const checkForSpecialKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnter = (e.key === 'Enter');
    const isEscape = (e.key === 'Escape');

    if (isEnter) {
      e.preventDefault();
      handleEditSave();
    } else if (isEscape) {
      e.preventDefault();
      handleEditCancel();
    }
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setEditedBlockContent(event.target.value);
  };

  return (
    <div key={`chat-block-${block.id}`} className="chat-block">
    <div className="chat-container">
      {block.role === Role.Developer ? (
        <div className="message-content">
          <div ref={contentRef} className="markdown-content">
              <MarkdownBlock
                markdown={block.content}
                role={block.role}
                loading={loading}
              />
          </div>
        </div>
      ) : (
      <div className="chat-row">
        <div className="avatar-container">
          <div className="avatar">
            {block.role === Role.User ? (
              <UserCircleIcon className="avatar-icon" />
            ) : block.role === Role.Assistant ? (
              <SparklesIcon key={`open-ai-logo-${block.id}`} className="avatar-icon" />
            ) : null}
          </div>
        </div>
        <div className="content-container">
          <div id={`message-block-${block.id}`} className='message-block'>
            <div className="message-content">
              {isEdit ? (
                <textarea
                  spellCheck={false}
                  tabIndex={0}
                  ref={textareaRef}
                  className="edit-textarea"
                  onChange={handleTextChange}
                  onKeyDown={checkForSpecialKey}
                  value={editedBlockContent}
                ></textarea>
              ) : (
                <div ref={contentRef} className="markdown-content">
                  {block.role === 'user' ? (
                    <UserContentBlock
                      text={block.content}
                      fileDataRef={block.fileDataRef || []}
                    />
                  ) : (
                    <MarkdownBlock
                      markdown={block.content}
                      role={block.role}
                      loading={loading}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  </div>
  );
};

export default ChatBlock;
