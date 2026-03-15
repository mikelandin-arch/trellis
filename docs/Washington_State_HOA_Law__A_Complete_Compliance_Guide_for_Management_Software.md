# Washington State HOA law: a complete compliance guide for management software

**Washington HOA management software must comply with four overlapping statutory regimes, and the landscape is shifting fast.** The state's legacy HOA Act (RCW 64.38) governs most existing homeowners associations today, but the Washington Uniform Common Interest Ownership Act (WUCIOA, RCW 64.90) becomes the sole governing statute for *all* communities on **January 1, 2028**—with key provisions already mandatory as of January 1, 2026. Any SaaS platform built today must support both frameworks simultaneously during this transition. This report maps every legal obligation to a concrete software feature requirement across ten compliance domains.

The four statutory regimes are RCW 64.38 (HOA Act, pre-2018 communities), RCW 64.34 (Condo Act), RCW 64.32 (Horizontal Property Regimes), and RCW 64.90 (WUCIOA, post-2018 and phasing in for all). RCW 24.03A (Nonprofit Corporation Act) layers additional governance requirements on HOAs organized as nonprofits. **ESSB 5796 (2024)** and **SB 5129 (2025)** are the landmark bills driving the transition, while **SB 5686 (2025)** overhauls foreclosure mediation for assessment collections. Software must account for community formation date, opt-in status, and size exemptions to determine which rules apply.

---

## 1. RCW 64.38 section-by-section: every requirement with software implications

RCW 64.38 is the primary statute governing legacy HOAs (formed before July 1, 2018, and not opted into WUCIOA). Below is the complete requirements mapping.

### Core governance and powers (RCW 64.38.010–.025)

**RCW 64.38.010 (Definitions)** establishes that "homeowners' association" means a corporation organized under Chapter 24.03A, and "lot" means a parcel subject to the governing documents. Software must track entity type (nonprofit vs. other) to determine which additional statutes apply.

**RCW 64.38.020 (Association powers and duties)** grants the board authority to adopt budgets, enforce governing documents, hire/discharge agents, institute litigation, and regulate common areas. Section (11) specifically authorizes levying fines "in accordance with a previously established schedule adopted by the board of directors and furnished to the owners" after providing "notice and an opportunity to be heard." Software must enforce: fine schedule management with owner distribution tracking, notice generation, and hearing workflow.

**RCW 64.38.025 (Board of directors)** contains several critical provisions:

| Subsection | Requirement | Software Feature |
|---|---|---|
| (1) | Board members must exercise the degree of care and loyalty required under RCW 24.03A | Fiduciary duty training/compliance tracking |
| (2) | Board adopts regular and special budgets | Budget creation and approval workflow |
| (3) | Within 30 days of budget adoption, board sets ratification meeting; budget summary mailed 14–60 days before meeting; budget ratified unless **majority of all allocated votes** reject it; no quorum required for ratification | Budget ratification workflow with automated notice scheduling, vote tracking against total allocated votes |
| (4) | Budget must disclose reserve balance, recommended contribution rate, and funding plan | Reserve disclosure fields in budget templates |
| (5) | Board members removable by majority of voting power present at quorum meeting | Removal vote tracking |

### Meetings (RCW 64.38.035)

This section, now supplemented by RCW 64.90.445 (effective January 1, 2026 for all communities), establishes:

**Owner/member meetings** require **14–50 days' notice** (WUCIOA; legacy was 14–60 days), delivered by first-class mail or hand delivery to each owner's address or designated alternate. Special meetings may be called by the board, president, or **10% of allocated votes**. Notice must include time, date, place, agenda items, full text of proposed amendments, budget changes, and any removal proposals.

**Board meetings** now require **14 days' notice** to all owners unless on a pre-published annual schedule (which constitutes notice). A meeting addressing an unforeseeable issue may be called with **7-day notice**. Per SB 5129, all board meetings must begin with a **minimum 15-minute owner comment period**, and all written materials provided to board members must be made available to owners.

**Open meeting requirements** mandate that all board and non-advisory committee meetings be open to owner observation. **Executive sessions** require: (1) an affirmative vote in open meeting, (2) a motion stating the specific purpose, (3) restriction of discussion to stated purpose, and (4) reconvening in open session to vote on any action. Permitted executive session topics: personnel matters, legal counsel communications, pending/likely litigation, possible governing document violations, and possible owner liability.

**Virtual meetings** are explicitly authorized under WUCIOA. No physical location required. The association must implement reasonable identity verification measures. All participants must be able to join by phone. **Email-based board voting is prohibited**—the open meeting requirement demands simultaneous communication. Board members may act by unanimous written consent only for ministerial actions, actions subject to ratification, or implementation of previously approved actions.

| Meeting Type | Notice Period | Delivery Method | Software Feature |
|---|---|---|---|
| Annual owner meeting | 14–50 days | First-class mail, hand delivery, or electronic (with consent) | Notice scheduler with period validation |
| Special owner meeting | 14–50 days | Same as above | Triggered by 10% petition or board action |
| Board meeting (scheduled) | Published annual schedule | Schedule distribution | Annual calendar publication tool |
| Board meeting (unscheduled) | 14 days | Mail or email (SB 5129 allows email without consent for board meeting notices) | Auto-notice generation |
| Board meeting (urgent) | 7 days | Electronic communication | Emergency notice dispatch |
| Budget ratification | 14–60 days after summary mailing | First-class mail | Budget workflow with mailing tracker |

### Financial records and reserves (RCW 64.38.040–.090)

**RCW 64.38.040** sets the default member meeting quorum at **34% of allocated votes** present in person or by proxy. Quorum is determined at the beginning of the meeting; members leaving do not break quorum.

**RCW 64.38.045** is the comprehensive records statute (detailed in Section 3 below).

**RCW 64.38.045(2)** requires annual financial statements. If annual assessments total **$50,000 or more**, an independent CPA audit is mandatory unless **67% of votes cast** at a quorum meeting waive the audit each year.

**RCW 64.38.065** mandates reserve studies: initial study based on visual site inspection, **annual updates**, and a **new visual site inspection at least every 3 years**. Exemptions apply for communities with ≤10 homes, no significant assets, or where the study cost exceeds 5% of the annual budget.

**RCW 64.38.070** specifies reserve study contents: component list (items >1% of annual budget), useful/remaining useful life for each component, estimated replacement cost, and three funding plans (baseline maintaining balance above $0, threshold maintaining a specified minimum, and full funding achieving 100% by end of 30-year period), plus a **30-year cash flow projection**.

**RCW 64.38.075** governs reserve withdrawals: all withdrawals must be recorded in minutes, notice delivered to each owner, and a **repayment schedule not exceeding 24 months** adopted (unless the board determines this would impose an unreasonable burden). Payments for out-of-cycle major maintenance are exempt.

Under SB 5129 (effective January 1, 2026), reserve funds must be in **interest-bearing accounts** at U.S.-regulated financial institutions. If reserves exceed **$250,000**, up to 50% may be invested in other securities (or 100% with 75% owner approval). All disbursements require **two signatures** and supporting documentation.

### Assessments and liens (RCW 64.38.100)

This is the critical collection statute, detailed fully in Section 5 below.

### Voting and proxies (RCW 64.38.120, supplemented by RCW 64.90.455)

Owners may vote by **directed or undirected proxy** with a maximum validity of **11 months**. Proxies must be dated; an undated proxy is void. Electronic voting is explicitly authorized under WUCIOA with identity verification requirements. **Secret ballots are required** for board elections, board/officer removal, declaration amendments, and reallocation of common elements. Ballots must include write-in candidate space. Current board members and candidates **cannot access ballots until after counting**.

---

## 2. How the Nonprofit Corporation Act layers on HOA governance

Most Washington HOAs are organized as nonprofit corporations, making RCW 24.03A applicable alongside RCW 64.38. **Where RCW 64.38 has more specific provisions, it controls**; where it is silent, RCW 24.03A fills the gaps.

### Additional requirements RCW 24.03A imposes

**Fiduciary duties** (RCW 24.03A.495) require directors to act in good faith, with ordinary prudence, and in the corporation's best interests. Directors must disclose material information to other board members. They may rely on officer reports, professional advice, and committee recommendations. A director is explicitly **not a trustee** of corporate property. Director liability is limited to receipt of unauthorized value, intentional misconduct, or knowing violation of law.

**Director removal** (RCW 24.03A.530) provides that members may remove directors with or without cause unless governing documents restrict removal to cause only. The board of a membership corporation **cannot remove** a member-elected director except for specific causes: court-declared unsound mind, felony conviction, failure to satisfy conflict-of-interest policy, court-found breach of fiduciary duty, excessive absences (if governing documents so provide), or failure to meet qualifications. At least **48 hours' notice** is required before any board meeting considering removal.

**Indemnification** (RCW 24.03A.630) incorporates the business corporation indemnification framework. Mandatory indemnification applies when a director was wholly successful in defense. Permissive indemnification and advance of litigation expenses are available subject to standard safeguards. D&O insurance is authorized.

**Electronic communications** (RCW 24.03A.015) are permitted by default for notices unless governing documents provide otherwise. Notice is effective when directed to an electronic address the recipient has provided.

**Action without meeting** is permitted by unanimous written consent of the board (RCW 24.03A.570) or by ballot for members (RCW 24.03A.480). Board special meetings require **48 hours' notice** under RCW 24.03A.555.

**Conflicting interest transactions** (RCW 24.03A.615) require disclosure and either approval by disinterested directors or members. Software must track conflict-of-interest disclosures.

**Annual reports** must be filed with the Secretary of State (RCW 24.03A.075). Failure to file can result in administrative dissolution. Software should track filing deadlines and compliance status.

| RCW 24.03A Requirement | Software Feature |
|---|---|
| Fiduciary duty standards | Board training compliance tracker |
| Director removal procedures | Removal workflow with cause documentation |
| Indemnification framework | D&O policy and indemnification tracking |
| Conflict-of-interest disclosures | COI disclosure management module |
| Annual SoS filing | Filing deadline reminders with status tracking |
| Electronic notice authorization | Owner communication preference management |
| 48-hour board special meeting notice | Notice period validation for board meetings |

---

## 3. Document retention schedule and member inspection rights

RCW 64.38.045 establishes comprehensive record-keeping obligations. All records are association property and may be kept in any form, including electronic.

### Complete document retention schedule

**Permanent retention (keep indefinitely):**

| Document Type | Statutory Basis | Access |
|---|---|---|
| Articles of incorporation and amendments | RCW 24.03A, 64.38.045(4)(d) | Open to member inspection |
| Declaration (CC&Rs) and amendments | RCW 64.38.045(4)(d) | Open to member inspection |
| Bylaws and amendments | RCW 64.38.045(4)(d) | Open to member inspection |
| Rules and regulations (currently in effect) | RCW 64.38.045(4)(d) | Open to member inspection |
| Minutes of all owner and board meetings | RCW 64.38.045(4)(a) | Open to member inspection |
| Board resolutions | RCW 24.03A | Open to member inspection |

**Seven-year retention:**

| Document Type | Retention Start | Statutory Basis |
|---|---|---|
| Financial statements and tax returns | Date of statement/filing | RCW 64.38.045(4)(e) |
| All contracts | Date of contract end | RCW 64.38.045(4)(h) |
| Architectural review decision materials | Date of ARC decision | RCW 64.38.045(4)(i) |
| Enforcement decision materials | Date of enforcement decision | RCW 64.38.045(4)(j) |
| Bank records, checks, invoices | Date of record | RCW 64.38.045(1) |
| Receipts and expenditure records | Date of transaction | RCW 64.38.045(4) |

**Duration-based retention:**

| Document Type | Retention Period | Statutory Basis |
|---|---|---|
| Current owner roster (names, addresses, vote allocations) | Maintain current | RCW 64.38.045(4)(c) |
| Board member and officer roster | Maintain current | RCW 64.38.045(4)(f) |
| Insurance policies | While current + reasonable period | RCW 64.38.045(4)(k) |
| Warranties | While current | RCW 64.38.045(4)(l) |
| Ballots, proxies, and voting records | **1 year** after the election/vote | RCW 64.38.045(4)(n) |
| Preforeclosure information | While account is delinquent | RCW 64.38.045(4)(o) |
| Most recent SoS annual report | Most recent on file | RCW 64.38.045(4)(g) |
| Most recent reserve study | Maintain current | RCW 64.38.045 |

### Member inspection rights

Records must be **reasonably available** for examination and copying during reasonable business hours at the association office or a mutually convenient location. The association may charge a **reasonable fee** for copies and for supervising inspection. Owners are entitled to **one free annual electronic or paper copy** of the current owner list and free copies of preforeclosure information. Before disclosing the owner list, the association must **redact addresses** of participants in the Address Confidentiality Program (RCW 40.24).

**Records that may be withheld** include: personnel and medical records, contracts being negotiated, attorney-client privileged communications, pending/likely litigation materials, individual enforcement records identifying the owner, individual account records (accessible only to that owner), and records otherwise protected by law.

Under WUCIOA provisions effective January 1, 2026, associations must **acknowledge records requests within 10 business days** and **complete production within 21 business days**.

**Penalties for noncompliance**: An owner may bring a court action to compel compliance (RCW 64.38.050), and the court may award reasonable attorney's fees to the prevailing party.

**Software requirements for records compliance:**
- Document management system with version control for governing documents
- Automated retention countdown timers with alerts before expiration
- Auto-archival and scheduled purge workflows after retention periods expire
- Searchable repository with metadata tagging (document type, date, retention class)
- Owner self-service portal for document access with role-based permissions
- Redaction engine for Address Confidentiality Program participants
- Records request tracking system with acknowledgment timestamps and deadline enforcement
- Fee calculation module for copy charges
- Free annual owner list download functionality

---

## 4. Meeting notice and voting workflow requirements

### Meeting workflow: annual/special owner meeting

The software must enforce this step-by-step process:

**Step 1 — Initiate.** Board, president, or owners holding 10% of allocated votes request a meeting. Software captures request source and validates petition threshold.

**Step 2 — Schedule.** Set meeting date within the 14–50 day notice window. System validates the date falls within the permitted range.

**Step 3 — Build agenda.** Required fields enforced: date, time, place (or virtual meeting link), all action items, full text of any proposed amendments, budget change details, and any officer/director removal proposals.

**Step 4 — Generate and distribute notices.** Multi-channel delivery: first-class mail merge to every owner's mailing address (or designated alternate), email to owners who have consented to electronic delivery, and optional posting. Track delivery confirmation. Notices must be sent 14–50 days before the meeting.

**Step 5 — Distribute materials.** All meeting materials provided to board members must also go to owners (SB 5129 requirement).

**Step 6 — Collect and validate proxies.** Verify each proxy is dated, within 11-month validity, and properly executed. Track directed vs. undirected proxies. Process identity verification per WUCIOA requirements.

**Step 7 — Verify quorum.** Real-time calculator tracking in-person attendance, validated proxies, and remote participants against the 34% threshold of total allocated votes.

**Step 8 — Open meeting.** Begin with mandatory 15-minute owner comment period. System timestamps the comment period start/end.

**Step 9 — Conduct business.** Follow agenda. For votes requiring secret ballots (elections, removal, amendments), the system separates voter identity from ballot content and prevents incumbent/candidate access until counting is complete. Write-in candidate space included on election ballots.

**Step 10 — Executive session (if needed).** Workflow enforces: open-meeting motion with stated purpose → closed session → return to open session → vote on any actions in open session. Minutes record the motion purpose and subsequent open-session vote.

**Step 11 — Generate minutes.** Template captures all actions, motions, vote tallies, executive session reference, and comment period documentation. Minutes must be made available to owners within **60 days**.

**Step 12 — Approve and archive minutes.** Submit for approval at the next meeting. Archive in permanent document storage.

### Voting workflow: election or action at meeting

**Step 1 — Determine ballot type.** Secret ballot required for: board elections, board/officer removal, declaration amendments, reallocation of common elements.

**Step 2 — Prepare ballots.** Include all candidates with write-in space. Generate paper ballots for owners who have not consented to electronic voting.

**Step 3 — Collect and verify.** Identity verification for all voters. Process proxies and absentee ballots. Track directed vs. undirected proxy votes.

**Step 4 — Verify quorum.** 34% of allocated votes (in-person + proxy + absentee + remote).

**Step 5 — Conduct vote.** Secret ballot mode separates voter identity from ballot content. Non-secret matters may use voice or show of hands.

**Step 6 — Count.** Independent counters; system enforces that incumbents and candidates have no ballot access until counting is complete. For electronic ballots, results must be reviewed and recorded publicly.

**Step 7 — Record and report.** Results documented in minutes. All ballots, proxies, and verification records archived for **1 year** per retention schedule.

### Vote-without-meeting workflow (WUCIOA)

Board authorizes the vote. Notice distributed with **minimum 14-day deadline** for ballot return. Electronic instructions provided; paper ballots sent to owners who have not consented to electronic voting. After deadline, ballots counted with secret ballot rules applied where required. Results reported to all owners.

### Budget ratification workflow

Board adopts proposed budget (including reserve disclosures). Within **30 days**, board sets ratification meeting date. Budget summary mailed **14–60 days** before the meeting. At the meeting, **no quorum is required**—the budget is ratified unless a **majority of all allocated votes** (not just those present) reject it. If rejected, the previous budget continues and the board must propose a new one.

---

## 5. Assessment collection workflow: from delinquency to foreclosure

RCW 64.38.100, as amended through 2025, establishes a mandatory step-by-step process. **Software must enforce every timeline and prerequisite before permitting the next step.**

### Phase 1 — Delinquency and first notice (Days 0–30)

When an assessment becomes past due, the association must send a **First Notice of Delinquency within 30 days** by first-class mail to the lot address, any alternate address on file, and by email if an electronic address is known. The notice must be in **English plus any language the owner has indicated as a preference**. Required statutory content includes specific preforeclosure language: "THIS IS A NOTICE OF DELINQUENCY FOR PAST DUE ASSESSMENTS... THIS NOTICE IS ONE STEP IN A PROCESS THAT COULD RESULT IN YOUR LOSING YOUR HOME." The notice must also include housing counselor referral information, the HUD telephone number and website, the statewide civil legal aid hotline, mediation information, and toll-free numbers obtained from the **Department of Commerce**.

During the **15-day protected period** after the first notice, the association may charge **only**: actual printing/mailing costs, an administrative fee of **no more than $10**, and a **single late fee of no more than $50 or 5% of the unpaid assessment, whichever is less**. No other collection actions are permitted.

### Phase 2 — Active collection (Days 45–90)

After the 15-day protected period expires, the association may begin additional collection activities: demand letters, phone contact, attorney referral, and additional late fees and interest per governing documents. Interest rates are governed by CC&Rs; if silent, the maximum under RCW 19.52.020 applies (the higher of **12% per annum** or **4 percentage points above the 26-week Treasury bill rate**). The association may record a lien with the county auditor (not required under RCW 64.38 but strongly recommended as best practice).

### Phase 3 — Second notice (Day 90+)

At or after **90 days past due**, and **not sooner than 60 days after the first notice**, a Second Preforeclosure Notice must be sent by first-class mail with the same statutory content as the first notice.

### Phase 4 — Foreclosure threshold and waiting period

The owner must owe the **greater of 3 months of assessments or $2,000** (excluding fines, late charges, interest, attorney fees, and collection costs). At least **90 days** must have elapsed since the foreclosure threshold was met (reduced from 180 days effective January 1, 2025).

### Phase 5 — Meet-and-confer and mediation (SB 5686, effective 2026)

Under the new Foreclosure Fairness Act expansion, associations must complete a **meet-and-confer process** before initiating foreclosure. Housing counselors may refer owners to mediation at any time from delinquency notice through 90 days before foreclosure sale. The association **cannot file judicial foreclosure until mediation certification is issued** (or 10 days after certification was due). Associations **cannot recover legal fees for the meet-and-confer and mediation process**.

### Phase 6 — Board authorization and foreclosure

The **board must specifically approve** commencement of foreclosure against the specific lot. Every aspect of collection, foreclosure, sale, and conveyance must be **"commercially reasonable."**

**Judicial foreclosure** (Chapter 61.12 RCW) preserves super-lien priority for condominiums. Redemption period is **8 months** (if deficiency waived) or **12 months** (if not). **Nonjudicial foreclosure** (Chapter 61.24 RCW) is available only if the declaration contains specific provisions (grant in trust, power of sale, non-agricultural use, power operative for assessment default), but **sacrifices super-lien priority** for condos.

**Statute of limitations**: **6 years** for HOAs under RCW 64.38; **3 years** for condominiums under RCW 64.34.

### Super-lien status

**HOAs under RCW 64.38 have NO super-lien priority.** Lien priority depends on governing documents and recording order. **Condominiums under RCW 64.34.364(3) have a 6-month super-lien** (assessments for the 6 months preceding sale have priority over mortgages), but this is lost if nonjudicial foreclosure is used. WUCIOA maintains a similar 6-month super-lien.

### Assessment payment requirement (SB 5129)

Effective January 1, 2026, associations must offer at least **one payment method without convenience or processing fees**.

### Software requirements for the collection workflow

- Automated aging reports and delinquency detection
- Multi-language notice template engine with Department of Commerce data integration
- Automated timeline enforcement: 30-day first notice, 15-day protected period, 60-day gap minimum, 90-day second notice
- Late fee engine enforcing $50/5% cap (whichever is less) during protected period
- Configurable post-notice late fee schedules per governing documents
- Interest accrual engine with configurable rates and RCW 19.52.020 ceiling
- Lien recording workflow with document generation and county filing tracking
- Foreclosure threshold calculator (3-month assessment vs. $2,000 comparison)
- 90-day waiting period timer from threshold date
- Meet-and-confer scheduling and tracking
- Mediation referral status tracking with foreclosure filing hold
- Board approval documentation workflow
- Judicial vs. nonjudicial pathway decision tool
- Fee-free payment method compliance
- FDCPA-compliant communication templates for third-party collections
- Full audit trail for every collection action

---

## 6. Violation enforcement: due process requirements and fine limits

RCW 64.38.020(11) establishes the enforcement framework. **Washington has no statutory dollar cap on fines**—instead, it uses a **reasonableness standard** combined with strict procedural requirements.

### Mandatory pre-fine procedure

Before any fine can be levied, the association must: (1) have a **previously established fine schedule** adopted by the board, (2) have **furnished the schedule to all owners** before violations occur, (3) provide **written notice** of the specific violation citing the exact governing document provision, and (4) provide an **opportunity to be heard** by the board or board-designated representative.

The hearing must allow the owner to attend, present evidence, and respond to allegations. The decision-maker must be impartial. Written decisions with stated reasons are required as best practice. The governing documents may provide appeal rights, and any owner may seek judicial review under RCW 64.38.050 (prevailing party may recover attorney's fees).

**Continuing violations and daily fines** are permissible subject to reasonableness. The fine schedule must specify continuing/daily amounts, and due process must occur before fines begin accruing. Courts review total accumulated fines for proportionality.

**Suspension of privileges**: Many CC&Rs authorize suspension of common area amenity access (pools, clubhouses, gyms) for delinquent or non-compliant owners. Under WUCIOA, associations cannot suspend access to limited common elements allocated to the owner's unit.

**Selective enforcement** is a recognized affirmative defense. Software must track enforcement consistency across all owners for the same rule violations to mitigate this risk.

Enforcement records must be retained for **7 years** after the decision (RCW 64.38.045(4)(j)). Records include complaints, evidence, notices, hearing documentation, decisions, and correspondence.

### Violation enforcement workflow (software must enforce)

**Step 1 — Detection and logging.** Capture source, date, reporter, violation type, location, and evidence. Flag anonymous complaints for due process issues.

**Step 2 — Investigation.** Verify violation against specific governing document provision. Check that the rule is properly adopted and not statutorily preempted. Check enforcement history for selective enforcement risk. Verify statute of limitations (6 years for contract-based claims).

**Step 3 — Courtesy notice (recommended).** Written reminder identifying the issue with a cure period (typically 10–30 days).

**Step 4 — Formal violation notice (required).** Must include: specific provision violated, description with evidence, fine amount from published schedule, hearing date/time/location, and owner's rights to appear, present evidence, and bring witnesses.

**Step 5 — Hearing (required).** Conducted by the board or designated representative. Owner presents evidence and responds. Decision-maker must be impartial. All proceedings documented.

**Step 6 — Written decision.** States reasons, cites evidence, specifies fine, identifies appeal rights and payment deadline.

**Step 7 — Appeal (if applicable per governing documents).** Review by full board, appeal body, or ADR.

**Step 8 — Compliance monitoring.** For continuing violations, recurring fines assessed per schedule with reasonableness tracking.

**Step 9 — Escalation.** Interest/late fees on unpaid fines, privilege suspension, lien, collection action, or judicial enforcement.

**Step 10 — Resolution and archival.** Close case, document compliance or payment, archive for 7 years.

---

## 7. Architectural review committee requirements and procedures

RCW 64.38 provides **minimal statutory ARC requirements**, leaving procedures largely to CC&Rs. However, specific statutory protections exist for certain modifications.

### Statutory response timelines

For **general ARC applications**, the statute does not specify a timeline—this is governed by CC&Rs (typically 30–45 days). For **EV charging station applications**, the statute imposes a **60-day deadline**: if the application is not denied in writing within 60 days, **it is deemed approved** unless the delay results from a reasonable request for additional information.

Under WUCIOA, all ARC committee decisions must be **individually approved by the board**, and committee meetings must be open to owner observation.

### Items HOAs cannot prohibit or unreasonably restrict

- U.S. flag display and flagpole installation
- Political yard signs (reasonable regulations permitted)
- Solar panels (reasonable regulations permitted)
- EV charging stations (specific statutory framework)
- Heat pump installations (SB 5973, 2024)
- Licensed child care / adult family homes (RCW 64.90.570)
- Drought/fire-resistant landscaping
- Pollinator habitat including beehives (SB 5934, 2024)
- Compost/recycling storage (WUCIOA)

ARC application fees must be **reasonable and uniformly applied**. Denials must be in writing, cite specific governing document standards, and explain the basis for rejection. Records of all ARC decisions must be retained for **7 years** after the decision.

### ARC application workflow (software must enforce)

**Step 1 — Submission.** Owner submits application with plans, specs, materials, and fee (if applicable). Review clock starts only upon complete submission.

**Step 2 — Completeness review.** If incomplete, return with missing items list; clock does not start. If complete, accept and start review timer.

**Step 3 — ARC review.** Application reviewed against published architectural standards. Statutory compliance checked for protected categories (EV, solar, flags, heat pumps, pollinator habitat). May request additional information (pauses clock per governing documents). Site visit if needed.

**Step 4 — Decision.** Approve, approve with conditions, or deny. Decision must be in writing. Denials must cite specific standards. Conditions clearly stated. Under WUCIOA, board must individually approve committee decisions.

**Step 5 — Deemed-approval check.** If deadline passes without action and governing documents have a deemed-approval clause, application is automatically approved. For EV stations: **statutory deemed approval at 60 days**. System auto-triggers status change with escalating pre-deadline warnings at 7, 3, and 1 day.

**Step 6 — Owner notification.** Written decision delivered with conditions, construction timeline, inspection requirements, or denial reasons with modification guidance and appeal rights.

**Step 7 — Construction monitoring.** Track compliance with approved plans and conditions. Schedule inspections.

**Step 8 — Completion and closure.** Final inspection, Letter of Completion if compliant. Non-compliance triggers violation enforcement workflow. Archive for 7 years.

---

## 8. Financial disclosure obligations in detail

### Annual budget

The board must adopt a budget covering revenues, expenditures, and reserves. Within **30 days** of adoption, a ratification meeting must be scheduled and a budget summary mailed to all owners. The budget must disclose: current reserve balance, recommended reserve contribution rate, and the funding plan adopted by the board. If the budget is rejected by a majority of all allocated votes, the previous budget continues.

### Reserve studies

Associations must conduct reserve studies with these requirements: initial study based on professional visual site inspection, **annual updates**, and a **new professional visual inspection at least every 3 years**. Reserve studies must include a component list (items costing >1% of annual budget), useful and remaining useful life for each component, estimated replacement costs, three funding plan options (baseline, threshold, and full funding), current and projected reserve balances, recommended contribution rates under each plan, and a **30-year cash flow projection**. Exemptions apply for communities with ≤10 homes, no significant assets, or where the study exceeds 5% of the annual budget. Owners holding **35% of allocated votes** may demand a reserve study be included in the next budget if more than 3 years have elapsed since the last professional study.

### Audit requirements

Annual financial statements are mandatory. An **independent CPA audit** is required if annual assessments total **$50,000 or more**. The audit may be waived annually by **67% of votes cast** at a quorum meeting. Associations below the $50,000 threshold are not required to obtain an audit.

### Reserve fund management

Reserve accounts must be in the association's name, at a financial institution, and **not commingled** with operating funds or any other person's funds. Under SB 5129, reserve funds must be in interest-bearing accounts. Reserves exceeding $250,000 may have up to 50% invested in other securities (100% with 75% owner approval). All disbursements require two officer/director signatures and supporting documentation. Withdrawals for purposes outside the reserve study require owner notification and a repayment schedule of ≤24 months.

### Distribution requirements

Financial statements and tax returns must be retained for 7 years and available for member inspection. Budget summaries must be mailed to all owners before ratification meetings. Minutes of all meetings (including financial decisions) must be available within 60 days. The most recent reserve study must be maintained and available.

---

## 9. 2024–2025 legislative changes reshaping HOA management

### ESSB 5796 (2024): WUCIOA becomes universal

This landmark bill repeals RCW 64.32, 64.34, and 64.38 effective **January 1, 2028**, making WUCIOA (RCW 64.90) the sole governing statute for all communities regardless of formation date. Key new requirements include mandatory fidelity insurance for all community types, enhanced secret ballot requirements, annual account reconciliation, and resale certificate standardization. Software must be designed for full WUCIOA compliance by 2028.

### SB 5129 (2025): Accelerated phase-in

This bill accelerates key WUCIOA provisions to **January 1, 2026** for all communities. The most impactful provisions: **15-minute mandatory owner comment period** at every board meeting, board materials must be shared with owners, verbal voting required at board meetings, phone participation must be available for all meetings, write-in candidate support on ballots, secret ballot counting restrictions, **at least one fee-free assessment payment method**, reserve fund investment rules with dual-signature disbursement, and expanded small community exemptions (from 12 units/$300 to **50 units/$1,000**).

### SB 5686 (2025): Foreclosure mediation expansion

Extends the Foreclosure Fairness Act to HOA/COA assessment foreclosures. Requires meet-and-confer before foreclosure, expands mediation program access, mandates multilingual delinquency notices, blocks judicial foreclosure filing until mediation certification, and prohibits recovery of meet-and-confer/mediation legal costs.

### Additional 2024 legislation

**SB 5973** prevents unreasonable denial of heat pump installations. **HB 1054** prohibits regulating occupancy by unrelated persons. **SB 5934** protects pollinator habitat including beehives. **HB 1507** requires board members to complete **fair housing training within 60 days** of taking office and every 3 years thereafter. Software must track training completion dates and renewal deadlines.

### Critical compliance timeline

| Date | Compliance Requirement |
|---|---|
| **June 6, 2024** | Heat pump, occupancy, pollinator habitat protections effective |
| **July 27, 2025** | SB 5129 and SB 5686 core provisions effective |
| **January 1, 2026** | ALL communities must comply with WUCIOA meeting, voting, payment, and reserve fund provisions |
| **January 1, 2028** | RCW 64.38 repealed; WUCIOA governs all communities exclusively |

---

## 10. Comprehensive compliance requirements matrix

This matrix maps every identified legal requirement to a software feature category.

### Governance and board management

| Legal Requirement | Statute | Software Feature |
|---|---|---|
| Board fiduciary duties (care, loyalty, good faith) | RCW 24.03A.495, 64.38.025(1) | Training compliance tracker |
| Fair housing training within 60 days, every 3 years | HB 1507 (2024) | Board member training/certification module |
| Director removal with proper notice and procedure | RCW 24.03A.530 | Removal workflow with cause documentation |
| Conflict-of-interest disclosures | RCW 24.03A.615 | COI disclosure tracking |
| Annual SoS filing | RCW 24.03A.075 | Filing deadline reminders |
| D&O indemnification tracking | RCW 24.03A.630 | Insurance policy and indemnification tracker |
| Community formation date determines applicable law | RCW 64.38, 64.90 | Multi-framework compliance engine with date-based rules |

### Meetings and notices

| Legal Requirement | Statute | Software Feature |
|---|---|---|
| Owner meeting notice: 14–50 days | RCW 64.90.445(1)(c) | Notice scheduler with period validation |
| Board meeting notice: 14 days (or published schedule) | RCW 64.90.445(2)(i), SB 5129 | Annual schedule publisher + notice automation |
| Urgent board meeting: 7-day notice | SB 5129 | Emergency notice dispatch |
| Multi-channel delivery (mail, email, hand delivery) | RCW 64.38.035, 64.90.515 | Multi-channel notice system with consent tracking |
| 15-minute owner comment period at board meetings | SB 5129 | Agenda template with mandatory comment block |
| Board materials distributed to owners | SB 5129 | Board packet distribution system |
| Open meeting requirement for board and committees | RCW 64.38.035(2), 64.90.445(2) | Meeting access management |
| Executive session workflow | RCW 64.38.035(2) | Closed session workflow with purpose logging |
| Virtual meeting with identity verification | RCW 64.90.445(1)(e) | Video/phone platform integration with ID verification |
| Phone participation available for all meetings | SB 5129 | Dial-in capability tracking |
| Minutes available within 60 days | RCW 64.38.035(1) | Minutes drafting/approval/distribution workflow |
| Verbal votes at board meetings | SB 5129 | Vote recording system (voice, not email) |

### Voting and elections

| Legal Requirement | Statute | Software Feature |
|---|---|---|
| 34% quorum (default) | RCW 64.38.040, 64.90.450 | Real-time quorum calculator |
| Proxy voting with 11-month maximum, date required | RCW 64.38.120, 64.90.455 | Proxy management with validation |
| Electronic voting with identity verification | RCW 64.90.455 | Electronic ballot system with authentication |
| Secret ballots for elections, removal, amendments | RCW 64.90.455, SB 5796 | Secret ballot engine (identity separated from vote) |
| Write-in candidate space on election ballots | SB 5129 | Ballot template with write-in fields |
| Board members/candidates excluded from ballot handling | SB 5129 | Role-based ballot access controls |
| Paper ballots for non-electronic-consent owners | RCW 64.90.455(4) | Dual-track ballot generation |
| Budget rejection requires majority of ALL votes | RCW 64.38.025(3) | Vote threshold calculator per action type |
| Audit waiver requires 67% of votes cast | RCW 64.38.045(2) | Configurable threshold voting |
| 1-year ballot/proxy retention | RCW 64.38.045(4)(n) | Election record archival with auto-purge |

### Financial management

| Legal Requirement | Statute | Software Feature |
|---|---|---|
| Annual budget with reserve disclosures | RCW 64.38.025(3)–(4) | Budget builder with reserve integration |
| Budget ratification workflow (30-day → 14–60 day) | RCW 64.38.025(3) | Multi-step budget workflow with deadline tracking |
| Reserve study: annual update, 3-year professional | RCW 64.38.065 | Reserve study scheduling and tracking |
| 30-year cash flow projection in reserve studies | RCW 64.38.070 | Reserve planning module |
| CPA audit if assessments ≥$50,000 | RCW 64.38.045(2) | Audit requirement flag and tracking |
| Separate operating and reserve accounts | RCW 64.38.045(3) | Multi-account fund tracking |
| Interest-bearing reserve accounts | SB 5129 | Investment tracking |
| Two signatures + documentation for reserve disbursements | SB 5129 | Dual-approval workflow |
| 50% investment cap ($250K+ reserves) | SB 5129 | Investment allocation compliance monitoring |
| 7-year retention of financial records | RCW 64.38.045(4)(e) | Automated retention management |
| Reserve withdrawal notification + 24-month repayment | RCW 64.38.075 | Withdrawal workflow with repayment tracking |

### Assessments and collections

| Legal Requirement | Statute | Software Feature |
|---|---|---|
| First delinquency notice within 30 days, multilingual | RCW 64.38.100(1)(a) | Auto-notice with multi-language templates |
| 15-day protected period: $10 admin fee + $50/5% late fee cap | RCW 64.38.100(1)(b) | Hard caps during protected period |
| Second notice at 90+ days, 60+ days after first | RCW 64.38.100(2)(b) | Timer-enforced second notice |
| Interest capped at RCW 19.52.020 maximum | RCW 19.52.020 | Dynamic interest rate engine |
| Foreclosure threshold: 3 months or $2,000 (greater of) | RCW 64.38.100(2)(a) | Threshold calculator |
| 90-day waiting period after threshold met | RCW 64.38.100(2)(c) | Countdown timer |
| Meet-and-confer before foreclosure | SB 5686 (2025) | Pre-foreclosure mediation workflow |
| Mediation certification required before judicial foreclosure | SB 5686 (2025) | Foreclosure hold pending certification |
| Board-specific approval for each foreclosure | RCW 64.38.100(2)(e) | Board resolution tracking per lot |
| At least one fee-free payment method | SB 5129 | Payment processing compliance |
| Preforeclosure notice with statutory language | RCW 64.38.100(1) | Notice template with required legal text |
| Dept. of Commerce contact information in notices | RCW 64.38.100(1) | Data integration for current phone/web info |
| 6-year statute of limitations (HOA) | RCW 4.16.040 | SOL tracking per assessment |

### Enforcement and violations

| Legal Requirement | Statute | Software Feature |
|---|---|---|
| Previously established fine schedule, furnished to owners | RCW 64.38.020(11) | Fine schedule management with distribution tracking |
| Written notice of specific violation before fine | RCW 64.38.020(11) | Violation notice template generator |
| Hearing opportunity before board or designee | RCW 64.38.020(11) | Hearing scheduling and documentation system |
| Fines must be reasonable | Case law, RCW 64.38.020(11) | Reasonableness tracking and comparison tools |
| Consistent enforcement across owners | Selective enforcement defense | Enforcement consistency dashboard |
| 7-year retention of enforcement materials | RCW 64.38.045(4)(j) | Case file archival with retention countdown |
| Privilege suspension (amenity access) | CC&Rs, WUCIOA limits | Access permission management tied to compliance status |

### Architectural review

| Legal Requirement | Statute | Software Feature |
|---|---|---|
| 60-day EV station application deemed approval | RCW 64.38 (EV provisions) | Auto-approval trigger with deadline alerts |
| ARC decisions in writing | Statutory (EV) + best practice | Decision letter generator |
| Cannot prohibit protected modifications | Various (flags, solar, EV, heat pumps, pollinators) | Protected-category alert system |
| 7-year retention of ARC decision materials | RCW 64.38.045(4)(i) | ARC file archival |
| Reasonable, uniform application fees | RCW 64.38 (EV provision by analogy) | Fee schedule management |
| Board approval of committee decisions (WUCIOA) | SB 5796, WUCIOA | Board approval integration for ARC decisions |
| Consistency with prior similar decisions | Reasonableness standard | Prior decision search and comparison |

### Records and document management

| Legal Requirement | Statute | Software Feature |
|---|---|---|
| Permanent retention: governing documents, minutes | RCW 64.38.045(4) | Permanent document vault with version control |
| 7-year retention: financials, contracts, ARC, enforcement | RCW 64.38.045(4) | Retention countdown and auto-archival |
| 1-year retention: ballots and proxies | RCW 64.38.045(4)(n) | Election record lifecycle management |
| Records available for member inspection | RCW 64.38.045(5) | Owner self-service document portal |
| 10-day acknowledgment, 21-day production (WUCIOA) | RCW 64.90.495 | Records request tracker with SLA enforcement |
| Reasonable copy fees | RCW 64.38.045(8) | Fee calculation module |
| Free annual owner list | RCW 64.38.045(8)(b) | Owner list download with ACP redaction |
| Address Confidentiality Program redaction | RCW 64.38.045(7) | ACP flag and automatic redaction |
| Electronic records permitted | RCW 64.38.045(1) | Cloud-based document management |
| Withholdable records (attorney-client, personnel, etc.) | RCW 64.38.045 | Access control with exemption categories |

---

## Conclusion: building for the WUCIOA future

The most consequential finding for software architecture is the **mandatory transition to WUCIOA by January 1, 2028**. Building a platform exclusively around RCW 64.38 would create technical debt that becomes worthless in under two years. The optimal approach is to build the compliance engine around **RCW 64.90 (WUCIOA) as the primary framework** while supporting RCW 64.38 legacy rules as a compatibility layer that can be sunset.

Three architectural decisions deserve immediate attention. First, the **multi-framework compliance engine** must determine which rules apply to each community based on formation date, size, assessment level, and opt-in status—this is not optional complexity but a legal necessity. Second, the **collection workflow** is the highest-liability area, given the detailed statutory timelines, mandatory preforeclosure notices, new mediation requirements under SB 5686, and the potential for foreclosure challenges if any step is missed. Third, the **meeting and voting infrastructure** must be ready for January 1, 2026, when the SB 5129 requirements (15-minute comment periods, board packet transparency, secret ballot controls, write-in candidate support) become mandatory for all communities.

Washington's HOA regulatory environment is among the most prescriptive in the nation and actively evolving. The Legislature has passed major HOA bills in every recent session, and law firms universally advise that more changes are coming. The software platform's compliance rules engine must be designed for rapid updates—hardcoding any specific timeline, dollar threshold, or procedural step would be a critical design mistake.