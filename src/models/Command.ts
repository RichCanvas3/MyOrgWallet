export interface Command {
    action: string;
    orgDid?: string;
    entityId?: string;     // entity - shopify, linkedin, ...
    value?: string;
  }