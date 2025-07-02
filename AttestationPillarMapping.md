# 🏛️ Attestation Category to Trust Pillar Mapping

<div align="center">

![Mapping](https://img.shields.io/badge/Attestation%20Mapping-Complete-green?style=for-the-badge)
![Pillars](https://img.shields.io/badge/5%20Trust%20Pillars-Mapped-blue?style=for-the-badge)
![Categories](https://img.shields.io/badge/Attestation%20Categories-Defined-orange?style=for-the-badge)

**📋 Comprehensive Mapping of Attestation Categories to Trust Pillars**  
*How different types of attestations contribute to organizational trust scores*

</div>

---

## 📊 Overview

This document provides a comprehensive mapping between attestation categories and the five trust pillars used in the Organization Trust Score system. Each attestation category contributes to specific pillars based on the type of verification and evidence it provides.

---

## 🏛️ Trust Pillars Overview

| Pillar | Weight | Description | Focus Area |
|--------|--------|-------------|------------|
| **👑 Leadership** | 25% | People and governance | Management identity, experience, integrity |
| **🏢 Identity** | 25% | Business legitimacy | Registration, verification, digital presence |
| **💰 Finance** | 20% | Financial stability | Accounts, balances, creditworthiness |
| **🛡️ Compliance** | 20% | Legal compliance | Licenses, insurance, regulatory adherence |
| **⭐ Reputation** | 10% | External feedback | Reviews, endorsements, track record |

---

## 📋 Attestation Category Mapping

### 👑 Leadership Pillar (25% Weight)

**Scoring:**
- Verified attestations: **20 points**
- Unverified attestations: **10 points**
- Multiple attestations bonus: **+5 points**

#### Mapped Categories:

| Category | Entity ID Pattern | Description | Points |
|----------|------------------|-------------|---------|
| `leadership` | `org-indiv(org)` | Organization to individual leadership attestations | 20/10 |
| `leaders` | Various | Leadership role verifications | 20/10 |
| `management` | Various | Management team attestations | 20/10 |

#### Examples:
- **Org-Indiv Attestations**: Links individuals to organizations with leadership roles
- **Leadership Credentials**: Professional qualifications and experience
- **Management Verification**: KYC/KYB for executives and owners

---

### 🏢 Identity Pillar (25% Weight)

**Scoring:**
- Verified attestations: **25 points**
- Unverified attestations: **15 points**
- Multiple attestations bonus: **+5 points**

#### Mapped Categories:

| Category | Entity ID Pattern | Description | Points |
|----------|------------------|-------------|---------|
| `identity` | Various | General identity verifications | 25/15 |
| `domain` | `domain(org)` | Domain ownership verification | 25/15 |
| `website` | Various | Website presence and verification | 25/15 |
| `social` | Various | Social media presence verification | 25/15 |
| `registration` | Various | Business registration attestations | 25/15 |

#### Examples:
- **Domain Attestations**: Proof of domain ownership and control
- **Website Attestations**: Verified website presence and SSL certificates
- **Social Media**: Verified social media accounts and presence
- **Business Registration**: Incorporation certificates and good standing
- **Email Verification**: Business email domain verification

---

### 💰 Finance Pillar (20% Weight)

**Scoring:**
- Verified attestations: **20 points**
- Unverified attestations: **10 points**
- Multiple attestations bonus: **+5 points**
- USDC Balance Bonuses:
  - $10,000+: **+30 points**
  - $1,000+: **+20 points**
  - $100+: **+10 points**
  - Any balance: **+5 points**

#### Mapped Categories:

| Category | Entity ID Pattern | Description | Points |
|----------|------------------|-------------|---------|
| `financial` | Various | General financial attestations | 20/10 |
| `account` | `account(org)` | Account-related attestations | 20/10 |
| `delegations` | Various | Account delegation attestations | 20/10 |
| `account access` | `account-indiv(org)` | Individual account access | 20/10 |

#### Examples:
- **Account Attestations**: USDC savings accounts and balances
- **Financial Delegations**: Account access control and permissions
- **Balance Verification**: On-chain USDC balance attestations
- **Account Access**: Individual access to organizational accounts

---

### 🛡️ Compliance Pillar (20% Weight)

**Scoring:**
- Verified attestations: **30 points**
- Unverified attestations: **15 points**
- Multiple attestations bonus: **+5 points**

#### Mapped Categories:

| Category | Entity ID Pattern | Description | Points |
|----------|------------------|-------------|---------|
| `compliance` | Various | General compliance attestations | 30/15 |
| `insurance` | Various | Insurance coverage verification | 30/15 |
| `license` | Various | Professional license verification | 30/15 |
| `registration` | Various | State registration and compliance | 30/15 |
| `security` | Various | Security and privacy compliance | 30/15 |

#### Examples:
- **Insurance Certificates**: General liability, professional indemnity
- **License Verification**: Professional licenses and permits
- **State Registration**: Secretary of State good standing
- **Security Compliance**: PCI-DSS, ISO certifications
- **Regulatory Compliance**: GDPR, CCPA adherence

---

### ⭐ Reputation Pillar (10% Weight)

**Scoring:**
- Verified attestations: **15 points**
- Unverified attestations: **+8 points**
- Multiple attestations bonus: **+5 points**

#### Mapped Categories:

| Category | Entity ID Pattern | Description | Points |
|----------|------------------|-------------|---------|
| `reputation` | Various | General reputation attestations | 15/8 |
| `endorsement` | Various | Third-party endorsements | 15/8 |
| `review` | Various | Customer review aggregations | 15/8 |
| `accreditation` | Various | Industry accreditations | 15/8 |

#### Examples:
- **Customer Reviews**: Verified review platform data
- **Endorsements**: Client testimonials and references
- **Accreditations**: BBB, industry association memberships
- **Awards**: Industry recognition and certifications

---

## 🔧 Implementation Details

### Current Attestation Categories (from AttestationService)

```typescript
const attestationCategories: AttestationCategory[] = [
  {
    class: "organization",
    name: "identity",
    id: "10"
  },
  {
    class: "organization", 
    name: "leadership",
    id: "10"
  },
  {
    class: "organization",
    name: "financial", 
    id: "20"
  },
  {
    class: "organization",
    name: "account access",
    id: "21"
  },
  {
    class: "organization",
    name: "delegations",
    id: "80"
  },
  {
    class: "individual",
    name: "identity",
    id: "80"
  },
  {
    class: "individual",
    name: "financial",
    id: "80"
  }
]
```

### Trust Score Calculation Logic

```typescript
// Leadership score (org-indiv attestations, leadership roles)
if (att.category === 'leaders' || att.entityId === 'org-indiv(org)') {
  breakdown.leadership += att.isValidated ? 20 : 10;
}

// Identity score (domain, website, social presence)
if (att.category === 'domain' || att.entityId === 'domain(org)' || 
    att.category === 'website' || att.category === 'social') {
  breakdown.identity += att.isValidated ? 25 : 15;
}

// Finance score (accounts, financial attestations)
if (att.category === 'account' || att.entityId?.includes('account')) {
  breakdown.finance += att.isValidated ? 20 : 10;
  savingsAccounts++;
}

// Compliance score (insurance, licenses, registrations)
if (att.category === 'insurance' || att.category === 'license' || 
    att.category === 'registration' || att.entityId?.includes('state')) {
  breakdown.compliance += att.isValidated ? 30 : 15;
}

// Reputation score (reviews, endorsements, general attestations)
if (att.category === 'reputation' || att.category === 'endorsement' || 
    att.category === 'review') {
  breakdown.reputation += att.isValidated ? 15 : 8;
}
```

---

## 📈 Scoring Enhancement Opportunities

### Missing Category Mappings

The current implementation has some gaps in category mapping. Here are suggested additions:

#### Leadership Pillar
- Add `management` category for management team attestations
- Add `executive` category for executive-level verifications
- Add `board` category for board member attestations

#### Identity Pillar
- Add `email` category for email verification attestations
- Add `phone` category for phone number verification
- Add `address` category for physical address verification

#### Finance Pillar
- Add `credit` category for credit score attestations
- Add `revenue` category for revenue verification
- Add `funding` category for funding round attestations

#### Compliance Pillar
- Add `audit` category for audit report attestations
- Add `certification` category for industry certifications
- Add `background` category for background check results

#### Reputation Pillar
- Add `rating` category for aggregated ratings
- Add `testimonial` category for client testimonials
- Add `award` category for awards and recognition

### Enhanced Scoring Logic

```typescript
// Enhanced mapping with more categories
const pillarMapping = {
  leadership: ['leaders', 'leadership', 'management', 'executive', 'board'],
  identity: ['identity', 'domain', 'website', 'social', 'email', 'phone', 'address'],
  finance: ['financial', 'account', 'credit', 'revenue', 'funding'],
  compliance: ['compliance', 'insurance', 'license', 'audit', 'certification'],
  reputation: ['reputation', 'endorsement', 'review', 'rating', 'testimonial']
};

// Enhanced scoring function
function calculatePillarScore(attestations: Attestation[], pillar: string): number {
  const categories = pillarMapping[pillar];
  let score = 0;
  
  attestations.forEach(att => {
    if (categories.includes(att.category)) {
      score += att.isValidated ? getVerifiedPoints(pillar) : getUnverifiedPoints(pillar);
    }
  });
  
  return Math.min(100, score);
}
```

---

## 🎯 Recommendations

### 1. Standardize Category Names
- Use consistent naming conventions across all attestation types
- Ensure category names match between creation and scoring logic

### 2. Expand Category Coverage
- Add missing categories for comprehensive pillar coverage
- Implement category-specific scoring rules

### 3. Improve Scoring Granularity
- Add category-specific point values
- Implement dynamic scoring based on attestation quality

### 4. Enhanced Validation
- Add category validation during attestation creation
- Ensure proper pillar mapping for all new attestation types

### 5. Documentation
- Maintain this mapping document as the source of truth
- Update when new categories or scoring rules are added

---

## 📊 Summary Table

| Pillar | Weight | Primary Categories | Secondary Categories | Max Points |
|--------|--------|-------------------|---------------------|------------|
| **Leadership** | 25% | `leadership`, `leaders` | `management`, `executive` | 100 |
| **Identity** | 25% | `identity`, `domain`, `website` | `social`, `email`, `phone` | 100 |
| **Finance** | 20% | `financial`, `account` | `credit`, `revenue`, `funding` | 100 |
| **Compliance** | 20% | `compliance`, `insurance`, `license` | `audit`, `certification` | 100 |
| **Reputation** | 10% | `reputation`, `endorsement`, `review` | `rating`, `testimonial` | 100 |

---

<div align="center">

**🔐 Building Trust Through Verifiable Attestations**  
*Comprehensive mapping ensures accurate and transparent trust scoring*

</div> 