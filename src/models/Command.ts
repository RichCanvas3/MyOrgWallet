export interface Command {
    action: string;
    did?: string;
    entityId?: string;     // entity - shopify, linkedin, ...
    value?: string;
    displayName?: string;
  }