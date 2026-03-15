# Mobile-first HOA management app: UX specification

This specification defines the complete user experience for a React Native (Expo SDK 53) HOA management app serving homeowners and volunteer board members in self-managed communities under 200 units. **The core design thesis: treat homeowners as consumers who want a 3-tap experience, and board members as mobile knowledge workers who need field-ready efficiency.** Every pattern below builds on competitor intelligence — TownSq's 4.7-star engagement model, ONR's senior-friendly simplicity, and the cautionary wreckage of FRONTSTEPS Caliber's 1.6-star mobile experience — to define a product that closes the industry's critical gap: no competitor combines mobile-first design, AI assistance, and self-managed pricing.

---

## A. User persona definitions

### Persona 1: The Homeowner — "Maria, 62, retired teacher"

Maria lives in a 140-unit community in suburban Arizona. She uses an iPhone 13 her daughter set up for her. She pays HOA dues quarterly, mostly forgets about her HOA until something goes wrong, and has never downloaded a "portal" app before — she's part of the **81% of HOA members who don't use their community portal**. Maria checks text messages and Facebook daily but finds most apps confusing. She received a violation notice last month for her mailbox paint and didn't know how to respond.

**Goals:** Pay dues without calling anyone. Understand what's happening in her community. Respond to that violation notice. Find the CC&Rs when her neighbor asks about fence height rules.

**Frustrations:** Too many passwords. Apps with tiny text. Confusing navigation that makes her feel "stupid." Paper notices that arrive days after decisions are made. The current process requires her to mail a physical check to a PO box.

**Tech comfort:** Uses texting, Facebook, weather, and photos apps. Understands tapping and scrolling. Uncomfortable with swiping gestures, long-press interactions, and anything that requires typing long passages. Would benefit enormously from voice-to-text.

**Design implications:** Every screen Maria touches must have **18sp minimum body text**, **48×48dp minimum touch targets** (56dp for primary actions), single-column layouts, and no more than one primary action per screen. Navigation must never exceed 3 levels deep. ONR's success with elderly residents stems from exactly this philosophy — one reviewer noted their elderly parents transitioned "from paper to app in less than a week" because of ONR's clean, uncluttered interface and bulletin-board metaphor that maps to familiar physical-world concepts.

### Persona 2: The Board Member — "David, 44, software engineer"

David volunteered for the board after a landscaping dispute. He has a day job, two kids, and roughly 5-8 hours per week for HOA tasks — most of it on his phone during breaks, commutes, and after dinner. He conducts violation inspections on Saturday mornings by driving through the neighborhood in 45-minute sessions. He needs to inspect 40-60 properties per session, take photos, and generate notices — all while maintaining momentum.

**Goals:** Complete inspections in the field without returning to a computer. Review ARC requests during downtime. Send announcements without drafting them from scratch. Understand the community's financial health at a glance.

**Frustrations:** Desktop-only workflows that force him to "do his homework" at night. Apps that lose data when connectivity drops (cellular dead zones in his community's back section). FRONTSTEPS users report needing "twenty clicks to get where you need to be" — David abandons tools that waste his time.

**Tech comfort:** Power user. Comfortable with complex apps but has zero patience for poor UX because he builds software himself. Will use keyboard shortcuts, gestures, and batch operations. Expects offline capability.

**Design implications:** David needs information density, batch operations, and keyboard/voice shortcuts. His tab bar includes Admin functions. His dashboard leads with action items (pending ARC reviews, overdue violations, upcoming meeting prep) rather than informational cards. Progressive disclosure lets him drill from summary to detail without page-hopping.

### Persona 3: Board Officers — role-specific variants

**President (Sarah, 51, marketing director):** Needs the 30,000-foot view. Her dashboard shows community health: open violations trending down, collections rate, upcoming board meeting agenda status, and pending governance actions. She cares about communication cadence — has the community heard from the board this month?

**Treasurer (Jim, 58, retired accountant):** Lives in the financial data. His dashboard surfaces **P&L summary, budget vs. actual variance, aging receivables, and delinquency rate**. He needs to answer "how are we doing financially?" in 10 seconds. TownSq's fatal flaw for treasurers: financial data locked in PDF-only format with no ability to compare periods or drill into line items.

**Secretary (Anh, 38, paralegal):** Manages the paper trail. Her dashboard surfaces upcoming meeting preparation status, pending minutes approval, document version control, and action item tracking from the last meeting. She creates agendas, records votes, and ensures compliance with governing documents.

---

## B. Information architecture and navigation design

### Expo-router file structure with role-based routing

SDK 53's `<Tabs.Protected>` component provides first-class conditional tab visibility — the cleanest pattern for role-based navigation. The file structure below separates concerns cleanly:

```
src/app/
├── _layout.tsx                     # Root: auth provider, theme, offline provider
├── (auth)/
│   ├── _layout.tsx                 # Stack navigator for auth flow
│   ├── welcome.tsx                 # Magic link landing
│   ├── verify.tsx                  # Identity verification
│   └── setup.tsx                   # Minimal profile setup
├── (tabs)/
│   ├── _layout.tsx                 # Bottom tab navigator with Protected guards
│   ├── index.tsx                   # Home/Dashboard (role-adaptive)
│   ├── payments/
│   │   ├── _layout.tsx             # Stack within tab
│   │   ├── index.tsx               # Payment overview + history
│   │   ├── pay.tsx                 # One-tap payment confirmation
│   │   └── methods.tsx             # Manage payment methods
│   ├── community/
│   │   ├── _layout.tsx
│   │   ├── index.tsx               # Announcements feed
│   │   ├── [postId].tsx            # Announcement detail + RSVP
│   │   ├── documents/
│   │   │   ├── index.tsx           # Document library with search
│   │   │   └── [docId].tsx         # Document viewer (PDF, cached)
│   │   └── contacts.tsx            # Board contact directory
│   ├── requests/
│   │   ├── _layout.tsx
│   │   ├── index.tsx               # My requests list (violations + ARC)
│   │   ├── violations/
│   │   │   └── [violationId].tsx   # Violation detail + respond
│   │   └── arc/
│   │       ├── new.tsx             # Multi-step ARC submission wizard
│   │       └── [arcId].tsx         # ARC request detail + status
│   ├── admin/                      # Board-only tab (Protected guard)
│   │   ├── _layout.tsx
│   │   ├── index.tsx               # Admin dashboard (role-specific widgets)
│   │   ├── violations/
│   │   │   ├── index.tsx           # Violation management list
│   │   │   ├── inspect.tsx         # Inspection mode (4-tap flow)
│   │   │   └── [violationId].tsx   # Violation detail (board view)
│   │   ├── arc-review/
│   │   │   ├── index.tsx           # ARC review queue
│   │   │   └── [arcId].tsx         # ARC review interface
│   │   ├── financials/
│   │   │   ├── index.tsx           # Financial dashboard
│   │   │   └── [reportType].tsx    # Specific report view
│   │   ├── communications/
│   │   │   ├── index.tsx           # Communication history
│   │   │   └── compose.tsx         # Communication composer
│   │   └── meetings/
│   │       ├── index.tsx           # Meeting list
│   │       ├── [meetingId].tsx     # Meeting detail/agenda
│   │       └── minutes.tsx         # Minutes editor
│   └── profile/
│       ├── _layout.tsx
│       ├── index.tsx               # Profile + settings
│       ├── notifications.tsx       # Notification preferences
│       └── role-switch.tsx         # View-as toggle (board members)
└── (modals)/
    ├── _layout.tsx                 # Modal presentation
    ├── payment-confirm.tsx         # Payment confirmation modal
    ├── photo-capture.tsx           # Camera with overlay guides
    └── voice-note.tsx              # Voice recording modal
```

### Bottom tab bar configuration by role

**Homeowner tabs (4 tabs):**

| Tab | Icon | Purpose |
|-----|------|---------|
| Home | house | Dashboard with balance, announcements, quick actions |
| Payments | credit-card | Pay dues, history, autopay management |
| Community | megaphone | Announcements, documents, events, contacts |
| Profile | person | Settings, notifications, help |

**Board member tabs (5 tabs):**

| Tab | Icon | Purpose |
|-----|------|---------|
| Home | house | Role-specific dashboard with action items |
| Payments | credit-card | Same as homeowner (they pay dues too) |
| Community | megaphone | Same as homeowner + compose capability |
| Admin | shield | Violations, ARC review, financials, meetings, comms |
| Profile | person | Settings, role switch, sync status |

The `Admin` tab uses a `<Tabs.Protected guard={isBoardMember}>` wrapper. When the guard evaluates to false, the tab is completely hidden and inaccessible — even via deep link. This prevents the FRONTSTEPS anti-pattern of exposing admin functions to unauthorized users.

Research consensus is firm: **never exceed 5 bottom tabs**. Beyond 5, touch targets shrink below usable thresholds and cognitive load increases. TownSq's navigation issues stemmed partly from information overload on its pre-redesign homepage — the November 2025 redesign specifically addressed this by introducing role-based personalization and pinned content.

### Role-switching for board members who are also homeowners

Board members are always homeowners too. Rather than maintaining separate app instances (TownSq's model of two separate apps — Community and Business — creates confusion), implement a **unified app with a role-context toggle** in Profile settings. The toggle reads "Viewing as: Board Member" with a segmented control offering "Homeowner | Board Member." When switched to Homeowner, the Admin tab disappears and the dashboard shows the simplified homeowner view. The app remembers the last-used role across sessions.

The toggle exists in Profile rather than on every screen because role-switching is infrequent — a board member typically stays in board mode during admin sessions and homeowner mode when making personal payments. Forcing constant role selection (like Uber's driver/rider switch on every launch) would add unnecessary friction.

### Progressive disclosure strategy

The architecture enforces progressive disclosure at three levels:

**Level 1 — Tab visibility.** Homeowners see 4 tabs. Board members see 5. Complexity is invisible to those who don't need it.

**Level 2 — Dashboard cards.** The home screen shows summary cards (balance due, announcement count, open violations). Each card is tappable for drill-down. No card shows more than one key metric and one action. This follows ONR's principle — praised because "the user experience is fantastic" — of showing only what matters in the moment.

**Level 3 — Screen-level expandables.** Financial reports show totals with expandable category breakdowns. Violation lists show status counts with filter controls hidden behind a filter icon. Meeting agendas show items with expandable discussion notes. Nielsen Norman Group's research confirms: **limit progressive disclosure to 2 levels maximum** before users lose context.

### Navigation depth limits

**Hard rule: 3 taps maximum from any tab to any actionable screen.** Examples:
- Pay dues: Home → Pay Now button → Confirm (2 taps)
- Respond to violation: Requests tab → Violation detail → Submit Response (3 taps)
- Review ARC request: Admin tab → ARC item → Vote (3 taps)

Beyond 3 levels, use modals for interrupting flows (payment confirmation, photo capture, voice recording) rather than pushing deeper into the stack. Modals don't add perceived navigation depth because the user understands they're temporary overlays.

---

## C. Key user journey maps

### Homeowner journeys

**Journey 1: Pay monthly dues (target: 2 taps from dashboard)**

Maria opens the app. Her dashboard's top card shows "Balance Due: $350.00" with a prominent green "Pay Now" button (56dp height, full width). She taps Pay Now. The payment confirmation screen appears showing: amount ($350.00), payment method (Bank Account ••••6789 — her saved ACH method), and due date. She taps "Confirm Payment." A success animation plays with a checkmark. A receipt is available immediately. Total interaction: **2 taps, under 15 seconds**.

If Maria has no saved payment method, the first payment requires adding one via Stripe's PaymentSheet component — which handles bank connection (via Plaid for instant ACH verification), card entry, and Apple/Google Pay in a prebuilt UI. After this one-time setup, subsequent payments revert to the 2-tap flow. The app defaults to ACH for recurring dues (significantly lower processing fees on $200-500 monthly amounts) and offers card as a convenience option.

For autopay enrollment: the payment confirmation screen includes a toggle — "Set up automatic monthly payments" — with clear language: "Your account will be charged automatically on the 1st of each month. You can cancel anytime in Settings." This directly addresses the adoption problem: **making payments effortless is the single strongest driver of portal adoption** according to industry research from Pilera and PayHOA.

**Journey 2: View and respond to a violation notice**

Maria receives a push notification: "You have a new violation notice for 742 Elm Street." She taps the notification, which deep-links to the violation detail screen. The screen shows: violation type (Mailbox — Paint/Condition), date issued, deadline to cure (30 days), status badge ("Open — Response Required"), a clear photo of her mailbox taken during inspection, and the relevant CC&R section excerpt.

Below the details, a prominent "Respond" button opens a response form. Maria can: (1) type a response, (2) tap the microphone icon to dictate her response via voice-to-text, (3) upload photos showing she's fixed the issue, or (4) request an extension with a reason. After submitting, the status changes to "Response Submitted — Under Review" and she receives a confirmation push notification.

**Journey 3: Submit an ARC request (guided 5-step wizard)**

Maria wants to replace her front door. She navigates to Requests → New ARC Request. The guided wizard uses Nielsen Norman Group discrete step indicators showing all 5 steps upfront:

- **Step 1 — Request type:** Visual category grid (Exterior Paint, Landscaping, Fencing, Doors/Windows, Roofing, Solar, Other). Maria taps "Doors/Windows."
- **Step 2 — Property and location:** Pre-filled with her address. She confirms and taps the area of the home on a simple diagram (front, side, back).
- **Step 3 — Description:** Text field with microphone icon for voice-to-text. Prompt text guides her: "Describe what you want to change and why." She dictates: "I want to replace my front door with a fiberglass door in dark bronze."
- **Step 4 — Photos:** Camera opens with overlay guides showing the recommended framing (existing condition, proposed product, and location context). She takes 3 photos. Thumbnails appear with the ability to retake.
- **Step 5 — Review and submit:** Summary of all entered information with "Edit" links per section. She taps "Submit Request." A confirmation screen shows estimated review timeline (typically 2-4 weeks).

Drafts auto-save to local storage (MMKV for the form state, WatermelonDB for the record) at each step completion. If Maria exits mid-flow, she sees a "Draft — Front Door Replacement" card in her Requests tab and can resume where she left off.

**Journey 4: Read and find community documents**

Maria taps Community → Documents. The document library shows categorized folders: Governing Documents, Meeting Minutes, Financial Reports, Community Rules, Forms. A search bar at the top supports keyword search across document titles and content.

She taps Governing Documents → CC&Rs. The PDF opens in an in-app viewer with pinch-to-zoom and page navigation. A "Download for Offline" button (with file size shown: 2.4 MB) lets her cache the document for later reference. Downloaded documents show a green checkmark badge in the list. This addresses the common complaint across competitors — TownSq users report the app "fails to load documents" at times; cached offline documents eliminate this failure mode.

**Journey 5: View announcement and RSVP to community event**

Maria's Community tab shows a social-media-style feed (modeled on ONR's bulletin board pattern, which succeeded specifically because it maps to familiar social media patterns that even elderly users understand). The top announcement reads: "Annual Community BBQ — Saturday March 21." She taps it. The detail screen shows date/time, location, description, and an "RSVP" button with options: Going / Not Going / Maybe. She taps "Going" and sees an updated attendee count. The event is automatically added to her device calendar via a calendar integration prompt.

### Board member journeys

**Journey 1: Field violation inspection (the surrounding experience)**

David opens the app Saturday morning for his weekly inspection drive. His Admin dashboard shows an "Inspection Mode" action card at the top: "14 properties to inspect on Route A." He taps "Start Inspection."

The inspection preparation screen (online, pre-field) shows:
- Route map with all properties plotted
- "Download for Offline" button that pre-caches: property data, prior violation history, relevant CC&R sections, and map tiles for the route area
- Download progress: "Preparing route... 47/47 properties cached ✓"
- A status indicator confirms "Route ready for offline use"

He taps "Begin Route." The app enters the existing 4-tap capture flow — GPS-sorted property list, tap to select, tap violation type, capture photo, tap save — now wrapped in a batch inspection mode that tracks progress (6/14 inspections complete). Between properties, the list auto-reorders by GPS proximity (the pattern HOALife pioneered, where properties are "split into routes by street name, organized by nearest GPS location to the inspector"). Voice-to-text notes let David dictate observations without stopping the car.

When David returns to connectivity, a banner appears: "Syncing 8 violations and 23 photos..." Progress shows individual item uploads. He can continue using the app during sync. When complete: "All changes synced ✓."

Post-inspection, the app automatically generates draft violation notices for David to review and approve before sending — mirroring HOALife's workflow where "completing an inspection automatically triggers the violations enforcement process."

**Journey 2: Review and vote on ARC request**

David receives a push notification: "New ARC request ready for review — Door Replacement at 742 Elm Street." He taps through to the ARC review interface.

The review screen is split into sections:
- **Request summary:** Homeowner, property, request type, submitted date, description
- **Photos:** Scrollable gallery of submitted photos with zoom
- **CC&R reference:** The relevant governing document section displayed alongside the request (side-by-side on tablets, stacked with toggle on phones) — solving the constant alt-tabbing that board members face when checking compliance
- **Precedent lookup:** AI-suggested similar past decisions: "3 similar door replacements approved in the last 2 years" with tap-to-view details
- **Discussion thread:** Threaded comments from other board members with @mentions, timestamps, and inline photo attachments
- **Vote:** Three buttons — Approve / Deny / Request More Info — with a required comment field for denials

David reads the discussion, checks the CC&R excerpt confirming dark bronze is within approved colors, and taps "Approve" with the note: "Consistent with approved color palette per Section 4.2." The vote is recorded and, once quorum is reached, the homeowner receives an automatic notification.

**Journey 3: Send community announcement**

From Admin → Communications → Compose, David creates a new announcement. The communication composer shows:
- **Audience selector:** All Homeowners / Board Only / Custom (select by address, section, or tag)
- **Channel selector:** Push Notification, Email, SMS, USPS Mail (checkboxes — multiple channels per message)
- **Content editor:** Rich text with formatting, image attachment, and event creation inline
- **AI assist button:** Generates a draft from a prompt: "Write a reminder about the upcoming annual meeting on April 15th" → produces a polished announcement David can edit
- **Preview:** Toggle between push notification preview, email preview, and SMS preview
- **Schedule:** Send now or schedule for later with date/time picker
- **USPS option:** For formal notices, generates a PDF for mailing via Lob integration with address verification

The multi-channel approach directly addresses adoption: reaching the 81% of non-portal users through email, SMS, and physical mail while giving the 19% of app users the richest experience through push notifications and in-app feed.

**Journey 4: Review financial dashboard**

Jim (Treasurer) opens the app. His role-specific dashboard leads with financial widgets:
- **Collections card:** "94.2% collected this month" with trend arrow (↑ from 91.8% last month)
- **Cash position card:** Operating account balance, reserve fund balance
- **Delinquency alert:** "7 accounts past due (total: $4,830)" — tappable for delinquency detail
- **Budget variance card:** "Operating expenses 3.2% under budget YTD" with mini bar chart

Tapping any card drills into the detailed report. The financial reports view (Admin → Financials) offers:
- P&L statement with expandable line items (progressive disclosure — totals visible, tap category for breakdown)
- Balance sheet with asset/liability groupings
- Budget vs. actual with variance highlighting (red for over-budget, green for under)
- Aging report sorted by days past due (30/60/90/120+)
- Date range selector via segment control: This Month / Quarter / YTD / Custom

This directly solves TownSq's most criticized financial UX flaw — a reviewer explicitly complained that "finance data only comes in PDF format" and that "scrolling through violations is nearly impossible with no search/filter/export." Interactive, drill-down financial views with filtering are a clear differentiator.

**Journey 5: Prepare for and run a board meeting**

Anh (Secretary) opens Admin → Meetings. The upcoming meeting card shows: "Board Meeting — March 15, 7:00 PM — Agenda: 60% complete." She taps to open the meeting preparation screen.

The **agenda builder** shows a sortable list of agenda items, each with:
- Topic title and description
- Time allocation (editable)
- Supporting documents (attached)
- Owner/presenter name
- Status: Draft / Ready / Discussed

She drags to reorder items, taps "+" to add a new topic, and attaches the monthly financial report from the document library. When the agenda is complete, she taps "Finalize & Distribute" to send it to all board members via push and email.

During the meeting, the **meeting mode** screen shows the agenda as a checklist. As each item is discussed, Anh marks it complete and captures notes — either typing or using voice-to-text. For motions, a "Record Vote" button captures the motion text, who moved/seconded, and the vote count (Aye/Nay/Abstain). Action items are created inline with assignee and due date.

Post-meeting, Anh taps "Generate Minutes" — which compiles the notes, votes, and action items into a formatted minutes document. She reviews, edits if needed, and distributes to the community via the communication composer.

---

## D. Wireframe-level screen descriptions

### Homeowner dashboard (Home tab)

The screen uses a **single-column scrollable layout** with card-based information hierarchy:

**Header area (sticky):** Community logo/name (left), notification bell with badge count (right), greeting: "Hi Maria" (left-aligned below logo).

**Primary action card (top, highest visual weight):** Balance Due card with amount in large bold text ($350.00), due date below, and a full-width "Pay Now" button in the brand's primary action color (56dp height). If paid, card switches to "✓ Current — Next due April 1" in a success-green variant. This follows TownSq's November 2025 redesign insight: putting account balance and direct payment button on the homepage dramatically improved engagement.

**Quick actions row:** 3-4 icon+label buttons in a horizontal scrollable row — "Submit Request," "View Documents," "Contact Board." Each button is 64dp tall with icon above label.

**Announcements preview card:** Shows the 2 most recent announcements with title, date, and first line of text. "View All →" link at bottom. Card matches ONR's bulletin board metaphor.

**My items card (conditional):** Only appears if the user has active violations, pending ARC requests, or action items. Shows a compact list: "🔴 Violation: Mailbox Paint — Response due Mar 20" and "🟡 ARC Request: Door Replacement — Under Review." Tapping any item navigates to its detail screen.

**Upcoming events card (conditional):** Next community event with date, title, and RSVP status. Only shown if events exist.

**Footer spacing:** 80dp bottom padding to clear the tab bar and prevent accidental taps.

### Payment screen (one-tap flow)

**Payment overview (Payments tab → index):**
- Current balance card (same as dashboard but with more detail: line items for quarterly assessment, special assessment, late fees)
- Payment history list below: date, amount, method, status (Completed / Pending / Failed) — each row is a tappable card
- "Set Up Autopay" banner card (shown if autopay not enabled) with clear value proposition

**Payment confirmation (Payments → pay):**
- Amount displayed prominently (32sp bold) at top center
- Below: selected payment method with brand icon and last 4 digits, with "Change" link
- Below: itemized breakdown (expandable)
- Below: autopay toggle with explanation text
- **Full-width "Pay $350.00" button** pinned to bottom of screen (safe area aware), 56dp height
- Processing state: button shows spinner and disables, text changes to "Processing..."
- Success state: animated checkmark, receipt card with "Share Receipt" and "Done" buttons
- For ACH payments specifically: success message reads "Payment initiated — typically processes in 2-5 business days" (ACH UX requires different messaging than instant card authorization)

### Document library with search

**List screen (Community → Documents):**
- Sticky search bar at top with magnifying glass icon and "Search documents..." placeholder
- Category folders below: Governing Documents, Meeting Minutes, Financial Reports, Community Rules, Forms — each showing document count
- Within each category: list of documents with title, date, file size, and offline status icon (✓ = cached, ↓ = downloadable)
- Pull-to-refresh to check for new documents

**Document viewer ([docId]):**
- Full-screen PDF viewer with standard controls (page nav, zoom)
- Top toolbar: back button, document title, share button, download-for-offline button
- Bottom toolbar (appears on tap): page indicator (3/12), table of contents, search-within-document
- Offline badge in top-right if viewing from cache: "📱 Available offline"

### Violation detail view (homeowner perspective)

**Screen layout ([violationId]):**
- **Status banner** at top: color-coded full-width bar (Red: "Open — Response Required by Mar 20", Yellow: "Response Submitted — Under Review", Green: "Resolved — Closed")
- **Violation information section:** Type, date issued, property address, description, relevant CC&R section reference (tappable to view the section)
- **Evidence photo(s):** Inspection photo in a tappable gallery carousel. Photos taken by the inspector during field inspection.
- **Timeline:** Vertical timeline showing: Notice Issued → (Response Submitted →) Board Review → Resolution. Current step is highlighted.
- **Response section (if open):** "Respond to this Violation" heading with:
  - Text area for written response (with microphone icon for voice-to-text)
  - "Upload Photos" button (to show completed repairs)
  - "Request Extension" link (opens extension form with reason field and requested date)
  - "Submit Response" button (full-width, 56dp)
- **History accordion:** Expandable section showing all prior correspondence on this violation

### ARC request submission flow

**Step screens (Requests → ARC → new):**

Each step occupies a full screen with:
- **Progress indicator** pinned at top: 5 discrete step circles with labels, current step filled, completed steps show checkmarks. This implements the Nielsen Norman Group discrete progress indicator pattern — users form better mental models when all steps are visible from the start.
- **Content area:** The step's input fields centered in the viewport
- **Navigation bar** pinned at bottom: "Back" (left) and "Next" (right, primary color), disabled until required fields complete

Step 4 (Photos) deserves specific detail: the camera opens with semi-transparent overlay guides showing a rectangle and text: "Frame the existing condition." After capture, the photo appears as a thumbnail with "Retake" and "Add Another" options. A minimum of 1 and maximum of 10 photos. The camera component is presented as a modal (using `(modals)/photo-capture.tsx`) to avoid adding navigation depth.

Step 5 (Review) shows all entered data in a read-only summary card layout. Each section has an "Edit" pencil icon that returns to the relevant step. The "Submit Request" button at bottom includes a disclaimer: "By submitting, you agree that work will not begin until approval is received."

### Board member dashboard (Admin tab — role-specific)

The admin dashboard adapts its widget composition based on officer role, using the same card-based layout with different card priorities:

**Common header:** "Admin Dashboard" title, sync status indicator (if pending items), date.

**President view — cards in order:**
1. **Community health scorecard:** Collections rate, open violation count (with trend), active ARC requests, days since last communication to community
2. **Action required card:** Red-badged count of items needing presidential attention (tie-breaking votes, policy decisions, escalated issues)
3. **Upcoming meeting prep card:** Next meeting date, agenda completeness percentage, outstanding action items from last meeting
4. **Quick actions:** Start Inspection, Send Announcement, Review ARC Requests

**Treasurer view — cards in order:**
1. **Financial snapshot:** Operating balance, reserve balance, collections rate percentage with month-over-month trend arrow
2. **Delinquency alert card:** Count and total amount past due, broken down by aging bucket (30/60/90+ days)
3. **Budget status card:** YTD spend vs. budget with a compact horizontal bar chart, color-coded by category
4. **Recent transactions card:** Last 5 payments received with homeowner name, amount, method

**Secretary view — cards in order:**
1. **Meeting preparation card:** Next meeting countdown, agenda status, pending minutes approval
2. **Action item tracker:** Outstanding items from last meeting with assignee and due date
3. **Document status card:** Recently uploaded/modified documents, pending approvals
4. **Communication log card:** Last 5 outbound communications with delivery status

### Violation management list and detail (board perspective)

**List screen (Admin → Violations → index):**
- **Filter bar** below header: Status chips (All, Open, Pending Response, Under Review, Resolved), sortable by date/address/type
- **Search bar:** Search by address, homeowner name, or violation type
- **Batch inspection banner** (conditional): "Route A ready — 14 properties. Start Inspection →"
- **Violation cards:** Each card shows: property address (bold), violation type, date, status badge, thumbnail of evidence photo. Cards are tappable for detail.
- **Floating Action Button** (bottom-right, 56dp): "+" icon for creating a one-off violation outside inspection mode

**Detail screen (Admin → Violations → [violationId]):**
- Identical violation information to homeowner view, PLUS:
- **Board actions section:** Buttons for "Send Notice" (opens communication composer pre-filled), "Schedule Re-inspection," "Escalate," "Close/Resolve"
- **Homeowner response section:** Shows the homeowner's submitted response, photos, and extension requests with "Accept" / "Deny" options
- **History section:** Full audit trail of all actions, notices sent (with delivery confirmation), responses received
- **Notes section:** Internal board notes (not visible to homeowner) with voice-to-text capability

### ARC review interface

**Review screen (Admin → ARC Review → [arcId]):**
- **Left/top section:** Request details — homeowner, property, request type, description, submitted photos in gallery
- **Right/bottom section (toggle on phone):** Relevant CC&R section extracted and displayed with the specific clause highlighted. A "View Full Document" link opens the PDF viewer. On tablets, this displays side-by-side for easy reference.
- **Precedent panel (expandable):** "Similar Past Decisions" section showing AI-matched prior ARC requests with their outcomes, dates, and relevant differences. Tapping a precedent shows its full details.
- **Discussion thread:** Chronological comments from board members. Rich input with @mention support, photo attachment, and voice-to-text. Threaded replies supported.
- **Voting section (pinned at bottom):** Three large buttons — "✓ Approve" (green) / "✗ Deny" (red) / "? Request Info" (yellow). Deny and Request Info require a comment. Current vote tally shown: "2 of 3 votes cast — Approve: 2."
- **Post-decision:** Once quorum reached, "Notify Homeowner" button generates and sends the decision letter through the communications system.

### Financial reports view

**Dashboard (Admin → Financials → index):**
- **Segment control** at top: P&L / Balance Sheet / Budget / Aging / Delinquency
- **Date range selector** below: This Month / Quarter / YTD / Custom (date picker)

**P&L view example:**
- Summary row at top: Total Revenue ($xxx), Total Expenses ($xxx), Net Income ($xxx) — bold numbers, color-coded
- Category rows below: Assessment Income, Late Fees, Interest Income (revenue); Landscaping, Insurance, Utilities, Maintenance, Legal (expenses)
- Each row shows amount with tap-to-expand for line-item detail
- Mini sparkline charts showing trend over selected period
- "Export" button (top-right) generates a PDF or CSV for sharing

**Aging report view:**
- Stacked horizontal bar chart showing total outstanding by aging bucket
- Below: sortable table of delinquent accounts with homeowner name, address, amount owed, days past due, last payment date
- Tap any row for full account history
- "Send Payment Reminders" batch action button

### Communication composer

**Compose screen (Admin → Communications → compose):**
- **To field:** Audience selector — dropdown options: All Homeowners, Board Members Only, Specific Addresses (searchable multi-select), Delinquent Accounts
- **Via field:** Channel checkboxes — ☐ Push Notification, ☐ Email, ☐ SMS, ☐ USPS Mail. Each shows estimated delivery time and cost (USPS: ~$1.50/letter)
- **Subject field:** Text input, shown for email and push channels
- **Body editor:** Rich text area with basic formatting (bold, italic, bullet lists), image insertion, link insertion
- **AI assist button** (wand icon): Opens a drawer with AI prompt field. User describes what they want to say; AI generates a polished draft inserted into the editor.
- **Attachments:** Add documents from the library or upload new files
- **Preview toggle:** Cycles through channel previews — how the message looks as a push notification (title + 2-line preview), email (full HTML), SMS (160-char truncation warning), USPS letter (PDF layout)
- **Footer actions:** "Schedule Send" (date/time picker) or "Send Now" confirmation with recipient count

### Meeting management screens

**Meeting list (Admin → Meetings → index):**
- Upcoming meetings at top, past meetings below
- Each card: date/time, type (Regular/Special/Annual), agenda status (Draft/Finalized), minutes status (Pending/Approved)

**Meeting detail ([meetingId]):**
- **Agenda section:** Ordered list of items with drag-to-reorder handles. Each item: title, time allocation, presenter, attached documents, status
- **Add Item** button with templates: New Business, Old Business, Financial Report, Committee Report, Owner Forum
- **Meeting mode toggle** (available when meeting starts): Transforms the agenda into a running checklist. Mark items as discussed. Record motions with Move/Second/Vote capture. Create action items inline with assignee picker and due date.
- **Minutes generation:** "Generate Minutes" button compiles all notes, votes, and action items into a formatted document that the secretary can edit before distributing.
- **Action items list:** Post-meeting view showing all items created during the meeting with owner, due date, and completion status.

---

## E. Onboarding flow design

### Magic link invitation flow (new homeowner)

The onboarding flow uses Clerk's magic link authentication integrated with the HOA's existing roster data. The flow minimizes friction by requiring **zero password creation** — addressing the finding that **45% of users abandon onboarding when asked to create an account**.

**Step 1 — Invitation (initiated by board):**
The board member uploads a community roster or adds homeowners individually in the admin panel. The system sends personalized invitations via both email and SMS: "You've been invited to join [Sunrise Meadows HOA] on [AppName]. Tap to get started →". The SMS version is critical — ONR's success with elderly users correlates with their text-message-first communication approach.

**Step 2 — Magic link tap:**
The homeowner taps the link. On mobile, the link triggers universal/app links to open directly in the app (if installed) or the app store (if not). After install, the deep link context is preserved. The link contains a signed token that pre-authenticates the user and associates them with their property.

**Step 3 — Identity verification (1 screen):**
"Welcome to Sunrise Meadows! Let's confirm your identity." Pre-filled fields from the roster: name and property address. The user confirms these are correct. This match prevents duplicate accounts and the PayHOA problem where self-service onboarding with no verification allowed duplicate community creation. By tying onboarding to the board-initiated roster, only verified homeowners can join their specific community.

**Step 4 — Minimal profile setup (1 screen):**
Phone number (for SMS notifications), email (pre-filled from invitation), profile photo (optional, clearly marked). A single screen with 2-3 fields maximum. No password creation — Clerk's magic link handles auth, with biometric (Face ID/Touch ID) for subsequent logins.

**Step 5 — Notification permissions (1 screen):**
"Stay informed about your community" with a clear value proposition before the system permission prompt: "Get notified about payment due dates, community events, and important announcements." This contextual framing before the iOS permission dialog dramatically improves opt-in rates compared to prompting on first launch with no context.

**Step 6 — Drop into the app:**
The homeowner lands on their dashboard. No tutorial overlay. No swipe-through introduction deck. NNGroup's research is unambiguous: **deck-of-cards tutorials do not improve task performance** — users skip them, can't remember the content, and they interrupt the user's goal. Instead, the app uses contextual "pull revelations."

### Solving the 19% portal adoption problem

The portal adoption crisis stems from six compounding factors: friction in registration, poor mobile experience, competition from Nextdoor/Facebook, perceived low value, password fatigue, and tech literacy gaps. This app addresses each:

- **Registration friction → eliminated.** Magic link from SMS means zero passwords, zero account creation forms. The invitation comes from a trusted source (their board), not an unknown company. If the elderly homeowner can tap a text message link, they can get in.

- **Poor mobile experience → native-first design.** FRONTSTEPS earns its 1.6-star rating partly because it's "not even an app, just an app that wraps a web browser." This app is native React Native — fast, responsive, and platform-conforming. No WebView wrappers.

- **Competing platforms → channel bridging.** Rather than competing with Nextdoor, the app sends push notifications, emails, and SMS that drive homeowners back into the app for the full experience. Announcements are delivered where people already are; the app is where they take action.

- **Perceived low value → payments as the gateway.** Online payment convenience is the #1 driver of initial adoption. The app leads with "pay your dues from your phone in 2 taps" — an immediate, tangible value proposition. Features like document access, violation response, and event RSVP build engagement after the initial payment hook.

- **Password fatigue → biometric re-authentication.** After initial magic link, the app uses Face ID/Touch ID for subsequent sessions. No password to forget, no re-authentication friction.

- **Tech literacy → progressive contextual education.** Rather than overwhelming Maria with a feature tour, the app teaches features when she encounters them. The first time she opens the document library, a single tooltip explains: "Search for any community document by name or topic." The first time she receives a violation, a brief inline guide explains: "Tap Respond to submit your reply to the board."

**Additional adoption accelerators:**
- QR code flyers at community common areas and in physical mail: "Scan to pay your dues from your phone"
- Board meeting demonstration: a 2-minute live demo showing the payment flow
- "Tech helper" sessions: monthly 30-minute sessions where a board member helps residents set up the app (ONR communities report this works well for elderly populations)
- Incentive: early adopters get priority for amenity reservations

### Preventing the duplicate community problem

PayHOA's self-service model allows any user to create a new community without checking if it already exists — leading to duplicate HOAs when board turnover occurs. This app prevents this architecturally:

**Communities are provisioned, not self-created.** Only a verified board officer can create a community through an administrative setup flow that includes EIN verification and state filing number. The invitation flow is one-directional: community exists first, then homeowners are invited into it.

**Board transitions are managed, not replaced.** When board members change, existing board members transfer admin roles to successors within the app — similar to transferring ownership of a shared account. The community, its data, and its homeowner roster persist across board transitions. A dedicated "Board Transition" workflow guides outgoing officers through handoff steps: transfer admin access, update officer roles, and invite new board members.

### Progressive onboarding over time

**Week 1 (payment hook):** Magic link → confirm identity → pay first dues. The app has delivered value. Notification: "You're all set! Your next payment is due April 1."

**Week 2 (community engagement):** Push notification for a community announcement. Homeowner opens the app, reads the announcement. Tooltip on the community feed: "Tap any announcement to learn more or RSVP."

**Week 3 (document discovery):** Push notification: "Your community's governing documents are now available in the app." Direct link to document library.

**Month 2+ (feature depth):** As the homeowner encounters new features (first violation notice, first ARC opportunity, first vote), contextual tooltips provide just-in-time guidance. A persistent but unobtrusive "?" help button on every screen opens context-sensitive help text that can be re-accessed anytime — addressing NNGroup's finding that tutorials users can't re-access cause frustration.

### First-run experience by role

**Homeowner first run:** Welcome → Identity verify → Profile setup → Notification permission → Dashboard with balance card. Total: 4 screens before productive use.

**Board member first run (invited by existing board):** Welcome → Identity verify → Profile setup → Notification permission → Role confirmation ("You've been added as a Board Member") → Dashboard with admin tutorial card: "Your first step: review your community's inspection routes." The admin dashboard includes a "Getting Started" checklist card that persists until all items are completed: Set up inspection routes, Review pending ARC requests, Familiarize with financial reports, Send your first announcement.

**Board officer first run:** Same as board member, with additional: Role-specific dashboard widget orientation. President sees: "As President, your dashboard shows community health and pending decisions." Treasurer sees: "As Treasurer, your dashboard leads with financial data and collections metrics." These are single-dismiss tooltips, not blocking overlays.

---

## F. Accessibility guidelines

### Universal design with 55+ accommodations

The target market — self-managed HOAs under 200 units — skews older. Many communities are age-restricted (55+) or have significant elderly populations. ONR's competitive advantage with elderly users comes from a philosophy that's instructive: **design for the least tech-savvy user, and everyone benefits.**

ONR reviewers consistently describe their experience in terms of simplicity: "easy to navigate," "simple and secure," "my parents transitioned from paper to app in less than a week." This isn't achieved through special "elderly mode" settings — it's achieved through universally clean, uncluttered design with generous spacing and familiar metaphors.

### Touch target specifications

All interactive elements follow these minimum sizes — exceeding WCAG 2.2 Level AA requirements (which specify **24×24 CSS pixels** as the minimum at AA) and meeting Apple/Google platform guidelines:

| Element type | Minimum size | Spacing from adjacent targets |
|---|---|---|
| Primary action buttons (Pay, Submit, Approve) | **56×56dp**, full-width preferred | 16dp vertical |
| Secondary buttons and list items | **48×48dp** | 8dp vertical |
| Tab bar icons | **48×48dp** per tab zone | Evenly distributed across width |
| Form fields | **48dp height** minimum | 12dp vertical |
| Icon buttons (close, back, edit) | **44×44dp** minimum with 48dp hit area | 8dp from edges |

Research from MIT's Touch Lab found the average fingertip is 16-20mm wide. Touch error rates drop from **15% at 24×24px targets to 3% at 44×44px targets**. Users with motor impairments experience error rates 75% higher on small targets. For a 55+ user base, generous sizing isn't optional.

### Typography system

| Text level | Minimum size | Weight | Use case |
|---|---|---|---|
| Page titles | 24sp | Bold (700) | Screen headers |
| Section headers | 20sp | Semibold (600) | Card titles, section dividers |
| Body text | 18sp | Regular (400) | All readable content |
| Secondary text | 16sp | Regular (400) | Timestamps, captions, metadata |
| Minimum allowed | 14sp | — | Legal disclaimers only (never primary content) |

Use **sans-serif system fonts** exclusively (SF Pro on iOS, Roboto on Android) for maximum readability. Support Dynamic Type (iOS) and system font scaling (Android) up to 200% without content clipping or layout breakage — this is a WCAG 2.2 requirement (SC 1.4.4). Test all screens at maximum system font size.

Avoid: all-caps text for more than 3 words (harder to read for older eyes), light font weights below 400 (insufficient stroke contrast), and center-aligned body text (disrupts reading rhythm).

### Color and contrast

All text meets **WCAG 2.2 AA contrast ratios** minimum, with AAA targets where feasible:

| Element | Required ratio | Target ratio |
|---|---|---|
| Normal text (under 18sp) | 4.5:1 | 7:1 |
| Large text (18sp+ or 14sp+ bold) | 3:1 | 4.5:1 |
| UI components and graphics | 3:1 | 4.5:1 |

**Never use color alone** to convey meaning. Every color indicator (red for violations, green for paid) includes a text label or icon redundancy. Status badges use both color AND text: "🔴 Open" not just a red dot. Violation severity uses both color and shape: red triangle for critical, yellow diamond for moderate, blue circle for minor.

Account for age-related lens yellowing that affects blue perception in older adults: avoid blue-on-gray combinations for important UI elements. Test with color blindness simulators (protanopia, deuteranopia, tritanopia) and with simulated cataract vision filters.

### Simplified navigation and reduced cognitive load

Directly applying NNGroup's cognitive load reduction principles:

**One primary action per screen.** The payment screen has one prominent button: "Pay $350.00." The violation response screen has one prominent button: "Submit Response." Secondary actions (change payment method, request extension) are present but visually recessive.

**Persistent Home and Back affordances.** Every screen shows a clear back arrow (top-left, 44×44dp minimum) and the tab bar provides a constant "Home" anchor. Never rely on swipe-back gesture as the only way to return — FRONTSTEPS users complained about being trapped in deep navigation with no clear escape. Always provide a visible button.

**Familiar metaphors.** The community feed uses a social media pattern (ONR's bulletin board). Documents use a file folder metaphor. Payments use a receipt metaphor. These map to physical-world concepts that transcend tech-savviness.

**No gesture-dependent features.** Every swipe action has a visible button alternative. No long-press for essential functions (long-press has zero visual affordance — elderly users cannot discover it). No multi-finger gestures. Pinch-to-zoom on documents includes visible +/- buttons as alternatives.

**Confirmation before destructive actions.** Delete, submit, and send actions require explicit confirmation via a dialog: "Are you sure you want to submit this response? This cannot be undone." Undo capability for 10 seconds after non-critical actions (like dismissing an announcement).

### WCAG 2.2 Level AA compliance checklist for mobile

Beyond touch targets, typography, and contrast, ensure:
- **Focus indicators** visible on all interactive elements when using keyboard/switch navigation
- **Screen reader support** on every component: `accessibilityLabel` on all interactive elements, `accessibilityRole` properly set, `accessibilityHint` for non-obvious actions, images have descriptive alt text, decorative images marked `accessibilityElementsHidden`
- **Motion sensitivity:** Respect `prefers-reduced-motion` system setting. Disable animations for users who enable Reduce Motion. Provide alternative to animated transitions.
- **Time limits:** No time-limited interactions (session timeouts should be at least 20 minutes with warning and extension option)
- **Error identification:** Form errors described in text adjacent to the field, not just color
- **Consistent navigation:** Tab bar and screen headers maintain identical position and behavior across all screens

### Supporting non-smartphone-native users

For residents transitioning from feature phones, the app provides:

**Tap-only interaction model.** Every feature is completable through tapping and scrolling alone — the two gestures that research shows transfer naturally from physical-world interactions. No swiping, pinching, long-pressing, or dragging is ever required for core functionality.

**First-touch animated hints.** When a user encounters a scrollable area for the first time, a brief bounce animation suggests scrollability. When photos can be zoomed, visible +/- buttons appear alongside a one-time tooltip: "Pinch to zoom or use these buttons."

**Large, labeled icons throughout.** Every icon has a text label below it. Icon-only buttons exist nowhere in the app. The tab bar uses icon+label for all tabs — research is conclusive that icon-only tabs hurt discoverability for all users, especially older ones.

**Numeric keyboard defaults.** Phone number, ZIP code, payment amount, and unit number fields automatically present the numeric keyboard. Avoid requiring users to switch keyboard layouts.

### Voice-to-text as a universal accessibility feature

Voice input appears wherever text input is required, marked by a **56dp microphone button** adjacent to the text field:

**Activation:** User taps the microphone icon. A modal appears with a pulsing waveform animation indicating the system is listening. Real-time transcription appears as text below the waveform.

**Feedback:** Transcribed text is editable inline — user can tap any word to correct it or tap "Speak again" to re-dictate. A "Done" button accepts the transcription and inserts it into the form field.

**Use cases beyond the existing violation notes spec:** ARC request descriptions, violation responses, communication composer body text, meeting notes, search queries, and any multi-word text field. For Maria's persona, voice input transforms a frustrating small-keyboard typing experience into a natural conversation.

---

## G. Offline capabilities

### What works offline vs. what requires connectivity

**Full offline capability (read and write):**
- Violation creation: form data, photos, GPS coordinates, voice notes — all saved locally to WatermelonDB with `_status: 'created'`
- Violation inspection routes: pre-downloaded property data, prior violation history, map tiles, route progress tracking
- Document viewing: any previously cached or pre-downloaded PDF
- Draft ARC requests: all wizard steps save to WatermelonDB with `is_draft: true`
- Meeting notes and action items: local creation and editing
- Community announcements: cached feed viewable offline

**Requires connectivity (hard requirement):**
- Payment processing (financial transactions need real-time server authorization via Stripe)
- Sending communications (email/SMS/push/USPS — must be server-dispatched for audit trail and delivery confirmation)
- Real-time financial data (account balances must be current — show "Last refreshed: [time]" for cached snapshots)
- Initial authentication (subsequent sessions use cached Clerk tokens with biometric re-auth)
- ARC request final submission (draft saved locally, but official submission requires server confirmation)
- Voting on ARC requests and motions (must be server-verified for quorum counting)

**Degraded but functional offline:**
- Search: local search across cached content works; full server search requires connectivity
- Notification history: cached notifications viewable, new ones arrive when online
- Profile editing: changes saved locally and synced when online

### Sync UX patterns

The app uses a layered sync architecture: **WatermelonDB for relational data sync, a custom media upload queue for photos/voice notes, and MMKV for ephemeral key-value state** (form progress, UI preferences).

**Global connectivity indicator:** A slim, non-intrusive banner appears below the navigation bar only when offline: "You're offline — changes will sync when you reconnect." The banner uses a neutral gray color — **offline is a state, not an error**. Avoid red/error styling, which FRONTSTEPS's approach of treating offline as a failure state causes user anxiety. When connectivity returns, the banner briefly changes to "Syncing..." with an animated icon, then auto-dismisses with "All changes synced ✓."

**Per-record sync status indicators:**

| Status | Visual indicator | When shown |
|---|---|---|
| Synced | No indicator (clean state) | Default for all server-confirmed data |
| Pending sync | Small clock icon + "Pending" label | Locally created/modified, not yet synced |
| Syncing | Small animated spinner | Currently uploading to server |
| Sync failed | Red exclamation + "Tap to retry" | Server rejected or network failure |

The design principle: **synced records show nothing**. Only un-synced or problematic items get visual markers. This reduces visual noise and draws attention only where it's needed.

**On save feedback (offline):** When a user creates a violation or saves a draft while offline, a toast notification confirms: "Saved ✓ — Will sync when online." This builds trust that data is safe.

### Conflict handling

WatermelonDB's sync protocol uses a **per-column client-wins merge strategy**: the server version serves as the base, but any field the client modified since the last sync takes the client's value. This means the vast majority of conflicts resolve silently without user intervention.

For the rare case where two board members edit the same violation record simultaneously, the app uses a notification approach: after sync, if the server merged changes from another user, a subtle toast informs: "This record was updated by another board member. Your changes have been merged." No action required — just awareness.

For genuinely conflicting changes to the same field (e.g., two board members change a violation status simultaneously), the system applies last-write-wins and notifies both parties: "[Board member name] also updated this violation's status. Current status: [server value]."

### Pre-inspection offline preparation

Before David heads into the field, the inspection preparation screen provides a one-tap "Prepare for Offline" flow:

The button initiates a download that caches: all property records on the route, violation history for each property, relevant CC&R sections, form templates, and map tiles covering the route area. A progress indicator shows: "Downloading route data... 34/47 properties" followed by "Your route is ready for offline use ✓."

This addresses a critical gap in competitor apps. Smartwebs' "offline" mode is write-only — inspectors can create violations but cannot view historical data, meaning they lack context about prior violations during inspections. Their developer acknowledged: "The data storage it would take to download all the images and history of an HOA would easily fill your device storage." For communities under 200 units, this constraint is manageable: pre-caching property records and text-based violation history for 200 properties requires minimal storage. Only photo history is selectively cached (most recent photo per prior violation, not all historical photos).

### Media upload queue

Photos and voice notes are handled separately from WatermelonDB's record sync because WatermelonDB does not manage binary file transfers. A dedicated upload queue (managed in-app, persisted to MMKV) handles media files with these UX characteristics:

**Background upload:** When connectivity returns, media uploads begin automatically in the background. The user can continue using the app normally. A subtle persistent indicator appears in the header: "Uploading 12 of 47 photos..." with a thin progress bar.

**Priority ordering:** Critical violation evidence photos upload first, followed by inspection photos, then voice notes, then supplementary media. This ensures the most important data reaches the server first.

**Queue visibility:** A "Pending Uploads" screen (accessible from Profile → Sync Status) shows all queued items with individual progress indicators. Each item shows: type (photo/voice note), associated record, file size, and status (queued/uploading/complete/failed). Failed items show the error reason and a "Retry" button.

**Wi-Fi preference:** A toggle in Settings — "Upload large files on Wi-Fi only" — allows field inspectors on metered cellular plans to defer large photo batches until they reach Wi-Fi. When enabled, the queue pauses on cellular with a message: "47 photos waiting for Wi-Fi (184 MB)."

**Data safety guarantee:** A warning appears if the user attempts to log out with unsynced data: "You have 8 items waiting to sync. Logging out will not delete your data, but sync will pause until you log back in." WatermelonDB's `hasUnsyncedChanges()` function drives this check.

### Offline-to-online transition sequence

When the device regains connectivity (detected via `@react-native-community/netinfo` with a server ping to confirm actual internet access):

1. Brief snackbar appears: "Back online — syncing..."
2. WatermelonDB sync triggers automatically (pull server changes, then push local changes)
3. Media upload queue begins processing
4. Per-record indicators update: clock → spinner → checkmark
5. On completion: snackbar auto-dismisses with "All changes synced ✓"
6. If partial failure: persistent but dismissible banner: "3 items failed to sync. Tap to review." Links to the queue screen.

The entire transition is **non-blocking** — the user is never prevented from using the app during sync. Sync happens in the background on a separate thread (WatermelonDB's native SQLite thread), ensuring UI responsiveness.

---

## Conclusion: design principles that tie everything together

Three architectural decisions differentiate this app from every competitor in the HOA space. First, **role-adaptive simplicity** — a single app that feels like a consumer payment app to Maria and a professional field tool to David, achieved through Expo SDK 53's Protected routes rather than separate apps (TownSq's model) or overwhelming everyone with the same interface (FRONTSTEPS's model). Second, **offline-first as the default**, not a degraded fallback — WatermelonDB's reactive data layer means the app feels identical whether the device has connectivity or not, eliminating the field-work frustration that plagues Smartwebs and FRONTSTEPS users. Third, **progressive trust-building onboarding** that uses magic links and payment convenience to drive initial adoption, then contextual education to deepen engagement — directly attacking the industry's 81% non-adoption rate not with more features but with less friction.

The most important screen in the entire app isn't the admin dashboard or the financial reports view — it's Maria's first payment confirmation. If she can pay her $350 in 2 taps and 15 seconds on the day she receives that SMS invitation, the adoption problem is solved one homeowner at a time.