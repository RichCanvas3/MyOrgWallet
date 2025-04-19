



export interface Organization {
  id?: number | null;
  name: string;
  hash: string;
  orgDid: string;
  issuedate?: string | null;
  expiredate?: number | null;
  revoked?: boolean | null
}
