

export interface Attestation {
  id?: string | null;
  uid?: string;         // attestation id
  class?: string;        // organization, individual
  schemaId?: string;    // attestation schema id
  entityId: string;     // entity - shopify, linkedin, ...
  category?: string;
  attester: string    // attestation attesting org
  hash: string;         // hash 
  vc?: string;
  vccomm?: string;      // hash           - commitment
  vcsig?: string;     // hash signature - commitment Signature
  vciss?: string;     // hash issuer    - commitment Issuer
  issuedate?: number | null;
  expiredate?: number | null;
  url?: string | null;
  proof?: string | null;
  revoked?: boolean | null;
  isValidated?: boolean;
  percentCompleted?: number;
  displayName?: string | null;

}

export interface AttestationCategory {
  id?: string;
  name: string;
  class: string;
}




export interface OrgAttestation extends Attestation {
  name: string,
}

export interface IndivAttestation extends Attestation {
  orgDid: string,
  name: string
}

export interface OrgIndivAttestation extends Attestation {
  indivDid: string,
  name: string,
  delegation: string,
}

export interface IndivAccountAttestation extends Attestation {
  accountName: string
  accountDid: string
  accountBalance: string | undefined
}

export interface AccountOrgDelAttestation extends Attestation {
  accountName: string,
  accountDid: string,
  coaCode: string,
  coaCategory: string,
  delegation: string,
}

export interface AccountIndivDelAttestation extends Attestation {
  accountName: string,
  accountDid: string,
  coaCode: string,
  coaCategory: string,
  indivDid: string,
  orgDelegation: string,
  indivDelegation: string,
}

export interface OrgAccountAttestation extends Attestation {
  accountName: string,
  accountDid: string,
  coaCode: string,
  coaCategory: string
}

export interface SocialAttestation extends Attestation {
  name?: string,
}

export interface RegisteredDomainAttestation extends Attestation {
  domain: string,
  domaincreationdate?: number | null,
}

export interface WebsiteAttestation extends Attestation {
  type: string, // public, ecommerce, blog, customer portal
}

export interface InsuranceAttestation extends Attestation {
  type: string, // public, ecommerce, blog, customer portal
  policy: string,
}

export interface EmailAttestation extends Attestation {
  type: string  // contact, job inquiry, ...
  email: string,
}

export interface StateRegistrationAttestation extends Attestation {
  name: string,
  idnumber: string,
  status: string,
  formationdate: number,
  locationaddress: string
}

export interface IndivEmailAttestation extends Attestation {
  type: string 
  email: string,
}