import env from './local.env.json';

export const OPENAI_API_KEY = (env as any).openapi_key;
export const OPENAI_DEFAULT_MODEL: string = (env as any).default_model;
export const OPENAI_DEFAULT_SYSTEM_PROMPT: string = (env as any).default_system_prompt;
export const OPENAI_DEFAULT_ASSISTANT_PROMPT: string = (env as any).default_assistant_prompt;
export const ISSUER_PRIVATE_KEY = (env as any).issuer_eoa_private_key;
export const WEB3_AUTH_NETWORK = (env as any).web3_auth_network;
export const WEB3_AUTH_CLIENT_ID = (env as any).web3_auth_client_id;
export const RPC_URL = (env as any).rpc_url;
export const BUNDLER_URL = (env as any).bundler_url;
export const PAYMASTER_URL = (env as any).paymaster_url;
export const X_CLIENT_ID = (env as any).x_client_id;
export const LINKEDIN_CLIENT_ID = (env as any).linkedin_client_id;
export const SHOPIFY_CLIENT_ID = (env as any).shopify_client_id;

