# Board governance and meeting management specification for HOA SaaS

**No existing HOA management platform offers an integrated meeting-to-governance lifecycle.** This specification defines a comprehensive board governance module that fills the market's most significant gaps: end-to-end meeting management, state-aware compliance automation, electronic voting with a full 51-jurisdiction legal matrix, and structured board governance workflows. The platform starts with Talasera HOA under Washington State law (RCW 64.38, transitioning to WUCIOA by 2028), then scales nationwide. Competitive analysis of nine platforms—AppFolio, Buildium, CINC Systems, TownSq, RunHOA, PayHOA, Condo Control, HOALife, and SmartWebs—confirms that **zero current platforms offer term tracking, meeting-to-action-item linking, annual meeting packet generation, or executive session compliance workflows**. This specification covers all nine capability areas and positions the platform for clear differentiation.

---

## 1. Meeting management workflow specification

### Agenda builder interface

The agenda builder provides a drag-and-drop visual editor with per-item time allocations and a running countdown total. Each agenda item carries a type classification—**Action Item**, **Discussion**, or **Information Only**—and supports file attachments (proposals, budgets, contracts). Standing items auto-populate from templates, and tabled items roll forward from prior meetings automatically.

Five meeting-type templates are required, each pre-loaded with state-mandated sections:

| Template | Required sections |
|----------|------------------|
| **Annual meeting** | Call to order, quorum verification, prior minutes approval, financial report, budget ratification, board elections, old business, new business, owner comment period, adjournment |
| **Board meeting** | Call to order, quorum verification, prior minutes approval, officer/committee reports, financial review, old business, new business, owner comment period (Nevada requires comment at both start AND end per NRS 116.31083(5)), executive session motion if needed, adjournment |
| **Special meeting** | Call to order, quorum verification, statement of purpose (single topic), discussion, vote, adjournment |
| **Committee meeting** | Call to order, scope review, report items, recommendations to board, adjournment |
| **Executive session** | Motion to enter (from open session), permitted-topics checklist (state-specific), return to open session, report of actions taken |

The state rules engine auto-populates required items based on the association's jurisdiction. Washington's SB 5129/RCW 64.90 mandates a minimum **15-minute owner comment period** at board meetings. The system enforces this by inserting a non-removable comment block into WA board meeting agendas.

### Notice distribution with state-specific timing

A **compliance calendar engine** auto-calculates send-by dates based on configurable state rules. The system displays "earliest send" and "latest send" markers on a visual calendar and fires amber alerts at 7 days before deadline and red alerts at 3 days.

| State | Annual/member meeting | Board meeting | Special meeting | Key statute |
|-------|----------------------|---------------|-----------------|-------------|
| **Washington** | 14–50 days | Per bylaws (WUCIOA: posted schedule or 14 days) | 14–50 days | RCW 64.38.035 / RCW 64.90.445 |
| **California** | 10–90 days (30 if election ballots included) | 4 days minimum | 4 days (board); member meetings per Corp Code | Civil Code §4920; Corp Code §7511 |
| **Florida** | 14 days continuous posting + mail/electronic | 48 hours posted | 14 days for special assessments/rule changes | F.S. 720.306, 718.112 |
| **Texas** | 10–60 days by mail; 144 hours posted/email | 144 hours (regular); 72 hours (special) | 72 hours | Property Code §209.0051 |
| **Colorado** | 10–50 days | Per bylaws | 10–50 days | CCIOA §38-33.3-308 |
| **Arizona** | 10–50 days | 48 hours posted | Same as regular | ARS §33-1804, §33-1808 |
| **Nevada** | 15–60 days | 10 days minimum | 15–60 days after petition | NRS 116.3108, 116.31083 |

Multi-channel distribution supports email (with open/delivery tracking), postal mail via print-and-mail API integration (Lob or Click2Mail), website posting, and physical posting confirmation with timestamped photo upload. A **notice content validator** checks that required elements—agenda text, amendment language, assessment details—are present before allowing distribution. The system maintains a complete audit trail of when notices were sent, by which method, and to whom.

### RSVP tracking and quorum calculation

The platform tracks quorum in real time across multiple attendance channels. A live dashboard shows total eligible voters, in-person count, virtual attendees, proxies received, and absentee ballots received. Quorum thresholds are configurable per vote type and pulled from the association's governing documents.

Typical quorum structures the system must support: **board meetings** require a majority of directors (e.g., 3 of 5); **regular member business** ranges from 10% to 50% depending on bylaws; **CC&R amendments** typically require 51–67% of all owners; and **special assessments** follow governing document thresholds. The system handles California's reconvened meeting rule (AB 2458: quorum drops to **20%** for reconvened director elections) and Florida's 30% statutory cap for member meeting quorum.

A digital check-in system uses QR code scanning for in-person attendees and auto-detection for virtual participants. When quorum is reached, a prominent visual indicator fires. If quorum fails, the system triggers an adjournment workflow with state-appropriate reconvened meeting scheduling.

### Minutes recording

Minutes templates use structured fields rather than free text. Each agenda item captures: presenter name, discussion summary, exact motion text, mover/seconder, and vote result (For/Against/Abstain with individual roll-call tracking). **Nevada and Florida require individual director votes to be recorded**; the platform makes this the default everywhere as best practice.

The system supports AI-assisted transcription from audio/video recordings to pre-populate draft minutes. A dedicated motion-tracking widget captures exact motion language, mover, seconder, and vote count with a single interaction. Minutes flow through a **Draft → Review → Approve** workflow with board member e-signatures, automatic PDF generation, and version control with diff tracking between draft and approved versions.

State-specific turnaround requirements: Nevada requires minutes available within **30 days**; California within **30 days** (summary/draft); Washington within **60 days** (RCW 64.38.035) or **10 business days** (WUCIOA); Hawaii within **7 calendar days** after approval.

---

## 2. Meeting recording requirements across states

### Only Nevada mandates association-initiated audio recording

Research reveals that **Nevada (NRS 116.31083) is the only state requiring HOAs to audio record all board meetings**, with indefinite retention (until community termination). Recordings must be provided to owners in electronic format at no charge within 30 days. Executive sessions must NOT be recorded.

**Important correction to project assumptions**: The task referenced a Washington State requirement for 6-month minimum audio/video recording retention. After thorough statutory research, **no such WA requirement exists in RCW 64.38 or RCW 64.90**. Washington statutes focus on written minutes as the official record. Some WA associations voluntarily record meetings, but this is not mandated. The platform should support configurable recording retention policies regardless.

Florida's HB 913 (effective July 2025) adds a requirement that **virtual meetings must be audio/video recorded and retained for 1 year**. This applies to both HOAs (Chapter 720) and condominiums (Chapter 718). California, Texas, Colorado, and Arizona have no recording mandates—they focus exclusively on written minutes.

### Recording storage architecture

The platform needs tiered cloud storage: hot storage (S3 Standard) for recordings under 90 days, warm storage (S3 Infrequent Access) for 90 days to 1 year, and cold storage (S3 Glacier) beyond 1 year. Audio-only recordings consume approximately **120 MB per meeting** (MP3 128kbps, 2-hour meeting); video at 1080p requires approximately **5 GB per meeting**. At scale with 10,000 associations, audio-only storage grows at roughly **20 TB/year**; video grows at **360–600 TB/year**.

The system should automatically transcode uploads to efficient formats (Opus for audio, H.265 for video), apply state-based retention lifecycle rules (Nevada: never auto-delete; Florida virtual: 1-year minimum), and run speech-to-text processing (AWS Transcribe or Whisper) to generate searchable transcripts that accelerate minutes creation. A legal hold feature prevents deletion of recordings related to pending litigation.

---

## 3. Virtual and hybrid meeting support

### Post-COVID, virtually every major state permits virtual HOA meetings

The platform must support virtual meetings as a first-class feature. Washington explicitly allows virtual meetings under both RCW 64.38.035(5) and RCW 64.90.445(3), requiring that notice describe the conferencing process and how owners can participate. California's AB 648 (effective January 2024) permits fully virtual board meetings, though **ballot counting for elections requires a physical location**. Florida, Texas, Nevada, Colorado, Arizona, North Carolina (HB 320, 2021), and Illinois (HB 4049) all explicitly permit virtual meetings. The only universal restriction is that California prohibits purely virtual ballot-counting sessions for elections.

### Video conferencing integration architecture

Rather than maintaining three separate platform integrations, the recommended architecture uses a **unified meeting API service** (such as Recall.ai or Nylas Notetaker) that provides a single API for Zoom, Teams, and Google Meet. This handles bot-based meeting recording across all platforms, automatic transcription with speaker diarization, calendar-triggered bot deployment, and webhook notifications for meeting lifecycle events.

For direct integration, the Zoom REST API is most feature-rich for HOA use: it supports meeting creation/scheduling, participant management, recording retrieval, and attendance reports. The Meeting SDK can embed Zoom directly into the platform UI. Microsoft Teams integration via Graph API requires Entra ID registration and cross-tenant permission management—substantially more complex. Google Meet's REST API creates meeting spaces and retrieves post-meeting artifacts but lacks real-time stream access.

### Hybrid meeting features

The platform supports simultaneous in-person and virtual attendance with: dual attendance tracking (QR code check-in for in-person, auto-detection for virtual, merged into unified quorum count), shared screen display for both channels, chat moderation for virtual attendee questions, unified voting that works on both mobile devices (in-person) and platform polls (virtual), and a single recording capturing both room and virtual audio. Per California AB 648, notices must include a phone number and email for technical support available before and during meetings.

---

## 4. Voting and elections system

### Board member election workflow

The platform supports three nomination models, configurable per association. **Open self-nomination** allows any eligible homeowner to submit via the member portal during the nomination window; the system auto-validates eligibility against dues status, ownership tenure, and other configurable criteria. California law (Civil Code §5105) mandates that HOAs allow self-nomination and that nominating committees cannot reject qualified candidates. **Petition-based nomination** provides digital petition forms with real-time signature counters and deadline enforcement. **Committee-nominated** slates are submitted via admin panel but must coexist with self-nominations where required.

A **nomination timeline engine** manages configurable milestones: nomination open → nomination close (typically 30–60 days before election) → ballot distribution → voting deadline → counting meeting. California requires an approximately **100-day election cycle** for director elections.

Ballot design supports five voting methods: **plurality** (most common; voters select up to N candidates for N seats), **cumulative** (voters distribute N votes among candidates, including stacking), **ranked choice** (instant runoff elimination), **weighted** (proportional to ownership interest), and **acclamation** (uncontested elections declared without balloting, permitted in California). The ballot UI displays candidate cards with photo, name, and expandable statement, enforces selection limits with clear error messages, warns on under-voting, and presents a review screen before final submission.

### Inspector of elections

California Civil Code §5110 mandates appointment of 1 or 3 **independent third-party inspectors** who cannot be current board members, candidates, employees, or contractors. Nevada requires an independent third party or election committee for contested elections. Washington's WUCIOA requires that incumbent board members and candidates cannot access ballots. The platform provides a dedicated Inspector Portal with voter eligibility verification, challenged ballot review, count initiation controls, digital certification, and comprehensive audit log viewing.

### CC&R amendment thresholds

The default supermajority threshold across most states is **67% (two-thirds)** of all voting members, not just those present. The system stores each association's specific threshold from its governing documents and applies state statutory defaults when documents are silent.

| State | Default/typical threshold | Key statute |
|-------|--------------------------|-------------|
| California | Majority of all members (§4270(b)); 67% typical in CC&Rs; court petition available if >50% approve but threshold not met | Civil Code §4270 |
| Washington | Per governing documents; transitioning to WUCIOA standard | RCW 64.38 / RCW 64.90 |
| Florida | 67% of all voting interests; max 80% for post-1992 condos | §720.306, §718.110 |
| Texas | Per governing documents; 67% common | Property Code Ch. 209 |
| Colorado | 67% unless otherwise stated | CCIOA §38-33.3-217 |
| Arizona | Per governing documents; 67% standard | ARS §33-1227 |
| Nevada | Per governing documents; 67% common | NRS 116.2117 |

### Special assessment votes

California requires membership approval for special assessments exceeding **5% of budgeted gross expenses** (Civil Code §5605), with a majority-of-quorum threshold. Texas requires written and signed ballots for assessment votes (Property Code §209.0058). Nevada requires membership approval for certain large assessments. Florida and Colorado leave it to governing documents. The platform flags assessment votes requiring membership approval based on the configured state and threshold percentage.

### Proxy management

The proxy system supports **general proxies** (holder votes at discretion) and **limited/directed proxies** (member pre-specifies votes per item). Florida's Condo Act (§718) requires limited proxies for substantive votes. Electronic proxy designation flows through: member selects proxy type → identifies proxy holder → signs electronically → system validates holder eligibility and proxy-count limits → confirmation sent to both parties. Proxies are revocable until the vote is cast; attending or voting in person supersedes a proxy. California makes secret ballots irrevocable once received by the inspector (§5120(a)).

Configurable proxy-holding limits prevent abuse: numerical caps (e.g., maximum 5 proxies per holder), percentage caps (e.g., maximum 10% of total votes), or no limit. The system flags board members holding proxies with a conflict-of-interest warning. Proxy expiration follows state rules: **90 days** in Florida, **11 months** as the common default, and **180 days** in Hawaii.

---

## 5. Electronic voting state-by-state legality matrix

### 31 states explicitly permit electronic HOA voting; zero states prohibit it

The research reveals a clear trend: **no US state explicitly prohibits electronic voting for HOA matters**, while 31 states (plus partial authorization in Washington and DC) have enacted affirmative authorization. The remaining 19 states are silent—meaning electronic voting is neither authorized nor forbidden, creating legal ambiguity that associations should address with legal counsel. The 2024–2025 legislative cycle brought major expansions: California's AB 2159 authorized electronic secret balloting for the first time (effective January 1, 2025), Massachusetts' Affordable Homes Act added condominium e-voting authorization (August 2024), and Pennsylvania's Act 115 of 2022 comprehensively authorized electronic ballots effective May 2023.

### Complete 51-jurisdiction matrix

| Jurisdiction | Status | Key statute | Notable requirements |
|---|---|---|---|
| **Alabama** | Silent | AL Code §10A-3-2.05 | Nonprofit statute allows proxy/mail voting only |
| **Alaska** | Silent | AK Stat §10.20.071 | Remote meeting participation but no electronic ballot authorization |
| **Arizona** | **Permits** | ARS §10-3708; §33-1812 | Must authenticate identity, authenticate ballot validity, transmit receipt, store for recount; must still offer in-person and absentee options |
| **Arkansas** | Silent | Ark. Code Ann. §4-28 | Practiced by some associations without statutory backing |
| **California** | **Permits** (eff. Jan 2025) | Civil Code §§5100–5260 (AB 2159) | Electronic secret balloting for elections and amendments; **excludes assessment votes** (paper only); 120-day implementation timeline; inspector of elections required; member opt-out right |
| **Colorado** | **Permits** (implicit) | CCIOA §38-33.3-310; Nonprofit Act §7-127-202 | CCIOA silent but does not preclude; nonprofit act allows electronic proxy and transmissions; secret ballots required for contested elections |
| **Connecticut** | **Permits** | Conn. Gen. Stat. §47-252 | Electronic/paper ballot for votes without a meeting unless declaration/bylaws prohibit |
| **Delaware** | **Permits** | Title 25, §81-310 (DE UCIOA) | Electronic ballot for any member action unless declaration/bylaws prohibit |
| **DC** | **Limited** | DC NPCL §29-405.01(e) | Electronic voting only during declared public health emergencies |
| **Florida** | **Permits** | §720.317 (HOAs); §718.128 (condos) | Board resolution required; must authenticate identity, confirm device compatibility 14 days before deadline, transmit receipt, permanently separate identity from ballot; written/electronic consent required; 25% petition right for condos |
| **Georgia** | **Permits** | Title 14, §14-3-704 | Action without meeting by electronic consent if majority of voting power consents |
| **Hawaii** | **Permits** (restricted) | HRS §514B (condos) | Device must be **isolated from internet**; printed audit trail required; effectively prohibits web-based voting for condominiums |
| **Idaho** | Silent | No specific statute | Not listed in CAI compilation |
| **Illinois** | **Permits** | 765 ILCS 160/1-25(i) | Board must adopt rules; instructions distributed 10–30 days before election; write-in votes allowed; members may void electronic vote by voting in person; **no proxy voting in board elections** |
| **Indiana** | Silent | IN Code §32-25.5-3-10 | Electronic proxy submission allowed; no electronic ballot authorization |
| **Iowa** | Silent | Iowa Code §499B; HF 2442 | Board directors cannot vote by proxy or secret ballot (except officer elections) |
| **Kansas** | **Permits** | K.S.A. §58-4614 | Electronic or paper ballot for votes without a meeting; must verify ballots cast by entitled owner |
| **Kentucky** | Silent | KRS Chapter 273 | Mail voting for elections if bylaws provide; no electronic authorization |
| **Louisiana** | Silent | LA Nonprofit Corp Law | No electronic voting statute identified |
| **Maine** | **Permits** | 13-B MRSA §604 | Bylaws may provide for electronic elections; board/member determination for other votes |
| **Maryland** | **Permits** | Real Property §11-139.2 | Board authorization required; if secret ballot required and e-anonymity cannot be guaranteed, must also offer printed ballots |
| **Massachusetts** | **Permits** (eff. Aug 2024) | G.L. c.183A §24 (H. 4977) | Governing body may allow e-voting; overrides contrary provisions in master deed/bylaws |
| **Michigan** | **Permits** (limited) | §§450.2407, 450.2441 | Bylaws must provide for electronic transmission voting; electronic consent not "delivered" until reproduced in paper form |
| **Minnesota** | **Permits** (limited) | Minn. Stat. §515B.3-110(c) | Electronic voting for any single issue **except director elections**; 15–45 day voting period |
| **Mississippi** | Silent | MS Condo Law | No electronic voting statute identified |
| **Missouri** | Silent | RSMo §448; Chapter 355 | No electronic voting statute identified |
| **Montana** | **Permits** | §35-2-533; UCIOA §3-110 | Member must consent to receive electronic ballot; consent to electronic notice = consent to electronic ballot |
| **Nebraska** | Silent | NE Nonprofit Corp Act | No electronic ballot authorization |
| **Nevada** | **Permits** | NRS 116.311; 116.31034 | Most comprehensive framework: must authenticate identity, ensure ballot secrecy, send receipt, store for recount; paper ballot + prepaid return envelope for opt-out owners; 15-day minimum return period; 2023 amendments (AB 341) expanded provisions |
| **New Hampshire** | Silent | NH RSA 292 | No electronic ballot authorization |
| **New Jersey** | **Permits** | A3802/S1293 | Electronic ballot option for board elections; ballot counted as proxy for quorum |
| **New Mexico** | Silent | §47-16-1 et seq. | No electronic voting statute |
| **New York** | **Permits** | BCL §602(iii); NPCL §603 | Reasonable measures to verify identity required; record of electronic votes maintained |
| **North Carolina** | **Permits** | NCGS §55A-1-40(26); HB 320 (2021) | "Vote" definition includes electronic voting system and electronic ballot; reasonable measures for virtual participation |
| **North Dakota** | **Permits** | N.D. Cent. Code §10-33-74 | Electronic/paper ballot; deadlines must be identical; electronic transmission must be verifiably authorized |
| **Ohio** | **Permits** | Ohio Rev. Code §1702.25 | Electronic ballot for votes without a meeting; identity verification required |
| **Oklahoma** | Silent | General nonprofit law | No electronic voting authorization |
| **Oregon** | **Permits** | ORS 94.661; ORS 100.428 | Board discretion to offer electronic ballots unless governing docs prohibit; **board members cannot vote electronically** (open meeting requirements); if 10%+ owners request secret ballot, e-voting only if secret e-ballot procedures exist |
| **Pennsylvania** | **Permits** | 68 Pa.C.S. §§3310(e), 4310(e), 5310(e) (Act 115 of 2022) | Comprehensive authorization effective May 2023; identity confirmation required; in-person vote supersedes electronic; **500+ unit associations must use independent reviewer** |
| **Rhode Island** | Silent | §34-36.1 | Statutes "sparse or silent" on voting mechanics |
| **South Carolina** | **Permits** | S.C. Code §33-31-708 | Electronic ballot for any action that could be taken at meeting; generally irrevocable |
| **South Dakota** | Silent | SDCL Ch. 47-28 | No electronic ballot authorization |
| **Tennessee** | **Permits** (limited) | T.C.A. §48-57 (Nonprofit Act) | Remote communication participation including voting at meetings; not standalone electronic ballots |
| **Texas** | **Permits** | Prop. Code §209.00592; §209.0058 | Electronic ballot = email/internet with receipt; legally equivalent to "written and signed"; supersedes contrary governing documents; established since 2011 |
| **Utah** | Silent | §57-8a; §57-8 | No electronic voting authorization |
| **Vermont** | **Permits** | 27A V.S.A. §3-110 (UCIOA) | Electronic/paper ballot for votes without a meeting unless declaration/bylaws prohibit |
| **Virginia** | **Permits** | Va. Code §55.1-1832; §55.1-1953 | Broad authorization (HB 1816, 2021); must protect identity for secret ballots; **must provide reasonable alternative at association's expense** for non-electronic voters |
| **Washington** | **Permits/Transitional** | RCW 64.90 (WUCIOA); RCW 64.38 (silent) | WUCIOA explicitly authorizes electronic participation; RCW 64.38 is silent; **all WA HOAs transition to WUCIOA by January 1, 2028** (ESSB 5796); secret ballots required for elections/amendments; ballots must be opened/counted at noticed meeting |
| **West Virginia** | Silent | §36B-1-101 et seq. | No electronic voting authorization |
| **Wisconsin** | Silent | §703; Ch. 181 | No electronic ballot authorization |
| **Wyoming** | Silent | §17-19 | No electronic voting authorization |

### Platform implications for the state matrix

The state rules engine must classify each jurisdiction and enforce the correct behavior. For **"Permits" states**, the platform enables full electronic voting with state-specific guardrails (e.g., California excludes assessment votes; Minnesota excludes director elections; Hawaii prohibits internet-connected devices). For **"Silent" states**, the platform displays a compliance warning recommending legal counsel review before enabling electronic voting, and requires an admin acknowledgment. The system should track governing document provisions that may authorize electronic voting even in silent states.

### Electronic voting security requirements

**Authentication** uses unique credentials per voter (one-time access codes distributed via email or mail), with optional multi-factor authentication via SMS/email verification codes. **Ballot secrecy** permanently separates voter identity from ballot content at the database level—the authentication table and ballot table share no foreign key once a vote is cast. No administrator, inspector, or database query can link a specific voter to their ballot selections.

The **audit trail** logs timestamped records of voter authentication, ballot submission, system events, and administrative actions. In secret ballot mode, the audit trail records that voter X submitted a ballot at timestamp Y but never records ballot content. Audit logs are immutable (append-only with cryptographic hash chain). **Tamper prevention** uses TLS 1.3 in transit, AES-256 at rest, digital signatures on ballot submissions, and ballot immutability after submission. The platform targets SOC 2 Type II compliance and annual third-party penetration testing.

**Ballot design** follows mobile-first progressive disclosure: one question per screen on mobile, scrollable on desktop. The interface includes candidate cards with photos and expandable statements, selection feedback with visual checkmarks, over-vote prevention, under-vote warnings, a full review screen before submission, and a confirmation receipt with tracking number. **WCAG 2.2 Level AA** accessibility compliance is mandatory: screen reader compatible, full keyboard navigation, high contrast mode, 200% text zoom support, and never using color alone to convey information. Multi-language support covers English, Spanish, Chinese (Simplified/Traditional), Vietnamese, Korean, and Tagalog.

---

## 6. Board member management and succession

### Term tracking system

The data model stores board member seat number, term start/end dates, term sequence number, election/appointment date, and appointment type (elected/appointed/interim). A **staggered-term Gantt chart** visualizes overlapping terms across all seats with color-coding by term group. Term limits are configurable per governing documents with override capability (some bylaws allow re-election after a gap).

Automated notifications fire at five milestones: **180 days** before expiration (alert to form nominating committee), **120 days** (solicit candidates), **90 days** (trigger election preparation workflow), **60 days** (transition planning notification to outgoing member), and **30 days** (final transition reminder). No competitor offers this capability—it represents a significant competitive differentiator.

### Officer roles and permissions

Role-based access control assigns granular permissions across modules: Financial Records, Meeting Minutes, Homeowner Records, Violations, Architectural Requests, Communications, Executive Session Documents, and Vendor Contracts. Each permission level supports None/Read/Read+Write/Full (including delete/approve). The President gets full admin access; the Treasurer gets full financial access; the Secretary manages minutes, records, and correspondence; Vice President mirrors the President when acting in their absence; Members-at-Large receive read access to all non-executive items plus voting rights.

Role-based dashboards surface the most relevant information per officer: the **President's dashboard** shows pending approvals, upcoming meetings, action item summaries, and community health metrics. The **Treasurer's dashboard** displays account balances, delinquency rates, budget-versus-actual, and collection rates. The **Secretary's dashboard** highlights pending minutes approvals, meeting prep status, and the correspondence log.

### New board member onboarding

A structured checklist tracks progress across five categories: document access (governing docs, financials, contracts, insurance), training materials (fiduciary duty, Robert's Rules, Fair Housing, state law), platform orientation (account setup, 2FA, mobile app), key contact introductions (attorney, management company, vendors), and governing document review with digital acknowledgment signatures. Progress displays as a percentage with automated reminders for incomplete items and a 30-day target completion window.

### Vacancy and succession workflow

When a board member resigns, is removed, or becomes incapacitated, the system triggers a vacancy workflow. Configurable filling methods include board appointment until the next annual meeting, special election within a configurable number of days, or automatic elevation (VP to President). The system tracks interim appointments separately, preserves the original term's end date, and automatically transfers access permissions from outgoing to incoming members.

---

## 7. Executive session documentation with state-specific compliance

### What the law permits in executive session

Executive session topics are strictly limited by statute and vary significantly by state. **Washington** (RCW 64.38.035, transitioning to RCW 64.90.445) permits discussion of personnel matters, legal counsel consultation, likely/pending litigation, possible governing document violations, and possible owner liability to the association. **No final vote or action may be taken during executive session**—the board must reconvene in open meeting to vote.

**California** (Civil Code §4935) allows the broadest scope: litigation, personnel, member discipline, delinquent homeowner payment plans, foreclosure decisions, and contract formation with third parties. **Florida** is the most restrictive major state—only attorney consultation regarding pending/threatened litigation and personnel matters are permitted (§720.303(2)(b)). **Texas** adds contract negotiations, enforcement actions, and matters whose disclosure would invade individual owner privacy.

**Universally prohibited** in executive session across all states: budget discussions, assessment increases, officer/director elections, rule adoption or amendment, general association business, and capital improvement decisions.

### Software implementation for executive sessions

The platform implements a three-phase executive session workflow. **Pre-session** (in open meeting): the system prompts for a motion to enter executive session, auto-generates motion language with a dropdown of legally permitted topics for the configured state, and records the motion and vote in open meeting minutes. **During session**: a timer tracks session duration, an attendee tracker logs who is present, the system displays permitted topics and warns if discussion may exceed scope, and no voting interface is available (for states prohibiting executive session votes). **Return to open session**: the system prompts for reconvening, auto-generates a summary template for open meeting minutes, and for Texas specifically prompts for oral summary of expenditures approved.

Executive session minutes are stored in a **separate encrypted document repository** with tiered access controls. Current board members can view sessions from their term; former board members lose access upon term expiration; the association attorney retains access; management company access is configurable; homeowners have no access; and auditors require a board vote. Every access is logged with user, timestamp, IP address, and action type. The audit log is append-only, tamper-proof, and viewable only by the President and Secretary. This capability represents a major competitive gap—no existing platform offers state-specific executive session compliance workflows.

---

## 8. Annual meeting packet generation

### Automated assembly wizard

The packet assembly uses a six-step wizard interface. **Step 1 (Setup)**: select meeting type, set date, confirm association details. **Step 2 (Component Selection)**: toggle on/off from the full component list—cover page, agenda, prior year minutes, president's report, financial reports (balance sheet, P&L, reserve fund status), proposed budget, election materials (candidate bios, ballots, proxy forms), committee reports, proposed rule changes, insurance summary, and management company report. **Step 3 (Content Collection)**: auto-populate from system data where available (financials pull from the accounting module, prior minutes from the minutes archive), with rich text editors for narrative components and file upload for external documents; deadline assignment for each component's completion. **Step 4 (Review)**: preview the assembled packet with drag-and-drop reordering and page number preview. **Step 5 (Approval)**: route to designated approvers with digital sign-off. **Step 6 (Distribution)**: select method per state requirements, schedule send date, generate print-ready PDF.

A dashboard tracks assembly progress: overall percentage complete, pending items, overdue items, and per-component status (Not Started → Draft → Under Review → Approved → Included). Automated reminders notify component owners of pending items.

### Distribution compliance

The system auto-configures minimum and maximum notice periods based on state selection. A compliance checker validates that the distribution date falls within the legal window. Washington requires notice per governing documents (14 days under WUCIOA); California requires 10–90 days with a 30-day minimum when election ballots are included; Florida requires 14 days of continuous conspicuous posting plus mail/electronic delivery; Texas requires 10–60 days by mail.

PDF generation produces paginated, bookmarked documents with auto-generated table of contents, section dividers, and page numbers. PDFs meet PDF/A accessibility standards. Integration with print vendors (Click2Mail API) enables physical mail distribution. All packet materials are published to the homeowner portal after the distribution date, with individual components viewable and downloadable separately, and acknowledgment tracking recording when each homeowner accessed the packet.

---

## 9. Task and action item management

### Meeting-to-task integration

Tasks are created directly from within the meeting minutes editor: highlight text, click "Create Action Item," and the system pre-populates the task with context from the agenda item. Each task carries a title, description, assignee (board member, committee, management company, or vendor), source meeting link, priority (Low/Medium/High/Critical), category, due date, and estimated effort. **Bidirectional linking** connects tasks to their source meeting and agenda item—from minutes, users see all linked action items and their current status; from any task, users navigate directly to the source meeting record. Uncompleted items automatically populate the next meeting's agenda under "Old Business" for review.

### Escalation and notification system

A five-tier escalation ladder fires automatically: **7 days before due** (gentle reminder to assignee), **on due date** (notification to assignee plus board president), **3 days overdue** (add management company), **7 days overdue** (full board notification, task flagged "Requires Board Attention"), and **14+ days overdue** (auto-added to next board meeting agenda). Notifications route through email, in-app alerts, push notifications, and SMS (for critical escalations), with per-user preferences for immediate, daily digest, or weekly digest delivery.

### Progress tracking and dashboards

Tasks flow through a structured workflow: **Not Started → In Progress → Blocked → Under Review → Completed** (with a Deferred branch). Blocked tasks require a mandatory reason field and blocking dependency identification. Progress notes are timestamped and support file attachments, photos, and @mention notifications.

The **Board Member Task View** presents a personal kanban board filterable by due date, priority, category, and source meeting. The **Committee Task View** groups tasks by committee with chair visibility into all members' work. The **Management Company View** provides a cross-community portfolio view with per-community breakdowns and SLA compliance metrics. An **Overview Dashboard** displays total open tasks, overdue counts, burndown charts, assignee workload distribution, and aging analysis for tasks open beyond 30, 60, and 90 days.

### Recurring tasks and dependencies

Pre-built recurring task templates cover annual insurance review, reserve study updates, budget preparation cycles, annual meeting preparation, fire extinguisher inspections, pool opening/closing, gutter cleaning, financial audits, D&O insurance renewal, and tax filing. Recurrence supports daily through annual frequency plus custom intervals, with auto-creation of the next instance upon completion. Task dependencies support finish-to-start, start-to-start, and finish-to-finish relationships with visual dependency chains and automatic blocking when predecessors are incomplete.

Standard reports include: **Overdue Items** (sorted by days overdue, auto-distributed weekly), **Completion Rate** (on-time vs. late trends over time), **Board Member Workload** (task distribution across members), **Meeting Action Item Status** (grouped by source meeting), and **Committee Performance** (per-committee completion rates and average time to close).

---

## Competitive positioning reveals massive governance gaps

Analysis of nine competitor platforms confirms that **no existing HOA management platform offers an integrated governance lifecycle**. The table below maps the most significant capability gaps to competitive opportunities:

| Capability gap | Best current offering | Market status |
|---|---|---|
| End-to-end meeting management (agenda → minutes → action items) | Condo Control offers agenda/minutes modules | No platform connects the full lifecycle |
| Board member term tracking and succession | None | Zero platforms offer this |
| Meeting-to-action-item linking with agenda roll-forward | None | Zero platforms offer this |
| Annual meeting packet auto-assembly | None | Zero platforms offer this |
| Executive session compliance workflows | None | Zero platforms offer this |
| State-specific notice timing enforcement | None | Zero platforms offer this |
| Inspector of Elections portal | None | Zero platforms offer this |
| AI-powered minutes from recordings | CINC adding AI features | No governance-specific AI exists |

TownSq leads in voting (3-step ballot creation, quorum tracking bar, weighted voting, real-time results) and mobile UX. Condo Control offers the most governance-aware features (e-voting, proxy voting, quorum tracking, audit trails) but charges for each as an add-on and has a dated UI. CINC Systems' Board Insight Center provides the best data-driven board portal. PayHOA—the platform being replaced—offers flexible weighted voting (percentage or flat, per-person or per-home) and broad communication tools (text, email, phone broadcast, message boards, website builder) but has no meeting management, no action item tracking, and limited governance features.

The platform should match PayHOA's communication breadth and TownSq's voting flexibility while building the complete governance lifecycle that no competitor offers. The combination of state-aware compliance automation, integrated meeting management, and structured board governance creates a defensible competitive moat in a market projected to reach **$18.0 billion by 2032** at a 7.1% CAGR, serving 369,000+ US community associations housing 77.1 million residents.

---

## Conclusion: governance as the competitive wedge

The HOA management software market has optimized for financial operations (payments, accounting, violations) while leaving governance—the actual work of running a board—underserved. This specification defines a governance module that transforms meetings from administrative overhead into structured, compliant, actionable workflows. Three design principles drive every feature: **state-aware compliance** (the rules engine adapts behavior to the jurisdiction automatically), **lifecycle continuity** (agenda items become minutes become action items become the next meeting's agenda), and **role-appropriate simplicity** (volunteer board members see only what they need, in an interface designed for non-professionals).

The electronic voting matrix reveals an accelerating legislative trend: California and Massachusetts joined the "permits" column in 2024–2025, Pennsylvania in 2023, North Carolina in 2021, and Virginia in 2021. Building a compliant electronic voting engine now positions the platform to capture demand as remaining silent states follow suit. Washington's WUCIOA transition (complete by January 1, 2028) means Talasera HOA will gain explicit electronic voting authorization on a defined timeline, making this the ideal proving ground before nationwide rollout. The five capabilities no competitor offers—term tracking, executive session compliance, meeting packet generation, meeting-to-task linking, and state-specific notice enforcement—together constitute the strongest possible differentiation strategy in this market.