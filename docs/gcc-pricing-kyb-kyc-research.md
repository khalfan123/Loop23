# GCC pricing, telecom costs, and KYB/KYC research (evidence draft)

**Status:** Research / design inputs only.  
**Date:** 2026-09-16  
**Worktree:** `loop9-voice-hardening-a1b2c3` / branch `codex/loop9-voice-hardening`  
**Not done here:** live billing prices in product, real KYC submissions, production config/UI, deploy, paid provisioning.

Voice hardening remains at the independently verified checkpoint (**5 files / 78 tests PASS**). This document does **not** assert supervisor acceptance of that increment.

---

## How to read this document

| Label | Meaning |
|-------|---------|
| **CONFIRMED** | Stated on an official regulator page, statute, or primary vendor public price page, with URL. |
| **ESTIMATE** | Derived, third-party, incomplete, or account-specific; must not be shipped as “official Loop9 rate.” |
| **UNKNOWN** | Not verified from primary sources in this pass — do not invent. |

Three onboarding layers that must stay separate:

1. **Company formation / bank KYB** — incorporation + bank account CDD.  
2. **Telecom / numbering** — licences, carrier partners, DID allocation identity checks.  
3. **Sector AML (FI / DNFBP / VASP)** — only if the entity falls in a designated category; **not** a blanket SaaS obligation.

---

## 1. Telecom & VoIP licensing (per country)

### UAE — TDRA

| Item | Status | Evidence |
|------|--------|----------|
| VoIP offered to subscribers is a Regulated Activity needing a licence or exemption | **CONFIRMED** | [TDRA FAQs](https://tdra.gov.ae/en/faqs) |
| VoIP Regulatory Policy v2.0 (30 Dec 2009) governs VoIP | **CONFIRMED** | [TDRA VoIP Regulatory Policy PDF](https://tdra.gov.ae/-/media/About/regulations-and-ruling/EN/Voice-over-internet-protocol-Regulatory-policy-pdf.ashx) |
| Policy states TRA’s then-present intention not to issue further licences allowing VoIP beyond existing licensees | **CONFIRMED** (policy text; confirm currency with counsel) | Same PDF §3.1 |
| Practical path for many SaaS voice products: obtain voice connectivity via a UAE licensee (e.g. Etisalat / du) rather than self-licence | **ESTIMATE** (business model implication of policy; counsel required) | FAQ + policy |
| Individual vs Class licences; eligibility includes UAE company under Commercial Companies Law / Art. 28 Telecom Decree | **CONFIRMED** | [TDRA Licensing](https://tdra.gov.ae/en/about/tdra-sectors/telecommunication/regulatory-affairs-department/licensing) |
| Application fee AED 10,000 | **ESTIMATE** (cited by secondary legal articles; **not** taken as confirmed from TDRA fee schedule in this pass) | e.g. pinlegalglobal summary — verify on TDRA |

**Loop9 implication (design):** Prefer **licensed-carrier / BYOC / reseller** architectures for UAE DIDs and PSTN. Do not claim Loop9 holds a TDRA VoIP licence unless counsel confirms.

### Saudi Arabia — CST (formerly CITC)

| Item | Status | Evidence |
|------|--------|----------|
| Virtual Voice Services Permit (VVSP) exists for virtual audio calls to/from PSTN via E.164 over licensed networks | **CONFIRMED** (service listing) | [my.gov.sa VVSP service](https://my.gov.sa/en/services/25559) (page may block automated fetch; listing is official national portal) |
| Cloud Computing Registration for cloud providers | **CONFIRMED** | [CST Cloud Computing Registration](https://www.cst.gov.sa/en/business/services/Cloud-Computing-Registration) |
| Electronic aggregation registration fee SAR 100,000 | **CONFIRMED** (that service’s fee field) | [CST Electronic Aggregation](https://www.cst.gov.sa/en/business/services/Registration-for-Providing-Electronic-Aggregation-in-Telecommunications-Services) |
| VVSP fee amount / exact doc checklist | **UNKNOWN** in this pass | Re-check CST portal with human login |
| DID KYC via commercial registration + national address + responsible-party ID | **ESTIMATE** (carrier / marketplace descriptions; not CST statute quote here) | Third-party DID sellers — treat as carrier practice, verify |

### Bahrain — TRA

| Item | Status | Evidence |
|------|--------|----------|
| Individual and Class licences under Telecom Law Arts. 29/32 | **CONFIRMED** | [TRA Applying for Licences](https://tra.org.bh/en/category/applying-for-available-licences) |
| Class includes Value Added Services (VAS) and ISP | **CONFIRMED** | Same |
| Exact VAS scope for AI voice / cloud PBX | **UNKNOWN** | Counsel + TRA application notes |

### Kuwait — CITRA

| Item | Status | Evidence |
|------|--------|----------|
| CITRA issues licences / exemptions under Telecom Law | **CONFIRMED** | [CITRA Home](https://www.citra.gov.kw/sites/en/Pages/Home.aspx) |
| Company registration portal requires CR, commercial licence, authorized signature | **CONFIRMED** | [CITRA Register Company](https://www.citra.gov.kw/sites/en/Pages/RegisterCompany.aspx) |
| ISP renewal example fees (KD 75,000 annual + bank guarantee) | **CONFIRMED** for that ISP renewal service — **not** generalized to all voice AI | [ServiceDetails SrvcID=56](https://www.citra.gov.kw/sites/en/Pages/ServiceDetails.aspx?SrvcID=56) |
| Loop9-specific licence class | **UNKNOWN** | Counsel |

### Oman — TRA

| Item | Status | Evidence |
|------|--------|----------|
| Class I / II / III licensing categories in Telecom Law FAQs | **CONFIRMED** | [TRA FAQ (AR)](https://tra.gov.om/FAQTele.jsp?menu=100); Class I list [EN](https://www.tra.gov.om/En/Class1.jsp?menu=30) |
| Class II covers public services using Class I capacity / numbering without scarce natural resources | **CONFIRMED** (FAQ summary) | Same |
| Mapping of AI inbound voice SaaS → Class II vs partner-only | **UNKNOWN** | Counsel |

### Qatar — CRA

| Item | Status | Evidence |
|------|--------|----------|
| Telecom Law 34/2006: Individual and Class licences | **CONFIRMED** | [CRA Telecommunications Law](https://www.cra.gov.qa/en/Law-and-Regulations/Legal-References/The-Telecommunications-Law-34-of-2006) |
| Class licences include private networks and **resale of retail telecommunications services** | **CONFIRMED** | [CRA Class Licenses](https://www.cra.gov.qa/en/Services/Telecommunications/Licensing/Class-Licenses) |
| Public fixed/mobile licensees (Ooredoo, Vodafone) | **CONFIRMED** | [CRA Licensees](https://www.cra.gov.qa/en/Services/Telecommunications/Licensing/Licensees) |
| Whether Loop9 needs Class resale vs pure over-the-top via licensed SIP | **UNKNOWN** | Counsel |

---

## 2. KYB / KYC layers (do not collapse)

### A. Company onboarding (Loop9 as vendor ↔ customer business)

**Collect only what is needed for B2B account integrity and fraud control**, e.g.:

- Legal name, trade licence / CR number, country of incorporation  
- Authorized signatory identity (for contract)  
- Business contact email/phone  

**Do not** invent a full AML CDD pack (passport scans of all UBOs, source-of-funds narratives, etc.) for every SaaS signup unless counsel confirms Loop9 is a designated FI/DNFBP/VASP **or** a payment partner contractually requires it.

### B. Telecom number verification (carrier / DID)

Separate from SaaS signup. Typical carrier asks (often **ESTIMATE** as practice):

- Local CR / trade licence matching the numbering jurisdiction  
- Authorized representative ID  
- Sometimes national address proof (KSA)  

This is **number provisioning KYC**, not “Loop9 is a bank.”

### C. Sector AML (UAE example — CONFIRMED framework)

UAE Cabinet Resolution No. (134) of 2025 (exec. regs of Federal Decree-Law No. 10 of 2025) defines **DNFBPs** as specific categories (gaming, real estate, DPMS, certain lawyers/accountants, TCSPs, plus any authority-designated additions) — **not** “all SaaS.”

Sources:

- [Cabinet Resolution 134/2025 (CBUAE Rulebook mirror)](https://rulebook.centralbank.ae/en/rulebook/cabinet-resolution-no-134-2025-regarding-executive-regulations-federal-decree-law-no-10)  
- [MoET DNFBP Guidelines (Mar 2026 PDF)](https://www.moet.gov.ae/documents/20121/465917/DNFBP+Guidelines+-+March+2026.pdf/6e46414b-0878-bcf0-6054-235a86336f41)  

CBUAE CDD/UBO rules (e.g. 25% beneficial ownership) apply to **licensed financial institutions** and similarly obligated entities — see [CBUAE Rulebook 3.2.2](https://rulebook.centralbank.ae/en/rulebook/322-beneficial-owner-identification) and [CDD guidance (6 Nov 2025)](https://www.centralbank.ae/media/bj5prczk/guidance-for-lfis-on-customer-due-diligence-and-record-keeping-6-november-2025.pdf).

**Loop9 implication:** Unless counsel classifies Loop9 as FI/DNFBP/VASP, **do not** implement bank-grade UBO collection as a default product gate. Banks Loop9 uses will still KYB Loop9 itself.

---

## 3. Telecom / voice unit-cost inputs (pricing)

### Twilio public list (CONFIRMED as vendor list prices; not Loop9 retail)

From [Twilio Programmable Voice — UAE](https://www.twilio.com/en-us/voice/pricing/ae) (retrieved 2026-09-16):

| Component | UAE list | Status |
|-----------|----------|--------|
| Outbound to UAE local | **$0.3635 / min** | **CONFIRMED** list |
| Outbound to UAE mobile | **$0.2995 / min** | **CONFIRMED** list |
| Receive on Twilio UAE DID | *(blank on page)* | **UNKNOWN** on public table — use Pricing API / account |
| Browser/app / SIP interface | **$0.0040 / min** each direction | **CONFIRMED** list |
| Media Streams | **$0.0044 / min** | **CONFIRMED** list |
| Conversation Relay | **$0.07 / min** | **CONFIRMED** list |
| International numbers (if no local inventory) | from **$1.00 / mo** | **CONFIRMED** “starting at” |

From [Twilio SIP Trunking — Saudi Arabia](https://www.twilio.com/en-us/sip-trunking/pricing/sa):

| Component | SA list | Status |
|-----------|---------|--------|
| Termination landline | from **$0.1698 / min** | **CONFIRMED** list |
| Termination mobile | **$0.3082 / min** | **CONFIRMED** list |
| Local SA voice-enabled DIDs | Page states voice-enabled numbers may be unavailable in-locale | **CONFIRMED** wording |

**ESTIMATE only — illustrative unit economics (not shippable prices):**

Assumptions (all **ESTIMATE**): average inbound handled minute = 2.0 min talk; STT+LLM+TTS AI stack = $0.04–$0.12 / min (**wide band**, model-dependent); Twilio Media Streams $0.0044; UAE outbound path unused for pure inbound.

| Scenario | Telecom (EST.) | AI stack (EST.) | Gross cost / call-min | Notes |
|----------|----------------|-----------------|------------------------|-------|
| Lean inbound (streams + mid AI) | ~$0.01–0.05 | ~$0.06 | **~$0.07–0.11** | Excludes DID rent, recording, QA, infra |
| Heavy (relay-class + premium AI) | ~$0.07+ | ~$0.10+ | **~$0.17+** | Conversation Relay alone is $0.07 list |

Suggested retail bands for **internal planning only** (**ESTIMATE**): 3–5× COGS for SMB SaaS, plus platform fee — **do not publish** until finance + counsel + live COGS meters exist.

Local Etisalat/du/STC/Ooredoo wholesale SIP: **UNKNOWN** in this pass (require NDAs / partner quotes).

---

## 4. Evidence-backed product design (next implementable step — not started)

When supervisor accepts voice + this research:

1. **Pricing config (local only):** country → cost components tagged `confirmed` | `estimate` | `partner_quote_required`; never hard-code Twilio list as “Loop9 price.”  
2. **Onboarding wizard:** collect layer-A business identity; optional layer-B “request DID” checklist that **links to carrier requirements** rather than inventing AML.  
3. **Jurisdiction banners:** UAE/KSA/BH/KW/OM/QA — “connectivity via licensed partners; Loop9 is not a telecom licensee unless stated.”  
4. **No auto-collect** of passport/UBO packs unless a jurisdiction profile explicitly requires it and counsel signs off.

---

## 5. Open counsel / partner checklist

- [ ] Confirm UAE go-to-market: licensee partnership vs any Class/Individual path  
- [ ] Confirm whether VVSP (KSA) applies to Loop9 vs only to Saudi-incorporated voice providers  
- [ ] Obtain written DID KYC checklists from chosen carriers per country  
- [ ] Confirm Loop9 AML classification in UAE (and each free zone) — default assumption: **not** DNFBP unless TCSP-like activities  
- [ ] Pull account-specific Twilio inbound DID + AE receive rates via Pricing API  
- [ ] Request local operator SIP quotes (Etisalat, du, stc, Batelco, Ooredoo, etc.)

---

## 6. Limitations of this pass

- No paid legal opinion.  
- Some national portals block automated fetch (e.g. my.gov.sa).  
- Secondary legal blogs not treated as CONFIRMED fee sources.  
- No live Loop9 COGS metering from production.  
- Voice metrics increment still awaits **supervisor** acceptance despite independent 78-test PASS.
