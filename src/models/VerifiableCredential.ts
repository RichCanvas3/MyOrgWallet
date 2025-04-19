export interface VerifiableCredential {
    '@context': string[];
    id?: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    expirationDate?: string;
    credentialSubject?: {
      id?: string;
      [key: string]: any;
    };
    proof?: {
      type: string;
      [key: string]: any;
    };
  }