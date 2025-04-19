import React, {useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ChatBubbleLeftIcon, CheckIcon, PencilSquareIcon, TrashIcon, XMarkIcon} from "@heroicons/react/24/outline";
import ConversationService, {Conversation} from "../service/ConversationService";
import {iconProps} from "../svg";
import {MAX_TITLE_LENGTH} from "../constants/appConstants";

interface ConversationListItemProps {
  convo: Conversation;
  isSelected: boolean;
  loadConversations: () => void;
  setSelectedId: (id: number) => void;
}

const ConversationListItem: React.FC<ConversationListItemProps> = ({
                                                                     convo,
                                                                     isSelected,
                                                                     loadConversations,
                                                                     setSelectedId
                                                                   }) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(convo.title);
  const navigate = useNavigate();
  const acceptButtonRef = useRef<HTMLButtonElement | null>(null);

  const saveEditedTitle = () => {
    ConversationService.updateConversationPartial(convo, {title: editedTitle})
      .then(() => {
        setIsEditingTitle(false);
        loadConversations(); // Reload conversations to reflect the updated title
      })
      .catch((error) => {
        console.error('Error updating conversation title:', error);
      });
  };

  const deleteConversation = () => {
    ConversationService.deleteConversation(convo.id)
      .then(() => {
        loadConversations(); // Reload conversations to reflect the deletion
      })
      .catch((error) => {
        console.error('Error deleting conversation:', error);
      });
  };

  const selectConversation = () => {
    if (isEditingTitle) {
      // If in edit mode, cancel edit mode and select the new conversation
      setIsEditingTitle(false);
      setEditedTitle(''); // Clear editedTitle
    } else {
      // If not in edit mode, simply select the conversation
    }
    setSelectedId(convo.id);
    if (!isEditingTitle) {
      const url = convo.gid ? `/chat/g/${convo.gid}/c/${convo.id}` : `/chat/c/${convo.id}`;
      navigate(url);
    }
  };

  const toggleEditMode = (convo: Conversation) => {
    if (!isEditingTitle) {
      // Entering edit mode, initialize editedTitle with convo.title
      setEditedTitle(convo.title);
    } else {
      // Exiting edit mode, clear editedTitle
      setEditedTitle('');
    }
    setIsEditingTitle(!isEditingTitle);
  };

  const handleTitleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, conversation: Conversation) => {
    if (e.key === 'Enter') {
      // Save the edited title when Enter key is pressed
      saveEditedTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>, conversation: Conversation) => {
    if (acceptButtonRef.current) {
      saveEditedTitle();
    }
    // Check if the blur event was not caused by pressing the Enter key
    // If in edit mode and the input loses focus, cancel the edit
    setEditedTitle(conversation.title);
    setIsEditingTitle(false);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    setIsEditingTitle(false);
  };

  if (isSelected) {
    return (
      <li key={convo.id} className="conversation-item">
        <div
          role="button"
          className="conversation-selected"
        >
          <ChatBubbleLeftIcon className="icon" />
          {isEditingTitle ? (
            <div className="edit-container">
              <input
                type="text"
                className="edit-input"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => handleTitleInputKeyPress(e, convo)}
                autoFocus={true}
                maxLength={MAX_TITLE_LENGTH}
                onBlur={(e) => {
                  if (isEditingTitle) {
                    handleInputBlur(e, convo);
                  }
                }}
              />
            </div>
          ) : (
            <div className="title-container">
              {convo.title}
            </div>
          )}
          <div className="action-buttons">
            {isEditingTitle ? (
              <>
                <button
                  ref={acceptButtonRef}
                  onClick={() => saveEditedTitle()}
                  className="action-button"
                  onContextMenu={handleContextMenu}
                >
                  <CheckIcon className="icon" />
                </button>
                <button
                  onClick={() => {
                    setIsEditingTitle(false);
                    setEditedTitle("");
                  }}
                  className="action-button"
                >
                  <XMarkIcon className="icon" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => toggleEditMode(convo)}
                  className="action-button"
                >
                  <PencilSquareIcon className="icon" />
                </button>
                <button
                  onClick={() => deleteConversation()}
                  className="action-button"
                >
                  <TrashIcon className="icon" />
                </button>
              </>
            )}
          </div>
        </div>
      </li>
    );
  } else {
    return (
      <li key={convo.id} className="conversation-item">
        <button
          onClick={() => selectConversation()}
          type="button"
          className="conversation-unselected"
        >
          <ChatBubbleLeftIcon className="icon" />
          <div className="title-container">
            {convo.title}
          </div>
        </button>
      </li>
    );
  }
}

export default ConversationListItem;
