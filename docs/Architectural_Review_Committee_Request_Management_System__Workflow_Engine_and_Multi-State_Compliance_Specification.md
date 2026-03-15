# Architectural Review Committee request management system

**The ARC Request Management System is a comprehensive workflow engine that automates the full lifecycle of homeowner modification requests—from mobile-first submission through committee deliberation to post-construction compliance verification—while enforcing state-specific legal timelines and maintaining a precedent database for decision consistency.** This specification defines a system designed for the Talasera HOA (single-family, Washington State) that scales to any subscribing HOA through configurable workflows, multi-state compliance rules, and tenant-isolated data architecture. The system fills critical gaps in existing platforms: no current HOA software offers conditional smart forms by project type, pre-submission compliance checking, visual plan annotation, neighbor notification workflows, or post-approval verification pipelines. This design incorporates the best features observed across SmartWebs, Vantaca, TownSq, and government permit portals while addressing every identified shortcoming.

---

## 1. Application workflow state machine

The state machine governs every ARC request from creation through closure. Each state has defined entry conditions, permitted transitions, responsible roles, and timeout behaviors. The system enforces that no request can exist outside a defined state, and every transition is logged with timestamp, actor, and rationale.

### Primary states and transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ARC REQUEST STATE MACHINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    auto     ┌──────────────┐                                 │
│  │  DRAFT   │────────────►│  SUBMITTED   │                                 │
│  │(homeowner│  (submit)   │(auto-ack sent│                                 │
│  │ saving)  │             │ w/in 48 hrs) │                                 │
│  └────┬─────┘             └──────┬───────┘                                 │
│       │                          │                                          │
│       │ abandon                  │ auto (1-3 bus. days)                     │
│       ▼                          ▼                                          │
│  ┌──────────┐             ┌──────────────┐    incomplete    ┌───────────┐  │
│  │ ABANDONED│             │ COMPLETENESS │───────────────►  │ INFO      │  │
│  │ (expired │             │ CHECK        │                  │ REQUESTED │  │
│  │  draft)  │             │(staff review)│  ◄───────────────│(homeowner │  │
│  └──────────┘             └──────┬───────┘   resubmit info  │ responds) │  │
│                                  │                          └─────┬─────┘  │
│                                  │ complete                       │         │
│                                  ▼                          expire│(30 day) │
│                           ┌──────────────┐                       ▼         │
│                           │ STAFF/MGR    │                ┌───────────┐    │
│                           │ REVIEW       │                │ EXPIRED   │    │
│                           │(preliminary) │                │ (closed)  │    │
│                           └──────┬───────┘                └───────────┘    │
│                                  │                                          │
│                          ┌───────┼────────┐                                │
│                          │       │        │                                │
│                     site visit  direct  fast-track                         │
│                     needed    to cmte  (pre-approved)                      │
│                          │       │        │                                │
│                          ▼       │        ▼                                │
│                   ┌────────────┐ │  ┌───────────┐                         │
│                   │ SITE VISIT │ │  │ AUTO-     │                         │
│                   │ SCHEDULED  │ │  │ APPROVED  │──────► CLOSED           │
│                   └─────┬──────┘ │  └───────────┘                         │
│                         │        │                                         │
│                    completed     │                                         │
│                         │        │                                         │
│                         ▼        ▼                                         │
│                   ┌──────────────────┐                                     │
│                   │ COMMITTEE REVIEW │◄──── (resubmit after denial)        │
│                   │ (discussion +    │                                     │
│                   │  threaded notes) │                                     │
│                   └────────┬─────────┘                                     │
│                            │                                               │
│                   ┌────────┼─────────────┐                                │
│                   │        │             │                                 │
│                   ▼        ▼             ▼                                 │
│            ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│            │ APPROVED │ │CONDITIONAL│ │ DENIED   │                        │
│            │          │ │ APPROVAL │ │          │                         │
│            └────┬─────┘ └────┬─────┘ └────┬─────┘                        │
│                 │            │             │                               │
│                 │       accept/reject      │                              │
│                 │            │        ┌────┼──────┐                       │
│                 │     ┌──────┼──────┐ │    │      │                      │
│                 │     ▼      ▼      │ ▼    ▼      ▼                      │
│                 │ ┌──────┐┌──────┐  │┌────────┐┌──────────┐             │
│                 │ │CONDS ││CONDS │  ││APPEALED││RESUBMIT- │             │
│                 │ │ACCEPT││REJECT│  ││(to BOD)││TED       │             │
│                 │ └──┬───┘└──┬───┘  │└───┬────┘└──────────┘             │
│                 │    │       │       │    │                               │
│                 │    │    back to    │  board                             │
│                 │    │    denied     │  hearing                           │
│                 │    │       │       │    │                               │
│                 ▼    ▼       │       │    ▼                               │
│            ┌──────────────┐  │       │ ┌───────────────┐                 │
│            │ WORK IN      │  │       │ │ APPEAL REVIEW │                 │
│            │ PROGRESS     │  │       │ │ (board votes) │                 │
│            │(construction)│  │       │ └───────┬───────┘                 │
│            └──────┬───────┘  │       │    ┌────┼────┐                    │
│                   │          │       │    ▼    ▼    ▼                     │
│              completed       │       │  upheld modified overturned       │
│                   │          │       │    │    │    │                     │
│                   ▼          │       │    │    │    │                     │
│            ┌──────────────┐  │       │    │    │    │                     │
│            │ COMPLIANCE   │  │       │    ▼    ▼    ▼                     │
│            │ VERIFICATION │  │       │  (routes back to appropriate      │
│            │(final insp.) │  │       │   state: DENIED, CONDITIONAL,     │
│            └──────┬───────┘  │       │   or APPROVED)                    │
│              ┌────┼────┐     │       │                                   │
│              ▼    ▼    ▼     │       │                                   │
│           pass  fail  partial│       │                                   │
│              │    │    │     │       │                                   │
│              │    ▼    ▼     │       │                                   │
│              │ ┌──────────┐ │       │                                   │
│              │ │COMPLIANCE│ │       │                                   │
│              │ │VIOLATION │──────────► VIOLATION SYSTEM                  │
│              │ └──────────┘ │       │                                   │
│              ▼              │       │                                    │
│         ┌──────────┐        │       │                                    │
│         │ CLOSED   │◄───────┘───────┘                                    │
│         │(archived)│                                                      │
│         └──────────┘                                                      │
│                                                                            │
│  WITHDRAWN ◄──── (homeowner can withdraw from any active state)           │
│  DEADLINE_EXCEEDED ──► DEEMED_APPROVED (per governing docs/state law)     │
│  ON_HOLD ◄──── (litigation, natural disaster, board discretion)           │
└────────────────────────────────────────────────────────────────────────────┘
```

### Complete state definitions

| State | Entry Condition | Timeout Behavior | Permitted Next States | Responsible Role |
|-------|----------------|------------------|-----------------------|-----------------|
| **DRAFT** | Homeowner begins form | Auto-expire after 90 days of inactivity | SUBMITTED, ABANDONED | Homeowner |
| **SUBMITTED** | Homeowner clicks Submit | Auto-acknowledge within 48 hours | COMPLETENESS_CHECK | System (auto) |
| **COMPLETENESS_CHECK** | Auto after acknowledgment | Must complete within 5 business days | STAFF_REVIEW, INFO_REQUESTED | Staff/Manager |
| **INFO_REQUESTED** | Missing required materials | Auto-expire after 30 days with no response | COMPLETENESS_CHECK (resubmit), EXPIRED | Homeowner |
| **STAFF_REVIEW** | Application complete | Must route within 5 business days | SITE_VISIT_SCHEDULED, COMMITTEE_REVIEW, AUTO_APPROVED | Staff/Manager |
| **SITE_VISIT_SCHEDULED** | Complex request flagged | Must complete within 14 days | COMMITTEE_REVIEW | ARC Liaison |
| **COMMITTEE_REVIEW** | Ready for deliberation | Must decide within deadline per governing docs (typically 30 days) | APPROVED, CONDITIONAL_APPROVAL, DENIED, DEADLINE_EXCEEDED | ARC Committee |
| **APPROVED** | Majority vote to approve | Approval expires if work not started within timeframe (typically 6 months) | WORK_IN_PROGRESS, EXPIRED, CLOSED | Committee/Board |
| **CONDITIONAL_APPROVAL** | Majority vote with conditions | Homeowner must respond within 14 days | CONDITIONS_ACCEPTED, CONDITIONS_REJECTED | Homeowner |
| **DENIED** | Majority vote to deny | Appeal window opens (30-45 days) | APPEALED, RESUBMITTED, CLOSED | Committee/Board |
| **CONDITIONS_ACCEPTED** | Homeowner signs conditions | Same as APPROVED | WORK_IN_PROGRESS | Homeowner |
| **CONDITIONS_REJECTED** | Homeowner rejects conditions | Treated as denial; appeal window opens | APPEALED, RESUBMITTED, CLOSED | Homeowner |
| **APPEALED** | Written appeal filed within deadline | Board must schedule hearing within 30 days | APPEAL_REVIEW | Homeowner |
| **APPEAL_REVIEW** | Board hearing held | Must decide within 14 days of hearing | APPROVED, CONDITIONAL_APPROVAL, DENIED (upheld), CLOSED | Board of Directors |
| **WORK_IN_PROGRESS** | Homeowner begins construction | Must complete within approval window | COMPLIANCE_VERIFICATION, EXPIRED | Homeowner |
| **COMPLIANCE_VERIFICATION** | Homeowner reports completion | Inspection within 14 days | CLOSED, COMPLIANCE_VIOLATION | ARC Liaison |
| **COMPLIANCE_VIOLATION** | Work deviates from approval | Escalate to violation system | Links to Violation System | ARC Liaison → Enforcement |
| **CLOSED** | Verified compliant or administratively closed | Permanent archival | None (terminal) | System |
| **WITHDRAWN** | Homeowner withdraws | Immediate | CLOSED | Homeowner |
| **EXPIRED** | Timeout reached without action | Immediate | CLOSED, RESUBMITTED | System |
| **DEEMED_APPROVED** | Committee missed statutory/CC&R deadline | Treated as full approval | WORK_IN_PROGRESS | System (auto) |
| **ON_HOLD** | Litigation, force majeure, or board pause | Timeline clock paused | Previous state (resume) | Board/Manager |
| **ABANDONED** | Draft inactive 90+ days | Immediate | CLOSED | System |
| **AUTO_APPROVED** | Pre-approved modification type matched | Immediate | CLOSED | System |
| **RESUBMITTED** | New application referencing prior denial | Carries forward prior context | COMPLETENESS_CHECK | Homeowner |

### Edge cases and error handling

**Deemed-approved trigger**: The system calculates the deadline based on the governing documents' response window. For Washington State EV charger requests, the statutory **60-day deemed-approved deadline** (RCW 64.38.062 / RCW 64.90.513) is hardcoded. For all other request types, the deadline is configurable per HOA based on their CC&Rs. The clock pauses only when a "reasonable request for additional information" is issued and resumes when the homeowner responds.

**Concurrent state prohibition**: A request can never exist in two states simultaneously. The ON_HOLD state preserves the previous state as metadata and restores it upon resumption.

**Withdrawal rules**: Homeowners may withdraw from any non-terminal state. Withdrawal after approval but before completion verification triggers an automatic note that the approved modification was not executed; if work was partially completed, the system flags it for manager review.

**Resubmission linking**: When a denied application is resubmitted, the new application carries a `previous_application_id` reference. Committee members see the full history including prior denial reasons, enabling continuity without re-explaining context.

---

## 2. ARC request types and submission requirements matrix

Each request type is classified by complexity tier, which determines the workflow path (simple requests may qualify for fast-track or auto-approval; complex requests require site visits and full committee review). The submission requirements matrix maps **21 modification categories** to their required and optional materials.

### Complexity tiers

**Tier 1 — Simple** (target: 7-day turnaround, staff-level approval possible): Exterior paint, mailbox replacement, exterior lighting, security cameras, basketball hoops, flagpoles, satellite dishes (notification only per OTARD).

**Tier 2 — Moderate** (target: 30-day turnaround, full committee review): Fencing, landscaping changes, roofing, windows/doors, driveways/hardscaping, sheds/outbuildings, pergolas/gazebos, EV chargers, holiday decorations (permanent installations).

**Tier 3 — Complex** (target: 45-60 day turnaround, site visit + committee + possible board ratification): Additions/remodels, swimming pools, solar panels, decks/patios (elevated), ADUs.

### Submission materials matrix

| Material Required | Paint | Fence | Landscape | Solar | Addition | Pool | Shed | Satellite | Roof | Driveway | Windows | Deck | ADU | EV Charger | Basketball | Flagpole | Mailbox | Lighting | Camera | Pergola |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Application form** | R | R | R | R | R | R | R | N* | R | R | R | R | R | R | R | R | R | R | R | R |
| **Written description** | R | R | R | R | R | R | R | N* | R | R | R | R | R | R | R | R | R | R | R | R |
| **Current condition photos** | R | R | R | R | R | R | R | — | R | R | R | R | R | O | O | O | O | O | O | R |
| **Proposed renderings/drawings** | — | O | O | R | R | R | O | — | — | O | O | R | R | O | — | — | — | — | — | R |
| **Architectural plans/blueprints** | — | — | — | O | R | R | — | — | — | — | — | R† | R | — | — | — | — | — | — | — |
| **Property survey/plot plan** | — | R | R | R | R | R | R | — | — | R | — | R | R | — | — | — | — | — | — | R |
| **Material specs/samples** | R‡ | R | O | R | R | R | R | — | R | R | R | R | R | O | O | O | O | R | O | R |
| **Color swatches (physical)** | R‡ | O | — | O | R | — | R | — | R | O | R | O | R | — | — | — | — | — | — | O |
| **Contractor info + license** | — | O | O | R | R | R | O | — | R | O | O | R† | R | R | — | — | — | — | — | O |
| **Building permit (or proof applied)** | — | — | — | R | R | R | O§ | — | O | — | O§ | R† | R | R | — | — | — | — | — | — |
| **CC&R reference acknowledgment** | R | R | R | R | R | R | R | — | R | R | R | R | R | R | R | R | R | R | R | R |
| **Neighbor notification** | — | O | — | — | R | R | — | — | — | — | — | O | R | — | — | — | — | — | O | — |
| **Project timeline** | O | R | O | R | R | R | R | — | R | R | O | R | R | R | — | — | — | — | — | R |
| **Cost estimate** | — | O | — | O | R | R | O | — | O | O | — | O | R | O | — | — | — | — | — | O |
| **Drainage/grading plan** | — | — | O | — | R | R | — | — | — | R | — | O | R | — | — | — | — | — | — | — |
| **Structural engineering** | — | — | — | — | R | O | — | — | — | — | — | R† | R | — | — | — | — | — | — | — |

**R** = Required | **O** = Optional | **—** = Not applicable | **N*** = Notification only (OTARD) | **R‡** = Physical samples required, digital insufficient | **R†** = Required for elevated decks (>30" above grade) | **O§** = Required if over size threshold per local jurisdiction

### Regulatory protections that override HOA authority

Certain modification types carry federal or state legal protections that the system must enforce by restricting the HOA's ability to deny or impose unreasonable conditions:

**Satellite dishes (FCC OTARD Rule, 47 C.F.R. §1.4000)**: The system enforces a **notification-only workflow** for dishes ≤1 meter on owner's exclusive-use property. No approval required. The HOA can suggest placement preferences but cannot require prior approval, impose unreasonable delays, or increase costs. The system blocks committee denial of OTARD-qualifying installations and instead routes them to a notification acknowledgment path.

**U.S. flag display (Freedom to Display the American Flag Act, 4 U.S.C. §5)**: The system flags any denial of American flag display as legally non-compliant. Reasonable time, place, and manner restrictions on the flagpole itself are permitted but the flag display cannot be prohibited.

**Solar panels (WA RCW 64.38.055; ~29 state solar access laws)**: In Washington, governing documents may not prohibit solar panels. The system enforces that HOA restrictions cannot degrade panel performance by more than **10%** and that frames/conduit color-matching is the maximum permissible aesthetic restriction. The system presents committee members with a compliance checklist of legally permissible conditions before allowing a vote.

**EV chargers (WA RCW 64.38.062 / RCW 64.90.513)**: The system enforces a **60-day deemed-approved deadline**. If the application is not denied in writing within 60 days of receipt, the system automatically transitions the request to DEEMED_APPROVED status. This is the only statutory timeline in Washington's HOA law and is hardcoded. No placement fees may be charged; only a reasonable processing fee is permitted if charged for all architectural modifications.

**Heat pumps (WA RCW 64.90.580, effective January 1, 2026)**: Associations may not prohibit or unreasonably restrict heat pump installation. Streamlined approval timeline similar to EV chargers.

**Drought-resistant/wildfire-resistant landscaping (WA RCW 64.38.057)**: Cannot be prohibited. Aesthetic rules cannot render use "unreasonably costly or otherwise effectively infeasible."

### Detailed specifications by request type

**Exterior paint/color changes** fall in Tier 1 and require physical paint swatches (manufacturer name, color name, color number) for body, trim, accent, and front door. Many HOAs maintain pre-approved color palettes; the system supports a "pre-approved palette" feature where homeowners select from approved colors for instant confirmation. Even same-color repainting should be submitted for record-keeping. Common denial reasons include colors not on the pre-approved palette, insufficient contrast between body and trim, and neon or fluorescent selections. No building permit is required.

**Fencing** requires a property survey with the fence drawn on it showing setback measurements from property lines and the front plane of the home. The application captures fence type (wood, vinyl/PVC, wrought iron, composite), style (privacy, shadowbox, picket, split-rail), height, and material specifications with product data sheets. Common CC&R provisions restrict chain link to rear yards or prohibit it entirely, limit height to **4-6 feet**, require the "good side out" facing neighbors, and prohibit extension beyond the front plane of the home. Fencing around pools requires building permits in most jurisdictions regardless of height.

**Solar panels** carry regulatory protections in Washington and 28 other states. The application captures panel layout diagram, mounting method (roof-mounted vs. ground-mounted), panel color, manufacturer specifications, and installer credentials. The system presents the legally permissible restriction checklist to committee members: roof-mounted panels may be required to not extend above the roofline, street-facing arrays must conform to roof slope, and frames/conduit may be required to match roofing color. Any condition that degrades performance by more than 10% is automatically flagged as potentially non-compliant.

**Additions and remodels** are the most complex Tier 3 requests, requiring scale architectural drawings (top, front, side, rear elevations), structural engineering drawings, plot plans with setback lines and easements, complete material and color specifications matching the existing residence, contractor licensing and insurance, and county building permit applications. The roof design must integrate with the existing roofline. Room additions generally cannot exceed one-third of the original rear yard. These requests always require site visits and full committee review.

**Swimming pools** require property surveys with pool and pump equipment locations drawn with setback measurements, contractor drawings, pool dimensions/depth/type, equipment screening plans, and barrier/fencing plans (required by code in all jurisdictions). Above-ground pools are prohibited in many communities. Minimum **5-10 foot setbacks** from property lines are typical. Equipment must be screened from view with self-closing, self-latching gates on barriers.

**Accessory Dwelling Units** require full architectural plans (site plan, floor plan, all elevations, sections), structural engineering, utility connection plans, and energy efficiency calculations where applicable. ADU regulations are evolving rapidly—California has extensive legislation (AB 68, SB 13, AB 881) limiting HOA authority to restrict ADUs. The system must track jurisdiction-specific ADU rules and flag restrictions that may conflict with state preemption laws.

**EV chargers** follow the streamlined regulatory path in Washington. The application captures charger type (Level 1/2/DC), location, electrical specifications, and licensed electrician credentials. In California, homeowners must name the HOA as additional insured. The system enforces that no placement fee is charged and that only a reasonable processing fee is permitted if uniformly applied to all architectural modifications.

---

## 3. Review timeline requirements and multi-state compliance

### Washington State timelines

Washington's HOA statutes (RCW 64.38 and RCW 64.90) contain **no general statutory deadline** for architectural review responses. This is a critical gap that the system addresses through configurable CC&R-based deadlines. The sole statutory deadline is the **60-day deemed-approved provision for EV charger installations** (RCW 64.38.062(3)(c) and RCW 64.90.513), which states: "If an application is not denied in writing within 60 days from the date of receipt of the application, the application is deemed approved, unless that delay is the result of a reasonable request for additional information."

The system implements a three-tier deadline framework:

**Statutory deadlines** (hardcoded, cannot be overridden by HOA configuration): EV chargers at 60 days; heat pumps per RCW 64.90.580; any future statutory deadlines added by legislative update. These trigger automatic DEEMED_APPROVED transitions.

**CC&R-based deadlines** (configured per HOA during onboarding): The system reads the governing document's response window and enforces it. For Talasera HOA, this will be set based on their specific CC&Rs. Common CC&R deadlines range from **15 to 45 days**. The *Holcomb v. Taree* case in Washington confirmed that courts enforce CC&R deemed-approved provisions as written.

**Platform-recommended deadlines** (defaults when CC&Rs are silent): The system applies a default **30-day response window** with escalation alerts at 7 days remaining, 3 days remaining, and deadline day. If CC&Rs contain no deadline and state law does not impose one, the system tracks elapsed time and alerts managers when response time becomes unreasonable (>45 days), citing the legal risk of waiver/estoppel claims.

### Auto-escalation rules

The system implements a cascading escalation sequence when committee deadlines approach:

| Days Before Deadline | Action | Recipient |
|---------------------|--------|-----------|
| 14 days | Reminder: Review pending | Committee members |
| 7 days | Escalation: Deadline approaching | Committee chair + HOA manager |
| 3 days | Urgent alert: Action required | Committee chair + HOA manager + Board president |
| 0 days (deadline) | Final notice: Deadline reached | All above + system flag |
| +1 day past deadline | Auto-transition to DEEMED_APPROVED (if CC&Rs/statute require) OR Manager override required | System auto / Manager |

The clock-pausing mechanism activates only when a formal "Request for Additional Information" is issued through the system. The system logs the pause timestamp, the specific information requested, and the resumption timestamp when the homeowner responds. For EV charger requests under Washington law, the pause is only valid if the request for additional information is "reasonable"—the system requires managers to categorize the information request against a pre-defined list of reasonable items.

### WUCIOA transition impact (critical for Washington HOAs)

Effective **January 1, 2028**, WUCIOA (RCW 64.90) fully replaces RCW 64.38 for all Washington communities. Key impacts on ARC operations that the system must accommodate:

**Board ratification required**: Under WUCIOA, ARC decisions that constitute "board-level decisions" must be individually approved by the board itself. The system adds an optional BOARD_RATIFICATION state between committee vote and final decision notification, configurable per HOA based on their legal counsel's interpretation of this requirement.

**Open meeting requirements**: All ARC committee meetings must be open to owners with **14 days advance notice** (or per a formally noticed schedule). Meeting materials must be available to owners before the meeting. The system integrates with the Multi-Channel Communication System to automate meeting notice distribution and material publication.

**Records retention**: Washington requires retention of "materials relied upon by the board or any committee to approve or deny any requests for design or architectural approval" for **seven years** (RCW 64.38.045). The system enforces a minimum 7-year retention policy with no manual deletion permitted within this window.

### Multi-state compliance engine

The system implements a `ComplianceRuleSet` per state that enforces jurisdiction-specific requirements:

| State | General ARC Deadline | Deemed-Approved | Written Denial Required | Specific Reasons Required | Appeal Rights | Solar Protection | EV Protection |
|-------|---------------------|-----------------|------------------------|--------------------------|--------------|-----------------|---------------|
| **WA** | Per CC&Rs (no statute) | 60 days (EV only) | Yes (EV) | Not in general statute | Per CC&Rs | Yes (RCW 64.38.055) | Yes (60-day auto-approve) |
| **CA** | "Expeditious" (~45 days) | Per CC&Rs; expeditious required | Yes (Civ. Code §4765) | Yes (§4765) | IDR + reconsideration at open meeting | Yes (strongest—§714) | Yes (§4745) |
| **FL** | Per CC&Rs; reasonable | Per CC&Rs | Yes (2024 amendment §720.3035) | Yes (must cite specific rule + non-conforming aspect) | Per docs + mediation | Limited | Limited |
| **TX** | Per CC&Rs | Per CC&Rs | Yes (§209.00505) | Yes (reasonable detail) | Formal board hearing within 30 days | Some | Limited |
| **AZ** | Per CC&Rs; "not unreasonably withheld" | Per CC&Rs | Implied | Implied | Per docs | Yes (strongest—§§33-439, 33-1816) | No specific |
| **CO** | Per CC&Rs | Per CC&Rs | Not explicit | Not explicit | Per docs | Yes (§38-33.3-106.5) | No specific |

The compliance engine loads the appropriate rule set based on the HOA's registered state. When a committee member attempts to deny a protected modification type (solar, EV, satellite, flag), the system displays a compliance warning with the specific statute citation and blocks the denial if it would violate the statute. For multi-state management companies, the compliance engine applies per-association rules based on the property's jurisdiction.

---

## 4. Committee review tools specification

The committee review interface is designed around the principle that every piece of information needed to make a defensible decision should be visible on a single screen, with deeper context one click away. Research shows that SmartWebs' single-screen document view and TownSq's private/shared comments are the strongest existing implementations, but no current platform offers annotation tools, precedent lookup, or compliance pre-checking.

### Threaded discussion and commenting

Each application has a **dual-track comment system** inspired by TownSq's private/shared model. **Internal comments** are visible only to committee members, staff, and board members—these support deliberation without premature disclosure. **External comments** are visible to the homeowner and create the communication record. Comments support @mentions to notify specific members, file attachments for reference documents, and inline quoting of CC&R sections pulled from the document management system.

### Structured voting interface

The voting interface presents each committee member with a clear three-option ballot: **Approve**, **Deny**, or **Approve with Conditions**. Every vote requires a rationale field (minimum 50 characters) citing the specific guideline or standard applied. For denials, the system requires selection of one or more denial reason categories (incomplete submission, non-compliance with design standards, encroachment on setbacks/easements, adverse drainage impact, incompatible scale/design, safety concern) plus a free-text explanation. This requirement is driven by Florida's 2024 law (§720.3035) mandating specific rule citations in denials and Texas's §209.00505 requiring "reasonable detail"—the system applies this standard universally as best practice.

The voting dashboard displays real-time vote tallies, configurable voting thresholds (simple majority, supermajority, unanimous), and auto-advancement when the threshold is met. Quorum is tracked against the committee roster: the system will not permit a vote to close until quorum is verified. **Proxy voting and secret ballots are blocked** for HOAs in Florida per §720.303(2)(c)(3), with this restriction configurable per state compliance rule set.

### Document annotation and markup

The system provides a **digital redlining** capability modeled on government plan review tools (Accela, Bluebeam). Committee members can annotate uploaded plans, photos, and drawings with callouts, measurement markers, highlight areas, and text notes. Annotations are layered—each committee member's markup appears in a distinct color and can be toggled on/off. This capability fills a gap identified in every existing HOA platform.

### Side-by-side CC&R comparison

A split-pane view displays the application materials on the left and the relevant CC&R/guideline sections on the right. The system auto-suggests relevant guideline sections based on the request type (e.g., for a fence request, it surfaces the fencing section of the architectural guidelines). Committee members can pin additional sections and create persistent links between specific application elements and guideline references.

### Precedent lookup

The system surfaces **past decisions for the same request type** in a collapsible panel showing outcome, conditions imposed, date, and anonymized property reference. A **consistency score** algorithm flags when the proposed decision would deviate from the pattern of past decisions for similar requests—for example, if the last five fence requests of the same material and style were approved, a proposed denial triggers a consistency warning. This directly addresses the legal risk of selective enforcement, which courts have consistently held creates waiver and estoppel defenses.

### Conflict of interest declarations

Before viewing any application, each committee member must confirm they have no conflict of interest. The system checks for address proximity (same street or adjacent lot), familial relationships (if modeled in the member database), and prior interactions with the applicant. In California, Civil Code §5350 prohibits a committee member from voting on changes to their own property—the system enforces this automatically by matching the applicant address against committee member addresses. The conflict declaration is logged and timestamped for the audit trail.

---

## 5. Homeowner portal features

The homeowner portal is the primary interface for submission, tracking, and communication. It follows mobile-first responsive design principles with a native app wrapper for iOS and Android.

### Visual progress tracker

The status tracker implements Nielsen Norman Group's recommendation of **discrete progress indicators** (separated steps rather than a continuous bar) combined with proactive push notifications. The tracker displays all states the request has passed through with timestamps, the current active state with an estimated completion date, and the next expected states. A "What happens next" panel explains the upcoming step in plain language. Each state transition generates a push notification, email, and optional SMS through the Multi-Channel Communication System.

The estimated timeline is calculated from historical average processing times for the same request type at that HOA, displayed as a range: "Fence requests at Talasera typically take **18-25 days** from submission to decision."

### Document management

Homeowners can upload additional materials to an open application at any time before the committee vote. The system accepts images (JPEG, PNG, HEIC), documents (PDF), drawings (DWG, DXF with viewer), and video (MP4, up to 2 minutes—inspired by Condo Control's unique video upload feature). Version control tracks all document uploads with timestamps, and committee members see a "new materials" badge when documents are added after their last review.

### Condition acceptance workflow

When a conditional approval is issued, the homeowner sees a structured conditions checklist with each condition presented as a separate item requiring individual acknowledgment. An electronic signature captures the homeowner's acceptance of all conditions, generating a timestamped, legally defensible record. The signed conditions document is automatically filed in the Document Management System. If the homeowner disagrees with conditions, they can formally reject and initiate an appeal.

### Approval and denial letter access

The homeowner can download the official approval letter (PDF, branded with HOA letterhead) at any time after a decision. Denial letters include the specific reasons for denial, the relevant CC&R section citations, a description of the appeal process with deadlines, and guidance for resubmission. This meets the increasingly strict legal requirements across states (Florida's 2024 amendment, Texas §209.00505, California §4765).

### Communication channel

A dedicated in-app messaging thread connects the homeowner to the ARC liaison (typically the community manager). Messages are logged as part of the application record. The system supports structured "Request for Information" messages that pause the review clock and present the homeowner with a clear checklist of needed items.

---

## 6. Template library specification

### Application form templates by category

The system provides **smart conditional forms** that dynamically adjust fields based on the selected modification type. This is the single largest gap identified across all competitor platforms—none offer forms that change based on project type.

**Form architecture**: A base form captures universal fields (property address, homeowner name/contact, project description, estimated start/completion dates, CC&R acknowledgment checkbox, electronic signature). Conditional sections activate based on the selected modification category:

**Paint/Color Change Form**: Adds fields for body color (manufacturer, name, number), trim color, accent color, front door color, surface type (stucco, siding, brick, wood). Pre-approved palette selector with color swatch preview. Physical sample submission instructions with mailing address or drop-off location.

**Fencing Form**: Adds property survey upload (required), fence type selector (privacy, semi-privacy, picket, split-rail, wrought iron, chain link), material selector, height input with max-height validation against CC&Rs, location drawing tool overlay on property survey, "good side out" acknowledgment, gate specifications.

**Solar Panel Form**: Adds panel layout diagram upload, mounting type (roof/ground), panel specifications (manufacturer, model, dimensions, color), installer credentials, electrical capacity assessment, regulatory compliance checklist (auto-populated based on state). System displays the legally permissible restriction boundaries to the homeowner before submission.

**Addition/Remodel Form**: Adds multi-file architectural plan upload (floor plan, all elevations required), structural engineering upload, existing home photos (all sides required), materials matching checklist, contractor license verification, building permit status, drainage impact statement.

**Pool Form**: Adds pool type (in-ground/above-ground), dimensions/depth, equipment location on survey, barrier/fencing plan, contractor credentials, building permit status, landscape plan for pool surround.

**ADU Form**: Adds comprehensive plan set upload (site plan, floor plan, all elevations, sections, utility plans), energy calculations, parking plan, height/setback compliance self-certification, local zoning reference.

**EV Charger Form**: Adds charger type (Level 1/2/DC), model/manufacturer, installation location, electrician credentials and license number, electrical panel capacity, insurance certificate upload. Displays the 60-day deemed-approved notice for Washington State.

### Decision letter templates

**Approval letter template**: Includes HOA name and logo, application reference number, property address, description of approved modification, any standard conditions (work must conform to plans, owner responsible for permits, completion deadline, inspection requirement, indemnification clause), committee vote date, authorized signature block.

**Conditional approval template**: Same as approval plus a structured conditions table with numbered conditions, acceptance signature block, and 14-day acceptance deadline. Each condition includes: condition description, compliance metric (how the HOA will verify), and consequence of non-compliance.

**Denial letter template**: Includes specific reason(s) for denial, the exact CC&R section or guideline provision relied upon, description of the specific aspect of the proposal that does not conform (required by Florida §720.3035(4)(b) and applied universally as best practice), description of the appeal process with filing deadline, guidance for modification and resubmission, and a statement that the homeowner may request reconsideration or file a formal appeal to the board.

**Request for Information template**: Lists specific missing items as a numbered checklist, explains that the review clock is paused pending receipt, provides the deadline for homeowner response (30 days default), and notes that failure to respond will result in application expiration.

**Site visit scheduling template**: Proposed date/time options, estimated duration, what the inspector will evaluate, homeowner preparation checklist (ensure access to all areas, mark proposed change locations), reschedule instructions.

**Compliance verification checklist template**: Side-by-side comparison fields (approved vs. as-built) for dimensions, materials, colors, location, and overall appearance. Pass/fail per item. Photo documentation fields. Final sign-off or deficiency notice.

---

## 7. Historical decision database

### Architecture and search

Every ARC decision is permanently archived with full application materials, committee deliberation notes (internal), decision rationale, conditions, and completion photos. The database supports **full-text search** across descriptions, decisions, and conditions, plus **structured filtering** by request type, property address, date range, outcome (approved/denied/conditional/withdrawn), committee member, and precedent tags.

### Precedent tagging system

Committee members can tag decisions with precedent labels (e.g., "earth-tone paint approved," "6ft-vinyl-fence-approved-rear-yard," "solar-roof-mount-street-facing-denied-pre-2024"). Tags are hierarchical: category → subcategory → specific attribute. When reviewing new applications, the system auto-suggests relevant precedents based on request type and key attributes, and committee members can explicitly link a new decision to a prior precedent ("consistent with Application #ARC-2024-0147").

### Consistency scoring algorithm

The system calculates a **consistency score** for each proposed decision by comparing it against the corpus of past decisions for the same request type. The algorithm evaluates: same modification type, similar materials/specifications, similar property characteristics (lot size, home style, visibility from street), and outcome pattern. A score below **70%** (indicating the proposed decision deviates from established patterns) triggers a mandatory acknowledgment from the voting committee member with an explanation of why this case differs. This creates a documented record that protects against selective enforcement claims.

### Statistical reporting

The reporting dashboard provides:

- **Approval rates** by request type, time period, and committee composition
- **Average review time** from submission to decision, with trend analysis
- **Common denial reasons** ranked by frequency, with drill-down to specific applications
- **Compliance verification pass rate** (percentage of completed projects that match approved plans)
- **Appeal rate and overturn rate** (percentage of denials that are appealed and percentage of appeals that result in reversal)
- **Resubmission success rate** (percentage of denied-then-resubmitted applications that are eventually approved)
- **Volume trends** by month, quarter, and year, segmented by request type
- **Committee member participation** metrics (votes cast, meetings attended, average response time)

Photo archives of all approved modifications are organized by property address, creating a visual history of each lot's evolution over time. This serves both the committee (for context when reviewing new requests) and future homeowners (understanding what has been approved at their address).

---

## 8. Violation tracking system integration

The integration between ARC and violation tracking creates a bidirectional link that handles three primary scenarios.

### Unapproved modification detected → violation generated

When a community manager or inspector identifies an unapproved modification during routine inspection, the violation system creates a violation record with a flag: `requires_arc_review`. The violation notice informs the homeowner that the modification was not approved and offers two paths: (1) submit a retroactive ARC application within **30 days** to seek approval, or (2) restore the property to its prior condition within **30 days**. If the homeowner submits a retroactive application, the violation is linked to the ARC request and its status tracks with the ARC outcome. If the ARC approves the retroactive request, the violation is automatically resolved. If the ARC denies it, the violation escalates to enforcement (fines, legal action).

### ARC approval → compliance deviation → violation

When the compliance verification inspection finds that completed work deviates from the approved plans, the system creates a linked violation record. The violation references the original ARC approval and documents the specific deviations. The homeowner receives notice to either (a) submit an amended ARC application for the as-built condition or (b) correct the work to match the approved plans. The violation system tracks the deadline and escalates per the standard enforcement ladder.

### Violation → retroactive ARC application conversion

The system supports one-click conversion of a violation record into a retroactive ARC application. The conversion pre-populates the ARC form with violation photos, property address, and modification description from the violation record. The original violation remains open with status `pending_arc_review` and automatically resolves or escalates based on the ARC outcome.

### Status synchronization

Both systems share a common property record. The property detail view shows all active ARC requests and all active violations in a unified timeline. Status changes in either system trigger notifications in the other. An approved ARC request creates a "modification record" on the property that the violation inspection system references—inspectors can see what has been approved when assessing a property, preventing false violation reports for approved work.

---

## 9. Mobile submission specification

The mobile experience is designed for guided, low-friction submission directly from the modification site. The native app (iOS/Android) leverages device capabilities that web portals cannot match.

### Guided photo capture

The app implements a **structured photo workflow** specific to each modification type. For a fence request, the sequence is: (1) front of property showing current condition, (2) proposed fence start point, (3) proposed fence path/line, (4) proposed fence end point, (5) view from neighbor's perspective, (6) any adjacent fencing for style reference. Each step displays an overlay guide showing the recommended framing angle. Photos are automatically **geotagged** with GPS coordinates and timestamped, creating verifiable evidence of location and timing.

For material samples, the app uses the camera with a **color calibration mode** that places a standard color reference card (white/gray/black) in frame to enable accurate color reproduction. While physical paint swatches remain the gold standard, this provides a digital complement that committee members can reference.

### Offline draft saving

The app stores form data and captured photos locally on the device. Homeowners can begin an application in the field (at the home, at a hardware store photographing material options) and complete it later. Auto-sync uploads all data when connectivity is restored. Draft expiration follows the same 90-day rule as web drafts.

### Voice-to-text description

The app supports voice-to-text input for the project description field, enabling homeowners to narrate their proposed change while standing at the location. The transcription is editable before submission.

### Location-aware features

When the homeowner opens the app at their property (GPS match), the system auto-populates the property address and pulls the lot's property survey from the document management system if available. The app can overlay modification locations on a satellite/aerial view of the property for spatial context.

---

## 10. Review process specification

This section defines the step-by-step review process with roles, timelines, and decision criteria for each stage.

### Step 1: Pre-submission guidance (Homeowner, self-service)

Before beginning an application, the homeowner accesses the "Before You Apply" module, which presents the architectural guidelines relevant to their planned modification, examples of previously approved similar projects (from the historical database), the list of required submission materials for their modification type, and any pre-approved modifications that do not require full committee review. The system checks whether the homeowner's account has any past-due assessments—some HOAs will not process applications from delinquent accounts (configurable per HOA).

### Step 2: Application submission (Homeowner, 15-45 minutes)

The homeowner completes the smart conditional form for their modification type. The system performs real-time validation: required fields are enforced, file uploads are checked for minimum resolution and file type, and the CC&R acknowledgment checkbox must be selected. Upon submission, the system generates a unique application number (format: `ARC-{YEAR}-{SEQUENCE}`, e.g., ARC-2026-0042), sends an auto-acknowledgment within **48 hours** via email/push/SMS confirming receipt with the application number, and starts the review timeline clock.

### Step 3: Completeness check (Staff/Manager, 1-5 business days)

The community manager or ARC administrator reviews the submission against the required materials checklist for the modification type. The system pre-flags missing items based on the submission matrix. If incomplete, the manager issues a structured "Request for Information" specifying exactly what is needed. The review clock pauses. If complete, the application advances to staff review.

### Step 4: Staff/manager preliminary review (Staff/Manager, 1-5 business days)

The manager performs an initial assessment: Does the request fall within a pre-approved category (auto-approve path)? Does it require a site visit? Are there obvious CC&R conflicts that should be flagged for the committee? Does the property have any active violations that may affect this request? The manager routes the application to the appropriate next state and may add internal notes for the committee.

**Fast-track path**: For Tier 1 modifications that match pre-approved standards (e.g., selecting a paint color from the approved palette, replacing a mailbox with the community standard model), the manager can approve directly without committee review, subject to HOA-configurable authorization levels.

### Step 5: Site visit (ARC Liaison/Inspector, if required, within 14 days)

For Tier 3 requests and flagged Tier 2 requests, the ARC liaison schedules a site visit. The homeowner receives scheduling options via the portal. The inspector uses the mobile app to document current conditions (geotagged photos), measure setbacks, assess neighbor impact, evaluate drainage patterns, and note any conditions not apparent from submitted plans. The site visit report is attached to the application and visible to committee members.

### Step 6: Committee review and deliberation (ARC Committee, during scheduled meeting or asynchronous voting period)

Committee members receive notification that the application is ready for review. The committee review interface displays all application materials, site visit report (if applicable), relevant CC&R sections, and matching precedents. Members use the threaded discussion for deliberation. The committee chair sets a voting deadline (typically aligned with the next scheduled ARC meeting or a **7-14 day asynchronous voting window**).

**Meeting-based review**: For HOAs that conduct ARC reviews at scheduled meetings, the system supports agenda building, quorum tracking, and minute-taking. In Arizona and Florida, these meetings must be open to homeowners with proper advance notice (48 hours in Florida, 14 days under WUCIOA).

**Asynchronous review**: For efficiency, committee members can review and vote independently within the voting window. The system tracks votes in real time and auto-closes when the voting threshold is met.

### Step 7: Committee vote (ARC Committee, during meeting or within voting window)

Each committee member casts a vote (Approve, Deny, Approve with Conditions) with required rationale. The system verifies quorum, checks for conflicts of interest, and calculates the result against the configured threshold (default: simple majority). For conditional approvals, the voting member specifies each condition. The committee chair or manager reviews the vote tally and conditions for completeness before the decision is finalized.

**Board ratification** (optional, configurable): Under WUCIOA, some Washington HOAs may require board ratification of committee decisions. The system routes the committee's recommendation to the board for final approval, adding **up to 14 additional days** to the timeline.

### Step 8: Decision notification (System auto-generates, immediate upon finalization)

The system generates the appropriate decision letter from templates, populates it with application-specific details (modification description, conditions, cited guidelines), and delivers it via all configured channels (email, push, SMS, portal, optional physical mail). For denials, the letter includes the appeal process description, filing deadline, and resubmission guidance.

### Step 9: Post-approval monitoring (Homeowner + ARC Liaison, ongoing)

For approved requests, the system tracks the construction timeline. Reminders fire at configurable intervals: "Your approval for [modification] expires in 60 days if work has not commenced." The homeowner can log construction milestones (started, 50% complete, substantially complete) and upload progress photos.

### Step 10: Compliance verification (ARC Liaison, within 14 days of completion report)

When the homeowner reports project completion (or the completion deadline arrives), the ARC liaison conducts a final inspection using the mobile app's compliance verification checklist. The checklist compares approved plans against as-built conditions for each dimension: materials match, colors match, dimensions within tolerance, location matches survey, and overall appearance consistent with approval. Pass results in case closure. Partial compliance triggers a deficiency notice with correction deadline. Failure triggers the violation integration workflow.

### Step 11: Case closure and archival (System, automatic)

Upon successful verification (or administrative closure for withdrawals/expirations), the system archives the complete case file: application, all documents, committee deliberation notes, decision letter, conditions, compliance verification results, and completion photos. The case becomes part of the historical decision database and is tagged for precedent reference. The property's modification history is updated. The seven-year retention clock begins per Washington State law.

---

## Decision criteria framework

The system presents committee members with a structured evaluation framework based on industry-standard ARC review criteria observed across real-world HOA guidelines:

1. **Design compatibility**: Is the proposed modification compatible with the applicant's home, adjacent properties, and the overall neighborhood aesthetic in style, quality, materials, height, shape, texture, and color?
2. **Location and neighbor impact**: Does the modification affect adjacent properties' access, views, sunlight, ventilation, or drainage?
3. **Scale appropriateness**: Is the size of the modification proportionate to the home and surrounding structures?
4. **Material and color harmony**: Do proposed materials and colors maintain continuity with the existing residence and community standards?
5. **Workmanship standard**: Is the planned construction quality equal to or better than the surrounding area?
6. **Code compliance**: Does the proposal comply with all applicable federal, state, and local building codes?
7. **Regulatory protection check**: Does federal or state law limit the HOA's authority over this modification type?
8. **Precedent consistency**: Is the proposed decision consistent with past decisions for similar modifications?

Each criterion is scored on a three-point scale (Meets Standard / Partially Meets / Does Not Meet) with required commentary for any "Does Not Meet" rating. This structured approach creates the documented, objective record that courts require when reviewing HOA decisions for arbitrariness.

---

## Roles and permissions matrix

| Capability | Homeowner | ARC Liaison (Staff) | Committee Member | Committee Chair | HOA Manager | Board Member |
|-----------|-----------|-------------------|-----------------|----------------|-------------|-------------|
| Submit application | ✅ | ✅ (on behalf) | — | — | ✅ (on behalf) | — |
| View own application | ✅ | ✅ | — | — | ✅ | — |
| View all applications | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Completeness check | — | ✅ | — | — | ✅ | — |
| Request additional info | — | ✅ | — | ✅ | ✅ | — |
| Schedule site visit | — | ✅ | — | ✅ | ✅ | — |
| Conduct site visit | — | ✅ | ✅ | ✅ | ✅ | — |
| Internal comments | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| External comments | ✅ | ✅ | — | ✅ | ✅ | — |
| Cast vote | — | — | ✅ | ✅ | — | — |
| Approve fast-track | — | ✅* | — | ✅ | ✅ | — |
| Override deadline | — | — | — | — | ✅ | ✅ |
| Ratify committee decision | — | — | — | — | — | ✅ |
| Hear appeal | — | — | — | — | — | ✅ |
| Generate reports | — | ✅ | — | ✅ | ✅ | ✅ |
| Configure templates | — | — | — | — | ✅ | — |
| Manage guidelines/CC&Rs | — | — | — | — | ✅ | ✅ |

*Staff fast-track approval is configurable per HOA and limited to Tier 1 pre-approved modifications.

---

## Data model overview for key entities

**ARC_Application**: `application_id`, `property_id`, `homeowner_id`, `request_type` (enum of 21 types), `complexity_tier` (1/2/3), `current_state` (enum of all states), `state_history[]` (timestamped state transitions), `submission_date`, `acknowledgment_date`, `decision_date`, `decision_type`, `conditions[]`, `conditions_accepted_date`, `completion_target_date`, `actual_completion_date`, `compliance_verification_date`, `compliance_result`, `previous_application_id` (for resubmissions), `linked_violation_id`, `assigned_committee_members[]`, `review_deadline`, `deemed_approved_deadline` (calculated based on state law and CC&Rs).

**ARC_Document**: `document_id`, `application_id`, `document_type` (enum: photo, plan, survey, material_spec, color_swatch, permit, contractor_license, engineering, video, other), `file_url`, `upload_date`, `uploaded_by`, `version`, `is_required`, `annotations[]`.

**ARC_Vote**: `vote_id`, `application_id`, `committee_member_id`, `vote_value` (approve/deny/conditional), `rationale_text`, `conditions_proposed[]`, `guideline_citations[]`, `precedent_references[]`, `conflict_of_interest_declared` (boolean), `vote_timestamp`.

**ARC_Comment**: `comment_id`, `application_id`, `author_id`, `comment_text`, `visibility` (internal/external), `parent_comment_id` (for threading), `attachments[]`, `timestamp`.

**ARC_Precedent_Tag**: `tag_id`, `application_id`, `tag_hierarchy` (category/subcategory/attribute), `tag_text`, `created_by`, `created_date`.

**ARC_Compliance_Check**: `check_id`, `application_id`, `inspector_id`, `inspection_date`, `checklist_items[]` (each with approved_value, as_built_value, pass_fail), `photos[]`, `overall_result`, `deficiency_notes`, `linked_violation_id`.

**HOA_Compliance_RuleSet**: `hoa_id`, `state_code`, `general_review_deadline_days`, `deemed_approved_enabled` (boolean), `deemed_approved_deadline_days`, `ev_charger_deemed_approved_days` (statutory override), `solar_protection_level`, `written_denial_required` (boolean), `specific_reasons_required` (boolean), `open_meetings_required` (boolean), `board_ratification_required` (boolean), `records_retention_years`, `appeal_filing_deadline_days`.

---

## Conclusion

This ARC system specification addresses every identified gap in existing HOA management platforms while building on the strongest features observed across SmartWebs (property-level archives, violation integration), Vantaca (configurable multi-step workflows, voting thresholds), and TownSq (private/shared comments, analytics). Three design decisions are most consequential for competitive differentiation.

First, **smart conditional forms** that dynamically adapt to each of the 21 modification types eliminate the single largest source of incomplete submissions and wasted committee time—no existing platform offers this. Second, the **multi-state compliance engine** with hardcoded statutory protections (OTARD, solar access, EV charger deemed-approved deadlines) prevents HOAs from making legally indefensible decisions, reducing liability exposure. Third, the **post-approval compliance verification pipeline**—from construction monitoring through final inspection to violation system integration—closes the workflow gap where every competitor stops at "approved" and loses visibility into whether the approved work was actually built as planned.

The WUCIOA transition (full applicability by January 1, 2028) creates an urgent market opportunity: Washington HOAs must adapt their governance processes, and a system purpose-built for WUCIOA compliance—including board ratification workflows, open meeting integration, and enhanced records retention—provides immediate value that legacy platforms cannot match. The consistency scoring algorithm and precedent database transform ARC decision-making from subjective judgment calls into documented, defensible, pattern-consistent governance that withstands legal scrutiny.