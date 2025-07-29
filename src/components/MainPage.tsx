import {useContext, useEffect, useRef, useState} from 'react';
import * as React from 'react';
import { hexlify, parseEther, formatEther, ethers, namehash } from 'ethers';
import { Button } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

import ETHRegistrarControllerABI from '../abis/ETHRegistrarController.json'
import PublicResolverABI from '../abis/PublicResolver.json'

import { createPublicClient, http } from 'viem';

import {ChatService} from "../service/ChatService";
import {OrgService} from "../service/OrgService";
import Chat from "./Chat";
import {ChatCompletion, ChatMessage, MessageType, Role} from "../models/ChatCompletion";
import {ScrollToBottomButton} from "./ScrollToBottomButton";
import {OPENAI_DEFAULT_SYSTEM_PROMPT, OPENAI_DEFAULT_ASSISTANT_PROMPT} from "../config";
import {CustomError} from "../service/CustomError";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import {useTranslation} from 'react-i18next';
import { createRoot } from 'react-dom/client';
import MessageBox, {MessageBoxHandles} from "./MessageBox";
import {
  CONVERSATION_NOT_FOUND,
  DEFAULT_INSTRUCTIONS,
  DEFAULT_INTRODUCTIONS,
  DEFAULT_MODEL,
  MAX_TITLE_LENGTH,
  SNIPPET_MARKERS
} from "../constants/appConstants";
import {ChatSettings} from '../models/ChatSettings';
import {Entity} from '../models/Entity';
import chatSettingsDB, {chatSettingsEmitter, updateShowInSidebar} from '../service/ChatSettingsDB';
import ConversationService, {
  Conversation,
  ConversationChangeEvent,
  conversationsEmitter
} from "../service/ConversationService";
import {Attestation, OrgAttestation, SocialAttestation, RegisteredDomainAttestation, WebsiteAttestation, InsuranceAttestation, EmailAttestation, StateRegistrationAttestation} from '../models/Attestation';
import AttestationService from '../service/AttestationService';
import EnsService from '../service/EnsService'
import {UserContext} from '../UserContext';
import {NotificationService} from '../service/NotificationService';
import CustomChatSplash from './CustomChatSplash';
import {FileDataRef} from '../models/FileData';
import {OpenAIModel} from '../models/model';
import {ArrowUturnDownIcon} from '@heroicons/react/24/outline';
import {Command} from '../models/Command'
import VerifiableCredentialsService from '../service/VerifiableCredentialsService'

import LinkedInAuth, { LinkedInAuthRef } from './LinkedInAuth';
import XAuth, { XAuthRef } from './XAuth';
import ShopifyAuth, { ShopifyAuthRef } from './ShopifyAuth';
import InsuranceAuth, { InsuranceAuthRef } from './InsuranceAuth';
import RightSide from "./RightSide";

import { useWallectConnectContext } from "../context/walletConnectContext";
import { getSignerFromSignatory } from "../signers/SignatoryTypes";

import { keccak256, toUtf8Bytes } from 'ethers';


import DeleteAttestationsModal from './DeleteAttestationsModal';
import ApproveLeaderModal from './ApproveLeaderModal';
import ApproveAccountAccessModal from './ApproveAccountAccessModal';
import CreateWebDidModal from './CreateWebDidModal';
import ImportDriversLicenseModal from './ImportDriversLicenseModal';
import AddCreditCardModal from './AddEOACrossChainAccountModal';
import FundCreditCardModal from './FundCreditCardModal';
import AddSavingsModal from './AddAccountModal';
import AddAccountModal from './AddEOACrossChainAccountModal';
import AddEnsRecordModal from './AddEnsRecordModal';
import OrgModal from './OrgModal';
import { invokeLangGraphAgent, sendMessageToLangGraphAssistant } from '../service/LangChainService';


function getFirstValidString(...args: (string | undefined | null)[]): string {
  for (const arg of args) {
    if (arg !== null && arg !== undefined && arg.trim() !== '') {
      return arg;
    }
  }
  return '';
}

function extractJsonFromString(input: string): string | null {
  let lastValidSegment: string | null = null;
  let currentStart = 0;

  for (let i = 0; i < input.length; i++) {
      if (input[i] === '}') {
          // Try to extract a substring from currentStart to i (inclusive)
          const potentialSegment = input.substring(currentStart, i + 1);
          try {
              JSON.parse(potentialSegment);
              // If valid, update lastValidSegment and move start past this segment
              lastValidSegment = potentialSegment;
              currentStart = i + 1;
          } catch (e) {
              // If invalid, try the next possible closing brace
              continue;
          }
      }
  }

  return lastValidSegment;
}


interface MainPageProps {
  className: string;
  appCommand: (cmd: Command) => void;
}


const linkedInAuthRef = { current: null as LinkedInAuthRef | null };
const shopifyAuthRef = { current: null as ShopifyAuthRef | null };
const xAuthRef = { current: null as XAuthRef | null };
const insuranceAuthRef = { current: null as InsuranceAuthRef | null };

const MainPage: React.FC<MainPageProps> = ({className, appCommand}) => {
  const defaultIntroduction: ChatMessage = { content: "test"} as ChatMessage;
  const [introduction, setIntroduction] = useState<ChatMessage>(defaultIntroduction);


  const {userSettings, setUserSettings} = useContext(UserContext);
  const {t} = useTranslation();
  const [chatSettings, setChatSettings] = useState<ChatSettings | undefined>(undefined);
  const [entities, setEntities] = useState<Entity[] | undefined>(undefined);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [model, setModel] = useState<OpenAIModel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const {id, gid} = useParams<{ id?: string, gid?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [allowAutoScroll, setAllowAutoScroll] = useState(true);
  const messageBoxRef = useRef<MessageBoxHandles>(null);
  const chatSettingsRef = useRef(chatSettings);
  const entitiesRef = useRef(entities);
  const buttonRef = useRef<HTMLButtonElement | null>(null);



  const { chain, veramoAgent, credentialManager, privateIssuerAccount, burnerAccountClient, orgAccountClient, orgBurnerDelegation, orgIndivDelegation, orgDid, indivDid, privateIssuerDid, orgName, indivName, indivAccountClient, setOrgNameValue, signatory } = useWallectConnectContext();


  const [isDeleteAttestationsModalVisible, setDeleteAttestationsModalVisible] = useState(false);
  const [isApproveLeaderModalVisible, setApproveLeaderModalVisible] = useState(false);
  const [isApproveAccountAccessModalVisible, setApproveAccountAccessModalVisible] = useState(false);
  const [isCreateWebDidModalVisible, setCreateWebDidModalVisible] = useState(false);
  const [isImportDriversLicenseModalVisible, setImportDriversLicenseModalVisible] = useState(false);
  const [isAddCreditCardModalVisible, setAddCreditCardModalVisible] = useState(false);
  const [isFundCreditCardModalVisible, setFundCreditCardModalVisible] = useState(false);
  const [isAddSavingsModalVisible, setAddSavingsModalVisible] = useState(false);
  const [isAddAccountModalVisible, setAddAccountModalVisible] = useState(false);
  const [isAddEnsRecordModalVisible, setIsAddEnsRecordModalVisible] = useState(false);
  const [existingEnsNameForUpdate, setExistingEnsNameForUpdate] = useState<string>('');

  const [isOrgModalVisible, setOrgModalVisible] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  const BASE_URL = import.meta.env.VITE_ORGSERVICE_API_URL || 'http://localhost:8501';


  const [threadID, setThreadID] = useState<string | null>(null);

  // Add state for thinking
  const [isThinking, setIsThinking] = useState(false);
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleOnDeleteAttestationsModalClose = () => {
    setDeleteAttestationsModalVisible(false);
  };
  const handleOnApproveLeaderModalClose = () => {
    setApproveLeaderModalVisible(false);
  };
  const handleOnApproveAccountAccessModalClose = () => {
    setApproveAccountAccessModalVisible(false);
  };
  const handleOnCreateWebDidModalClose = () => {
    setCreateWebDidModalVisible(false);
  };
  const handleOnImportDriversLicenseModalClose = () => {
    setImportDriversLicenseModalVisible(false);
  };
  const handleOnAddCreditCardModalClose = () => {
    setAddCreditCardModalVisible(false);
  };
  const handleOnFundCreditCardModalClose = () => {
    setFundCreditCardModalVisible(false);
  };
  const handleOnAddSavingsModalClose = () => {
    setAddSavingsModalVisible(false);
  };
  const handleOnAddAccountModalClose = () => {
    setAddAccountModalVisible(false);
  };
  const handleOnOrgModalClose = () => {
    setOrgModalVisible(false);
  };
  const handleOnAddEnsRecordModalClose = () => {
    setIsAddEnsRecordModalVisible(false);
    setExistingEnsNameForUpdate('');
  };

  // Refresh callbacks for sections
  const handleRefreshAttestations = () => {
    // This will be passed to MainSection and then to AttestationSection
    // The AttestationSection already has its own refresh mechanism via events
    if ((window as any).refreshAttestations) {
      (window as any).refreshAttestations();
    }
  };

  const handleRefreshAccounts = () => {
    // This will be passed to MainSection and then to ChartOfAccountsSection
    // The ChartOfAccountsSection will refresh its data
    if ((window as any).refreshChartOfAccounts) {
      (window as any).refreshChartOfAccounts();
    }
  };




  useEffect(() => {

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        ChatService.cancelStream();
      }
    };

    chatSettingsEmitter.on('chatSettingsChanged', chatSettingsListener);

    const button = createButton();
    buttonRef.current = button;

    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('keydown', handleKeyDown);

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (userSettings.model) {
      fetchModelById(userSettings.model).then(setModel);
    }

    if (code) {
      console.info("received authentication")
    } else {
      setLoading(false);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
      chatSettingsEmitter.off('chatSettingsChanged', chatSettingsListener);
    };
  }, []);



  
  async function init() {
    let orgname;
    let domain;
    let state_registration;
    let linkedin;
    let x;
    let ens_registration;
    let insurance;
    let website;
    let shopify;
    let email_org;
    let email_indiv;
    let indiv;
    let account_indiv;
    let accountOrg_org;
    let account_org;
    let orgIndiv_org;


    if (orgAccountClient && chain && orgDid && indivDid) {

      await AttestationService.setEntityAttestations(chain, orgDid, indivDid).then((ents) => {
        
        if (ents != undefined) {
          console.log("ents: ", ents)
          setEntities(ents)
          for (const entity of ents) {
            if (entity.name == "org(org)" && entity.attestation) {
              setOrgNameValue((entity.attestation as OrgAttestation).name)
              orgname = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == "domain(org)") {
              console.log('domain here!!!!!')
              domain = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == "ens(org)") {
              ens_registration = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == "indiv(indiv)") {
              indiv = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'linkedin(indiv)') {
              linkedin = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'x(indiv)') {
              x = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'account(indiv)') {
              account_indiv = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'insurance(org)') {
              insurance = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'website(org)') {
              website = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'shopify(org)') {
              shopify = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'email(org)') {
             email_org = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'email(indiv)') {
             email_indiv = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'state-registration(org)') {
              state_registration = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'account-org(org)') {
             accountOrg_org = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'account(org)') {
             account_org = JSON.stringify(entity.attestation as OrgAttestation)
            } else if (entity.name == 'org-indiv(org)') {
              orgIndiv_org = JSON.stringify(entity.attestation as OrgAttestation)
            }    
          }

          if (!conversation) {
            if (location.pathname.startsWith("/chat/c/")) {
              let conversationId = location.pathname.replace("/chat/c/", "")
              handleSelectedConversation(conversationId)
            }
            else {
              newConversation(ents)
            }
          }
        }
      })


    }
    else {
      navigate("/")
    }
    //return ents_array
    return {
      "name": orgname,
      "linkedin": linkedin,
      "x": x,
      "state_registration": state_registration,
      "ens_registration": ens_registration,
      "domain": domain,
      "shopify": shopify,
      "insurance": insurance,
      "website": website,
      "email_org": email_org,
      "email_indiv": email_indiv,
      "indiv": indiv,
      "account_indiv": account_indiv,
      "account-org(org)": accountOrg_org,
      "account_org": account_org,
      "orgIndiv_org": orgIndiv_org
    };
  }

  
  //const company_config = ''

  //console.log('company config: ', company_config)


  useEffect(() => {
    //console.info("........ is connected: ", signatory)
    if (signatory == undefined) {
      navigate('/')
    }

  }, [signatory]);

  useEffect(() => {
    conversationsEmitter.on('conversationChangeEvent', handleConversationChange);

    return () => {
      conversationsEmitter.off('conversationChangeEvent', handleConversationChange);
    };

  }, []);

  useEffect(() => {
    chatSettingsRef.current = chatSettings;
  }, [chatSettings]);

  useEffect(() => {
    if (location.state?.reset) {
      messageBoxRef.current?.reset();
      messageBoxRef.current?.focusTextarea();
    }
  }, [location.state]);

  useEffect(() => {
  }, [introduction]);



  useEffect(() => {
    if (conversation && conversation.id) {
      // Only update if there are messages
      if (messages.length > 0) {
        ConversationService.storeConversation(conversation, messages);
      }
    }
  }, [messages]);


  useEffect(() => {
    if (userSettings.model) {
      fetchModelById(userSettings.model).then(setModel);
    }
  }, [userSettings]);

  useEffect(() => {
    let isMounted = true;

    async function fetchThreadID() {
      if (threadID || !isMounted) {
        return;
      }

      try {
        const threadID_text = await invokeLangGraphAgent({});
        const threadID_Array = threadID_text.split("'");
        const threadIDResult = threadID_Array[1];

        if (isMounted) {
          setThreadID(threadIDResult);
          const company_config = await init();
          //getArgfromUserMessage(threadIDResult, `lets get started: ${company_config}`).then(str => {
          getArgfromUserMessage(threadIDResult,
             `Lets get started: Name: ${company_config["name"]},
              Domain: ${company_config["domain"]}, 
              Linkedin: ${company_config["linkedin"]}, 
              Twitter: ${company_config["x"]}, 
              State Registration: ${company_config["state_registration"]}, 
              ENS Registration: ${company_config["ens_registration"]}, 
              Linkedin: ${company_config["linkedin"]},
              Shopify: ${company_config["shopify"]},
              Insurance: ${company_config["insurance"]},
              Website: ${company_config["website"]},
              Org Email: ${company_config["email_org"]},
              Individual Email: ${company_config["email_indiv"]},`).then(str => {
            if (str) {
              addMessage(Role.Assistant, MessageType.Normal, str, '', [], sendMessage);
            }
          })
        }
      } catch (error) {
        console.error('Error fetching thread ID:', error);
      }
    }

    fetchThreadID();

    return () => {
      isMounted = false;
    };
  }, [threadID]);

  const fetchModelById = async (modelId: string): Promise<OpenAIModel | null> => {
    try {
      const fetchedModel = await ChatService.getModelById(modelId);
      return fetchedModel;
    } catch (error) {
      console.error('Failed to fetch model:', error);
      if (error instanceof Error) {
        NotificationService.handleUnexpectedError(error, 'Failed to fetch model.');
      }
      return null;
    }
  };

  const chatSettingsListener = (data: { gid?: number }) => {
    const currentChatSettings = chatSettingsRef.current;
    if (data && typeof data === 'object') {
      if (currentChatSettings && currentChatSettings.id === data.gid) {
        fetchAndSetChatSettings(data.gid);
      }
    } else {
      if (currentChatSettings) {
        fetchAndSetChatSettings(currentChatSettings.id);
      }
    }
  };

  const fetchAndSetChatSettings = async (gid: number) => {
    try {
      const settings = await chatSettingsDB.chatSettings.get(gid);
      setChatSettings(settings);
      if (settings) {
        if (settings.model === null) {
          setModel(null);
        } else {
          fetchModelById(settings.model).then(setModel);
        }
      }
    } catch (error) {
      console.error('Failed to fetch chat settings:', error);
    }
  };


  const handleConversationChange = (event: ConversationChangeEvent) => {

      if (event.action === 'edit') {
        if (event.id === 0) {
          console.error("invalid state, cannot edit id = 0");
        }
        else if (event.conversation) {
          const convoMessages = JSON.parse(event.conversation.messages)
          if (messages.length != convoMessages.length ) {
            setMessages(convoMessages)
            scrollToBottom()
          }
        }
      }
    };



  const newConversation = (entities: Entity[]) => {

    if (conversation == undefined) {

      if (location.pathname.startsWith("/chat/c/")) {
        let conversationId = location.pathname.replace("/chat/c/", "")
        //setConversation(conversationId)
      }
      else {
        setConversation(null);
      }

      setShowScrollButton(false);
      clearInputArea();

      // Set the initial introduction message to the requested string
      let introduction = "Hello!";

      // If we have the individual's name, personalize the greeting
      if (indivName) {
        // Extract first name (everything before the first space)
        const firstName = indivName.split(' ')[0];
        introduction = `Hello, ${firstName}!`;
      }

      let instruction : string | undefined

      if (entities != undefined) {
        for (const entity of entities) {
          if (entity.attestation == undefined && entity.introduction && entity.introduction != "") {
            // introduction = entity.introduction?.replace("[org]", orgName?orgName:"");
            instruction = entity.instruction?.replace("[org]", orgName?orgName:"");
            break
          }
        }
      }



      const introductionMessage = {
        id: 0,
        messageType: MessageType.Normal,
        role: Role.Assistant,
        content: introduction
      } as ChatMessage;
      setIntroduction(introductionMessage);


      setMessages([]);

      const id = Date.now();
      const newConversation: Conversation = {
        id: id,
        gid: getEffectiveChatSettings().id,
        timestamp: Date.now(),
        title: "test",
        model: model?.id || DEFAULT_MODEL,
        systemPrompt: instruction?instruction:"",
        assistantPrompt: introduction,
        messages: "[]",
      };
      setConversation(newConversation);

      ConversationService.storeConversation(newConversation, messages);
      
      navigate(`/chat/c/${newConversation.id}`);

    }



    messageBoxRef.current?.focusTextarea();
  };



  const handleSelectedConversation = (id: string | null) => {
    if (id && id.length > 0) {
      let n = Number(id);
      ConversationService.getConversationById(n)
        .then(conversation => {
          if (conversation) {
            setConversation(conversation);

            const introductionMessage = {
              id: 0,
              messageType: MessageType.Normal,
              role: Role.Assistant,
              content: conversation.assistantPrompt
            } as ChatMessage;
            setIntroduction(introductionMessage);


            clearInputArea();
            ConversationService.getChatMessages(conversation).then((msgs: ChatMessage[]) => {
              if (msgs.length === 0) {
                console.warn('possible state problem');
                const errorMessage: string = 'Conversation ' + location.pathname + ' not found';
                NotificationService.handleError(errorMessage, CONVERSATION_NOT_FOUND);
              } else {
                setMessages(msgs);
              }
            });
          } else {
            const errorMessage: string = 'Conversation ' + location.pathname + ' not found';
            NotificationService.handleError(errorMessage, CONVERSATION_NOT_FOUND);

            console.info("************* navigating to chat 3")
            //navigate('/chat/');
          }
        });
    }
    setAllowAutoScroll(true);
    setShowScrollButton(false);
    messageBoxRef.current?.focusTextarea();
  };


  const handleModelChange = (value: string | null) => {
    if (value === null) {
      setModel(null);
    } else {
      fetchModelById(value).then(setModel);
    }
  };

  async function getArgfromUserMessage(currentThreadID: string, message: string): Promise<string> {
    const args = await processUserMessage(currentThreadID, message);
    return args;
  }

  async function stateRegister(company_name: string, state: string, ngrok_url: string) {
    console.log(company_name, state)
    try {
      const response = await fetch(
        `${BASE_URL}/creds/good-standing/company?company=${company_name}&state=${state}`
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("Fetch failed:", response.status, text);
        return `Fetch failed: ${response.status} - ${text}`;
      }
      console.log(response);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error during fetch:", error);
      if (error instanceof Error) {
        return `Error during fetch: ${error.message}`;
      }
      return "An unknown error occurred during fetch.";
    }
  }

  const callApp = (message: string, fileDataRef: FileDataRef[]) => {
    var ngrok_url = 'https://b2f972629ffd.ngrok-free.app';
    if (conversation == null || threadID == null) {
      return
    }

    const brokenMessage = message.split(' ')

    // Command must be: Register ENS: <domain_name>
    if (brokenMessage[0] == 'Register' && brokenMessage[1] == 'ENS:') {
      console.log('Correct input, and name = ', brokenMessage[2] )
      console.log('ENS Name: ', brokenMessage[2])
    }

    checkAllDirectActions("", message);

    // Ensure auto-scroll is enabled when sending new messages
    setAllowAutoScroll(true);

    // Add user's message
    addMessage(Role.User, MessageType.Normal, message, '', fileDataRef, sendMessage);

    // Force scroll to bottom after adding user message
    setTimeout(() => {
      scrollToBottom();
    }, 100);

    // Clear any existing timeout
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
    }

    // Set thinking state after delay
    thinkingTimeoutRef.current = setTimeout(() => {
      setIsThinking(true);
      // Ensure thinking indicator is visible
      scrollToBottom();
    }, 750);

    // Process user message
    getArgfromUserMessage(threadID, message).then(str => {
      // Clear timeout and hide thinking state
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
      setIsThinking(false);

      if (str.includes("ens_verification") && orgAccountClient && chain) {
        console.log('process ens verification')
        setIsAddEnsRecordModalVisible(true)
        setExistingEnsNameForUpdate('')
        // Remove the immediate ENS registration call - it will be handled by the modal
        addMessage(Role.Assistant, MessageType.Normal, `Opening ENS registration modal...`, '', fileDataRef, sendMessage)
      } else if (str.includes('state_register') && orgAccountClient && chain) {
        const listMessage = str.split(' ')
        console.log(listMessage)
        const data = stateRegister(orgName || '', message, ngrok_url);
        console.log('state data being jsoned', data);
        addMessage(Role.Assistant, MessageType.Normal, `${orgName} Registeration Verified!`, '', fileDataRef, sendMessage)
        /*
        var split = data.split('-');
        console.log(split)
        var id = (split[1].split('** '))[1];
        var name = 'test';
        var formDate = (split[4].split('** '))[1];
        var address = (split[5].split('** '))[1];
        console.log(id, formDate, address)
        */
      } else if (str.includes('linkedin_verification')) {
        //call linkedin modal here
        addMessage(Role.Assistant, MessageType.Normal, 'Linkedin being verified...', '', fileDataRef, sendMessage);
      } else if (str.includes('shopify_verification')) {
        //call shopify modal here
        addMessage(Role.Assistant, MessageType.Normal, 'Shopify being verified...', '', fileDataRef, sendMessage);
      } else if (str.includes('x_verification')) {
        //call x modal
        addMessage(Role.Assistant, MessageType.Normal, 'Twitter being verified...', '', fileDataRef, sendMessage);
      } else if (str.includes('insurance_verification')) {
        //insurance modal here
        addMessage(Role.Assistant, MessageType.Normal, 'Insurance being verified...', '', fileDataRef, sendMessage);
      }
      console.log('Data From Stream: ', str);

      // Force scroll to bottom after response
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }).catch(error => {
      // Clear timeout and hide thinking state on error
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
      setIsThinking(false);
      console.error('Error processing message:', error);
    });


  };

  const addMessage = (
    role: Role,
    messageType: MessageType,
    message: string,
    args: any,
    fileDataRef: FileDataRef[],
    sendMessage?: (sendMessage: ChatMessage[], args: string) => void
  ) => {
    let content: string = message;

    setMessages((prevMessages: ChatMessage[]) => {
      const newMsg: ChatMessage = {
        id: prevMessages.length + 1,
        args: "",
        role: role,
        messageType: messageType,
        content: content,
        fileDataRef: fileDataRef,
      };
      const newMessages = [...prevMessages, newMsg];

      // Enable auto-scroll for new messages
      setAllowAutoScroll(true);

      return newMessages;
    });

    const newMessage: ChatMessage = {
      id: messages.length + 1,
      args: "",
      role: role,
      messageType: messageType,
      content: content,
      fileDataRef: fileDataRef,
    };
    const updatedMessages = [...messages, newMessage];

    if (sendMessage) {
      sendMessage(updatedMessages, args);
    }
  };

  function getEffectiveChatSettings(): ChatSettings {
    let effectiveSettings = chatSettings;
    if (!effectiveSettings) {
      effectiveSettings = {
        id: 0,
        author: 'system',
        name: 'default',
        model: model?.id || DEFAULT_MODEL
      };
    }
    return effectiveSettings;
  }


  function sendMessage(updatedMessages: ChatMessage[], args: string) {
    /*
    // if we know what to do already from processor then go ahead and do it.  No need to call openai
    if (args != "") {
      console.info("*********************** no need to have AI look at user input becasue it told us what to do: ", args)



      let messages: ChatMessage[] = [
        {
          id: 0,
          messageType: MessageType.Normal,
          role: Role.Assistant,
          content: "",
          args: args
        } as ChatMessage,
        ...updatedMessages
      ];
      setMessages(messages)




      //console.info(">>>>>>>> handleStreamedResponse ")
      handleStreamedResponse("", args, [], true)
      return
    }
    */

    let defaultIntroduction
    let defaultInstruction
    let defaultTools
    /*
    //console.info("set ai stuff")
    if (entities != undefined) {
      for (const entity of entities) {
        //console.info("entity: ", entity, entity.attestation)
        if (entity.attestation == undefined && entity.introduction) {
          //console.info(">>>>>> add tools for : ", entity.name)
          if (entity.introduction != undefined) {
            defaultIntroduction = entity.introduction.replace("[org]", orgName?orgName:"")
          }
          if (entity.instruction != undefined) {
            defaultInstruction = entity.instruction.replace("[org]", orgName?orgName:"")
          }
          if (entity.tools != undefined) {
            defaultTools = entity.tools
          }
          break
        }
      }
    }
    */
    //console.info("tell AI what we need to do")
    //console.info("default introduction: ", defaultIntroduction)
    //console.info("default instruction: ", defaultInstruction)
    //console.info("default tools: ", defaultTools)


    setLoading(true);
    clearInputArea();
    let systemPrompt = getFirstValidString(
      defaultInstruction,
      conversation?.systemPrompt,
      chatSettings?.systemInstructions,
      userSettings.systemInstructions,
      DEFAULT_INSTRUCTIONS
    );
    let assistantPrompt = getFirstValidString(
      defaultIntroduction,
      conversation?.assistantPrompt,
      chatSettings?.assistantIntroductions,
      userSettings.assistantIntroductions,
      OPENAI_DEFAULT_ASSISTANT_PROMPT,
      DEFAULT_INTRODUCTIONS
    );

    let messages: ChatMessage[] = [
      {
        role: Role.System,
        content: systemPrompt
      } as ChatMessage,
      {
        id: 0,
        messageType: MessageType.Normal,
        role: Role.Assistant,
        content: assistantPrompt
      } as ChatMessage,
      ...updatedMessages
    ];

    let effectiveSettings = getEffectiveChatSettings();

    /*
    console.info("....... defaultTools: ", defaultTools)
    ChatService.sendMessageStreamed(effectiveSettings, messages, defaultTools, handleStreamedResponse)
      .then((response: ChatCompletion) => {
        //console.info(">>>>> sendMessageStreamed response: ", response)
        //addMessage(Role.Assistant, MessageType.Error, "lets do next thing", []);
        // no-op
      })
      .catch(err => {
        console.info(">>>>> error sendMEssageStreamed: ")
        if (err instanceof CustomError) {
          const message: string = err.message;
          setLoading(false);

          console.info("...... add assistant message to list: ", message)
          addMessage(Role.Assistant, MessageType.Error, message, "", []);
        } else {
          NotificationService.handleUnexpectedError(err, 'Failed to send message to openai.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
    */
    setLoading(false);
  }



  // Helper function to fetch existing ENS name
  const fetchExistingEnsName = async (): Promise<string> => {
    if (!orgAccountClient || !chain) return '';

    try {
      const orgAddress = await orgAccountClient.getAddress();
      const existingEnsName = await EnsService.getEnsName(orgAddress, chain);
      console.log("Found existing ENS name for org:", existingEnsName);
      return existingEnsName || '';
    } catch (error) {
      console.error("Error fetching existing ENS name:", error);
      return '';
    }
  };

  function checkAllDirectActions(lastAssistantResponse: string, lastUserResponse: string) {
    let actionMessage = ""

    try {
      if (lastUserResponse.toLowerCase().includes("show wallet") ||
          lastUserResponse.toLowerCase().includes("show address") ||
          lastUserResponse.toLowerCase().includes("my address") ||
          lastUserResponse.toLowerCase().includes("smart account address")) {
        console.info("Showing wallet addresses...");

        const showAddresses = async () => {
          const addresses = [];

          if (orgAccountClient) {
            const orgAddress = await orgAccountClient.getAddress();
            addresses.push(`Organization Smart Account: ${orgAddress}`);
          }

          if (indivAccountClient) {
            const indivAddress = await indivAccountClient.getAddress();
            addresses.push(`Individual Smart Account: ${indivAddress}`);
          }

          if (burnerAccountClient) {
            const burnerAddress = await burnerAccountClient.getAddress();
            addresses.push(`Burner Account: ${burnerAddress}`);
          }

          const message = `Your wallet addresses:\n${addresses.join('\n')}`;
          addMessage(Role.Assistant, MessageType.Normal, message, '', [], sendMessage);
        };

        showAddresses().catch(console.error);
        actionMessage = "show addresses";
      }
      if (lastUserResponse.toLowerCase().includes("delete all") ||
          lastUserResponse.toLowerCase().includes("delete attestations")) {
        setDeleteAttestationsModalVisible(true)
        actionMessage="delete attestations"
      }
      if (lastUserResponse.toLowerCase().includes("approve leader")) {
        console.info("approve leader ...")
        setApproveLeaderModalVisible(true)
        actionMessage="approve leader"
      }

      if (lastUserResponse.toLowerCase().includes("create web did")) {
        console.info("create web did ...")
        setCreateWebDidModalVisible(true)
        actionMessage="create web did"
      }
      if (lastUserResponse.toLowerCase().includes("import drivers license")) {
        console.info("import drivers license ...")
        setImportDriversLicenseModalVisible(true)
        actionMessage="import drivers license"
      }
      //if (lastUserResponse.toLowerCase().includes("add credit card")) {
      //  console.info("add credit card ...")
      //  setAddCreditCardModalVisible(true)
      //}
      if (lastUserResponse.toLowerCase().includes("add account")) {
        console.info("add account ...")
        setAddSavingsModalVisible(true)
        actionMessage="add account"
      }
      if (lastUserResponse.toLowerCase().includes("approve account access")) {
        console.info("approve account access ...")
        setApproveAccountAccessModalVisible(true)
        actionMessage="approve account access"
      }
      if (lastUserResponse.toLowerCase().includes("add debit card")) {
        console.info("add debit card ...")
        setAddAccountModalVisible(true)
        actionMessage="add debit card"
      }
      if (lastUserResponse.toLowerCase().includes("add ens record") ||
          lastUserResponse.toLowerCase().includes("add ens name") ||
          lastUserResponse.toLowerCase().includes("register ens")) {
        console.info("add ens record ...")
        setIsAddEnsRecordModalVisible(true)
        setExistingEnsNameForUpdate('')
        actionMessage="add ens record"
      }
      if (lastUserResponse.toLowerCase().includes("update ens logo") ||
          lastUserResponse.toLowerCase().includes("update ens avatar") ||
          lastUserResponse.toLowerCase().includes("change ens logo")) {
        console.info("update ens logo ...")

        // Extract ENS name from the message if provided
        const ensMatch = lastUserResponse.match(/(?:update|change)\s+(?:ens\s+)?(?:logo|avatar)\s+(?:for\s+)?([a-zA-Z0-9-]+\.eth)/i);
        console.log("Chat message:", lastUserResponse);
        console.log("Regex match result:", ensMatch);
        let ensName = ensMatch ? ensMatch[1] : '';

        // Open modal immediately without fetching ENS name to avoid MetaMask popup
        console.log("Opening ENS logo update modal...");
        console.log("Extracted ENS name from message:", ensName);

        // Use the extracted name if available, otherwise leave empty for user to enter
        if (ensName) {
          setExistingEnsNameForUpdate(ensName);
        } else {
          setExistingEnsNameForUpdate('');
        }

        setIsAddEnsRecordModalVisible(true);
        actionMessage="update ens logo"
        return; // Exit early to prevent further processing
      }
      if (lastUserResponse.toLowerCase().includes("fund card")) {
        console.info("fund card ...")
        setFundCreditCardModalVisible(true)
        actionMessage="fund card"
      }

      // Check for ENS domain creation request
      if (lastUserResponse.toLowerCase().includes("create ens domain")) {
        const match = lastUserResponse.match(/create ens domain[:\s]+([a-zA-Z0-9-]+)/i);
        if (match && match[1]) {
          console.info("Creating ENS domain...");
          const domainName = match[1];
          createEnsDomainName(domainName);
          actionMessage = "create ens domain";
        }
      }

    } catch (error)
    {

    }


    return actionMessage

  }


  async function addOrgRegistrationAttestation(st: string, id: string, stat: string, address: string, formDate: string) {

    const entityId = "state-registration(org)"

    if (orgAccountClient) {

      //console.info(">>>>>>>>>>>>> org name: ", orgName)
      if (orgName != undefined) {

        //const org = await OrgService.getOrgWithCompanyName(orgName, st);

        //let orgJson = JSON.parse(org)
        //console.info("org check: ", JSON.parse(org))

        const idNumber = id
        const status = stat
        const locationAddress = address
        const state = st
        const formationDate = formDate

        if (orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && orgAccountClient && burnerAccountClient) {

          const vc = await VerifiableCredentialsService.createStateRegistrationVC(entityId, orgDid, privateIssuerDid, idNumber, orgName, status, formationDate, state, locationAddress);
                      const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgName, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
          console.info("state reg createCredential result: ", result)
          const fullVc = result.vc
          const proof = result.proof
          const vcId = result.vcId

          console.info("fields: ", proof, fullVc, burnerAccountClient, orgAccountClient, orgBurnerDelegation, orgIndivDelegation)
          console.info("orgIndivDelegation: ", orgIndivDelegation)
          if (chain && proof && fullVc && vcId && burnerAccountClient && orgAccountClient && orgBurnerDelegation && orgIndivDelegation) {

            // now create attestation
            const hash = keccak256(toUtf8Bytes("hash value"));
            const attestation: StateRegistrationAttestation = {
              idnumber: idNumber,
              status: status,
              formationdate: new Date(formationDate).getTime() / 1000, // Convert to Unix timestamp
              locationaddress: locationAddress,
              name: orgName,
              attester: orgDid,
              entityId: entityId,
              class: "organization",
              category: "compliance",
              hash: hash,
              vccomm: (fullVc.credentialSubject as any).commitment.toString(),
              vcsig: (fullVc.credentialSubject as any).commitmentSignature,
              vciss: privateIssuerDid,
              vcid: vcId,
              proof: proof
            };

            // Use the signer directly from signatory
            const walletSigner = signatory.signer;
            
            if (!walletSigner) {
              console.error("Failed to get wallet signer");
              return;
            }

            console.info("add state registration attestation")
            const uid = await AttestationService.addStateRegistrationAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
            console.info("add registration attestation complete")

            entities?.forEach((ent) => {
              if (ent.name == entityId) {
                ent.attestation = attestation
              }
            })

          }
        }

        return orgName + "org attestation" + orgName
      }
      else {
        console.info("....... org name is not defined yes ........")
      }

    }
  }

  async function addOrgDomainAttestation(domain: string) {

    const entityId = "domain(org)"
    const org = await OrgService.checkDomain(domain);

    let orgJson = JSON.parse(org)
    console.info("domain check: ", orgJson)

    const domaincreationdate = new Date("2023-03-10")
    const domaincreationdateSeconds = Math.floor(domaincreationdate.getTime() / 1000); // Convert to seconds

    if (orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && orgAccountClient && burnerAccountClient) {

      const vc = await VerifiableCredentialsService.createRegisteredDomainVC(entityId, orgDid, privateIssuerDid, domain, domaincreationdate.toDateString());
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, "state-registration", orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
      const fullVc = result.vc
      const proof = result.proof
      const vcId = result.vcId
      if (proof && fullVc && vcId && chain && burnerAccountClient && orgAccountClient && orgBurnerDelegation && orgIndivDelegation) {

        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: RegisteredDomainAttestation = {
          domain: domain,
          domaincreationdate: domaincreationdateSeconds,
          attester: orgDid,
          entityId: entityId,
          class: "organization",
          category: "identity",
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: privateIssuerDid,
          vcid: vcId,
          proof: proof
        };

        // Use the signer directly from signatory
        const walletSigner = signatory.signer;
        
        if (!walletSigner) {
          console.error("Failed to get wallet signer");
          return;
        }

        const uid = await AttestationService.addRegisteredDomainAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
        console.info("add org domain attestation complete")

        entities?.forEach((ent) => {
          if (ent.name == entityId) {
            ent.attestation = attestation
          }
        })

      }
    }

  }

  async function addOrgWebsiteAttestation(website: string) {

    const org = await OrgService.checkWebsite(website);

    const websiteType = "public"

    const entityId = "website(org)"
    if (orgDid && credentialManager && privateIssuerAccount && orgAccountClient && burnerAccountClient && privateIssuerDid) {

      const vc = await VerifiableCredentialsService.createWebsiteOwnershipVC(entityId, orgDid, privateIssuerDid, websiteType, website);
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, website, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
      const fullVc = result.vc
      const proof = result.proof
      const vcId = result.vcId
      if (proof && chain && fullVc && vcId && burnerAccountClient && orgAccountClient && orgBurnerDelegation && orgIndivDelegation) {

        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: WebsiteAttestation = {
          type: websiteType,
          url: website,
          attester: orgDid,
          entityId: entityId,
          class: "organization",
          category: "identity",
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: privateIssuerDid,
          vcid: vcId,
          proof: proof
        };

        // Use the signer directly from signatory
        const walletSigner = signatory.signer;
        
        if (!walletSigner) {
          console.error("Failed to get wallet signer");
          return;
        }

        const uid = await AttestationService.addWebsiteAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
        console.info("add website attestation complete")

        entities?.forEach((ent) => {
          if (ent.name == entityId) {
            ent.attestation = attestation
          }
        })

      }
    }


  }

  async function addOrgEmailAttestation(email: string) {

    //const org = await OrgService.checkEmail(email);

    const emailType = "info"

    const entityId = "email(org)"
    if (orgDid && privateIssuerDid && credentialManager && privateIssuerAccount && orgAccountClient && burnerAccountClient) {

      const vc = await VerifiableCredentialsService.createEmailVC(entityId, orgDid, privateIssuerDid, emailType, email);
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, email, orgDid, credentialManager, privateIssuerAccount, burnerAccountClient, veramoAgent)
      const fullVc = result.vc
      const proof = result.proof
      const vcId = result.vcId

      if (proof && chain &&fullVc && vcId && burnerAccountClient && orgAccountClient && orgBurnerDelegation && orgIndivDelegation) {

        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: EmailAttestation = {
          type: emailType,
          email: email,
          attester: orgDid,
          entityId: entityId,
          class: "organization",
          category: "identity",
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: privateIssuerDid,
          vcid: vcId,
          proof: proof
        };

        // Use the standardized signer access
        const walletSigner = await getSignerFromSignatory(signatory);
        
        if (!walletSigner) {
          console.error("Failed to get wallet signer");
          return;
        }

        const uid = await AttestationService.addEmailAttestation(chain, attestation, walletSigner, [orgBurnerDelegation, orgIndivDelegation], orgAccountClient, burnerAccountClient)
        console.info("add email attestation complete")

        entities?.forEach((ent) => {
          if (ent.name == entityId) {
            ent.attestation = attestation
          }
        })

      }
    }

  }


  function checkLinkedinAttestation(lastAssistantResponse: string, lastUserResponse: string) {

    var intent = null;
    if (lastAssistantResponse?.includes("linkedin")) {
      if (lastUserResponse.includes("yes")) {
        intent = "createLinkedinAttestation"
      }
    }

    if (intent == "createLinkedinAttestation") {

      // set attestation
      if (entities != undefined) {
        for (const entity of entities) {
          if (entity.name == "linkedin(indiv)" && entity.attestation == undefined) {
            let att : Attestation = {
              entityId: "linkedin(indiv)",
              attester: "",
              hash: "",
            }
            entity.attestation = att
            break
          }
        }
      }

      return `{"validate": "linkedin(indiv)"}`
    }

    return ""

  }

  function checkXAttestation(lastAssistantResponse: string, lastUserResponse: string) {

    var intent = null;
    if (lastAssistantResponse?.includes("x")) {
      if (lastUserResponse.includes("yes")) {
        intent = "createXAttestation"
      }
    }

    if (intent == "createXAttestation") {

      // set attestation
      if (entities != undefined) {
        for (const entity of entities) {
          if (entity.name == "x(indiv)" && entity.attestation == undefined) {
            let att : Attestation = {
              entityId: "x(indiv)",
              attester: "",
              hash: "",
            }
            entity.attestation = att
            break
          }
        }
      }

      return `{"validate": "x(indiv)"}`
    }

    return ""

  }

  function checkShopifyAttestation(lastAssistantResponse: string, lastUserResponse: string) {

    var intent = null;
    if (lastAssistantResponse?.includes("shopify")) {
      if (lastUserResponse.includes("yes")) {
        intent = "createShopifyAttestation"
      }
    }

    if (intent == "createShopifyAttestation") {

      // set attestation
      if (entities != undefined) {
        for (const entity of entities) {
          if (entity.name == "shopify(org)" && entity.attestation == undefined) {
            let att : Attestation = {
              entityId: "",
              attester: "",
              hash: "",
            }
            entity.attestation = att
            break
          }
        }
      }

      return `{"validate": "shopify(org)"}`
    }

    return ""

  }

  function checkInsuranceAttestation(lastAssistantResponse: string, lastUserResponse: string) {

    var intent = null;
    if (lastAssistantResponse?.includes("insurance")) {
      if (lastUserResponse.includes("yes")) {
        intent = "createInsuranceAttestation"
      }
    }

    if (intent == "createInsuranceAttestation") {

      // set attestation
      if (entities != undefined) {
        for (const entity of entities) {
          if (entity.name == "insurance(org)" && entity.attestation == undefined) {
            let att : Attestation = {
              entityId: "",
              attester: "",
              hash: "",
            }
            entity.attestation = att
            break
          }
        }
      }

      return `{"validate": "insurance(org)"}`
    }

    return ""

  }


  async function processUserMessage(currentThreadID: string, content: string) {

    let args = ""
    const stateList = ['colorado', 'delaware']

    var lastUserResponse = content.toLowerCase()
    var introduction = userSettings.assistantIntroductions ? userSettings.assistantIntroductions : OPENAI_DEFAULT_ASSISTANT_PROMPT

    if (currentThreadID) {

      // Check if user wants to skip the current entity
      if (content.toLowerCase().includes('skip')) {
        if (entities) {
          const updatedEntities = markCurrentEntityAsSkipped([...entities]);
          setEntities(updatedEntities);

          // Find next entity to prompt for
          const nextEntity = getCurrentEntity(updatedEntities);
          if (nextEntity && orgName) {
            const nextPrompt = nextEntity.introduction?.replace("[org]", orgName) || "What would you like to do next?";
            return `I understand you'd like to skip that for now. ${nextPrompt}`;
          } else {
            return "No problem! You've completed all the required attestations. Feel free to let me know if you'd like to add any additional verifications or if you have any questions.";
          }
        }
        return "I understand you'd like to skip that for now. What would you like to do next?";
      }

      if (content.toLowerCase() == 'colorado') {
        var response = await sendMessageToLangGraphAssistant(lastUserResponse, currentThreadID, 'state_register', entities || [], {}, linkedInAuthRef, xAuthRef);
        console.log('adding attestation')
        addOrgRegistrationAttestation(response['name'], response['id'], content, response["address"], response["formDate"]);
        console.log('LangChain Response: ', response.message)
        return response.message;
      } else if ((content.toLowerCase())[12] == 'l') {//'https://www.linkedin.com/in') {
        //console.log('hallo')
        var response = await sendMessageToLangGraphAssistant(lastUserResponse, currentThreadID, 'linkedin_verification', entities || [], {}, linkedInAuthRef, xAuthRef);
        console.log('LangChain Response: ', response.message)
        return response.message;
      } else if (content.toLowerCase() == 'twitter') {
        var response = await sendMessageToLangGraphAssistant(lastUserResponse, currentThreadID, 'x_verification', entities || [], {}, linkedInAuthRef, xAuthRef);
        return response.message;
      } else {

        var response = await sendMessageToLangGraphAssistant(lastUserResponse, currentThreadID, 'none', entities || [], {}, linkedInAuthRef, xAuthRef);
        return response.message;
      }
    }





    //return
    //var introduction = userSettings.assistantIntroductions ? userSettings.assistantIntroductions : OPENAI_DEFAULT_ASSISTANT_PROMPT
    /*
    if (entities != undefined) {
      for (const entity of entities) {
        if (entity.attestation == undefined && entity.introduction && entity.introduction != "" ) {
          introduction = entity.introduction.replace("[org]", orgName?orgName:"")
          break
        }
      }
    }
    */
    //console.info(" >>>>>>>>>>>  default assistant message: ", introduction)

    // get last assistant message content

    if (conversation) {
      var messages: ChatMessage[] = JSON.parse(conversation.messages);
      if (messages.length > 0) {
        introduction = messages[messages.length - 1].content.toLowerCase().replace("[org]", orgName?orgName:"")
      }
    }

    /*
    //console.info(" >>>>>>>>>>>  introduction: ", introduction)
    // check if the user put in direct action like "delete all"
    const actionMessage = checkAllDirectActions(introduction, lastUserResponse)
    if (actionMessage != "") {
      args = actionMessage
      return args
    }


    // let inject args if the user said "yes" to actions
    args = checkLinkedinAttestation(introduction, lastUserResponse);
    if (args != "") {
      return args
    }

    args = checkXAttestation(introduction, lastUserResponse);
    if (args != "") {
      return args
    }


    args = checkShopifyAttestation(introduction, lastUserResponse)
    if (args != "") {
      return args
    }

    args = checkInsuranceAttestation(introduction, lastUserResponse)
    if (args != "") {
      console.info("############## return insurance args")
      return args
    }
    */
   return "something went wrong"
  }


  function postToolCmdSendMessages(prevMessages: ChatMessage[], org: string | null, entities: Entity[]) : ChatMessage[] {

    let defaultIntroduction = userSettings.assistantIntroductions ? userSettings.assistantIntroductions : OPENAI_DEFAULT_ASSISTANT_PROMPT
    defaultIntroduction = "How can we help you?"

    let defaultInstruction


    if (entities && org) {
      for (const entity of entities) {
        //console.info("entity: ", entity, entity.attestation, entity.skipped)
        if (entity.attestation == undefined && !entity.skipped && entity.introduction != "" ) {
          if (entity.introduction != undefined) {
            console.info("found introduction: ", entity.name)
            defaultIntroduction = entity.introduction.replace("[org]", org)
            break
          }
          if (entity.instruction != undefined) {
            console.info("found instruction: ", entity.name)
            defaultInstruction = entity.instruction.replace("[org]", org)
            break
          }
        }
      }
    }


    const updatedMessage2 = {
      ...prevMessages[prevMessages.length - 1],
      content: defaultIntroduction,
      args: ""
    };

    let msgs = [...prevMessages.slice(0, -1), updatedMessage2]
    if (msgs != undefined) {
      setMessages(msgs)
    }
    else {
      msgs = []
    }

    return msgs

  }


  // Function to mark the current entity as skipped
  function markCurrentEntityAsSkipped(entities: Entity[]): Entity[] {
    if (!entities || !orgName) return entities;

    // Find the current entity being prompted for (first missing, non-skipped entity by priority)
    for (const entity of entities) {
      if (entity.attestation == undefined && !entity.skipped && entity.introduction != "") {
        console.info("marking entity as skipped: ", entity.name);
        entity.skipped = true;
        break;
      }
    }
    return entities;
  }

  // Function to un-skip an entity (for later use)
  function unSkipEntity(entities: Entity[], entityName: string): Entity[] {
    if (!entities) return entities;

    const entity = entities.find(e => e.name === entityName);
    if (entity) {
      console.info("un-skipping entity: ", entity.name);
      entity.skipped = false;
    }
    return entities;
  }

  // Function to get the current entity being prompted for
  function getCurrentEntity(entities: Entity[]): Entity | undefined {
    if (!entities) return undefined;

    for (const entity of entities) {
      if (entity.attestation == undefined && !entity.skipped && entity.introduction != "") {
        return entity;
      }
    }
    return undefined;
  }

  function processAssistantMessage(isFirstCall: boolean, content: string, args: string, prevMessages: ChatMessage[], updatedMessage: ChatMessage, fileDataRef: FileDataRef[]) {

    const result = {
      isToolFunction: false,
      messages: [] as ChatMessage[]
    };

    if (args) {
      const argsVal = extractJsonFromString(args)
      //console.info("argsVal: ", argsVal)
      if (argsVal != null) {

        result.isToolFunction = true
        let command = JSON.parse(argsVal)

        if ("edit" in command) {
          let socialCommand = command["edit"]
          if (socialCommand && socialCommand.toLowerCase() == "linkedin(indiv)") {
            //console.info("....... edit linkedin information .........")
            const cmd : Command = {
              action: "edit",
              did: indivDid,
              entityId: "linkedin(indiv)",
            }
            appCommand(cmd)
          }
          if (socialCommand.toLowerCase() == "x(indiv)") {
            //console.info("....... edit x information .........")
            const cmd : Command = {
              action: "edit",
              did: indivDid,
              entityId: "linkedin(indiv)",
            }
            appCommand(cmd)
          }
        }
        if ("validate" in command) {
          //console.info("social edit request: ", command["validate"])
          let socialCommand = command["validate"]
          if (socialCommand.toLowerCase() == "linkedin(indiv)") {

            if (isFirstCall) {
              linkedInAuthRef.current?.openLinkedInPopup();
            }

            entities?.forEach((ent) => {
              if (ent.name == "linkedin(indiv)") {
                ent.attestation = { entityId: "linkedin(indiv)", hash: "", attester: ""}
              }
            })
            setEntities(entities)

            if (orgName && entities) {
              result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
            }

            clearInputArea();
            //messageBoxRef.current?.reset();
          }
          if (socialCommand.toLowerCase() == "x(indiv)") {

            if (isFirstCall) {
              xAuthRef.current?.openXPopup();
            }

            entities?.forEach((ent) => {
              if (ent.name == "x(indiv)") {
                ent.attestation = { entityId: "x(indiv)", hash: "", attester: ""}
              }
            })
            setEntities(entities)

            if (orgName && entities) {
              result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
            }

            clearInputArea();
            //messageBoxRef.current?.reset();
          }
          if (socialCommand.toLowerCase() == "shopify(org)") {

            if (isFirstCall) {
              shopifyAuthRef.current?.openShopifyPopup();
            }

            entities?.forEach((ent) => {
              if (ent.name == "shopify(org)") {
                ent.attestation = { entityId: "shopify(org)", hash: "", attester: ""}
              }
            })
            setEntities(entities)

            if (orgName && entities) {
              result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
            }

            clearInputArea();
            //messageBoxRef.current?.reset();
          }

          if (socialCommand.toLowerCase() == "insurance(org)") {

            console.info("isFirstCall: ", isFirstCall)
            if (isFirstCall) {
              console.info("open insurance popup: ", insuranceAuthRef.current)
              insuranceAuthRef.current?.openInsurancePopup()
            }

            entities?.forEach((ent) => {
              if (ent.name == "insurance(org)") {
                ent.attestation = { entityId: "insurance(org)", hash: "", attester: ""}
              }
            })
            setEntities(entities)

            console.info("post tool cmd send message")
            if (orgName && entities) {
              result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
            }

            clearInputArea();
            //messageBoxRef.current?.reset();


          }

        }

        console.info("............. command: ", command)
        if ("orgName" in command) {
          let newOrgName = command["orgName"]
          if (newOrgName) {
            if (isFirstCall) {

              setNewOrgName(newOrgName)
              setOrgModalVisible(true)

              entities?.forEach((ent) => {
                if (ent.name == "org(org)") {
                  ent.attestation = { entityId: "org(org)", hash: "", attester: ""}
                }
              })
              setEntities(entities)

              if (newOrgName && entities) {
                result.messages = postToolCmdSendMessages(prevMessages, newOrgName, entities)
              }


            }
          }
        }


        if ("state" in command) {
          let state = command["state"]
          if (state) {
            if (isFirstCall) {
              // Note: State registration attestation is handled elsewhere
              // This is just a placeholder for the UI update

              entities?.forEach((ent) => {
                if (ent.name == "state-registration(org)") {
                  ent.attestation = { entityId: "state-registration(org)", hash: "", attester: ""}
                }
              })
              //setEntities(entities)

              console.info("entities and orgName: ", orgName, entities)
              if (orgName && entities) {
                console.info("prev messages: ", prevMessages)
                result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
                console.info("state returned messages: ", result.messages)
              }

            }
          }
        }

        if ("domain" in command) {
          let domain = command["domain"]
          if (domain) {
            if (isFirstCall) {
              addOrgDomainAttestation(domain).then(() => {

                if (location.pathname.startsWith("/chat/c/")) {
                  let conversationId = location.pathname.replace("/chat/c/", "")
                  let id = parseInt(conversationId)
                  ConversationService.getConversationById(id).then((conversation) => {
                    if (conversation) {

                      var currentMsgs: ChatMessage[] = JSON.parse(conversation.messages);

                      const newMsg: ChatMessage = {
                        id: currentMsgs.length + 1,
                        args: "",
                        role: Role.Developer,
                        messageType: MessageType.Normal,
                        content: "I've updated your wallet with a verifiable credential and published your domain attestation.",
                      };

                      const msgs: ChatMessage[] = [...currentMsgs.slice(0, -1), newMsg]
                      const msgs2: ChatMessage[] = [...msgs, currentMsgs[currentMsgs.length - 1]]

                      console.info("update conversation message ")
                      ConversationService.updateConversation(conversation, msgs2)
                    }
                  })

                }

              })

              entities?.forEach((ent) => {
                if (ent.name == "domain(org)") {
                  ent.attestation = { entityId: "domain(org)", hash: "", attester: ""}
                }
              })
              setEntities(entities)

              if (orgName && entities) {
                result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
              }

            }

          }
        }

        // Handle ENS domain creation
        if ("createEns" in command) {
          let ensName = command["createEns"]
          if (ensName) {
            if (isFirstCall) {
              createEnsDomainName(ensName).then(() => {
                console.log("ENS domain creation complete");
                // Update UI or show success message
                if (orgName && entities) {
                  result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
                }
              }).catch((error) => {
                console.error("Error creating ENS domain:", error);
              });
              clearInputArea();
            }
          }
        }

        if ("email" in command) {
          let email = command["email"]
          console.info("email value: ", email)
          if (email) {
            if (isFirstCall) {
              addOrgEmailAttestation(email).then(() => {

              })

              entities?.forEach((ent) => {
                if (ent.name == "email(org)") {
                  ent.attestation = { entityId: "email(org)", hash: "", attester: ""}
                }
              })
              setEntities(entities)

              if (orgName && entities) {
                result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
              }

            }

          }
        }

        if ("website" in command) {
          let website = command["website"]
          if (website) {
            if (isFirstCall) {
              addOrgWebsiteAttestation(website).then(() => {

              })

              entities?.forEach((ent) => {
                if (ent.name == "website(org)") {
                  ent.attestation = { entityId: "website(org)", hash: "", attester: ""}
                }
              })
              setEntities(entities)

              if (orgName && entities) {
                result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
              }

            }

          }
        }


      }
    }


    return result
  }

  function handleStreamedResponse(content: string, args: string, fileDataRef: FileDataRef[], done: boolean) {

    //console.info("...... handleStreamedResponse content: ", content)
    //console.info("...... handleStreamedResponse args: ", args)

    let isFirstCall = 0
    setMessages(prevMessages => {

      //console.info("...... prevMessages: ", prevMessages)


      // get the latest list of messages,  remember this can be called twice

      isFirstCall = isFirstCall + 1



      let isNew: boolean = false;
      try {
        if (prevMessages.length === 0) {
          //console.error('prevMessages should not be empty in handleStreamedResponse.');
          //console.info("~~~~~~~~~~~~~~~~~~~~~~~~ return empty")
          return [];
        }
        if (prevMessages[prevMessages.length - 1].role === Role.User) {
          //console.info("last message was a user message")
          isNew = true;
        }
      } catch (e) {
        console.error('Error getting the role');
        console.error('prevMessages = ' + JSON.stringify(prevMessages));
        console.error(e);
      }

      // if args are passed in and isNew (no assistant message) then go ahead and add Assistant message
      // user sent a direct message to execute a tool without assistant getting involved
      if (isNew == true && args != "") {

        if (args != "" && content == "") {
          content = "how can I help you? "
        }

        const message: ChatMessage = {
          id: prevMessages.length + 1,
          role: Role.Assistant,
          messageType: MessageType.Normal,
          content: content,
          args: args,
          fileDataRef: fileDataRef,
        };
        isNew = false
        prevMessages = [...prevMessages, message]
      }

      if (isNew) {
        const message: ChatMessage = {
          id: prevMessages.length + 1,
          role: Role.Assistant,
          messageType: MessageType.Normal,
          content: content,
          args: args,
          fileDataRef: fileDataRef,
        };
        //console.info("......... is new because last message is User")
        //console.info("return ...prevMessages, message ")

        const msgs = [...prevMessages, message]
        return msgs;
      } else {

        let updatedContent = prevMessages[prevMessages.length - 1].content
        if (updatedContent != content) {
          updatedContent = updatedContent + content
        }

        const updatedMessage = {
          ...prevMessages[prevMessages.length - 1],
          content: updatedContent,
          args: prevMessages[prevMessages.length - 1].args + args
        };
        // Replace the old last message with the updated one
        if (done == true) {
          // received message from AI Assitant => updatedMessage
          // go do what the AI assistant message told us to do  =>  appCommand
          const response = processAssistantMessage(isFirstCall == 1, updatedMessage.content, updatedMessage.args, prevMessages, updatedMessage, fileDataRef);
          if (response.isToolFunction && response.messages) {
            return response.messages
          }
          return [...prevMessages.slice(0, -1), updatedMessage];
        }
        else {
          return [...prevMessages.slice(0, -1), updatedMessage];
        }

        return [...prevMessages];
      }

    });
  }


  const scrollToBottom = () => {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.scroll({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const clearInputArea = () => {
    messageBoxRef.current?.clearInputValue();
  };

  const handleUserScroll = (isAtBottom: boolean) => {
    setShowScrollButton(!isAtBottom);
    if (isAtBottom) {
      setAllowAutoScroll(true);
    }
  };



  // ---------------------------------
  // The code below handles highlight => quote
  // ---------------------------------
  const createButton = () => {
    const button = document.createElement('button');
    button.className = 'px-2 py-1 bg-gray-100 text-black border border-gray-200 rounded-md shadow-md hover:bg-gray-200 focus:outline-hidden';

    const iconContainer = document.createElement('div');
    iconContainer.className = 'h-5 w-5';

    const root = createRoot(iconContainer);
    root.render(<ArrowUturnDownIcon/>);

    button.appendChild(iconContainer);
    // Stop propagation for mousedown and mouseup to avoid affecting other event listeners
    button.addEventListener('mousedown', event => event.stopPropagation());
    button.addEventListener('mouseup', event => event.stopPropagation());
    button.addEventListener('click', handleQuoteSelectedText);
    return button;
  };

  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() === '') {
      if (buttonRef.current && buttonRef.current.parentNode) {
        buttonRef.current.parentNode.removeChild(buttonRef.current);
        buttonRef.current = null;
      }
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Remove the existing button if it exists
      if (buttonRef.current && buttonRef.current.parentNode) {
        buttonRef.current.parentNode.removeChild(buttonRef.current);
      }

      const newButton = createButton();
      const buttonHeight = 30;
      const buttonWidth = newButton.offsetWidth;

      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        const containerRect = chatContainer.getBoundingClientRect();
        newButton.style.position = 'absolute';
        newButton.style.left = `${rect.left - containerRect.left + (rect.width / 2) - (buttonWidth / 2)}px`;
        newButton.style.top = `${rect.top - containerRect.top - buttonHeight}px`;
        newButton.style.display = 'inline-block';
        newButton.style.verticalAlign = 'middle';
        newButton.style.zIndex = '1000';

        chatContainer.appendChild(newButton);
        buttonRef.current = newButton;
      }
    }
  };

  const handleQuoteSelectedText = () => {
    const selection = window.getSelection();
    if (selection) {
      const selectedText = selection.toString();
      const modifiedText = `Assistant wrote:\n${SNIPPET_MARKERS.begin}\n${selectedText}\n${SNIPPET_MARKERS.end}\n`;
      messageBoxRef.current?.pasteText(modifiedText);
      messageBoxRef.current?.focusTextarea();
    }
  };
  // ---------------------------------

  // MetaMask
  async function createEnsDomainName(ensName: string) {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const network = await provider.getNetwork()



    const name = ensName
    const duration = 31536000 // 60 * 60 * 24 * 365
    const secret = hexlify(ethers.randomBytes(32))

    const ETHRegistrarControllerAddress = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968'
    const PublicResolverAddress = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5'

    const ethRegistrarController = new ethers.Contract(
      ETHRegistrarControllerAddress,
      ETHRegistrarControllerABI.abi,
      signer
    )

    const publicResolver = new ethers.Contract(
      PublicResolverAddress,
      PublicResolverABI.abi,
      signer
    )

    console.log('Name: ', name)
    console.log('Duration: ', duration)
    console.log('Secret: ', secret)

    createName()

    async function createName() {
      const registrationObject = {
        label: name,
        owner: signer.address,
        duration: duration,
        secret: secret,
        resolver: publicResolver.target, // '0x0000000000000000000000000000000000000000' = null, meaning no resolver is set
        data: [],
        reverseRecord: 1, // 0 reverse record flag set to 0
        referrer: '0x0000000000000000000000000000000000000000000000000000000000000000'
      }

      const commitment = await ethRegistrarController.makeCommitment(registrationObject)

      console.log('Sending commit...')

      const tx1 = await ethRegistrarController.commit(commitment)
      await tx1.wait()

      console.log('Commit sent. Waiting 60 seconds...')

      await new Promise ((r) => setTimeout(r, 60000))

      console.log('Waited 60 seconds!')
      console.log('Registering...')

      const rentPrice = await ethRegistrarController.rentPrice(`${name}.eth`, 365 * 24 * 60 * 60) // 1 year in seconds

      console.log('Rent Price: ', rentPrice)

      const tx2 = await ethRegistrarController.register(registrationObject, {
        value: BigInt('3125000000003490') // 0.003125 ETH
      })

      await tx2.wait()

      // ENS Domain Name Created Successfully
      console.log(`ENS name "${name}.eth" registered!`)
      console.log(`See ENS profile here: https://sepolia.app.ens.domains/${name}.eth`)
    }
  }

  // Function to handle un-skipping entities from the UI
  const handleUnSkipEntity = (entityName: string) => {
    if (entities) {
      const updatedEntities = unSkipEntity([...entities], entityName);
      setEntities(updatedEntities);
      console.info("Un-skipped entity: ", entityName);
    }
  };

  return (
      <div className="flex  w-full">
        <DeleteAttestationsModal
          isVisible={isDeleteAttestationsModalVisible}
          onClose={handleOnDeleteAttestationsModalClose}
        />
        <ApproveLeaderModal
          isVisible={isApproveLeaderModalVisible}
          onClose={handleOnApproveLeaderModalClose}
        />
        <ApproveAccountAccessModal
          isVisible={isApproveAccountAccessModalVisible}
          onClose={handleOnApproveAccountAccessModalClose}
        />
        <CreateWebDidModal
          isVisible={isCreateWebDidModalVisible}
          onClose={handleOnCreateWebDidModalClose}
        />
        <ImportDriversLicenseModal
          isVisible={isImportDriversLicenseModalVisible}
          onClose={handleOnImportDriversLicenseModalClose}
        />
        <AddCreditCardModal
          isVisible={isAddCreditCardModalVisible}
          onClose={handleOnAddCreditCardModalClose}
        />
        <FundCreditCardModal
          isVisible={isFundCreditCardModalVisible}
          onClose={handleOnFundCreditCardModalClose}
        />
        <AddSavingsModal
          isVisible={isAddSavingsModalVisible}
          onClose={handleOnAddSavingsModalClose}
          onRefresh={() => {
            handleRefreshAttestations();
            handleRefreshAccounts();
          }}
        />
        <AddAccountModal
          isVisible={isAddAccountModalVisible}
          onClose={handleOnAddAccountModalClose}
          onRefresh={() => {
            handleRefreshAttestations();
            handleRefreshAccounts();
          }}
        />
        <OrgModal
          orgName={newOrgName?newOrgName:""}
          isVisible={isOrgModalVisible}
          onClose={handleOnOrgModalClose}
        />
        <AddEnsRecordModal
          isVisible={isAddEnsRecordModalVisible}
          onClose={handleOnAddEnsRecordModalClose}
          onRefresh={handleRefreshAttestations}
          existingEnsName={existingEnsNameForUpdate}
        />
        <LinkedInAuth ref={linkedInAuthRef} />
        <XAuth ref={xAuthRef} />
        <ShopifyAuth ref={shopifyAuthRef} />
        <InsuranceAuth ref={insuranceAuthRef} />
        <div
          className="flex"
          style={{
            flexBasis: '40%',
            margin: '0 0 0 15px',
          }}
        >
              <div className={`${className} overflow-hidden w-full h-full relative flex z-0`}>
              <div className="flex flex-col items-stretch w-full h-full">
              <main
                className="main-panel"
                onMouseUp={handleMouseUp}
              >
                {/* Chat section */}
                <div className="chat-section">
                  {chatSettings ? (
                    <CustomChatSplash className="-translate-y-[10%]" chatSettings={chatSettings} />
                  ) : null}
                  <Chat
                    introductionMessage={introduction}
                    chatBlocks={messages}
                    onChatScroll={handleUserScroll}
                    conversation={conversation}
                    model={model?.id || DEFAULT_MODEL}
                    onModelChange={handleModelChange}
                    allowAutoScroll={allowAutoScroll}
                    loading={loading}
                  />
                  {isThinking && (
                    <div style={{
                      padding: '10px 20px',
                      color: 'gray',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '20px'
                    }}>
                      <CircularProgress size={16} />
                      <span>Thinking...</span>
                    </div>
                  )}
                </div>

                {/* Scroll to bottom button */}
                {showScrollButton && (
                  <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 mb-2 z-10">
                    <ScrollToBottomButton onClick={scrollToBottom} />
                  </div>
                )}

                {/* MessageBox pinned to bottom */}
                <div className="message-input-container">
                  <div className="message-form">
                    <MessageBox
                      ref={messageBoxRef}
                      callApp={callApp}
                      loading={loading}
                      setLoading={setLoading}
                      allowImageAttachment={
                        model === null || model?.image_support || false
                          ? 'yes'
                          : !conversation
                          ? 'warn'
                          : 'no'
                      }
                      className="message-box"
                    />
                  </div>
                </div>
              </main>
              </div>
            </div>
        </div>
        <div
          className="flex min-w-0"
          style={{
            flexBasis: '60%'
          }}
        >
          <RightSide
            className="rightside-container w-full"
            appCommand={appCommand}
            onRefreshAttestations={handleRefreshAttestations}
            onRefreshAccounts={handleRefreshAccounts}
            entities={entities}
            onUnSkipEntity={handleUnSkipEntity}
          />
        </div>
      </div>
  );
};

export default MainPage;
