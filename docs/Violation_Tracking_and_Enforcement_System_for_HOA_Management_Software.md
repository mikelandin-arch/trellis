# Violation tracking and enforcement system for HOA management software

**A self-managed HOA serving under 200 units needs a violation enforcement system that is legally defensible across all 50 states, operable by volunteer board members with no legal training, and fast enough to document a violation in under 60 seconds from a smartphone.** This specification defines every component of that system—from the state machine governing a violation's lifecycle to the mobile UX that makes field inspections effortless, from state-specific compliance guardrails to the analytics that defend against selective enforcement claims. The system synthesizes the best patterns from HOALife, Smartwebs, CINC Systems, and AppFolio while closing the gaps that PayHOA and other self-managed platforms leave open: no mobile inspection, no automated escalation, no bulk management, and no state-aware compliance engine.

---

## Deliverable 1: Violation lifecycle state machine

The violation lifecycle is a finite state machine with **12 primary states**, **23 transitions**, and **6 terminal states**. Every violation record moves through this machine, and the system enforces that no state can be skipped without an explicit override by a board member with appropriate permissions.

### Primary states

```
┌─────────────┐
│  REPORTED    │──── Dismiss (insufficient evidence / not a violation) ──→ [DISMISSED]
│  (Initial)  │
└──────┬──────┘
       │ Board/manager verifies
       ▼
┌─────────────┐
│  VERIFIED    │──── Dismiss (within compliance / de minimis) ──→ [DISMISSED]
└──────┬──────┘
       │ Generate courtesy notice
       ▼
┌─────────────────┐
│ COURTESY NOTICE  │──── Owner cures ──→ [RESOLVED - CURED]
│    SENT          │──── No response after cure period ──→ FORMAL NOTICE SENT
└──────┬───────────┘
       │ Cure period expires uncured
       ▼
┌─────────────────┐
│ FORMAL NOTICE    │──── Owner cures ──→ [RESOLVED - CURED]
│    SENT          │──── Owner requests hearing ──→ HEARING SCHEDULED
│                  │──── Cure period expires ──→ ESCALATED
└──────┬───────────┘
       │
       ▼
┌─────────────────┐
│   ESCALATED      │──── Schedule hearing ──→ HEARING SCHEDULED
│                  │──── Owner cures ──→ [RESOLVED - CURED]
└──────┬───────────┘
       │
       ▼
┌─────────────────┐
│   HEARING        │──── Fine approved ──→ FINE ASSESSED
│   SCHEDULED      │──── Dismissed at hearing ──→ [DISMISSED]
│                  │──── Continued / tabled ──→ HEARING SCHEDULED (new date)
│                  │──── Owner cures before hearing ──→ [RESOLVED - CURED]
└──────┬───────────┘
       │ Hearing held, fine voted
       ▼
┌─────────────────┐
│  FINE ASSESSED   │──── Fine paid ──→ [RESOLVED - FINE PAID]
│                  │──── Owner appeals ──→ APPEAL PENDING
│                  │──── Payment plan established ──→ PAYMENT PLAN ACTIVE
│                  │──── Fine unpaid past due date ──→ FINE DELINQUENT
│                  │──── Owner cures + pays ──→ [RESOLVED - FINE PAID]
└──────┬───────────┘
       │ Unpaid past threshold
       ▼
┌─────────────────┐
│ FINE DELINQUENT  │──── Payment received ──→ [RESOLVED - FINE PAID]
│                  │──── Lien threshold met ──→ LIEN WARNING SENT
│                  │──── Payment plan ──→ PAYMENT PLAN ACTIVE
└──────┬───────────┘
       │
       ▼
┌─────────────────┐
│  LIEN WARNING    │──── Payment received ──→ [RESOLVED - FINE PAID]
│     SENT         │──── No payment ──→ LIEN RECORDED
└──────┬───────────┘
       │
       ▼
┌─────────────────┐
│ LIEN RECORDED    │──── Payment received ──→ LIEN RELEASED → [RESOLVED]
│                  │──── Board votes legal referral ──→ LEGAL REFERRAL
└──────┬───────────┘
       │
       ▼
┌─────────────────┐
│ LEGAL REFERRAL   │──── Settlement ──→ [RESOLVED - SETTLED]
│                  │──── Court judgment ──→ [RESOLVED - JUDGMENT]
│                  │──── Board withdraws ──→ [WITHDRAWN]
└─────────────────┘

APPEAL PENDING ──→ Appeal upheld ──→ return to FINE ASSESSED
               ──→ Appeal overturned ──→ [DISMISSED]
               ──→ Appeal modified ──→ FINE ASSESSED (modified amount)

PAYMENT PLAN ACTIVE ──→ Plan completed ──→ [RESOLVED - FINE PAID]
                    ──→ Plan defaulted ──→ FINE DELINQUENT
```

### Terminal states

Six terminal states exist: **RESOLVED - CURED** (violation fixed, no fine), **RESOLVED - FINE PAID** (fine satisfied), **DISMISSED** (not valid or overturned), **WITHDRAWN** (board elects to drop), **RESOLVED - SETTLED** (legal settlement), **RESOLVED - JUDGMENT** (court order).

### Edge cases and special transitions

**Ownership change mid-violation.** When a property transfers, the system freezes the current violation record, generates an estoppel snapshot, and creates a new record for the incoming owner if the physical violation persists. Unpaid fines remain on the prior owner's account; the physical condition violation transfers to the new owner with a fresh courtesy notice and full due process restart. The estoppel letter discloses all open violations and unpaid fines.

**Anonymous complaints.** The system accepts reports without complainant identity but flags them as "unverified—requires independent confirmation." No enforcement action proceeds until a board member or manager independently verifies the violation with photographic evidence. Arizona law (A.R.S. §33-1803) prohibits anonymous complaints entirely; the system enforces this per state configuration.

**Repeat offenders.** The system maintains a **12-month lookback window** per violation category per property. A second occurrence of the same category within 12 months automatically escalates the notice level (skipping courtesy, starting at formal notice) and increases the fine tier. The lookback window is configurable per community. Three or more occurrences within 12 months flags the property for board review as a chronic violator.

**Selective enforcement risk.** Every state transition is timestamped and logged. The system tracks enforcement actions across all properties and generates a **consistency score** comparing response times, fine amounts, and escalation speed for similar violation types. If a violation of a given type is being enforced against one property but a similar violation exists on another property without action, the system raises a warning to the board.

---

## Deliverable 2: Violation category taxonomy

The taxonomy uses a three-level hierarchy: **Category → Subcategory → Specific violation**, with each leaf node carrying default values for severity, cure period, and notice template. All values are configurable per community.

### Landscaping violations

| Subcategory | Specific violations | Severity | Default cure | Notes |
|---|---|---|---|---|
| Overgrown lawn | Grass exceeding height limit (typically 6-12"); weeds in lawn, beds, or cracks | Minor | 7 days | Most common violation nationwide; seasonal peak spring-summer |
| Dead/dying vegetation | Dead trees, dead shrubs, bare/brown lawn patches | Moderate | 14 days | May require professional service; 30 days if tree removal needed |
| Unapproved plantings | Plants not on approved list; hedges exceeding height; invasive species | Minor | 14 days | Requires ARC review if replacement needed |
| Tree maintenance | Overhanging branches on sidewalks/streets; untrimmed trees blocking sightlines | Moderate | 14 days | Safety escalation if blocking traffic visibility |
| Mulch/ground cover | Missing or deteriorated mulch; bare soil in beds; unapproved ground cover (gravel, rubber) | Minor | 14 days | Seasonal: spring renewal |

### Exterior maintenance violations

| Subcategory | Specific violations | Severity | Default cure | Notes |
|---|---|---|---|---|
| Paint/stain | Peeling, chipping, fading, or unapproved color | Moderate | 30 days | Weather-dependent; may extend to 60 days in winter |
| Fencing | Broken/leaning/missing sections; unapproved style or material; rust/rot | Moderate | 30 days | May require contractor |
| Roof | Missing shingles, visible damage, moss/algae growth, tarps | Major | 30 days | Insurance coordination may require extension |
| Siding/stucco | Cracks, holes, discoloration, missing pieces | Moderate | 30 days | |
| Windows/doors | Broken glass, damaged screens, unapproved window coverings visible from exterior | Minor | 14 days | Foil/cardboard in windows is common specific violation |
| Driveway/walkway | Cracks, oil stains, unapproved surface material | Minor | 30 days | |
| Gutters/downspouts | Missing, damaged, detached, overflowing | Moderate | 14 days | Safety concern if water damage to adjacent property |

### Parking violations

| Subcategory | Specific violations | Severity | Default cure | Notes |
|---|---|---|---|---|
| Street parking | Overnight parking where prohibited; parking on wrong side; blocking access | Minor | Immediate-48 hrs | Some states prohibit HOA enforcement on public streets |
| Commercial vehicles | Commercial vehicle stored in driveway or visible; work trucks exceeding size limits | Minor | 7 days | Define "commercial": signage, weight class, vehicle type |
| Inoperable vehicles | Flat tires, expired tags, non-running vehicles, vehicles on blocks | Moderate | 14 days | May require towing; provide specific date for removal |
| RV/boat/trailer | Storage of recreational vehicles visible from street; unapproved parking location | Minor | 7 days | Common CC&R restriction; 48-72 hr guest exception typical |
| Guest parking | Exceeding guest parking duration; blocking common areas | Minor | 24-48 hrs | |
| Garage use | Converting garage to living space; garage kept open/cluttered | Minor | 14 days | Often tied to parking availability requirements |

### Noise violations

| Subcategory | Specific violations | Severity | Default cure | Notes |
|---|---|---|---|---|
| Persistent animal noise | Barking dogs, roosters, persistent howling | Minor | 14 days | Require pattern documentation; single incidents rarely actionable |
| Music/entertainment | Loud music, parties beyond quiet hours | Minor | Warning | Non-curable per occurrence; fine on repeat |
| Construction noise | Work outside permitted hours | Minor | Warning | Typically defined hours: 7am-7pm weekdays, 8am-6pm weekends |
| Mechanical equipment | HVAC noise, generators, power tools outside hours | Minor | 14 days | |

### Architectural modifications without approval

| Subcategory | Specific violations | Severity | Default cure | Notes |
|---|---|---|---|---|
| Structures | Sheds, pergolas, decks, patios built without ARC approval | Major | 30 days | May require retroactive ARC submission; removal if denied |
| Exterior changes | Paint color, siding material, window replacement without approval | Moderate | 30 days | |
| Hardscape | Patio extensions, retaining walls, driveway widening | Major | 30 days | |
| Solar panels | Installation without architectural review | Moderate | 30 days | Many states protect solar rights (CA, AZ, CO); cannot prohibit, but can regulate placement |
| Satellite dishes | Unapproved location or size exceeding 1 meter | Minor | 14 days | FCC OTARD rule limits HOA authority on dishes ≤1m |

### Pet violations

| Subcategory | Specific violations | Severity | Default cure | Notes |
|---|---|---|---|---|
| Leash requirements | Off-leash in common areas | Minor | Warning | Non-curable per occurrence; fine on repeat |
| Breed/size/number | Exceeding pet count or weight limits; restricted breeds | Moderate | 30 days | Verify enforceability; service/emotional support animal exemptions (FHA) |
| Waste cleanup | Failure to pick up pet waste | Minor | Warning | Per-occurrence after first warning |
| Aggressive behavior | Biting, lunging, threatening behavior in common areas | Major | Immediate | Safety escalation; may involve animal control |

### Signage violations

| Subcategory | Specific violations | Severity | Default cure | Notes |
|---|---|---|---|---|
| Political signs | Signs exceeding size/number limits or displayed outside permitted window | Minor | 7 days | **State law preempts HOA restrictions in most states**: AZ allows 71 days before to 3 days after election; NV 30 days before early voting to 7 days after; FL/CA/CO protect noncommercial signs broadly |
| Commercial signs | Business advertising, contractor signs left after work | Minor | 7 days | |
| For-sale/rent signs | Non-conforming size, location, or number of real estate signs | Minor | 7 days | FHA and state laws protect right to display for-sale signs; HOA can regulate size/placement only |
| Holiday/seasonal | Excessive or extended displays | Minor | 14 days post-event | |

### Trash and debris violations

| Subcategory | Specific violations | Severity | Default cure | Notes |
|---|---|---|---|---|
| Bin storage | Trash cans visible from street outside collection day; bins not returned after pickup | Minor | 24-48 hrs | Most common: define permitted display window (e.g., after 5pm day before, returned by 9pm collection day) |
| Bulk items | Furniture, appliances, mattresses left at curb or in yard | Moderate | 7 days | |
| Construction debris | Materials, dumpsters, or equipment from home projects | Moderate | 7 days | Require removal plan for active projects |
| General debris | Accumulated items in yard, porch clutter, stored materials visible | Minor | 7 days | |

### Template structure for each violation type

Every violation type stores: **CC&R article reference** (configurable per community), **default notice language** (editable template with merge fields for address, owner name, date observed, cure date, fine amount), **photo requirement flag** (true for all physical violations; Nevada requires photos by statute), **severity level**, **default cure period**, and **escalation rules** (graduated fine amounts per offense tier).

---

## Deliverable 3: Notification workflow specifications

### Complete notification sequence

**Step 1: Courtesy notice (Day 0).** Triggered automatically when a verified violation is created. Delivered via email and first-class mail simultaneously. Contains: property address, owner name, specific CC&R provision violated (quoted), description of observed condition, date and time observed, photograph(s), specific cure deadline date (calculated from state-configured cure period), statement that this is a courtesy and no fine is being assessed, contact information for questions. Tone is friendly and informational: "We noticed..." not "You are in violation of..."

**Step 2: Formal violation notice (Day 7-14, triggered by cure period expiration without resolution).** Delivered via first-class mail; certified mail added automatically in Texas, Virginia, and Colorado. Contains all courtesy notice elements plus: statement that this is a formal notice, reference to the courtesy notice and its date, updated photograph if re-inspected, explicit warning of fine amounts per the community's published schedule, right to request a hearing (with deadline for request), state-required language (Texas: Servicemembers Civil Relief Act notice; Arizona: ADRE hearing right notice; Florida: fining committee hearing right). In Colorado, this serves as the first of two required 30-day cure notices.

**Step 3: Reminder/follow-up (Day 21-28, configurable).** Email and first-class mail. Brief reminder that the formal notice cure period is approaching expiration. Includes cure deadline, current photographs, and consequences of non-compliance. This is optional and configurable per community—some boards prefer to skip directly to escalation.

**Step 4: Hearing notice (triggered by cure period expiration without cure or by owner hearing request).** Minimum advance delivery: **14 days** (Florida, Virginia), **10 days** (California, Texas). System calculates the required lead time per state configuration. Delivered via the method required by state: certified mail with return receipt in Texas and Virginia; first-class mail in most other states. Contains: date, time, and location (including virtual meeting link if permitted by state) of hearing; description of violation and proposed penalty; owner's right to attend, present evidence, and be represented by counsel; right to submit written response if unable to attend. Florida hearing notices must specify the fining committee composition. Nevada hearing notices must include a clear photograph of the violation.

**Step 5: Hearing decision notice (within 7 days of hearing in Florida; 15 days in California).** Delivered per state requirements (Virginia: hand delivery or certified mail, return receipt). Contains: board/committee decision, specific fine amount if imposed, cure deadline, payment due date (Florida: minimum 30 days from notice), appeal rights and deadline, consequences of non-payment. The system auto-calculates the payment due date based on state rules.

**Step 6: Fine assessment/delinquency notice (triggered by payment due date passing without payment).** First-class and certified mail. Contains: original fine amount, any accrued daily fines for continuing violations, total balance due, interest accrued (if permitted by state—California prohibits interest on fines), payment options (online portal, check, payment plan request), warning of lien consequences, state-specific lien threshold information.

**Step 7: Resolution confirmation (triggered when violation is marked resolved).** Email and portal notification. Confirms: violation has been closed, any remaining balance (if fine was assessed), acknowledgment of cure. Positive, professional tone. This notice is important for the enforcement record and for the homeowner's peace of mind.

**Step 8: Lien warning (triggered when unpaid fines reach state-specific lien threshold).** Certified mail required in all states. Contains: total amount owed with itemized breakdown, statement of intent to record lien, deadline to pay or establish payment plan (typically 30 days), information about impact on property title and resale, state-specific foreclosure information.

### Delivery channel matrix

| Notice type | Email | First-class mail | Certified mail | Portal | Text/SMS |
|---|---|---|---|---|---|
| Courtesy | ✓ | ✓ | — | ✓ | Optional |
| Formal violation | ✓ | ✓ | TX, VA, CO | ✓ | — |
| Reminder | ✓ | ✓ | — | ✓ | Optional |
| Hearing notice | ✓ | ✓ | TX, VA | ✓ | — |
| Hearing decision | ✓ | Per state | VA (required) | ✓ | — |
| Fine assessment | ✓ | ✓ | ✓ | ✓ | — |
| Resolution | ✓ | — | — | ✓ | ✓ |
| Lien warning | ✓ | — | ✓ (all states) | ✓ | — |

### State compliance engine

The notification workflow engine reads from a **state configuration table** that stores: minimum cure period, hearing notice lead time, required delivery methods, fine cap per violation, fine cap aggregate, daily fine cap, whether a separate fining committee is required, required statutory language for notices, payment due date calculation, and appeal period. When generating any notice, the system checks the property's state and applies the appropriate rules. If a board member attempts to set a fine above the state cap or schedule a hearing with insufficient lead time, the system blocks the action and displays the specific statutory constraint.

---

## Deliverable 4: Mobile violation reporting UX flow

### Design philosophy: 45 seconds, not 60

The target is **45 seconds from unlock to submission**, leaving a 15-second buffer against the 60-second goal. This is achieved by eliminating all typing from the critical path and using the phone's native sensors (GPS, camera) as primary input devices. The flow requires exactly **4 taps and 1 photo** for a standard violation.

### Step-by-step mobile flow

**Screen 1: Home / inspection dashboard (0 seconds).** Large green button: "Report Violation" (single-violation mode) or "Start Inspection" (batch mode). Below: count of pending sync items, last inspection date, quick-access recent violations. Bottom nav: Inspect | Queue | History | Settings. The button fills the lower third of the screen for easy thumb access.

**Screen 2: Property selection (5-10 seconds).** Map view centered on GPS position with property pins color-coded: blue (no issues), yellow (open violation), red (multiple open violations), gray (not yet inspected today). The **3 nearest properties** are highlighted with enlarged pins and displayed in a bottom sheet with address and owner name. Inspector taps the correct property pin or taps from the bottom sheet list. If GPS is ambiguous between adjacent properties, the system shows the 2-3 closest and asks for confirmation. For batch inspections, properties on the current route are listed in order of proximity with a "next" button that auto-advances.

**Screen 3: Violation type selection (5 seconds).** Grid of **8 category icons** with text labels: 🌿 Landscaping, 🏠 Exterior, 🚗 Parking, 🗑️ Trash, 🐕 Pets, 📐 Architectural, 🔊 Noise, 🪧 Signs. Icons are 64x64dp minimum with 16sp labels. Tapping a category expands to show **3-6 subcategories** as large pill-shaped buttons. The most frequently used subcategory for that community is highlighted. One tap selects the specific violation type. Total: 2 taps (category + subcategory).

**Screen 4: Photo capture (10-15 seconds).** Camera opens automatically after violation type selection. Large capture button centered at bottom. Timestamp, GPS coordinates, and property address are displayed as a semi-transparent overlay on the viewfinder (and burned into the saved image). After capture, the photo appears with options: "Retake," "Add Another Photo" (up to 5), or "Continue." Photos are compressed to ~1MB and stored locally with original EXIF metadata preserved separately for chain of custody.

**Screen 5: Notes and severity (optional, 5-10 seconds).** Pre-populated description from the violation type template (e.g., "Grass height exceeds community standard of 6 inches"). Microphone icon for voice-to-text additions. Severity toggle: Minor (green) | Moderate (yellow) | Major (red)—defaults based on violation type. A "Skip" button is prominently available; notes are optional. This screen uses progressive disclosure: advanced options (custom cure period, link to specific CC&R article, priority flag) are hidden behind an "Advanced" accordion.

**Screen 6: Review and submit (3-5 seconds).** Single-screen summary card: property address, owner name, violation type with icon, photo thumbnail, notes preview, severity badge, cure deadline (auto-calculated). Large "Submit" button at bottom. Success confirmation with haptic feedback and checkmark animation. Two options appear: "Add Another" (returns to Screen 2 with same route context) or "Done."

### Batch inspection mode

For community-wide drive/walk inspections, the flow changes slightly. After tapping "Start Inspection," the inspector selects a route (pre-configured by street or zone). The map shows all properties on the route as a sequential list sorted by GPS proximity. For each property, the inspector either taps "No Violation" (marks as inspected, moves to next) or taps "Add Violation" which enters the standard 4-tap flow above. A progress bar shows "14 of 47 properties inspected." Completing a route triggers an inspection summary report. Multiple routes can be chained in a single session.

### Offline architecture

The app downloads all community data (property database with GPS coordinates, violation type taxonomy, CC&R articles, prior violation history, owner contact information) during a "Prepare" phase on WiFi. All field operations write to a local SQLite database. Photos are stored in device storage with metadata in the local DB. A queue badge shows pending items ("3 violations ready to sync"). When connectivity returns, background sync uploads all queued violations and photos. Sync status is visible: green checkmark (synced), yellow arrow (pending), red exclamation (failed—retry). Conflict resolution uses last-write-wins since inspectors typically work different routes. The app functions fully without any cellular signal, as both HOALife and Smartwebs have proven this architecture in production.

### Voice-to-text implementation

The notes field includes a microphone icon that activates native OS speech recognition (iOS Speech Framework, Android SpeechRecognizer). A custom vocabulary bias list includes HOA-specific terms: fascia, soffit, covenant, CC&R, setback, easement, common area, architectural review. The dictated text appears in real-time and is editable. On-device recognition is preferred for offline reliability; cloud-based recognition is used when online for higher accuracy.

### Address auto-detection

The system uses reverse geocoding (Google Geocoding API or Mapbox, with LocationIQ as offline fallback) to convert GPS coordinates to street addresses, then matches against the community's property database. Since standard GPS accuracy is 3-5 meters in open areas, the system never auto-selects a property without confirmation—it always presents the nearest 2-5 properties and requires a tap to confirm. For communities with available GIS/plat data, property boundary polygons enable precise identification.

---

## Deliverable 5: State-by-state compliance requirements

### Compliance matrix for top 10 HOA states

| Requirement | FL | CA | CO | AZ | TX | IL | NC | WA | VA | NV |
|---|---|---|---|---|---|---|---|---|---|---|
| **Governing statute** | Ch. 720 F.S. | Davis-Stirling (Civ. Code §4000+) | CCIOA §38-33.3 | A.R.S. §33-1803 | TRPOPA Ch. 209 | CICAA 765 ILCS 160 | N.C.G.S. Ch. 47F | RCW 64.38/64.90 | Va. Code §55.1-1800+ | NRS Ch. 116 |
| **Separate fining committee** | **Required** (3+ non-board members) | Optional | Not required | Not required | Optional | Not required | Optional | Not required | Not required | Optional (3+) |
| **Hearing notice minimum** | 14 days | 10 days | Per policy | Per policy | 10 days before hearing | Per policy | Per docs | Per policy | 14 days | Reasonable |
| **Fine cap per violation** | **$100** | **$100** (eff. 7/2025) | **$500** | No cap (reasonable) | No cap | No cap (reasonable) | **$100** | No cap (reasonable) | **$100** |
| **Aggregate/continuing cap** | **$1,000** | No escalation for same violation | $500 (no daily fines) | No cap | No cap | No cap | $100/day after 5 days | No cap | **$50 single; $10/day × 90 days = $900 max** | $1,000/hearing; $100/7-day period continuing |
| **Cure period** | Reasonable (not specified) | Right to cure before hearing | **30 days** (72 hrs health/safety) | 21-day response period | Reasonable (curable violations) | Per docs | 5 days post-decision for daily fines | Per docs (reasonable) | Reasonable (practice: 10-30 days) | Reasonable + 14 days post-fine |
| **Certified mail required** | No (recommended) | No | **Yes** (+ posting + one additional method) | No (recommended) | **Yes** (all enforcement notices) | No | No | No | **Yes** (hearing notice + decision) | No |
| **Email notice permitted** | Yes | Yes | Yes (if owner provided) | Not specified | Yes (opt-in only) | Yes | Not specified | Yes | Not specified | Not specified |
| **Right to counsel at hearing** | Not specified | Yes | Not specified | Not specified | Not specified | **Yes** (explicit) | Not specified | Not specified | **Yes** (explicit) | Not specified |
| **Hearing decision deadline** | **7 days** written | **15 days** written | Per policy | Per policy | Per policy | Per policy | Per docs | Per policy | **7 days** (hand delivery or certified) | Per policy |
| **Hearing deadline from notice** | **90 days** max | None specified | None specified | None specified | **30 days** from request | None specified | None specified | None specified | None specified | None specified |
| **Fines create lien** | Only if ≥$1,000 + declaration authorizes | **No** | Per docs (but no foreclosure on fines alone) | **No** | No (fines alone) | Per docs | **Yes** | **No** | **Yes** (as assessment) | Per docs |
| **Foreclosure on fines** | Possible (if ≥$1,000 + declaration) | **Prohibited** | **Prohibited** (fines alone) | **Prohibited** | **Prohibited** (fines alone) | Unclear | Yes (judicial only) | **Prohibited** | Possible | Possible with process |
| **State agency oversight** | DBPR | None | HOA Information Center | **ADRE** (admin hearing) | None | Ombudsperson | None | None | CIC Board | **RE Division + Ombudsman** |
| **Record retention** | Official records act | Per Civil Code | Per §317 | Per §33-1805 | Per docs | Per docs | Per §47F-3-118 | **7 years** (explicit) | Per docs | General record required |
| **Political signs** | Protected (§720.304) | Protected (§4710) | Protected (§38-33.3-106.5) | 71 days before to 3 days after election | Protected (§202.009) | First Amendment | Flag display protected | Cannot prohibit | US flag protected | 24"×36" max; 30 days before early voting to 7 days after |
| **Payment application order** | Per docs | **Assessments first, then costs/fees** (§5655) | Per docs | Principal first, then interest | **Assessments → Current assessments → Legal costs → Atty fees → Fines → Other** (§209.0063) | Per docs | Per docs | Per docs | Per docs | Per docs |
| **Payment plan required** | No | No | **Yes** (18-month plan, min $25/mo before foreclosure) | No | **Yes** (HOAs ≥15 lots; 3-18 month term) | No | No | No | No | No |
| **Interest on fines** | Per docs (18% max on assessments) | **Prohibited on fines** (AB 130) | 8% max | Per docs | Per docs | Per docs | Per docs | Per docs | Per docs | **Prohibited** |

### Critical state-specific rules the system must enforce

**Florida** requires the system to: (1) prevent any board member, officer, employee, or their spouse/parent/child/sibling from being assigned to the fining committee; (2) enforce the 14-day hearing notice window; (3) enforce the 90-day maximum between notice and hearing; (4) cap fines at $100/day and $1,000 aggregate; (5) ensure the 30-day payment window after hearing decision; (6) generate the hearing decision notice within 7 days.

**California** requires the system to: (1) enforce the $100 per violation cap (effective July 2025 per AB 130); (2) block late fees or interest on fines; (3) ensure the owner has an opportunity to cure before the disciplinary meeting; (4) allow the board to make a written health/safety finding at an open meeting to exceed the $100 cap; (5) deliver hearing decision within 15 days; (6) provide IDR/ADR information in escalation notices.

**Colorado** requires the system to: (1) enforce two consecutive 30-day cure periods before legal action; (2) enforce the 72-hour cure period for health/safety violations; (3) generate notices via certified mail AND physical posting AND one additional method; (4) allow owners to designate a third party and preferred language for notices; (5) block daily fines (not permitted); (6) cap fines at $500 per violation; (7) require an 18-month payment plan before foreclosure.

**Texas** requires the system to: (1) send all enforcement notices via certified mail; (2) include Servicemembers Civil Relief Act notice in all violation letters; (3) distinguish between curable and non-curable violations; (4) enforce the 30-day hearing request window; (5) apply payments in the statutory order (assessments first, fines last); (6) offer payment plans for HOAs with 15+ lots.

**Arizona** requires the system to: (1) provide 21-day owner response period; (2) respond within 10 business days to owner responses; (3) include ADRE hearing right notice in all enforcement communications; (4) reject anonymous complaints; (5) prevent fines from being included in assessment liens.

**Nevada** requires the system to: (1) include a clear photograph with every violation notice for physical violations; (2) require detailed fine schedules with categories and specific amounts (no "all violations" category); (3) cap fines at $100 per violation or $1,000 per hearing; (4) enforce the 14-day cure period before continuing fines; (5) impose continuing fines per 7-day period; (6) prohibit interest on fines; (7) anonymize violation records (no names/addresses in general violation records per NRS 116.31175).

---

## Deliverable 6: Comprehensive feature specification

### Area 1: Full violation lifecycle

Covered in Deliverable 1 above. The state machine handles all branches: cure at any stage, dismissal at any stage, hearing, fine, appeal, payment plan, lien, and legal referral. The system enforces sequential progression—you cannot skip from courtesy notice to lien without passing through formal notice and hearing (unless the board documents an emergency override). Every transition is logged with the user who triggered it, timestamp, and reason. The audit log is immutable and retained for the state-configured retention period (minimum 7 years for Washington properties, configurable for others).

### Area 2: Violation categories

Covered in Deliverable 2 above. The taxonomy is stored as a configurable tree structure. Each community imports a default set and customizes it to match their specific CC&Rs. HOALife's approach of AI-parsing uploaded CC&R documents to auto-generate violation categories is the gold standard and should be replicated. The system ships with templates for the 8 major categories and 35+ subcategories documented above, with suggested fine amounts, cure periods, and notice language.

### Area 3: State-by-state notice requirements

Covered in Deliverable 5 above. The system stores compliance rules as a configuration layer keyed by state, with the 10 researched states pre-configured. Adding new states requires only populating the configuration table—no code changes. The compliance engine acts as a guardrail, not a gate: it warns and blocks non-compliant actions (e.g., "Texas requires certified mail for this notice type") rather than hiding options.

### Area 4: Photo and video evidence handling

**Capture.** All photos taken through the app embed visible watermarks (date, time, GPS coordinates, property address) and preserve original EXIF metadata in a separate metadata record. The app stores two versions: the watermarked display version and the original unmodified file. Photos are captured at minimum **2MP resolution** with GPS accuracy recorded (±X meters).

**Storage.** Photos are stored in encrypted cloud storage (AES-256) with access controls. Each photo receives a **SHA-256 hash** at capture time, stored in the violation record. Any subsequent modification would produce a different hash, enabling tampering detection. The system maintains an access log for every photo view and download.

**Chain of custody.** The system records: who captured the photo (user ID + device ID), when (device clock + server clock comparison), where (GPS coordinates + accuracy), when uploaded, who has viewed it, and whether it has been included in any notice or hearing packet. This chain is exportable as a court-ready evidence log.

**Privacy safeguards.** The system includes a privacy checklist that appears during the first photo capture of each inspection session: "Ensure photos focus on the violation, not people. Avoid capturing home interiors, children, or individuals." Photos should only capture conditions visible from public areas or common areas per the *Katz v. United States* reasonable expectation of privacy standard. The system allows board members to crop or redact portions of photos before including them in notices (while preserving the original for the evidence record). The legal safe harbor, as established in Florida case law (*Hidden Harbour Estates v. Norman*), is that photographing visible property conditions from public areas is permissible as long as the images do not capture people or home interiors.

**Admissibility.** For HOA hearings (administrative, not judicial), photos with timestamps and GPS data are routinely accepted without formal authentication. For court proceedings, the chain of custody log, hash verification, and metadata preservation provide the foundation for authentication under evidence rules. As Tinnelly Law Group advises, courts want "actual physical photo evidence and clear documentation of the homeowner's violation history."

### Area 5: Automated notification workflows

Covered in Deliverable 3 above. The workflow engine is timer-based: each violation record carries a set of scheduled events (next notice date, cure deadline, hearing date, payment due date). A background process checks daily for due events and triggers the appropriate actions. The system integrates with postal mail APIs (Lob or LetterStream) for automated printing and mailing of physical notices, including certified mail with return receipt tracking. Email delivery uses a transactional email service with delivery confirmation and read receipts. The system logs every delivery attempt and its outcome.

### Area 6: Board review and voting workflow

**Violation review.** New violations appear on a board dashboard sorted by severity and age. Each violation card shows: property, type, photo, date reported, current state, and days since last action. Board members can filter by status, type, severity, route, or assigned member.

**Executive session.** Violation discussions involving specific homeowners are flagged for executive session per state open meeting laws. The system supports creating executive session agenda items linked to violation records. California requires that if the member requests executive session, the board must comply. The system generates separate executive session minutes that document topics discussed without identifying confidential details, along with a note that the board reconvened in open session to vote.

**Voting.** The system enforces quorum requirements (configurable per community bylaws, typically majority of board). Votes are recorded electronically: each board member casts approve/deny/abstain, and the result is automatically calculated and logged. For Florida, the system ensures the fining committee (not the board) conducts the vote on fine approval.

**Conflict of interest.** Before any violation discussion, the system prompts each participating board member: "Do you have a conflict of interest with this property? (You are the owner, a neighbor, or have a personal dispute with the owner.)" A "Yes" response automatically recuses the member from discussion and vote, logs the recusal, and adjusts the quorum count. California Civil Code §5350 prohibits directors from voting on discipline of themselves—the system enforces this by matching the violation property against board member addresses. If a board member's property is the subject of a violation, they are automatically blocked from the hearing and vote.

**Documentation.** Every hearing generates a structured record: attendees, evidence presented (linked photos/documents), homeowner's response (written or verbal summary), board discussion summary, vote tally, decision, and rationale. This record is retained per the state-configured retention period and is exportable as a PDF hearing packet.

### Area 7: Fine assessment and tracking

**Graduated fine schedules.** The default schedule ships as: 1st offense = courtesy notice (no fine), 2nd offense = $25, 3rd offense = $50, 4th offense = $100, subsequent = $100 each. For continuing violations, daily fines of $25/day begin the day after the cure deadline. All amounts are configurable per community and overridden by state caps. The system prevents any fine from exceeding the applicable state cap and displays a warning when a board member attempts to set a fine above the limit.

**Daily fines.** For continuing violations (ongoing conditions like overgrown grass vs. one-time events like an unauthorized party), the system calculates daily fines automatically from cure deadline expiration. Colorado's prohibition on daily fines is enforced at the state configuration level. Virginia's $10/day cap with 90-day maximum is auto-calculated. Nevada's 7-day period structure is supported as an alternative to daily fines.

**Payment plans.** The system supports structured payment plans with: total amount, number of installments, payment frequency (monthly, bi-weekly), start date, and auto-payment enrollment. Texas requires plans of 3-18 months for HOAs with 15+ lots; Colorado requires 18-month plans with minimum $25/month before foreclosure. The system tracks plan compliance and auto-triggers delinquency if a payment is missed.

**Fine waivers.** Board members can waive or reduce fines with a documented rationale. The system logs all waivers and includes them in consistency analytics to ensure waivers are granted equitably. A waiver of more than 50% of a fine requires approval from a majority of the board (configurable).

**Interest.** Where permitted, interest accrues automatically at the state-configured rate (maximum 18% in Florida, 8% in Colorado). California and Nevada prohibit interest on fines—the system enforces zero interest for these states. Interest calculations are visible on the homeowner ledger with accrual dates.

### Area 8: Financial module integration

**Homeowner ledger.** Fines appear as separate line items on the owner's financial ledger, categorized as "Violation Fine" with a link to the underlying violation record. The ledger shows: date assessed, description (violation type + date), amount, payments applied, and running balance. Fines are distinct from assessments, late fees, and legal fees.

**Payment application order.** The system applies payments in the order required by state law. Texas mandates: delinquent assessments → current assessments → legal costs for assessments → other attorney fees → fines → other. California mandates: delinquent assessments → collection costs/late charges/interest. The system's default order is configurable per state. When a payment is received, the system automatically applies it in the correct order and displays the allocation on the receipt.

**Lien recording.** When unpaid fines reach the state-specific lien threshold (Florida: $1,000 if declaration authorizes; North Carolina: any amount; Virginia: as assessment), the system generates a lien warning notice (certified mail), waits the configured period, and then generates a pre-populated lien document for board review and recording. The system tracks lien status (warned, recorded, released) and integrates with county recording offices where electronic recording is available.

**Resale certificates/estoppel letters.** When a resale certificate is requested, the system automatically populates: all open violations with current status, all unpaid fines with itemized breakdown, all pending hearings or appeals, and any active liens. Florida's standardized estoppel form is pre-built; the system auto-generates the required content. The certificate is binding on the HOA for 30 days (electronic) or 35 days (mailed) in Florida.

**Foreclosure guardrails.** The system enforces state restrictions on fine-based foreclosure. For California, Colorado, Texas, Arizona, and Washington, the system blocks any foreclosure action where the only delinquent amounts are fines. For Florida (fines ≥$1,000 with declaration authorization), North Carolina (judicial foreclosure only), and Virginia (fines treated as assessments), the system permits foreclosure initiation with appropriate warnings and documentation requirements.

### Area 9: Reporting and analytics

**Violation trends.** Time-series charts showing violation counts by category, month, and year. Year-over-year comparison identifies whether enforcement is improving community compliance. Seasonal pattern analysis highlights expected peak periods (landscaping in summer, holiday decorations in January).

**Repeat offender identification.** The system maintains a **repeat offender score** per property: number of violations in trailing 12 months, weighted by severity. Properties exceeding a configurable threshold (default: 3 violations in 12 months) are flagged on the board dashboard and in inspection route views. The board can generate a chronic violator report for executive session review.

**Resolution time metrics.** Average and median days from report to resolution, broken down by violation type, severity, and board member assigned. Benchmarks: first-notice cure rate target of **70%+** (industry standard); average resolution time target of **21 days** for minor violations, **45 days** for moderate, **90 days** for major.

**Violation hotspot mapping.** A geographic heatmap overlaid on the community map showing violation density by area. This uses the GPS coordinates captured during inspections. Hotspots identify areas requiring more frequent inspection or infrastructure investment (e.g., a street with recurring landscaping violations may need community-wide communication about lawn care standards). Smartwebs and HOALife both offer this feature in production.

**Enforcement consistency analytics.** The core defense against selective enforcement claims. The system generates a **consistency report** showing: average days to first notice by violation type (deviation flags properties that received significantly faster or slower response), fine amounts assessed for similar violations (deviation flags disproportionate fines), cure periods granted for similar violations, and complaint-driven vs. inspection-driven enforcement ratio. If the system detects that more than 30% of enforcement actions originate from complaints rather than systematic inspections, it warns the board that complaint-driven enforcement increases selective enforcement risk.

**Board workload metrics.** Violations per board meeting, hearing backlog (violations awaiting hearing), average hearings per month, staff hours on enforcement (if tracked), and open violations per board member (if assigned). These metrics help self-managed HOAs understand whether their volunteer capacity is sufficient.

**Seasonal patterns.** Based on historical data, the system identifies seasonal peaks and suggests proactive communication. Example: "Landscaping violations typically increase 340% between April and June in your community. Consider sending a community-wide reminder in March."

### Area 10: Mobile-first violation reporting

Covered in Deliverable 4 above. The key differentiator for this platform is making mobile inspection as effortless for a **volunteer board member walking their dog** as it is for a professional community manager. The "4 taps and a photo" flow eliminates all typing from the critical path. Batch inspection mode with route-based organization supports systematic community-wide inspections. Full offline capability ensures the app works in communities with poor cellular coverage. The system supports both native mobile apps (React Native or Flutter for iOS and Android) and a PWA fallback for occasional users.

**AI-assisted violation detection.** Following CINC Systems' Cephai+ roadmap, a future enhancement is photo analysis that auto-suggests violation types from captured images. The MVP for this is image classification that identifies the most likely violation category (landscaping, parking, exterior, trash) and pre-selects it, saving one tap. This requires training data from community violation photos and can be implemented incrementally.

### Area 11: Homeowner self-service

**Violation portal.** Homeowners log into their community portal (web and mobile) and see a violations tab showing: all current violations with status, photos, cure deadline, and fine balance; all historical violations (resolved and dismissed); a timeline view showing every notice sent and every status change. The portal uses the same color coding as the board view: red (new/active), yellow (pending hearing or payment), green (resolved), gray (dismissed).

**Written response submission.** For any active violation, the homeowner can submit a written response directly through the portal. The response is attached to the violation record and visible to all board members. Rich text editing and photo/document upload are supported. The system timestamps the response and sends a confirmation receipt to the homeowner.

**Hearing request.** A "Request Hearing" button appears on any violation that is in formal notice or escalated state. Tapping it generates a hearing request form (pre-populated with violation details) and submits it to the board. The system auto-schedules the hearing per state timing requirements and sends the hearing notice.

**Counter-evidence upload.** Homeowners can upload photos, documents, contractor invoices, or other evidence supporting their position. Uploads are timestamped and logged. The board sees all uploaded materials when reviewing the violation. This is critical for situations where the homeowner has cured the violation and wants to document compliance without waiting for the next inspection.

**Fine payment.** The portal displays the current fine balance with itemized breakdown (base fine, daily fines, interest if applicable). Homeowners can pay via ACH, credit card, or request a payment plan. Payment confirmation is immediate, and the violation status auto-updates. Auto-pay enrollment is available for payment plans. Credit card processing at 3.25% + $0.50 and ACH at $1.95 per transaction (consistent with PayHOA pricing) keeps costs reasonable for self-managed communities.

**Violation history.** A complete, chronological history of all violations for the homeowner's property is accessible at any time. This includes resolved violations, demonstrating that the system treats the homeowner fairly and maintaining transparency. Historical records include all notices sent, responses received, hearing outcomes, and fine payments.

**Anonymous violation reporting by homeowners.** Homeowners can report violations on other properties through the portal. The system offers both attributed and anonymous reporting options. Anonymous reports are flagged for independent verification before any enforcement action. Arizona properties automatically disable the anonymous option per state law. The report form collects: property address, violation type, description, optional photos, and date observed. Submitted reports enter the board's review queue as "Resident Report — Requires Verification."

---

## System configuration and multi-state support

The entire platform is built on a **configurable compliance engine** rather than hard-coded state rules. Each community profile contains: state jurisdiction, applicable statute, fine caps (per violation and aggregate), cure period defaults, required delivery methods per notice type, hearing notice lead time, hearing decision notification deadline, whether a fining committee is required, whether daily fines are permitted, interest rate cap on fines, whether fines can create liens, whether foreclosure is permitted on fines alone, payment application order, mandatory statutory notice language, record retention period, and political sign rules.

When a new community is onboarded, the system auto-populates these values from the state template. Board members can customize within the legal bounds—the system prevents any configuration that would violate state law (e.g., setting a $200 fine cap in Florida where the statute limits it to $100). For states not in the pre-configured set, the system defaults to the most conservative settings across all states and prompts the administrator to consult counsel.

This architecture ensures the platform can serve communities in any state without code changes, simply by adding or updating state configuration profiles. As state laws evolve (and they evolve frequently—California AB 130, Colorado HB 22-1137, and Florida HB 1203 all passed between 2022 and 2025), the platform team updates the state profiles and existing communities receive updated guardrails automatically.

---

## How this system defends against the five most common HOA enforcement failures

**Selective enforcement.** Systematic inspection mode with route-based community coverage ensures violations are identified uniformly. Consistency analytics flag disparate treatment. Every enforcement action is timestamped and logged, creating an auditable record that the association can produce in court to demonstrate uniform application.

**Due process violations.** The state machine prevents skipping steps. The compliance engine enforces state-specific notice periods, delivery methods, and hearing rights. The system will not allow a fine to be assessed without a hearing (where required) or a notice to be sent without the required statutory language.

**Volunteer board burnout.** The 45-second mobile workflow, automated notice generation, automated escalation timers, and template-driven communications reduce the time burden on volunteer board members from what HOALife users report was "60-70 hours per week" to a fraction. Batch inspection mode means a board member can inspect 50 properties in a 30-minute walk.

**Homeowner dissatisfaction.** The self-service portal provides transparency that 57% of HOA residents say they lack. Homeowners can see exactly what rule was violated, view the photographic evidence, track the status of their violation, submit their response, and pay fines online. This transforms enforcement from an opaque, adversarial process into a transparent, documented one.

**Legal exposure from poor documentation.** Every photo is geotagged, timestamped, and hashed. Every notice is logged with delivery confirmation. Every hearing is documented with attendees, evidence, and vote records. Every fine is tracked with payment history. The complete violation record is exportable as a court-ready evidence package at any time, meeting the standard courts require: "actual physical photo evidence and clear documentation of the homeowner's violation history."