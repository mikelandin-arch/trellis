# Multi-state HOA compliance framework for SaaS platform architecture

**HOA law varies dramatically across the 10 highest-density states, but roughly 60% of compliance logic can be standardized into universal modules with configurable parameters, while 40% requires state-specific conditional logic.** This framework maps the full regulatory landscape across Florida, California, Colorado, Arizona, Texas, Illinois, North Carolina, Washington, Virginia, and Nevada — the states collectively governing more than 220,000 community associations and 18+ million housing units. Arizona, as a key expansion market, received the most significant HOA reforms in 2024–2025, including a **10x increase in foreclosure thresholds** (from $1,200 to $10,000) and new meeting recording retention mandates. The analysis below provides the architectural blueprint for a configurable compliance engine.

---

## The 10 states that define the HOA compliance landscape

The United States has approximately **370,000 community associations** housing 77 million residents. Density concentrates heavily in Sun Belt and Western states, with Colorado leading by population share (**42.9%** of residents in HOA communities) and Florida leading by absolute association count (~50,100). The regulatory environments range from Nevada's comprehensive state-administered oversight apparatus to Texas's comparatively light statutory framework.

| Rank | State | HOAs | % Homeowners in HOAs | Primary Statute | Complexity | State Oversight |
|------|-------|------|---------------------|-----------------|------------|-----------------|
| 1 | Florida | ~50,100 | 64.0% | Ch. 720 F.S. | **High** | Partial (DBPR) |
| 2 | California | ~51,250 | 66.1% | Davis-Stirling Act (Civ. Code §4000+) | **High** | None |
| 3 | Colorado | ~10,300 | 62.4% | CCIOA (C.R.S. §38-33.3) | Medium-High | Partial (Info Center) |
| 4 | Arizona | ~9,675 | 45.8% | A.R.S. §33-1801 et seq. | Medium | None (ADRE disputes only) |
| 5 | Texas | ~23,000 | 32.1% | Prop. Code Ch. 209 (TRPOPA) | Medium | None |
| 6 | Illinois | ~18,800 | 45.1% | 765 ILCS 160 + 765 ILCS 605 | Medium | None |
| 7 | North Carolina | ~14,100 | 40.3% | N.C.G.S. Ch. 47F | Medium | None |
| 8 | Washington | ~10,475 | 48.8% | WUCIOA (RCW 64.90) | Medium-High → High | None |
| 9 | Virginia | ~8,725 | 35.2% | Va. Code §55.1-1800+ | **High** | **Yes** (CIC Board + Ombudsman) |
| 10 | Nevada | ~3,390 | 28.6% | NRS Ch. 116 | **High** | **Yes** (Ombudsman + Commission + NRED) |

Florida and California both underwent major reforms in 2024–2025. Florida's HB 1203 introduced criminal penalties for board misconduct and mandatory websites for associations with 100+ parcels. California's AB 130 capped fines at **$100 per violation** effective July 2025. Washington's SB 5796 is consolidating four separate HOA statutes into a single framework by January 2028, representing the most ambitious legislative overhaul in any state. Nevada and Virginia stand alone as the only top-10 states with dedicated regulatory agencies capable of enforcement — Nevada's Commission can impose administrative fines, issue subpoenas, and appoint receivers.

---

## Assessment collection rules diverge on late fees, lien priority, and payment plans

Assessment collection is the area with the most significant state-to-state variation, making it the highest-priority candidate for per-state configuration in the compliance engine.

**Late fee caps** exist in only three states: Florida (greater of **$25 or 5%**), Arizona (greater of **$15 or 10%**), and all others defer to governing documents with a "reasonable" standard. Interest rate caps are similarly sparse — California caps at **12%**, Colorado at **8%**, and Florida defaults to **18%** if CC&Rs are silent.

**Super-lien status** — where the HOA's assessment lien takes priority over the first mortgage — applies in only three of the ten states. Nevada grants the strongest super-lien priority at **9 months** of assessments, followed by Colorado and Washington at **6 months** each. This distinction has enormous implications for collections strategy and must be a core configurable parameter.

**Payment plan mandates** represent another critical divergence. Texas requires a minimum **3-month** payment plan before foreclosure (§209.0062). Colorado requires plans calibrated to the owner's ability to pay. California requires the board to meet with owners who submit written requests. Arizona added a new "reasonable efforts" communication requirement in 2024 via HB 2648. The remaining states leave payment plans to governing documents.

**Payment application order** — how partial payments are allocated across principal, interest, fees, and legal costs — differs by statute in Florida, Texas, and Arizona, and defaults to governing documents elsewhere. This is a frequently litigated area and must be precisely configurable.

| State | Late Fee Cap | Interest Cap | Super-Lien | Payment Plan Required | Payment Application Order |
|-------|-------------|-------------|------------|----------------------|--------------------------|
| Florida | $25 or 5% | 18% default | No | No (qualifying offer in foreclosure) | Interest → Late fees → Costs → Principal |
| California | "Reasonable" | 12% | No | Meeting required on request | Per CC&Rs |
| Colorado | Per CC&Rs | 8% | **Yes (6 mo.)** | **Yes** (ability-based) | Per CC&Rs |
| Arizona | $15 or 10% | Per CC&Rs | No | **Yes** (reasonable efforts, HB 2648) | Principal first, then interest |
| Texas | Per CC&Rs | Per CC&Rs | No | **Yes** (3-month minimum) | Assessments → Current → Atty fees → Fines |
| Illinois | Per CC&Rs | Per CC&Rs | No | No | Per CC&Rs |
| North Carolina | Per CC&Rs | Per CC&Rs | No | No | Per CC&Rs |
| Washington | Per CC&Rs | Per CC&Rs | **Yes (6 mo.)** | No | Per CC&Rs |
| Virginia | Per CC&Rs | Per CC&Rs | Partial | No | Per CC&Rs |
| Nevada | Per CC&Rs | Per CC&Rs | **Yes (9 mo.)** | Info required pre-collection | Per CC&Rs |

---

## Violation enforcement shows a clear pattern with state-specific parameters

All ten states require **written notice** and a **right to be heard** before imposing fines, establishing a universal workflow pattern. The divergence lies in specific timelines, fine limits, and procedural details.

**Fine caps** exist in four states and vary dramatically. Virginia imposes the strictest limit at **$50 per single offense** ($10/day for continuing violations, capped at 90 days/$900). California caps at **$100 per violation** with no escalation for ongoing same-violation issues. Florida allows **$100 per violation** but permits aggregate fines up to **$1,000** for continuing violations. Arizona, Texas, Nevada, Colorado, Illinois, North Carolina, and Washington have no statutory cap — fines must simply be "reasonable."

**Hearing procedures** diverge in important ways. Florida uniquely requires a fining **committee separate from the board** to approve fines. California and most other states allow the board itself to conduct hearings. Arizona mandates a specific **21-day response period** for owners, followed by a **10-business-day** HOA response cycle. Texas requires notice by **certified mail** with explicit hearing and cure rights.

**The universal violation workflow** that a compliance engine should implement:

1. Violation observed → documented (Colorado requires timestamped photos)
2. Written notice issued → delivered via statutorily compliant method
3. Cure period provided → state-specific duration (Colorado: 30+30 days non-health/safety; 72 hours health/safety)
4. Hearing right → notice period varies (Florida: 14 days; California: 10 days; Arizona: 21 days)
5. Hearing conducted → by board or committee (Florida: committee only)
6. Fine imposed → within state cap if applicable
7. Appeal/escalation → state-specific (Arizona: ADRE petition; Nevada: Ombudsman)

The engine should parameterize: cure period duration, hearing notice period, hearing body (board vs. committee), fine cap amount, fine escalation rules, delivery method requirements, and appeal pathways.

---

## Meeting and voting rules share a common structure with configurable timelines

**Meeting notice periods** follow a broadly similar pattern. Board meeting notice ranges from **48 hours** (Florida, Arizona, Illinois) to **4 days** (California general) to **10 days** (North Carolina). Member/annual meeting notice falls within a **10–60 day** window in most states, with Florida requiring **14 days minimum**. All ten states require board meetings to be **open to members**, creating a universal open-meeting compliance module.

**Quorum requirements** for member meetings differ substantially: Florida defaults to **30%**, Texas and Colorado to **20%**, Illinois to **20%**, and North Carolina to **10%**. Board quorum universally defaults to a **majority of directors** unless governing documents specify otherwise. The engine must store both board and member quorum thresholds as per-community configurable values, since governing documents frequently override statutory defaults.

**Voting procedures** present the sharpest divergence around proxy voting. Arizona **prohibits proxy voting** after the declarant control period ends, requiring absentee or electronic ballots instead. California **prohibits proxies in board elections** and mandates a double-envelope secret ballot system with independent inspectors. Florida prohibits proxies in board elections when electronic voting is adopted. Texas prohibits proxies in contested elections for communities with 100+ lots. The remaining states generally permit proxies with standard safeguards.

**Electronic voting** has gained broad statutory authorization — California authorized it for director elections effective January 2025 (AB 2159), and Arizona, Florida, Nevada, Colorado, Virginia, and Illinois all permit it with varying procedural requirements. This represents a strong candidate for a universal module with state-specific configuration for which election types qualify.

**Secret ballot requirements** are mandatory for board elections in Florida, California, Arizona, Colorado, and Nevada. Texas requires written signed ballots for contested elections. California's double-envelope and independent inspector requirements are the most prescriptive in the nation.

---

## Record access rights converge around a 10-business-day standard

Record access is one of the most standardizable compliance areas. **Six of ten states** require responses within **10 business days** (Florida, California for standard records, Texas, Arizona, Illinois, and Colorado by advance-request convention). North Carolina and Virginia use "reasonable time" language without specifying days. Nevada enforces compliance through its Commission with **$25/day** administrative penalties.

**Copy fee limits** range from Arizona's **$0.15 per page** hard cap (with free inspection) to North Carolina's **$200 per request** plus $100 expedite fee. California charges "direct and actual cost." Florida permits "reasonable" fees but imposes **$50/day** civil penalties for wrongful denial starting on day 11.

The universal records-access module should implement: request intake tracking, configurable response deadline countdown, document categorization (disclosable vs. exempt), copy fee calculation, delivery confirmation, and penalty exposure alerts. State-specific parameters include: response timeframe, fee formula, penalty structure, and exempt record categories.

| State | Response Time | Copy Fee Cap | Non-Compliance Penalty |
|-------|--------------|-------------|----------------------|
| Florida | 10 working days | Reasonable | $50/day civil penalty |
| California | 10 business days (standard); 30 (enhanced) | Direct/actual cost | $500/violation + attorney fees |
| Texas | 10 business days (+15-day extension) | Per published policy | Court order/county attorney |
| Arizona | 10 business days | $0.15/page; inspection free | Attorney fees; board removal |
| Nevada | Per statute | Regulated | $25/day administrative penalty |
| Colorado | 10 days advance request | Reasonable | Attorney fees (prevailing party) |
| Illinois | 10 business days | Reasonable | Attorney fees |
| North Carolina | Reasonable | $200/request | Court order |
| Virginia | Reasonable | Reasonable | Ombudsman complaint |
| Washington | Per statute | Reasonable | Court order |

---

## Financial reporting and reserve requirements create a two-tier compliance structure

**Audit thresholds** are the primary differentiator in financial reporting. Florida has the most granular tiered system: full audit above **$500,000** revenue, CPA review at $300K–$500K, compilation at $150K–$300K, and cash basis below $150K. California requires annual review above **$75,000** revenue. Nevada mirrors California's $75,000 threshold. Colorado and Illinois require audits above **$250,000**. Texas, Arizona, North Carolina, and Virginia leave audit requirements to governing documents.

**Reserve study requirements** split the states into three tiers. **Mandatory with teeth**: Nevada requires studies every 5 years by a licensed reserve specialist with "adequate" funding enforcement, and Florida now mandates Structural Integrity Reserve Studies (SIRS) every 10 years for buildings 3+ stories with **no waiver** permitted for structural items (post-Surfside reform). **Mandatory but flexible**: California requires visual inspections every 3 years with annual board review but sets no funding minimum. Virginia requires studies every 5 years for condominiums. Washington requires them for post-2018 communities. New Jersey enacted requirements in 2024 with 30-year baseline funding plans. **No requirement**: Texas, Arizona, North Carolina, and Illinois have no statutory mandate, though Illinois requires "reasonable reserves" in annual budgets.

The compliance engine should implement a **reserve study tracking module** with configurable parameters for: study requirement (yes/no), frequency, qualified preparer requirements, funding minimums, and disclosure obligations. For budget distribution, the universal module should track timeline compliance — Florida requires **14 days** before adoption meeting, California requires **30–90 days** before fiscal year end, and Arizona requires **10 days** before the ratification meeting.

---

## Foreclosure procedures require the most complex state-specific logic

Foreclosure is the compliance area with the widest divergence and highest legal risk, demanding the most sophisticated per-state configuration.

**Minimum thresholds before foreclosure** range from zero (Texas, Nevada, Illinois) to Arizona's new **$10,000 OR 18 months** (effective September 2025, planned communities only). California requires **$1,800 OR 12 months** delinquent. Florida has no HOA-specific minimum but requires 45-day notice. Virginia requires the lien to exceed **$5,000**. North Carolina requires **90 days** minimum delinquency.

**Judicial vs. non-judicial foreclosure** is a fundamental architectural split. Florida and Illinois **require judicial foreclosure** exclusively. California, Texas, Arizona, Nevada, Colorado, North Carolina, Virginia, and Washington permit **non-judicial foreclosure** under varying conditions. Texas uniquely requires a court order for non-judicial foreclosure unless the homeowner waives in writing.

**Foreclosure prohibitions on fines** are nearly universal — Florida, California, Texas, Arizona, Colorado, and Nevada all prohibit foreclosure based solely on unpaid fines. Arizona's 2024 HB 2648 formalized this by creating distinct "Common Expense Liens" (foreclosable) versus "Member Expense" liens for fines (not foreclosable).

| State | Min. Threshold | Foreclosure Type | Super-Lien | Fines Foreclosable | Key Protections |
|-------|---------------|-----------------|------------|-------------------|-----------------|
| Florida | No minimum; 45-day notice | Judicial only | No | No | Notice of Contest (90-day deadline) |
| California | $1,800 or 12 months | Judicial or non-judicial | No | No | Board vote required; 90-day redemption |
| Colorado | 6 months assessments | Judicial or non-judicial | **Yes (6 mo.)** | No | Board vote; payment plan; 3 contact methods |
| Arizona | **$10,000 or 18 months** (planned) | Judicial or non-judicial | No | **No** (separate lien type) | Payment plan; no 3rd-party assignment |
| Texas | No statutory minimum | Judicial or non-judicial | No | No | 180-day redemption; 3-month payment plan |
| Illinois | No minimum | Judicial only | No | Per CC&Rs | Standard judicial process |
| North Carolina | 90 days delinquent | Primarily non-judicial | No | Judicial only for fines | Pre-suit mediation; 3-year SOL |
| Washington | Per statute | Judicial or non-judicial | **Yes (6 mo.)** | Per CC&Rs | Mediation process |
| Virginia | $5,000 | Judicial or non-judicial | Partial | Per CC&Rs | 10-year SOL on lien; 60-day cure notice |
| Nevada | No minimum | Primarily non-judicial | **Yes (9 mo.)** | Only if health/safety threat | 60-day redemption; 60-day pre-collection wait |

---

## Arizona 2024–2025: a compliance checklist for the expansion market

Arizona enacted **8 significant HOA bills in 2024** (effective September 14, 2024) and **7 in 2025** (effective September 26, 2025). The following checklist covers every provision a compliance engine must implement.

### 2024 legislation (effective September 14, 2024)

**HB 2648 — Lien reform (A.R.S. §§33-1202, 33-1256, 33-1802, 33-1807).** Creates two distinct lien categories: "Common Expense Liens" for assessments (foreclosable) and "Member Expenses" for fines (not foreclosable). Requires reasonable efforts to communicate with owners and offer payment plans before foreclosure. Prohibits transferring lien ownership to third-party collectors. Modifies payment application order: current assessments first, then late charges, then collection costs.

**HB 2662 — Meeting agendas (A.R.S. §§33-1248, 33-1804).** Requires agendas to accompany meeting notices. Board meeting agendas must be delivered at least **48 hours** before the meeting via hand-delivery, mail, website, email, or other electronic means.

**HB 2141 — Condo interior improvements (A.R.S. §33-1221).** Prohibits condo associations from banning interior decoration or improvements that include reasonable disturbance mitigation (e.g., underlayment for hard flooring). Applies to condominiums only.

**HB 2119 — Transfer fee exemptions (A.R.S. §33-442).** Prohibits charging transfer fees for conveyances between related parties (spouses, parent-child, trusts) as defined in A.R.S. §11-1134(B)(3) and (7).

**SB 1016 — Flagpole holders (A.R.S. §33-1808).** Associations cannot prohibit owners from using **two or fewer** wall-mounted flagpole holders.

**SB 1432 — Unlawful covenant removal (A.R.S. §§33-531–539, new).** Boards may amend governing documents to remove discriminatory covenants without a member vote. Owners may petition; boards have **90 days** to evaluate and **90 days** to amend.

**HB 2698 — Declarant control (A.R.S. §33-1820, new).** Declarations must specify end-date or calculation method for the declarant control period. Associations must maintain common areas to the same standard established during declarant control.

### 2025 legislation (effective September 26, 2025)

**SB 1039 — Meeting recording retention (A.R.S. §§33-1248, 33-1804).** If a board records an open meeting, it must retain the **unedited recording** for at least **6 months** and make it available to any member upon request within **10 business days** per §33-1805/§33-1258.

**SB 1494 — Foreclosure threshold increase (A.R.S. §33-1807).** Raises the minimum for HOA lien foreclosure from $1,200/12 months to **$10,000 OR 18 months delinquent**, whichever occurs first. Applies to **planned communities only** — condo thresholds under §33-1256 were not equivalently updated.

**SB 1378 — Political signs and flags (A.R.S. §§33-1261, 33-1808).** Expands the definition of "political sign" to include **flags**. Political flags now receive the same protections: display permitted **71 days** before primary election through **15 days** after general election. Maximum aggregate of **9 square feet** if no local regulation exists.

**HB 2322 — Mixed-use condo assessments (A.R.S. §§33-1202, 33-1217, 33-1255).** Requires split assessment allocation for condominiums with separate commercial and residential structures. Expenses benefiting only one type are assessed only to those units. Shared expenses are proportionally allocated. Changes after declarant control require **unanimous** owner vote.

**SB 1022 — Small claims jurisdiction (A.R.S. §22-503).** Increases small claims court limit from $3,500 to **$5,000**, enabling more delinquent accounts to be pursued through small claims.

**SB 1070 — Tax deed property sales.** Authorizes counties to sell tax-deed property directly to HOAs when the property is part of a maintained common area.

### Existing Arizona provisions critical for software compliance

**Record access (A.R.S. §33-1805/§33-1258):** 10 business days to fulfill; inspection free; copies at $0.15/page maximum. **Violation process (A.R.S. §33-1803):** Written notice → 21-day owner response → 10-business-day HOA response; late penalty capped at $15 or 10%; must inform of ADRE hearing right. **Assessment increases (A.R.S. §33-1803(A)):** Cannot exceed 20% over prior year without majority member vote. **Electronic violation notice acceptance (SB 1337):** Introduced in 2025 but **did not pass** — monitor for 2026 reintroduction.

---

## Standardizable patterns: the universal compliance modules

Analysis across all ten states reveals clear areas where a single module with configurable parameters can achieve compliance. These represent approximately **60% of total compliance logic**.

**Universal module 1: Notice and communication engine.** Every state requires written notice for violations, meetings, assessments, and foreclosure actions. The engine should support configurable delivery methods (certified mail, first-class, email, electronic portal, hand-delivery, posted notice), configurable timing windows per notice type per state, template management with state-specific required language, and delivery confirmation tracking. The variation is in parameters (days, methods, required content), not in the fundamental workflow.

**Universal module 2: Meeting management.** All states require advance notice, open meetings, quorum tracking, and minutes retention. Configurable parameters: notice period (48 hours to 21 days), quorum threshold (10%–50%), agenda distribution requirements, recording retention period (0–6 months), and permitted meeting formats (in-person, virtual, hybrid). The core workflow — schedule → notify → conduct → document — is identical everywhere.

**Universal module 3: Records request fulfillment.** The workflow is universal: request received → clock starts → documents gathered → exempt records filtered → copies prepared → fees calculated → delivered. Configurable parameters: response deadline (10 business days is the dominant standard), fee structure, exempt record categories, and penalty exposure.

**Universal module 4: Violation lifecycle management.** The pattern holds across all states: observe → document → notify → cure period → hearing → decide → fine/resolve. Every state-specific variant fits within this framework when the following parameters are configurable: cure period duration, hearing notice period, hearing body type, fine cap, fine escalation rules, and appeal pathway.

**Universal module 5: Budget and financial reporting.** Annual budget adoption, distribution to members, and financial statement preparation follow the same lifecycle. Configurable parameters: audit threshold tiers, distribution timeline, reserve contribution requirements, and resale disclosure components.

---

## State-specific variations requiring conditional logic

The remaining **40% of compliance logic** requires per-state modules or conditional branching that cannot be reduced to simple parameter changes.

**Foreclosure eligibility engine (high complexity).** Each state combines different threshold types (dollar amount, months delinquent, or both), different foreclosure methods (judicial-only vs. non-judicial), super-lien calculations, fine-exclusion rules, pre-foreclosure communication requirements, and redemption periods. Arizona's 2024 dual-lien-type system and 2025 threshold increase add further complexity. This module requires per-state decision trees, not simple parameters.

**Lien priority and super-lien calculation (Nevada, Colorado, Washington).** Super-lien states require calculating the priority amount (6 or 9 months of assessments), interfacing with mortgage holder notification requirements, and managing the interaction between HOA liens and first mortgages. Non-super-lien states need none of this logic.

**Election and voting procedures (high state variance).** California's double-envelope system with independent inspectors, Arizona's post-declarant proxy prohibition, Florida's fining committee requirement, and Texas's certified-mail voting rules each require distinct workflow implementations that cannot be parameterized into a single module.

**State regulatory agency integration (Nevada, Virginia only).** Nevada requires HOA registration with NRED, community manager certification verification, Ombudsman filing support, and Commission compliance reporting. Virginia requires CIC Board annual reports and Ombudsman complaint response tracking. No other top-10 state has equivalent requirements, making these purely state-specific modules.

**Florida-specific website mandate.** Associations with 100+ parcels must maintain websites with specific content including governing documents, meeting schedules, and financial reports. No other state has an equivalent mandate at this specificity level.

**California fine limitation logic.** The $100 per-violation cap with no escalation for ongoing same violations and mandatory health/safety exception documentation requires unique business logic distinct from all other states' fine structures.

---

## Data model recommendations for multi-state support

The compliance engine's data model must support a hierarchical configuration system that moves from universal defaults to state-specific overrides to community-specific customizations.

### Core entity structure

**`State_Compliance_Profile`** — The top-level configuration entity for each state. Contains: primary statute reference, regulatory complexity rating, oversight agency (if any), super-lien status, foreclosure type (judicial/non-judicial/both), and effective date for latest statutory changes. This table drives which rule modules are activated for each community.

**`Compliance_Rule`** — Individual configurable rules with the following attributes: `rule_category` (assessment, violation, meeting, voting, records, financial, reserve, foreclosure), `rule_type` (threshold, timeline, cap, requirement, prohibition), `default_value`, `state_override_value`, `community_override_value`, `effective_date`, `expiration_date`, and `source_statute`. The three-tier override hierarchy (default → state → community) enables both standardization and customization.

**`Assessment_Configuration`** — Per-community settings: late fee formula (`flat`, `percentage`, `greater_of`), late fee cap amount, interest rate, interest type (simple/compound), payment application order (ordered array of categories), acceleration permitted (boolean), and super-lien months (0, 6, or 9).

**`Violation_Workflow_Configuration`** — Per-state templates: cure_period_days, hearing_notice_days, hearing_body_type (`board`, `committee`), fine_cap_per_violation, fine_cap_aggregate, fine_escalation_permitted (boolean), required_delivery_method, appeal_pathway, and required_notice_content (JSON template).

**`Foreclosure_Eligibility_Rules`** — Per-state decision engine: min_amount_threshold, min_months_delinquent, threshold_logic (`AND`, `OR`), foreclosure_type, super_lien_priority_months, fines_included_in_lien (boolean), pre_foreclosure_steps (ordered array), redemption_period_days, and lien_expiration_years.

**`Meeting_Configuration`** — Per-state/per-community: board_notice_hours, member_notice_days_min, member_notice_days_max, board_quorum_type (`majority`, `percentage`), member_quorum_percentage, open_meeting_required (boolean), recording_retention_days, agenda_required_with_notice (boolean), and electronic_meeting_permitted (boolean).

**`Records_Access_Configuration`** — Per-state: response_deadline_business_days, copy_fee_formula, inspection_fee (typically $0), penalty_type (`per_day_civil`, `per_violation`, `administrative`, `none`), penalty_amount, and exempt_record_categories (array).

### Recommended architectural patterns

**Rule versioning with effective dates.** Every compliance rule must carry `effective_date` and optional `expiration_date` fields. Arizona's SB 1494 changes the foreclosure threshold on September 26, 2025 — the system must apply the old threshold ($1,200/12 months) before that date and the new threshold ($10,000/18 months) after. Implement a `get_active_rule(state, category, as_of_date)` function.

**Dual-entity tracking for Arizona liens.** Arizona's HB 2648 requires tracking two distinct lien types on the same property: "Common Expense Liens" (assessments, foreclosable) and "Member Expenses" (fines, not foreclosable). The `Lien` entity needs a `lien_type` enum field and the foreclosure eligibility engine must filter by type.

**Community type differentiation.** Arizona, California, Florida, Illinois, Virginia, and Washington maintain separate statutes for planned communities versus condominiums. The data model must include a `community_type` enum (`planned_community`, `condominium`, `cooperative`, `mixed_use`) that selects the correct statutory framework. Arizona's SB 1494 foreclosure threshold applies only to planned communities, not condominiums — this is exactly the kind of conditional logic the type field enables.

**Election calendar integration.** Arizona's SB 1378 (political flags) and similar provisions in other states require awareness of election dates to enforce political sign/flag display windows. Include a `Protected_Display_Period` entity linked to state and local election calendars, with fields for `start_date_offset_days` (71 days before primary), `end_date_offset_days` (15 days after general), and `max_aggregate_square_feet`.

**Compliance audit trail.** Every state-mandated action (notice sent, hearing held, record request fulfilled, payment plan offered) should generate an immutable `Compliance_Event` record with timestamp, actor, action type, statutory basis, and evidence attachments. This serves both operational tracking and legal defensibility — critical given that Florida now imposes criminal penalties for certain compliance failures.

### Configuration hierarchy

```
Platform Defaults (universal rules)
  └── State Profile (statutory overrides)
       └── Community Type (planned community vs. condo)
            └── Community Instance (CC&R-specific overrides)
                 └── Temporal Rules (effective date filtering)
```

This five-layer hierarchy ensures that a community in Arizona automatically inherits the $15-or-10% late fee cap, the 10-business-day records response deadline, and the $10,000/18-month foreclosure threshold — while still allowing CC&R-specific overrides where statutes permit (e.g., interest rates, quorum thresholds, architectural review standards).

---

## Conclusion: building for regulatory velocity

The most important architectural insight from this analysis is not the current state of the law but the **rate of change**. Florida, California, Arizona, and Washington all enacted major HOA reforms in 2024–2025, and the trend toward stricter consumer protections — fine caps, foreclosure restrictions, transparency mandates, and digital accessibility requirements — is accelerating. The compliance engine must be built for **regulatory velocity**: new rules, amended thresholds, and additional states should be deployable through configuration changes rather than code releases.

Three design principles emerge from the data. First, **separate the "what" from the "when"** — every rule needs effective dating because legislatures frequently pass laws with delayed implementation (Washington's WUCIOA transition runs through 2028). Second, **model the workflow, parameterize the details** — the violation lifecycle, assessment collection pipeline, and foreclosure eligibility check are structurally universal but numerically unique per state. Third, **plan for the outliers** — Nevada's regulatory agency integration, California's double-envelope voting, Florida's criminal liability provisions, and Arizona's dual-lien system each require dedicated modules that no amount of parameterization can absorb.

For the Arizona expansion specifically, the platform must implement SB 1494's foreclosure threshold ($10,000/18 months) and HB 2648's dual-lien tracking before September 2025 to be market-ready. The meeting recording retention requirement (SB 1039, 6 months) and political flag protections (SB 1378) round out the compliance checklist. Monitor SB 1337 (electronic violation notice acceptance) for likely reintroduction in 2026, and watch for potential alignment of condominium foreclosure thresholds with the new planned community standard — a legislative gap that Arizona's HOA reform advocates are already targeting.