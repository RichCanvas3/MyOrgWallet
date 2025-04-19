import {Attestation, OrgAttestation, SocialAttestation, RegisteredDomainAttestation} from './Attestation';

export interface Entity {
  name: string;
  schemaId: string;
  schema: string;
  priority: number;
  introduction?: string;
  instruction?: string;
  attestation?: Attestation | null;
  tools?: [any]
}


