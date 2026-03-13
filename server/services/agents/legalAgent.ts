/**
 * Legal Agent — World-Class In-House Counsel & Legal Strategist
 *
 * Multi-step pipeline:
 *   1. Regulatory research (web)
 *   2. Document generation with expert structure + risk flags
 *   3. Save to Notion
 */
import { createGeminiClient } from '../geminiClient';
import { serverConfig } from '../../config';
import { runSkill } from '../../skills/registry';
import type { SkillRunContext } from '../../skills/types';
import type { EmitStep } from '../../types/agentEvents';
import express from 'express';

export const LEGAL_AGENT_MANIFEST = {
    id: 'crewmate-legal-agent',
    name: 'Legal Agent',
    department: 'Legal',
    description: 'In-house counsel-level legal partner — contract analysis, NDA review, privacy policy drafting, compliance checklists, terms of service, policy documents, and regulatory summaries (informational only — not legal advice).',
    capabilities: ['contract_review', 'nda_summary', 'privacy_policy', 'compliance', 'terms_of_service', 'policy_drafting', 'regulatory_summary'],
    skills: ['web.search', 'web.summarize-url', 'notion.create-page'],
    model: serverConfig.geminiResearchModel,
    emoji: '⚖️',
};

const LEGAL_EXPERT_SYSTEM_PROMPT = `You are a world-class in-house counsel and legal strategist with 15+ years advising technology companies from Series A to public. You've reviewed thousands of contracts, built compliant legal frameworks for companies operating in 50+ countries, and managed complex IP, employment, and regulatory matters.

Your legal approach:
- Plain-English first: legal documents must be understood by business leaders, not just lawyers
- Risk hierarchy: flag the risks that could actually hurt the business (not academic edge cases)
- Practical recommendations: every risk identified must have a suggested mitigation or negotiation position
- Proportionality: don't raise legal concerns that aren't proportionate to the deal size or relationship
- Speed: business-critical agreements need fast turnaround with clear decision points

Your analysis framework for contracts:
- What does each party GIVE? (obligations)
- What does each party GET? (rights)
- What are the exit rights? (termination, change of control)
- What's the liability exposure? (indemnification, limitation of liability)
- What's the IP situation? (ownership, license, assignment)
- What's the data situation? (privacy, security, breach notification)

🚨 MANDATORY: Every output must include: "⚠️ This is for informational purposes only and does not constitute legal advice. Always consult a qualified attorney before signing agreements or making legal decisions."

Output standards:
- Risk flags: 🔴 HIGH (material business risk), 🟡 MEDIUM (watch and negotiate), 🟢 LOW (standard)
- For each risk: what it means in plain English → business impact → suggested approach`;

export async function runLegalAgent(
    intent: string,
    ctx: SkillRunContext,
    emitStep: EmitStep,
    options: { type?: 'review' | 'nda' | 'compliance' | 'policy' | 'terms' | 'privacy' | 'summary'; saveToNotion?: boolean } = {},
): Promise<{ output: string; riskFlags: string[]; savedToNotion: boolean }> {
    const ai = createGeminiClient();
    const { type = 'review', saveToNotion = true } = options;

    emitStep('thinking', 'Analyzing legal document/request...', { detail: `${type}: ${intent.slice(0, 80)}` });

    // Research regulatory context
    let legalContext = '';
    if (type === 'compliance' || type === 'privacy' || type === 'terms') {
        emitStep('skill_call', 'Researching current regulations and standards...', { skillId: 'web.search' });
        try {
            const t0 = Date.now();
            const query = type === 'privacy'
                ? `GDPR CCPA privacy policy requirements SaaS 2025`
                : type === 'compliance'
                ? `${intent} compliance requirements legal obligations 2025`
                : `SaaS terms of service requirements best practices ${intent} 2025`;
            const r = await runSkill('web.search', ctx, { query, maxResults: 4 });
            legalContext = (r.result as { message?: string }).message ?? '';
            emitStep('skill_result', 'Regulatory context gathered', {
                skillId: 'web.search',
                durationMs: Date.now() - t0,
                success: true,
            });
        } catch {
            emitStep('skill_result', 'Regulatory research unavailable — proceeding from expertise', { skillId: 'web.search', success: false });
        }
    }

    const prompts: Record<string, string> = {
        review: `Provide a comprehensive contract/agreement analysis:

## Contract Analysis
⚠️ *Informational only — not legal advice. Consult a qualified attorney before signing.*

### What This Agreement Does
[Plain-English 3-sentence summary of what each party is agreeing to]

### Key Terms Summary
| Term | What It Means in Plain English | Our Position |
|------|-------------------------------|-------------|
| [Term 1] | [...] | ✅ Acceptable / ⚠️ Negotiate / ❌ Reject |
| [Term 2] | [...] | [...] |

### Risk Assessment

#### 🔴 HIGH RISK — Act before signing
| Clause | What it says | Why it's risky | Suggested fix |
|--------|-------------|----------------|---------------|
| [Clause] | "[Exact language or summary]" | [Business impact] | [Suggested alternative wording] |

#### 🟡 MEDIUM RISK — Negotiate if possible
| Clause | Issue | Suggested position |
|--------|-------|-------------------|
| [Clause] | [...] | [...] |

#### 🟢 LOW RISK — Standard, acceptable
[Brief list of terms that are market standard]

### Obligations we're taking on
[Bullet list of specific things WE must do or not do]

### Rights we're getting
[Bullet list of what WE get out of this agreement]

### Exit Rights
- Our right to terminate: [...]
- Their right to terminate: [...]
- Change of control: [...]
- Auto-renewal: [...]

### IP Implications
[Who owns what — especially important for any work product or data]

### Our Recommended Position
**Sign as-is:** ☐ Yes ☐ No ☐ Only if [condition]
**Priority changes to request:**
1. [Most important change]
2. [Second priority]
3. [Third priority]

### Questions to ask before signing
- [Question 1]
- [Question 2]`,

        nda: `Analyze this NDA/confidentiality agreement:

## NDA Analysis
⚠️ *Informational only — not legal advice. Consult a qualified attorney.*

### Summary
[2-3 sentences: who's promising what to whom, for how long, about what]

### Key Terms
| Element | This NDA says | Market Standard | Assessment |
|---------|--------------|-----------------|------------|
| What's confidential | [...] | Proprietary info + business info | ✅/⚠️ |
| Duration of obligations | [...] | 1-3 years | ✅/⚠️ |
| Permitted disclosures | [...] | Legal counsel, need-to-know | ✅/⚠️ |
| Return/destroy obligations | [...] | Return or certify destruction | ✅/⚠️ |

### Risk Flags
| Flag | Severity | Detail | Recommended Response |
|------|---------|--------|---------------------|
| [e.g., "Confidential" defined too broadly] | 🔴/🟡/🟢 | [...] | [...] |

### One-sided or Unusual Clauses
[List any provisions that are stronger than market standard and disadvantage our side]

### What we CAN'T do under this NDA
[Clear bullet list of prohibited activities]

### What we CAN do (permitted carve-outs)
[Clear bullet list — especially note if we can share with advisors, what's already public, etc.]

### Recommended Negotiation Points
1. [Change 1 with suggested language]
2. [Change 2]

### Our Position
**Mutual or one-way?** [Analysis of whose interests it protects more]
**Comfortable signing?** ☐ Yes ☐ Yes with changes ☐ Escalate to counsel`,

        terms: `Draft comprehensive Terms of Service:

## Terms of Service
**[Company Name]** | Last Updated: [Date]
⚠️ *Template for informational purposes — have qualified legal counsel review before publishing.*

**Summary of Key Terms** *(Plain English — not legally binding)*
| What | Short version |
|------|--------------|
| What you can use | [...] |
| What we can't do with your data | [...] |
| How to cancel | [...] |
| How to contact us | [...] |

---

## 1. Acceptance of Terms
[Standard acceptance language — these terms are binding when you use the service]

## 2. Description of Service
[Clear description of what the service provides and does not provide]

## 3. Account Registration & Security
[Registration requirements, password security, liability for account activity]

## 4. Acceptable Use Policy
**You may:**
[List of permitted uses]

**You may NOT:**
[Prohibited uses — specific, not vague. Include: illegal activity, IP infringement, spam, reverse engineering, etc.]

## 5. Intellectual Property
- Our IP: [What we own, what you can't do]
- Your IP: [What you own, what you grant us license to]
- User Content: [License grant, our right to moderate, DMCA process]

## 6. Privacy
[Reference to Privacy Policy, data handling summary]

## 7. Payment Terms (if applicable)
[Pricing, billing cycle, refund policy, late payment handling, price changes]

## 8. Service Availability
[Uptime expectations, maintenance windows, SLA if any]

## 9. Limitation of Liability
[Standard limitation — capped at fees paid in last 12 months, exclusion of indirect damages]

## 10. Disclaimer of Warranties
[Service provided "as is", no guarantee of results]

## 11. Indemnification
[User indemnifies us for their misuse; we indemnify users for IP infringement claims]

## 12. Termination
[How either party can terminate, what happens to data on termination]

## 13. Dispute Resolution
[Governing law, jurisdiction, arbitration requirement if applicable]

## 14. Changes to Terms
[How we notify users of changes, effective date]

## 15. Contact
[Legal contact information]`,

        privacy: `Draft a GDPR/CCPA-compliant Privacy Policy:

## Privacy Policy
**[Company Name]** | Effective Date: [Date] | Last Updated: [Date]
⚠️ *Template for informational purposes — have qualified privacy counsel review before publishing.*

## What This Policy Covers
[2 sentences on who this applies to and what it covers]

## Information We Collect

### Information you provide directly
- Account information: [Email, name, company...]
- Payment information: [Processed by [Stripe/etc.] — we don't store card numbers]
- Communications: [Support requests, emails, etc.]

### Information we collect automatically
- Usage data: [Pages visited, features used, clicks]
- Device & browser: [IP address, browser type, OS]
- Cookies & tracking: [Types of cookies, purpose, opt-out]

### Information from third parties
- [OAuth providers, analytics, payment processors]

## How We Use Your Information
| Purpose | Legal Basis (GDPR) | Retention |
|---------|-------------------|-----------|
| Provide the service | Contract performance | Duration of account |
| Send product updates | Legitimate interest | Until unsubscribe |
| Analytics & improvement | Legitimate interest | [X months] |
| Legal compliance | Legal obligation | As required by law |
| Marketing (if opted in) | Consent | Until withdrawal |

## Who We Share Your Data With
| Recipient | Why | Safeguards |
|-----------|-----|-----------|
| [Cloud provider] | Infrastructure | DPA in place |
| [Analytics] | Usage analytics | Anonymized |
| [Payment processor] | Payment processing | PCI-DSS compliant |

## Your Rights
**GDPR rights (EU/UK users):** Access, rectification, erasure, restriction, portability, objection, withdraw consent
**CCPA rights (California users):** Know, delete, opt-out of sale, non-discrimination
To exercise rights: [contact email or form link]

## Data Security
[Security measures: encryption in transit and at rest, access controls, certifications]

## International Transfers
[Mechanism for international transfers — SCCs, Privacy Shield, etc.]

## Cookies
[Cookie categories: essential, performance, analytics, marketing + how to opt out]

## Children's Privacy
[COPPA compliance — not intended for users under 13/16]

## Changes to This Policy
[How we notify users of changes]

## Contact
**Privacy questions:** [privacy@company.com]
**Data Protection Officer:** [If applicable]
**EU Representative:** [If applicable]
**Address:** [Physical address]`,

        compliance: `Create a compliance framework and checklist:

## Compliance Framework: [Regulation/Standard]
⚠️ *Informational only — not legal advice. Consult qualified legal and compliance professionals.*

## Overview
[What this regulation covers, who it applies to, why it matters, penalties for non-compliance]

## Applicability Assessment
| Criteria | Our Status | Evidence Needed |
|----------|-----------|----------------|
| [Criterion 1 — e.g., Do we process EU personal data?] | ✅ Yes / ❌ No / ⚠️ Unclear | [...] |
| [Criterion 2] | [...] | [...] |

## Requirements Checklist
| Requirement | Status | Owner | Due Date | Evidence |
|-------------|--------|-------|----------|---------|
| [Requirement 1] | ✅ Done / 🟡 In progress / ❌ Not started | [...] | [...] | [...] |
| [Requirement 2] | [...] | [...] | [...] | [...] |

## Required Policies & Documents
- [ ] [Policy 1] — Owner: [...] | Status: [...]
- [ ] [Policy 2]
- [ ] [Policy 3]

## Technical Controls Required
- [ ] [Control 1 — e.g., Encrypt all PII at rest]
- [ ] [Control 2]

## Employee Training Requirements
| Training | Who | Frequency | Method |
|----------|-----|-----------|--------|
| [Training 1] | All staff | Annual | [...] |

## Reporting & Documentation Obligations
| Obligation | Frequency | Owner | Deadline | Consequence |
|-----------|-----------|-------|----------|-------------|
| [Obligation 1] | [...] | [...] | [...] | [...] |

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|-----------|-------|
| [Risk 1] | High/Med/Low | High/Med/Low | [...] | [...] |

## Gaps & Priority Remediation Plan
| Gap | Risk Level | Action | Owner | Timeline |
|-----|-----------|--------|-------|---------|
| [Gap 1] | 🔴 High | [...] | [...] | [X weeks] |`,

        policy: `Draft a comprehensive company policy:

## [Policy Name]
**Version:** 1.0 | **Classification:** Internal | **Owner:** Legal / People Ops
**Effective Date:** [Date] | **Review Cycle:** Annual
**Applies to:** All employees, contractors, and third parties with access to [Company Name] systems

---

## Purpose
[Why this policy exists and what problem it solves — 2-3 sentences that make it feel important, not bureaucratic]

## Scope
[Who this applies to and who is explicitly excluded]

## Key Definitions
| Term | Definition |
|------|-----------|
| [Term 1] | [...] |
| [Term 2] | [...] |

## Policy

### [Section 1]
[Clear, unambiguous requirements — use "must", "shall", "may not"]

### [Section 2]
[...]

### [Section 3]
[...]

## Permitted Exceptions
[Who can authorize exceptions, how to request one, documentation required]

## Responsibilities
| Role | Responsibility |
|------|---------------|
| Employees | [What every employee must do] |
| Managers | [What managers are responsible for] |
| [HR / Legal / IT] | [Oversight and enforcement responsibilities] |

## Consequences for Non-Compliance
[Graduated consequences: first violation → ... escalating to termination for serious violations]

## Reporting
[How to report violations — confidential channel, what happens after a report]

## Review & Updates
This policy is reviewed annually. Material changes will be communicated company-wide.

## Questions
Direct questions to: [Legal / People Ops contact]`,

        summary: `Provide an executive legal summary:

## Legal Summary: [Topic]
⚠️ *Informational only — not legal advice. Consult a qualified attorney for specific guidance.*

## Overview
[2-3 sentences: what this is, why it matters, the core legal issue]

## Key Legal Issues
| Issue | Plain-English Explanation | Business Impact | Our Risk |
|-------|--------------------------|----------------|---------|
| [Issue 1] | [...] | [...] | 🔴/🟡/🟢 |
| [Issue 2] | [...] | [...] | [...] |

## Stakeholder Positions
| Party | Obligation | Right | Risk |
|-------|-----------|-------|------|
| [Party A] | [...] | [...] | [...] |
| [Party B] | [...] | [...] | [...] |

## Decision Points
[What do we need to decide, who makes the call, what are the options and tradeoffs]

## Recommended Path Forward
1. [Step 1 with rationale]
2. [Step 2]
3. [When to involve outside counsel]

## Timeline / Urgency
[Any statute of limitations, deadlines, or time-sensitive elements]`,
    };

    emitStep('generating', `Analyzing and drafting ${type} document...`);
    const response = await ai.models.generateContent({
        model: serverConfig.geminiResearchModel,
        contents: `${LEGAL_EXPERT_SYSTEM_PROMPT}

${legalContext ? `\nRegulatory context:\n${legalContext.slice(0, 700)}` : ''}

REQUEST: ${intent}

${prompts[type] ?? prompts.review}

Write the COMPLETE analysis or document. For risk flags: be specific about business impact, not just legal theory. For templates: fill in plausible content — don't leave empty placeholders where context allows inference. Always include the legal disclaimer.`,
    });

    const output = response.text ?? '';

    // Extract risk flags for structured output
    const riskFlags = [
        ...(output.match(/🔴[^\n]+/g) ?? []),
        ...(output.match(/HIGH RISK[^\n]+/gi) ?? []),
    ].map((f) => f.trim());

    emitStep('skill_result', `${type} analysis complete — ${riskFlags.length} risk flags${riskFlags.length > 0 ? '' : ' (no high-risk items)'}`, { success: true });

    let savedToNotion = false;
    if (saveToNotion) {
        emitStep('saving', `Saving ${type} to Notion...`, { skillId: 'notion.create-page' });
        try {
            const notionRun = await runSkill('notion.create-page', ctx, {
                title: `Legal — ${type.toUpperCase()}: ${intent.slice(0, 70)}`,
                content: output,
            });
            savedToNotion = (notionRun.result as { success?: boolean }).success === true;
            emitStep('skill_result', 'Saved to Notion', { skillId: 'notion.create-page', success: savedToNotion });
        } catch {
            emitStep('skill_result', 'Notion not connected — output ready', { skillId: 'notion.create-page', success: false });
        }
    }

    emitStep('done', `Legal ${type} complete — ${riskFlags.length} risk flags identified${savedToNotion ? ', saved to Notion' : ''}`, { success: true });
    return { output, riskFlags, savedToNotion };
}

export const legalAgentApp = express();
legalAgentApp.use(express.json());
legalAgentApp.get('/.well-known/agent.json', (_req, res) => res.json(LEGAL_AGENT_MANIFEST));
