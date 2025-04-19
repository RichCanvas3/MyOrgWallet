export interface VcZkProof {
  id?: string | null
  publicSignals?: string[] | null
  proof?: string | null;
  createdAt?: string | null;
  orgDid?: string | null;
  vccomm?: string | null;
  isValid?: boolean | null;
}

export interface VcRevokeZkProof {
  id?: string | null
  publicSignals?: string[] | null
  proof?: string | null;
  createdAt?: string | null;
  orgDid?: string | null;
  vccomm?: string | null;
  isValid?: boolean | null;
}

