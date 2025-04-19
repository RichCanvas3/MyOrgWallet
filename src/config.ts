import env from './local.env.json';

export const OPENAI_API_KEY = (env as any).openapi_key;
export const OPENAI_DEFAULT_MODEL: string = (env as any).default_model;
export const OPENAI_DEFAULT_SYSTEM_PROMPT: string = (env as any).default_system_prompt;
export const OPENAI_DEFAULT_ASSISTANT_PROMPT: string = (env as any).default_assistant_prompt;
export const ISSUER_PRIVATE_KEY = (env as any).issuer_eoc_private_key;
