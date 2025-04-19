import {useContext, useEffect, useRef, useState} from 'react';
import * as React from 'react';

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

import { keccak256, toUtf8Bytes } from 'ethers';
import { useWalletClient } from 'wagmi';

import DeleteAttestationsModal from './DeleteAttestationsModal';
import OrgModal from './OrgModal';  


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

  const { data: walletClient } = useWalletClient();

  const { issuerAccountClient, signer, orgAccountClient, session, orgDid, orgName, setOrgNameValue } = useWallectConnectContext();

  const [isDeleteAttestationsModalVisible, setDeleteAttestationsModalVisible] = useState(false);
  const [isOrgModalVisible, setOrgModalVisible] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");


  const handleOnDeleteAttestationsModalClose = () => {
    setDeleteAttestationsModalVisible(false);
  }

  const handleOnOrgModalClose = () => {
    setOrgModalVisible(false);
  }




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


  
  useEffect(() => {
    if (orgDid) {
      AttestationService.setEntityAttestations(orgDid).then((ents) => {
        if (ents != undefined) {

          setEntities(ents)

          for (const entity of ents) {
            if (entity.name == "org" && entity.attestation) {
              setOrgNameValue((entity.attestation as OrgAttestation).name)
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
      
      //console.info("------------> org is not defined")
      navigate("/")
    }
    

  }, [orgDid]);


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
  
      let introduction = userSettings.assistantIntroductions ? userSettings.assistantIntroductions : OPENAI_DEFAULT_ASSISTANT_PROMPT
      let instruction : string | undefined
  

      if (entities != undefined) {
        for (const entity of entities) {
          if (entity.attestation == undefined && entity.introduction && entity.introduction != "") {
            introduction = entity.introduction?.replace("[org]", orgName?orgName:"");
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
              } else {
                setMessages(msgs);
              }
            });
          } else {
            const errorMessage: string = 'Conversation ' + location.pathname + ' not found';
            NotificationService.handleError(errorMessage, CONVERSATION_NOT_FOUND);
            navigate('/chat/');
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

  const callApp = (message: string, fileDataRef: FileDataRef[]) => {

    if (conversation == null) {
      return
    }


    setAllowAutoScroll(true);

    //console.info("..... process user message: ", message)
    let args = processUserMessage(message);

    //message = message + ", Please respond with a JSON object. Include keys like 'company_name', 'state_name', 'email' if they exist."

    addMessage(Role.User, MessageType.Normal, message, args, fileDataRef, sendMessage);
  };

  const addMessage = (
    role: Role,
    messageType: MessageType,
    message: string,
    args: string,
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
      console.info("setMessages 3")
      return [...prevMessages, newMsg];
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
      // this is going to sendMessage(...)
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

    // if we know what to do already from processor then go ahead and do it.  No need to call openai
    if (args != "") {
      console.info("*********************** no need to have AI look at user input becasue it told us what to do: ", args)

      
      /*
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
      */



      console.info(">>>>>>>> handleStreamedResponse ")
      handleStreamedResponse("", args, [], true)
      return
    }


    let defaultIntroduction
    let defaultInstruction
    let defaultTools
    
    if (entities != undefined) {
      for (const entity of entities) {
        //console.info("entity: ", entity, entity.attestation)
        if (entity.attestation == undefined && entity.introduction != "") {
          console.info(">>>>>> add tools for : ", entity.name)
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

    //console.info("tell AI what we need to do")
    //console.info("default introduction: ", defaultIntroduction)
    //console.info("default instruction: ", defaultInstruction)


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

  }

  

  async function checkDeleteAll(lastAssistantResponse: string, lastUserResponse: string) {

    try {
      if (lastUserResponse.toLowerCase().includes("delete all") ||
          lastUserResponse.toLowerCase().includes("delete attestations")) {

        setDeleteAttestationsModalVisible(true)

      }
      
      } catch (error)
      {

    }
    

    return ""
    
  }


  async function addOrgRegistrationAttestation(st: string) {

    const entityId = "state-registration"

    if (signer && orgAccountClient && walletClient) {

      //console.info(">>>>>>>>>>>>> org name: ", orgName)
      if (orgName != undefined) {

        const org = await OrgService.getOrgWithCompanyName(orgName, st);
  
        let orgJson = JSON.parse(org)
        //console.info("org check: ", JSON.parse(org))

        const idNumber = orgJson["idNumber"]
        const status = orgJson["status"]
        const locationAddress = orgJson["address"]
        const state = orgJson["state"]
        const formationDate = "1/2/2020"

        if (orgDid && walletClient && orgAccountClient && issuerAccountClient && session && signer) {

          const vc = await VerifiableCredentialsService.createStateRegistrationVC(entityId, orgDid, idNumber, orgName, status, formationDate, state, locationAddress);
          const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient, session)
          const fullVc = result.vc
          const proofUrl = result.proofUrl

          console.info("************** creating att: ", proofUrl)

          if (fullVc && signer && orgAccountClient && walletClient) {
          
            // now create attestation
            const hash = keccak256(toUtf8Bytes("hash value"));
            const attestation: StateRegistrationAttestation = {
              idnumber: idNumber,
              status: status,
              formationdate: 1,
              //state: state,
              locationaddress: locationAddress,
              name: orgName,
              attester: orgDid,
              entityId: entityId,
              hash: hash,
              vccomm: (fullVc.credentialSubject as any).commitment.toString(),
              vcsig: (fullVc.credentialSubject as any).commitmentSignature,
              vciss: VerifiableCredentialsService.issuerDid,
              proof: proofUrl
            };
            const uid = await AttestationService.addStateRegistrationAttestation(attestation, signer, orgAccountClient)
            console.info("add registration attestation complete")
    
            entities?.forEach((ent) => {
              if (ent.name == entityId) {
                ent.attestation = attestation
              }
            })
    
          }
        }

        return orgJson["name"] + "org attestation" + orgJson["name"]
      }
      else {
        console.info("....... org name is not defined yes ........")
      }

    }
  }

  async function addOrgDomainAttestation(domain: string) {

    const entityId = "domain"
    const org = await OrgService.checkDomain(domain);
    
    let orgJson = JSON.parse(org)
    console.info("domain check: ", orgJson)

    const domaincreationdate = new Date("2023-03-10")
    const domaincreationdateSeconds = Math.floor(domaincreationdate.getTime() / 1000); // Convert to seconds

    if (orgDid && walletClient && orgAccountClient && issuerAccountClient && session && signer) {

      const vc = await VerifiableCredentialsService.createRegisteredDomainVC(entityId, orgDid, domain, domaincreationdate.toDateString());
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient, session)
      const fullVc = result.vc
      const proofUrl = result.proofUrl
      if (fullVc && signer && orgAccountClient && walletClient) {
      
        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: RegisteredDomainAttestation = {
          domain: domain,
          domaincreationdate: domaincreationdateSeconds,
          attester: orgDid,
          entityId: entityId,
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: VerifiableCredentialsService.issuerDid,
          proof: proofUrl
        };

        const uid = await AttestationService.addRegisteredDomainAttestation(attestation, signer, orgAccountClient)
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

    const entityId = "website"
    if (orgDid && walletClient && orgAccountClient && issuerAccountClient && session && signer) {

      const vc = await VerifiableCredentialsService.createWebsiteOwnershipVC(entityId, orgDid, websiteType, website);
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient, session)
      const fullVc = result.vc
      const proofUrl = result.proofUrl
      if (fullVc && signer && orgAccountClient && walletClient) {
      
        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: WebsiteAttestation = {
          type: websiteType,
          url: website,
          attester: orgDid,
          entityId: entityId,
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: VerifiableCredentialsService.issuerDid,
          proof: proofUrl
        };

        const uid = await AttestationService.addWebsiteAttestation(attestation, signer, orgAccountClient)
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
    
    console.info("email check: ", email)
    const emailType = "info"
    
    const entityId = "email"
    if (orgDid && walletClient && orgAccountClient && issuerAccountClient && session && signer) {

      const vc = await VerifiableCredentialsService.createEmailVC(entityId, orgDid, emailType, email);
      const result = await VerifiableCredentialsService.createCredential(vc, entityId, orgDid, walletClient, issuerAccountClient, session)
      const fullVc = result.vc
      const proofUrl = result.proofUrl
      if (fullVc && signer && orgAccountClient && walletClient) {
      
        // now create attestation
        const hash = keccak256(toUtf8Bytes("hash value"));
        const attestation: EmailAttestation = {
          type: emailType,
          email: email,
          attester: orgDid,
          entityId: entityId,
          hash: hash,
          vccomm: (fullVc.credentialSubject as any).commitment.toString(),
          vcsig: (fullVc.credentialSubject as any).commitmentSignature,
          vciss: VerifiableCredentialsService.issuerDid,
          proof: proofUrl
        };

        const uid = await AttestationService.addEmailAttestation(attestation, signer, orgAccountClient)
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
          if (entity.name == "linkedin" && entity.attestation == undefined) {
            let att : Attestation = {
              entityId: "linkedin",
              attester: "",
              hash: "",
            }
            entity.attestation = att
            break
          }
        }
      }

      return `{"validate": "linkedin"}`
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
          if (entity.name == "x" && entity.attestation == undefined) {
            let att : Attestation = {
              entityId: "x",
              attester: "",
              hash: "",
            }
            entity.attestation = att
            break
          }
        }
      }

      return `{"validate": "x"}`
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
          if (entity.name == "shopify" && entity.attestation == undefined) {
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

      return `{"validate": "shopify"}`
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
          if (entity.name == "insurance" && entity.attestation == undefined) {
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

      return `{"validate": "insurance"}`
    }

    return ""
    
  }

  function processUserMessage(content: string) {

    let args = ""
    
    var lastUserResponse = content.toLowerCase()
    var introduction = userSettings.assistantIntroductions ? userSettings.assistantIntroductions : OPENAI_DEFAULT_ASSISTANT_PROMPT

    if (entities != undefined) {
      for (const entity of entities) {
        if (entity.attestation == undefined && entity.introduction && entity.introduction != "" ) {
          introduction = entity.introduction.replace("[org]", orgName?orgName:"")
          break
        }
      }
    }
    
    //console.info(" >>>>>>>>>>>  default assistant message: ", introduction)

    // get last assistant message content
    if (conversation) {
      var messages: ChatMessage[] = JSON.parse(conversation.messages);
      if (messages.length > 0) {
        introduction = messages[messages.length - 1].content.toLowerCase().replace("[org]", orgName?orgName:"")
      }
    }

    //console.info(" >>>>>>>>>>>  introduction: ", introduction)

    checkDeleteAll(introduction, lastUserResponse).then((data) => {
      
    })
 
    

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
      return args
    }


    return ""
  }

  
  function postToolCmdSendMessages(prevMessages: ChatMessage[], org: string | null, entities: Entity[]) : ChatMessage[] { 

    let defaultIntroduction = userSettings.assistantIntroductions ? userSettings.assistantIntroductions : OPENAI_DEFAULT_ASSISTANT_PROMPT
    defaultIntroduction = "How can we help you?"

    let defaultInstruction

    console.info("entities: ", entities)
    console.info("current org: ", org)
    
    if (entities && org) {
      for (const entity of entities) {
        //console.info("entity: ", entity, entity.attestation)
        if (entity.attestation == undefined && entity.introduction != "" ) {
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


    console.info("^^^^^^^^^^^^^^^ defaultIntroduction: ", defaultIntroduction)
    const updatedMessage2 = {
      ...prevMessages[prevMessages.length - 1],
      content: defaultIntroduction,
      args: ""
    };

    let msgs = [...prevMessages.slice(0, -1), updatedMessage2]
    if (msgs != undefined) {
      console.info("~~~~~~~~~~~~~~~~~~~~~~~~   setMessages: ", msgs)
      setMessages(msgs)
      console.info("&&&&&&&&&&&&&&&&&&&&&&&&  setMessages done ")
    }
    else {
      msgs = []
    }

    return msgs

  }

  function processAssistantMessage(isFirstCall: boolean, content: string, args: string, prevMessages: ChatMessage[], updatedMessage: ChatMessage, fileDataRef: FileDataRef[]) {

    console.info("isFirstCall: ", isFirstCall)
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

      

        console.info(">>>>>>>>>>> command: ", command)

        if ("edit" in command) {
          let socialCommand = command["edit"]
          if (socialCommand && socialCommand.toLowerCase() == "linkedin") {
            //console.info("....... edit linkedin information .........")
            const cmd : Command = {
              action: "edit",
              orgDid: orgDid,
              entityId: "linkedin",
            }
            appCommand(cmd)
          }
          if (socialCommand.toLowerCase() == "x") {
            //console.info("....... edit x information .........")
            const cmd : Command = {
              action: "edit",
              orgDid: orgDid,
              entityId: "linkedin",
            }
            appCommand(cmd)
          }
        }
        if ("validate" in command) {
          //console.info("social edit request: ", command["validate"])
          let socialCommand = command["validate"]
          if (socialCommand.toLowerCase() == "linkedin") {

            if (isFirstCall) {
              linkedInAuthRef.current?.openLinkedInPopup();
            }

            entities?.forEach((ent) => {
              if (ent.name == "linkedin") {
                ent.attestation = { entityId: "linkedin", hash: "", attester: ""}
              }
            })
            setEntities(entities)

            if (orgName && entities) {
              result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
            }

            clearInputArea();
            //messageBoxRef.current?.reset();
          }
          if (socialCommand.toLowerCase() == "x") {

            if (isFirstCall) {
              xAuthRef.current?.openXPopup();
            }

            entities?.forEach((ent) => {
              if (ent.name == "x") {
                ent.attestation = { entityId: "x", hash: "", attester: ""}
              }
            })
            setEntities(entities)

            if (orgName && entities) {
              result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
            }
            
            clearInputArea();
            //messageBoxRef.current?.reset();
          }
          if (socialCommand.toLowerCase() == "shopify") {

            if (isFirstCall) {
              shopifyAuthRef.current?.openShopifyPopup();
            }

            entities?.forEach((ent) => {
              if (ent.name == "shopify") {
                ent.attestation = { entityId: "shopify", hash: "", attester: ""}
              }
            })
            setEntities(entities)

            if (orgName && entities) {
              result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
            }
            
            clearInputArea();
            //messageBoxRef.current?.reset();
          }

          if (socialCommand.toLowerCase() == "insurance") {

            if (isFirstCall) {
              insuranceAuthRef.current?.openInsurancePopup()
            }

            entities?.forEach((ent) => {
              if (ent.name == "insurance") {
                ent.attestation = { entityId: "insurance", hash: "", attester: ""}
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

        
        if ("orgName" in command) {
          let newOrgName = command["orgName"]
          if (newOrgName) {
            if (isFirstCall) {

              setNewOrgName(newOrgName)
              setOrgModalVisible(true)

              entities?.forEach((ent) => {
                if (ent.name == "org") {
                  ent.attestation = { entityId: "org", hash: "", attester: ""}
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
              addOrgRegistrationAttestation(state).then(() => {
                
              })

              entities?.forEach((ent) => {
                if (ent.name == "state-registration") {
                  ent.attestation = { entityId: "state-registration", hash: "", attester: ""}
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
                if (ent.name == "domain") {
                  ent.attestation = { entityId: "domain", hash: "", attester: ""}
                }
              })
              setEntities(entities)

              if (orgName && entities) {
                result.messages = postToolCmdSendMessages(prevMessages, orgName, entities)
              }
              
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
                if (ent.name == "email") {
                  ent.attestation = { entityId: "email", hash: "", attester: ""}
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
                if (ent.name == "website") {
                  ent.attestation = { entityId: "website", hash: "", attester: ""}
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

    console.info("...... handleStreamedResponse content: ", content)
    console.info("...... handleStreamedResponse args: ", args)

    let isFirstCall = 0
    setMessages(prevMessages => {

      console.info("...... prevMessages: ", prevMessages)


      // get the latest list of messages,  remember this can be called twice
      
      isFirstCall = isFirstCall + 1


      
      let isNew: boolean = false;
      try {
        if (prevMessages.length === 0) {
          console.error('prevMessages should not be empty in handleStreamedResponse.');
          console.info("~~~~~~~~~~~~~~~~~~~~~~~~ return empty")
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
        console.info("~~~~~~~~~~~~~~~~~~~~~~~~ return msgs: ", msgs)
        return msgs;
      } else {
        const updatedMessage = {
          ...prevMessages[prevMessages.length - 1],
          content: prevMessages[prevMessages.length - 1].content + content,
          args: prevMessages[prevMessages.length - 1].args + args
        };
        // Replace the old last message with the updated one
        if (done == true) {
          console.info("....process assistant message ......: ", updatedMessage)

          // received message from AI Assitant => updatedMessage
          // go do what the AI assistant message told us to do  =>  appCommand

          const response = processAssistantMessage(isFirstCall == 1, updatedMessage.content, updatedMessage.args, prevMessages, updatedMessage, fileDataRef);
          if (response.isToolFunction && response.messages) {
            console.info("prev: ", response.messages)
            return response.messages
          }
          
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
    setAllowAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom);
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

  return (
      <div className="flex  w-full">
        <DeleteAttestationsModal
          isVisible={isDeleteAttestationsModalVisible}
          onClose={handleOnDeleteAttestationsModalClose}
        />
        <OrgModal
          orgName={newOrgName?newOrgName:""}
          isVisible={isOrgModalVisible}
          onClose={handleOnOrgModalClose}
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
                </div>
        
                {/* Scroll to bottom button */}
                {showScrollButton && (
                  <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 mb-2 z-10">
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
          />
        </div>
      </div>
  );
};

export default MainPage;