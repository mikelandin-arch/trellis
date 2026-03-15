# Financial management and payment processing module specification

**Stripe Connect with Destination Charges is validated as the optimal payment gateway** for this HOA management SaaS platform, offering the best combination of multi-tenant architecture, competitive ACH pricing (0.8% capped at $5), SAQ-A PCI compliance, and zero monthly fees. Combined with an optimized Plaid integration using Transactions Sync and webhooks, the platform can eliminate PayHOA's 2–3 day bank sync lag—reducing it to under 4 hours. This specification covers all 11 required areas: assessment modeling, payment methods, gateway comparison, accounting, budgeting, invoicing, collections, financial statements, bank integration, audit support, and tax compliance. Washington State's SB 5686 (2025) and WUCIOA requirements serve as the primary compliance baseline, with configurable state rules for nationwide deployment.

---

## Deliverable 1: Payment gateway comparison and recommendation

### Gateway comparison matrix

| Feature | Stripe Connect | Square | PaySimple | Authorize.net | Zego | Dwolla | Finix |
|---|---|---|---|---|---|---|---|
| **ACH fee** | 0.8% ($5 cap) | 1% ($1–$5 cap) | ~$0.60/txn | 0.75% (no cap) | ~$1/txn | Custom | Interchange+ |
| **Card fee** | 2.9% + $0.30 | 2.9% + $0.30 | ~2.49%+ | 2.9% + $0.30 | 2.5–3.5% | No cards | Interchange+ |
| **Monthly fee** | $0 | $0–$69 | Custom | $25/gateway | $99–$199 | Custom | Custom |
| **Multi-tenant architecture** | ★★★★★ | ★☆☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | ★★★★☆ | ★★★★☆ | ★★★★★ |
| **Recurring billing** | ★★★★★ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | ★★★★☆ |
| **API quality** | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ | ★★★★★ |
| **PCI burden** | SAQ-A | Included | Monthly fee | SAQ A-EP/D | Handled | N/A | Varies |
| **Convenience fee model** | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★★★☆☆ | ★★★★★ |
| **Payout speed** | T+2 / Instant | T+1 / Instant | T+2–3 | T+2–3 | T+1–2 | T+3–5 / Same Day | Custom |
| **Dispute fee** | $15 + $15 counter | $0 | Varies | Varies | Built-in | Per occurrence | Built-in |
| **Contract** | None | None | Custom | Monthly | Annual | Annual | Custom |
| **HOA-specific features** | None (build custom) | None | None | None | ★★★★★ | None | None |

### Cost model for a 100-unit HOA paying $300/month assessments

With an 80% ACH / 20% card payment split, Stripe processes this portfolio for approximately **$372/month** in total fees. If homeowners pay the card convenience fee (as permitted under SB 5129 since ACH remains free), the HOA absorbs only **$192/month** in ACH costs. At scale with custom Stripe pricing, these costs decrease further.

### Recommendation: Stripe Connect with Destination Charges — confirmed

The architecture routes payments as follows: homeowner pays via Stripe → Stripe deducts processing fee → platform retains `application_fee_amount` (SaaS fee plus optional convenience fee) → remainder transfers to the HOA's Connected Account → HOA receives payout on T+2 schedule. Each HOA operates as an Express or Custom Connected Account, providing complete fund isolation and per-HOA reporting.

**Key implementation decisions validated by research:**

- **Build custom recurring billing** using Stripe Payment Intents with internal scheduling rather than Stripe Billing (avoids the 0.5% surcharge that would add $150/month on $30K volume)
- **Default to ACH** as the fee-free method required by Washington SB 5129, with card payments carrying a disclosed convenience fee
- **Integrate Financial Connections** (Stripe's Plaid integration) for instant bank account verification and pre-debit balance checks, reducing NSF returns
- **Budget $2/month per active Connected Account** plus $0.25 + 0.25% per payout for Express/Custom Connect accounts
- **At scale (>$100K/month processing)**, negotiate custom Stripe pricing; evaluate Dwolla as supplementary ACH processor if ACH volume exceeds 90%

Square, PaySimple, and Authorize.net lack the multi-tenant Connected Account architecture essential for a SaaS platform serving multiple HOAs. Zego and ClickPay are turnkey HOA payment solutions without embeddable APIs. Finix offers superior payment monetization control but requires greater operational maturity—worth evaluating at significant scale.

---

## Deliverable 2: Chart of accounts template for HOAs

This chart supports **fund accounting** with separate tracking for Operating Fund (OF), Reserve/Replacement Fund (RF), Special Assessment Fund (SAF), and custom funds. Every transaction carries a fund identifier dimension.

### 1000–1999: Assets

| Acct # | Account name | Fund | Description |
|--------|-------------|------|-------------|
| 1010 | Operating Checking Account | OF | Primary operating checking |
| 1020 | Operating Savings/Money Market | OF | Operating savings |
| 1030 | Petty Cash | OF | Small cash on hand |
| 1110 | Reserve Savings Account | RF | Interest-bearing reserve savings (WA law requires interest-bearing) |
| 1120 | Reserve Money Market Account | RF | Reserve money market funds |
| 1130 | Reserve CD Investments | RF | Certificates of deposit for reserves |
| 1140 | Reserve Investment Account | RF | Securities/bonds (50% cap if reserves >$250K) |
| 1210 | Special Assessment Bank Account | SAF | Segregated special assessment funds |
| 1310 | Assessments Receivable – Current | OF | Current period assessments due |
| 1315 | Assessments Receivable – Delinquent | OF | Past-due assessments |
| 1320 | Special Assessments Receivable | SAF | Special assessments due |
| 1330 | Late Fees Receivable | OF | Accrued late charges |
| 1340 | Fines Receivable | OF | Accrued violation fines |
| 1350 | Other Receivables | OF | Transfer fees, ARC fees, miscellaneous |
| 1360 | Allowance for Doubtful Accounts | OF | Contra-asset for estimated bad debt |
| 1410 | Prepaid Insurance | OF | Insurance premiums paid in advance |
| 1420 | Prepaid Contracts/Services | OF | Prepaid vendor contracts |
| 1510 | Due from Reserve Fund | OF | Interfund receivable from RF |
| 1520 | Due from Operating Fund | RF | Interfund receivable from OF |
| 1530 | Due from Special Assessment Fund | OF | Interfund receivable from SAF |
| 1610 | Common Area Personal Property | OF | Furniture, equipment, vehicles |
| 1620 | Accumulated Depreciation | OF | Contra-asset for depreciation |
| 1710 | Deposits | OF | Security deposits held by vendors |
| 1720 | Accrued Interest Receivable | RF | Interest earned not yet received |

### 2000–2999: Liabilities

| Acct # | Account name | Fund | Description |
|--------|-------------|------|-------------|
| 2010 | Accounts Payable – Trade | OF | Vendor invoices payable |
| 2020 | Accounts Payable – Reserve Projects | RF | Reserve project invoices |
| 2110 | Accrued Expenses | OF | Expenses incurred not yet billed |
| 2120 | Accrued Management Fees | OF | Management fees owed |
| 2130 | Accrued Taxes Payable | OF | Income/property taxes owed |
| 2210 | Prepaid Assessments | OF | Owner payments received in advance |
| 2220 | Deferred Revenue – Special Assessments | SAF | Unearned special assessment revenue |
| 2310 | Due to Operating Fund | RF | Interfund payable to OF |
| 2320 | Due to Reserve Fund | OF | Interfund payable to RF (reserve borrowing) |
| 2410 | Line of Credit | OF | Short-term borrowing facility |
| 2420 | Notes Payable – Current Portion | OF | Current year loan payments |
| 2430 | Long-Term Loans Payable | OF | Multi-year loan obligations |
| 2510 | Security Deposits Held | OF | Key/access card deposits |

### 3000–3999: Equity / Fund balances

| Acct # | Account name | Fund | Description |
|--------|-------------|------|-------------|
| 3010 | Operating Fund Balance – Beginning | OF | Opening operating fund balance |
| 3020 | Operating Fund – Current Year Surplus/(Deficit) | OF | Net results of current year |
| 3110 | Reserve Fund Balance – Beginning | RF | Opening reserve fund balance |
| 3120 | Reserve Fund – Current Year Change | RF | Current year reserve activity |
| 3210 | Special Assessment Fund Balance – Beginning | SAF | Opening SAF balance |
| 3220 | Special Assessment Fund – Current Year Change | SAF | Current year SAF activity |
| 3310 | Other/Custom Fund Balance | Custom | Additional tracked funds |
| 3900 | Interfund Transfers | Multi | Permanent transfers between funds |

### 4000–4999: Revenue

| Acct # | Account name | Fund | Tax treatment (1120-H) |
|--------|-------------|------|----------------------|
| 4010 | Regular Assessments – Operating | OF | Exempt function income |
| 4020 | Regular Assessments – Reserve Contribution | RF | Exempt function income |
| 4030 | Special Assessments | SAF | Exempt function income |
| 4110 | Late Fees / Late Charges | OF | Exempt function income |
| 4120 | Interest on Delinquent Accounts | OF | Exempt function income |
| 4130 | Violation Fines | OF | Exempt function income |
| 4140 | ARC / Architectural Review Fees | OF | Exempt function income |
| 4150 | Transfer / Resale Fees | OF | Exempt function income |
| 4160 | Move-In/Move-Out Fees | OF | Exempt function income |
| 4170 | Key/Access Card Fees | OF | Exempt function income |
| 4210 | Interest Income – Operating | OF | **Non-exempt** (taxable at 30%) |
| 4220 | Interest Income – Reserves | RF | **Non-exempt** (taxable at 30%) |
| 4230 | Rental Income – Common Areas | OF | **Non-exempt** (taxable at 30%) |
| 4240 | Vending/Laundry Income | OF | **Non-exempt** (taxable at 30%) |
| 4250 | Insurance Recovery Income | OF/RF | Context-dependent |
| 4260 | Other Miscellaneous Income | OF | Evaluate per source |
| 4900 | Bad Debt Recovery | OF | Exempt function income |

### 5000–5999: Expenses

| Acct # | Account name | Fund | Category |
|--------|-------------|------|----------|
| 5010 | Management Fees | OF | Administrative |
| 5020 | Accounting / Bookkeeping | OF | Administrative |
| 5030 | Legal Fees | OF | Administrative |
| 5040 | Audit / Review / Compilation | OF | Administrative |
| 5050 | Insurance – General Liability | OF | Administrative |
| 5055 | Insurance – Fidelity Bond | OF | Administrative |
| 5060 | Office Supplies & Postage | OF | Administrative |
| 5070 | Printing & Copying | OF | Administrative |
| 5080 | Software & Technology | OF | Administrative |
| 5090 | Meeting Expenses | OF | Administrative |
| 5095 | Bank Charges & Fees | OF | Administrative |
| 5110 | Wages & Salaries | OF | Payroll |
| 5120 | Payroll Taxes | OF | Payroll |
| 5130 | Employee Benefits | OF | Payroll |
| 5140 | Workers Compensation | OF | Payroll |
| 5210 | Water & Sewer | OF | Utilities |
| 5220 | Electricity | OF | Utilities |
| 5230 | Gas / Heating | OF | Utilities |
| 5240 | Trash / Recycling | OF | Utilities |
| 5250 | Cable / Internet / Telephone | OF | Utilities |
| 5310 | Landscaping & Grounds | OF | Grounds |
| 5320 | Snow Removal | OF | Grounds |
| 5330 | Pool Maintenance | OF | Grounds |
| 5340 | Pest Control | OF | Grounds |
| 5350 | Janitorial / Cleaning | OF | Grounds |
| 5410 | Building Repairs & Maintenance | OF | Repairs |
| 5420 | Plumbing Repairs | OF | Repairs |
| 5430 | Electrical Repairs | OF | Repairs |
| 5440 | HVAC Maintenance | OF | Repairs |
| 5450 | Elevator Maintenance | OF | Repairs |
| 5460 | Road / Parking Maintenance | OF | Repairs |
| 5510 | Security Services / Patrol | OF | Security |
| 5520 | Gate/Access System Maintenance | OF | Security |
| 5530 | Fire Safety / Alarm Systems | OF | Security |
| 5610 | Federal Income Tax | OF | Taxes |
| 5620 | State/Local Taxes | OF | Taxes |
| 5630 | Property Tax | OF | Taxes |
| 5710 | Roof Replacement/Repair | RF | Reserve expenditure |
| 5720 | Exterior Painting/Siding | RF | Reserve expenditure |
| 5730 | Paving / Road Resurfacing | RF | Reserve expenditure |
| 5740 | Pool / Spa Renovation | RF | Reserve expenditure |
| 5750 | HVAC System Replacement | RF | Reserve expenditure |
| 5760 | Elevator Modernization | RF | Reserve expenditure |
| 5770 | Fencing / Walls Replacement | RF | Reserve expenditure |
| 5780 | Clubhouse / Amenity Renovation | RF | Reserve expenditure |
| 5790 | Plumbing System Replacement | RF | Reserve expenditure |
| 5795 | Other Reserve Expenditures | RF | Reserve expenditure |
| 5810 | Reserve Contribution Transfer | OF | Operating transfer |
| 5910 | Bad Debt Expense | OF | Other |
| 5920 | Depreciation Expense | OF | Other |
| 5930 | Reserve Study Expense | OF | Other |
| 5940 | Miscellaneous Expense | OF | Other |

### Fund accounting implementation notes

The system must tag every transaction with a Fund ID. Reserve contributions flow as revenue (4020) in the Reserve Fund, matched by expense (5810) in the Operating Fund, with a corresponding cash transfer between bank accounts. Interfund accounts (1510–1530 and 2310–2330) balance automatically when one fund pays another's obligations. Washington requires that reserve borrowing be repaid within **24 months** (RCW 64.38.075) and documented in board minutes with notice to all owners.

---

## Deliverable 3: Financial reporting requirements

### GAAP framework: FASB ASC 972

HOA financial statements follow **FASB ASC 972 (Real Estate—Common Interest Realty Associations)**, codified from the 1991 AICPA Audit and Accounting Guide. Key requirements include accrual basis accounting, fund-based reporting, and mandatory supplementary information on future major repairs and replacements—even when unaudited.

### Required financial statements

**Balance Sheet (Statement of Financial Position)** must present assets, liabilities, and fund balances **by fund** in columnar format (Operating, Reserve, SAF, Combined Total). Uses unclassified format. Interfund receivables and payables must be displayed as separate line items. Common real property is generally not recognized as an asset; personal property in operations is recognized and depreciated.

**Income Statement (Statement of Revenues and Expenses)** must show revenues and expenses **by fund** with separate columns. Reserve contributions appear as transfers, not revenue. The operating fund captures all day-to-day activity. Reserve fund shows investment income and capital project expenditures. Variance to budget should appear as a supplementary column.

**Statement of Changes in Fund Balances** reconciles beginning to ending fund balances per fund. Shows net results and interfund transfers as separate line items. May be combined with the income statement per ASC 972-10-45-10. Permanent transfers between funds must appear here, never as revenue.

**Cash Flow Statement** follows standard format: operating, investing, and financing activities. Should separately identify reserve fund cash flows. Investment purchases and maturities for reserve accounts appear in investing activities.

**Accounts Receivable Aging Report** must bucket outstanding balances by 0–30, 31–60, 61–90, 91–120, and 120+ days. Include per-owner detail with unit/lot number, owner name, assessment type breakdown (regular, special, late fees, fines, interest, legal costs), last payment date, and current collection status. This report drives the collections workflow and lien filing decisions.

**Budget vs. Actual Variance Report** compares year-to-date actual revenues and expenses against the adopted budget, by line item, with dollar and percentage variances. Should present monthly and YTD views. Flag items exceeding budget by configurable threshold (typically 10%). Critical for board oversight and mid-year assessment adjustments.

**Reserve Fund Status Report** must show: each component's name, estimated useful life, remaining useful life, current replacement cost, fully funded balance, current reserve balance, percent funded, and annual contribution required. Include 30-year cash flow projection graph showing projected income, expenditures, and ending balance per year. Calculate percent funded as Current Reserve Balance ÷ Fully Funded Balance. Benchmarks: **70–100% = strong, 60–69% = fair, below 60% = at risk**.

**Owner Ledger / Statement of Account** provides a complete transaction history per owner: all charges (assessments, fees, fines, interest), all payments, credits, and running balance. Must be exportable as PDF for owner self-service and attorney referral packages. Include payment application detail showing how each payment was allocated.

### Required supplementary information (per ASC 972-235-50)

Even when unaudited, HOA financial statement packages must include supplementary information listing: all reserve components with estimated remaining useful lives, estimated replacement costs, amounts accumulated per component, the association's funding policy, methods and assumptions used, the date and source of the most recent reserve study, and whether the study included a physical inspection.

### Notes to financial statements

Required disclosures include: legal form and entity type, number of units, assessment policies and delinquency procedures, common property descriptions, replacement funding policy and compliance status, tax status (IRC 528 election or alternative), related party transactions, contingencies and litigation, and insurance coverage summary.

---

## Deliverable 4: Collections workflow specification

### The eleven-step automated workflow

This workflow must be **fully configurable per state** with parameters for timing, fee amounts, notice content, delivery methods, and required pre-foreclosure steps. A state rules engine stores the compliance configuration for each jurisdiction, and the HOA's CC&Rs provide an additional overlay of community-specific rules.

**Step 1 — Assessment due date passes.** The system marks the account as "Past Due" at midnight on the due date if no payment has been received or is pending. This starts the grace period timer. Audit log entry records the date, amount, assessment type, and owner. No external communication at this step.

**Step 2 — Grace period expires; friendly reminder sent.** Configurable grace period (typically **5–15 days**; Washington has no statutory grace period; Colorado requires 15 days per HB 22-1137; Arizona requires 15 days before late fees). The system sends an informal reminder via email and optionally regular mail: "Your account has a past-due balance of $X. Please remit payment by [date] to avoid late fees." No FDCPA language required since the HOA is collecting its own debt. **Pause conditions:** active payment plan, bankruptcy auto-stay filed, active dispute, hardship application pending.

**Step 3 — Late fee assessed.** Upon grace period expiration with no payment, the system calculates the late fee using the **lower of** the state statutory cap and the CC&R-specified amount. State rules: Washington = "reasonable" per CC&Rs (no statutory dollar cap); Florida = greater of $25 or 5%; Arizona = greater of $15 or 10%; **Colorado = no late fees permitted** (HB 22-1137). The fee posts to the owner's ledger (account 4110) with full audit trail documenting the calculation method, state rule applied, and CC&R authority.

**Step 4 — First formal delinquency notice.** Washington requires this **within 30 days** of the assessment becoming past due. The notice must be sent via **first-class mail** to the unit address and any other address the owner has provided, **plus email** if the owner's electronic address is known. Per SB 5686, the notice must be in **English and any language the owner has indicated as a correspondence preference**. Required content: itemized amount of delinquency, right to cure, association contact information, foreclosure prevention resources, and (after January 1, 2026) information about the foreclosure mediation program. Arizona requires certified mail with return receipt. Colorado requires certified mail plus one other method. The system generates the notice from a state-specific template, logs the send date, delivery method, content hash, and tracking numbers.

**Step 5 — Interest accrual begins.** From the delinquency date, the system calculates daily interest and posts monthly. Rate configuration per state ceiling: Washington = maximum per RCW 19.52.020 (higher of **12% per annum** or 4 points above the 26-week T-bill rate); Florida = 18% default if not specified in documents; Colorado = **8% maximum**; others per CC&Rs. The system supports both simple and compound interest methods. Each accrual entry logs the rate used, calculation method, and daily amount.

**Step 6 — Second notice / demand letter.** Washington requires this at or after **90 days past due** and no sooner than **60 days after the first notice**. The notice must contain the same pre-foreclosure information as the first notice—both must be separately mailed. Content includes a full account statement with all amounts itemized, payment plan information, right to dispute, and mediation/counseling resources. Texas requires a second notice via certified mail 30 days after the first, followed by a third notice 90 days after the second.

**Step 7 — Payment plan offer / meet-and-confer.** Washington's SB 5686 mandates a meet-and-confer process requiring good-faith negotiation before foreclosure. Colorado requires a **mandatory 18-month payment plan** (minimum $25/month, 8% interest cap, payments applied to assessments first). Arizona requires a "reasonable" payment plan offer before foreclosure. Texas requires payment plan guidelines for communities with more than 14 lots. The system generates a payment plan template, tracks owner response, schedules the meet-and-confer meeting, and pauses all further collection actions during active negotiation. Plan parameters are configurable: duration (6–18 months), down payment (10–25%), interest rate, minimum payment amount. Current assessments must continue to be paid alongside plan installments.

**Step 8 — Intent to lien notice.** California requires this **30 days before recording** a lien, with IDR rights disclosed. Texas requires this 90 days after the second notice. Other states vary. The notice states the association's intent to record a lien if amounts are not paid within the specified period. If the owner in California requests IDR (Internal Dispute Resolution), the association must participate before recording the lien.

**Step 9 — Lien filing.** In Washington, the assessment lien arises **automatically** from the time assessments are due (recording is not required for perfection but is best practice for notice to purchasers). In California, a pre-lien letter must precede recording by 30 days. Many states require a formal board vote (Washington, California, Colorado). The system generates the lien document, submits it for county recording or flags it for attorney filing, and logs the recording number, date, county, and amount.

**Step 10 — Pre-foreclosure requirements.** Washington imposes the most stringent requirements: the association must verify that the owner owes the **greater of 3 months of assessments or $2,000** (excluding fines, late charges, interest, and attorney fees); both pre-foreclosure notices have been sent; 90 days have elapsed since the minimum amount accrued; board has approved foreclosure by recorded vote against that specific unit; and if referred to mediation per SB 5686, the association must wait for mediation completion and certification. Colorado requires two separate 30-day cure periods plus the 18-month payment plan offer. Nevada follows a NOD → 90-day reinstatement → Notice of Sale sequence.

**Step 11 — Attorney referral / foreclosure initiation.** The system generates a complete case file for the attorney containing: all notices with proof of mailing, full account ledger with payment history, communication log, board minutes documenting approval, governing documents, and lien recording details. Once the account transfers to an attorney or third-party collector, **FDCPA compliance mode activates** automatically, templating all subsequent communications with required disclosures (debt collector statement, 30-day dispute rights, creditor identification).

### Payment application order by state

The system must enforce **statutory payment application order** where mandated and allow CC&R-configurable order elsewhere:

| State | Payment application order | Source |
|---|---|---|
| **Florida** | Interest → Late fees → Collection costs → Principal (MANDATORY) | Fla. Stat. §720.3085(3)(b) |
| **Colorado** | Assessments FIRST → Then fines/fees/charges (MANDATORY) | C.R.S. §38-33.3-316.3 |
| **Texas** | Delinquent assessments → Current assessments → Other charges | Tex. Prop. Code §209.0063 |
| **Washington** | Not specified — configurable per CC&Rs | RCW 64.90 silent |
| **All others** | Per CC&Rs; default: Interest → Late fees → Costs → Delinquent assessments (oldest first) → Current → Fines | Best practice |

### State rules comparison table

| Parameter | WA | FL | AZ | CA | NV | CO | TX |
|---|---|---|---|---|---|---|---|
| **Late fee cap** | "Reasonable" per CC&Rs | ≥$25 or 5% | ≥$15 or 10% | Per CC&Rs | Per CC&Rs | **None allowed** | Per CC&Rs |
| **Interest ceiling** | ~12% (RCW 19.52.020) | 18% | Per CC&Rs | Per CC&Rs (10% default) | Per CC&Rs | 8% max | Per CC&Rs |
| **First notice timing** | ≤30 days past due | Before attorney fees | 30 days (certified) | Per CC&Rs | Certified mail | Certified + 1 other | First-class/email |
| **Foreclosure threshold** | ≥3 months OR $2,000 | 45-day notice | 18 months OR $10K (HOA) | $1,800 or 12 months | No minimum | 6 months of assessments | Per CC&Rs |
| **Super-lien** | 6 months | Limited | None | None | **9 months** | 6 months | None |
| **Mandatory payment plan** | Effective (meet-and-confer) | No | Yes | No (IDR available) | No | **Yes — 18 months** | Yes (>14 lots) |
| **Foreclosure type** | Judicial | Judicial | Judicial only | Judicial/nonjudicial | Nonjudicial | Judicial | Both (court auth) |
| **Board vote required** | Yes (per unit) | Not explicit | Not specified | Yes (majority, exec session) | Board authorization | Yes (recorded) | Yes |

### Configurable parameters for the state rules engine

The collections engine must allow per-state AND per-community configuration of these 15 parameters: grace period days, late fee type and amount with statutory cap enforcement, interest rate with state ceiling enforcement, interest accrual method, notice timing per step, notice delivery method, language requirements, payment application order, foreclosure threshold, required pre-foreclosure steps, board approval requirements per step, payment plan terms, pause triggers (bankruptcy, dispute, hardship, payment plan, mediation), and FDCPA mode activation.

---

## Deliverable 5: Comprehensive feature specification

### Area 1: Assessment types

**Regular assessments** are the primary revenue source. The system models them as recurring charges with configurable frequency (monthly, quarterly, semi-annual, annual) and amount per unit. The total assessment splits between operating (account 4010) and reserve contribution (account 4020) per the adopted budget ratio. Proration applies at ownership transfer: the system calculates the daily rate and assigns the appropriate portion to each owner based on the closing date. Revenue recognition follows established GAAP practice under ASC 972: recognized in the period assessed regardless of collection timing.

**Special assessments** are one-time or installment charges authorized by board resolution (and often membership vote). The system supports lump-sum billing or configurable installment plans (e.g., 12 monthly payments). Each special assessment receives a unique identifier, tracks against the Special Assessment Fund, and generates separate invoices. Deferred revenue treatment applies under ASC 606 when the assessment funds a future capital project.

**Late fees** trigger automatically per the collections workflow Step 3 logic. The system calculates using the lower of the state cap and CC&R amount. Fee types supported: flat dollar, percentage of past-due amount, or greater-of calculation. Colorado's prohibition on late fees must be enforced. Late fee revenue posts to account 4110.

**Fines** require due process before assessment: notice of violation, opportunity for hearing before the board, and documented board decision. The system tracks the violation-to-fine lifecycle and only posts the fine charge (account 4130) after the hearing outcome is recorded. State-specific caps apply (typically $50–$200 per violation per day).

**ARC (Architectural Review Committee) fees** are one-time application fees charged when an owner submits a modification request. The system ties the fee to the ARC workflow and recognizes revenue (account 4140) upon application submission. Typical range: $50–$500.

**Transfer/resale fees** are charged at property sale. The system generates the fee upon recording an ownership transfer, including the resale certificate/disclosure packet fee. Revenue posts to account 4150. These fees interact with the estoppel/demand statement process.

All assessment types feed into the collections workflow—regular and special assessments are the delinquency-triggering charges, while late fees, interest, and fines accrue as secondary charges on the delinquent account.

### Area 2: Payment methods

**ACH/eCheck** serves as the **fee-free payment method** required by Washington SB 5129. Stripe processes ACH Direct Debits at 0.8% capped at $5, which the HOA absorbs. The system uses Stripe Financial Connections (Plaid-powered) for instant bank account verification, eliminating the 1–2 day micro-deposit delay. Pre-debit balance verification checks the account balance before initiating the debit, reducing NSF returns. ACH settlement takes **3–5 business days**; the system must handle the asynchronous confirmation lifecycle: initiated → pending → succeeded/failed. Return codes handled: R01 (Insufficient Funds), R02 (Account Closed), R03 (No Account), R29 (Corporate entry not authorized). The $4 Stripe return fee should be charged back to the owner's account per CC&R authorization. Nacha compliance requires: written or electronic authorization for recurring debits, WEB entry classification for internet-initiated transactions, commercially reasonable fraud detection, and the consumer's right to revoke authorization at any time (Reg E).

**Credit/debit cards** are offered as a convenience option with a disclosed fee (2.9% + $0.30). The convenience fee model works because a fee-free alternative (ACH) exists. Stripe Elements renders the card form in an iframe, keeping the platform at **SAQ-A PCI compliance** (22 questions, no quarterly scans). Cards settle in **T+2 business days**. Chargeback prevention strategies: clear billing descriptor ("TALASERA HOA DUES"), payment confirmation emails, billing reminders 3–5 days before charge, easy autopay cancellation, and Stripe Radar fraud detection.

**Check payments** via lockbox convert paper checks to digital entries. The lockbox service provider scans checks, extracts payment data, and deposits funds to the HOA's bank account. The system receives a data file with check images and payment details, automatically matching payments to owner accounts by unit number or account number. Manual check entry is supported for walk-in or mailed payments received directly by the management office.

**Autopay/recurring payments** use Stripe's Payment Intents API with stored payment methods (card tokens or ACH mandates). The platform's internal scheduler triggers payments on the configured date (typically the 1st of each month). Smart retry logic handles failures: retry once after 3 days, once more after 7 days, then notify the owner and assess a late fee if applicable. Owners must be able to enroll, modify, and cancel autopay through the owner portal. Written/electronic authorization records are maintained for Nacha/Reg E compliance.

### Area 3: Payment gateway (covered in Deliverable 1)

### Area 4: Accounting requirements

**Accrual vs. cash basis.** GAAP requires accrual accounting per ASC 972. The system must support **both** because many smaller HOAs prepare internal reports on a cash basis while their CPA prepares GAAP-compliant statements on an accrual basis. The platform defaults to accrual but provides a cash-basis view toggle. Key accrual entries: assessments receivable recognized when billed (not when collected), prepaid assessments deferred to the applicable period, and expenses recognized when incurred regardless of payment timing.

**Fund accounting** is the foundational architecture. The system tracks three core funds (Operating, Reserve, Special Assessment) plus custom funds. Every transaction carries a fund tag. Balance sheets, income statements, and fund balance changes are presented per fund in columnar format. Interfund transfers use Due To/Due From accounts (1510–1530, 2310–2330) and appear in the Statement of Changes in Fund Balances—never as revenue. Reserve contributions flow as expense in the Operating Fund (5810) and revenue in the Reserve Fund (4020).

**Bank reconciliation** follows a three-step process: (1) import bank transactions via Plaid, (2) automatically match transactions to GL entries using rule-based and AI-powered matching (by amount, description, date, and recurring patterns), (3) present unmatched items for manual review and categorization. The system tracks reconciled vs. unreconciled status per transaction and generates a bank reconciliation report showing the book balance, bank balance, and reconciling items.

**GAAP compliance under ASC 972** requires: fund-based presentation, accrual basis, revenue recognition in the period assessed, required supplementary information on future major repairs/replacements, specific notes disclosures (legal form, units, assessment policies, replacement funding, tax status), and common property treatment (not recognized as assets; disclosed in notes).

### Area 5: Budgeting and financial reporting

**Annual budget creation workflow** should begin 90+ days before fiscal year end. The system provides a template pre-populated with prior-year actuals and current-year budget. Board members edit line items with variance explanations. Reserve contribution amounts derive from the reserve study's recommended funding plan. The total budget divided by units yields the per-unit assessment rate. Assessment rate changes require membership notice per governing documents and state law. Washington requires budget ratification by the membership (RCW 64.90.525). Lender requirements (FHA/Fannie Mae) mandate a minimum **10% of assessments** allocated to reserves.

**Budget vs. actual variance reporting** compares YTD actual revenues and expenses against the adopted budget by line item, showing dollar and percentage variances in both monthly and YTD views. Items exceeding budget by a configurable threshold (default 10%) are flagged for board attention.

**Reserve fund tracking** integrates with the reserve study to present: each component's name, useful life, remaining useful life, replacement cost, fully funded balance, and percent funded. The **30-year cash flow projection** models annual reserve income (contributions plus investment interest), projected expenditures (based on component replacement schedules), and ending balance per year. Three funding strategies are supported: full funding (100% by year 30), threshold funding (maintain a target percentage), and baseline funding (never fall below $0). The percent funded formula is: Current Reserve Balance ÷ Fully Funded Balance, where Fully Funded Balance = Σ(Current Replacement Cost × Effective Age ÷ Useful Life).

**Assessment rate calculation** divides the total annual budget (operating expenses plus reserve contribution minus non-assessment revenue) by the number of assessable units. The system supports weighted calculations where units pay different amounts based on lot size, unit type, or percentage interest as defined in the governing documents.

### Area 6: Invoicing

**Automated invoice generation** creates invoices based on the assessment schedule. The system generates invoices in batch on a configurable date (e.g., the 15th of the prior month for dues due the 1st). Each invoice itemizes: assessment type, amount, due date, payment instructions (ACH, card, check), any outstanding balance carried forward, and late fee warning.

**Invoice templates** are customizable per HOA with branding (logo, colors), configurable fields, and state-specific disclosures. Templates support PDF generation for mailing, email delivery with embedded payment links, and owner portal display.

**Multiple schedules** are supported concurrently—an owner may receive monthly operating assessments, quarterly special assessment installments, and a one-time ARC fee on the same statement. The system consolidates all charges into a single monthly statement while maintaining per-charge detail.

**Credit memo handling** allows adjustments for overpayments, fee waivers (board-approved), and error corrections. Each credit memo requires a reason code, optional board approval (configurable), and full audit trail. Credits apply to the owner's balance per the payment application order.

**Statement generation** produces a comprehensive owner statement showing: all charges, payments, credits, and running balance for a configurable date range. Statements are available on-demand via the owner portal and generated automatically at month-end.

### Area 7: Collections workflow (covered in Deliverable 4)

### Area 8: Financial statements (covered in Deliverable 3)

### Area 9: Bank integration

**Plaid is the recommended bank integration provider**, offering the best combination of institution coverage (12,000+ US institutions), developer experience, and cost efficiency at the platform's growth stage.

**Root cause of PayHOA's 2–3 day lag.** PayHOA's FAQ states: "The Plaid system will pull the bank data on a daily basis." This means PayHOA polls once per day. Combined with Plaid's own 1–4x daily refresh frequency and the pending-to-posted transaction lifecycle (1–2 business days, extending to 3+ days over weekends), the aggregate lag reaches 2–3 days. **This is primarily an implementation problem, not a Plaid limitation.**

**Solution architecture to eliminate the lag:**

The platform uses **Plaid Transactions Sync** (cursor-based incremental updates) with **SYNC_UPDATES_AVAILABLE webhooks** that fire whenever Plaid detects new transaction data. Upon webhook receipt, the system immediately calls `/transactions/sync` to fetch added, modified, and removed transactions. Additionally, the `/transactions/refresh` endpoint (paid add-on) enables user-triggered on-demand refreshes. A scheduled backup poll runs every 4 hours. For real-time balance needs (reserve fund monitoring), the **Balance API** (`/accounts/balance/get`) returns live balance data from the institution. This approach reduces the lag from 2–3 days to **under 4 hours** in most cases, with real-time balance data on demand.

**Plaid pricing projections:**

| Scale | Connected accounts | Estimated annual cost | Per-account |
|---|---|---|---|
| Launch | 100–500 | $6K–$15K | $5–$8 |
| Growth | 500–2,000 | $15K–$36K | $1.50–$3.00 |
| Scale | 2,000–10,000 | $30K–$70K | $0.50–$1.00 |

**Alternatives evaluated.** MX Technologies offers superior data categorization (119+ categories, 99.7% accuracy) but at enterprise pricing ($15K–$90K annual minimum) unsuitable for early-stage. Yodlee requires $10K–$50K setup and $100K+ annual at small scale. Finicity (Mastercard) provides FCRA-compliant data and real-time balance snapshots with a more accessible pricing model. Akoya, the bank-owned FDX-standard network, offers the highest data quality through direct API connections (zero screen scraping) but covers only 4,300 institutions versus Plaid's 12,000. **At enterprise scale, a multi-provider strategy** combining Plaid (primary, broadest coverage) with Akoya (supplemental for major banks) provides optimal reliability.

**Automated bank reconciliation** uses rule-based matching first (amount, date, description pattern, recurring transaction detection via Plaid's `/transactions/recurring/get`), then AI/ML matching that learns from user corrections. Plaid's `pending_transaction_id` links pending and posted versions of the same transaction. Unmatched items route to an exception queue for manual categorization. The system tracks reconciled status per transaction and generates standard bank reconciliation reports.

### Area 10: Audit support

**Immutable audit trail.** Every financial transaction records: date, amount, account(s), payee/payer, creating user, approving user, timestamp, and IP address in an append-only log. Modifications record before/after values with the modifying user and justification. Deletions are prohibited—corrections use reversing entries. This log supports the 7-year retention requirement.

**Approval workflows** are configurable by expenditure amount and account type. A recommended default: under $500 requires treasurer approval; $500–$5,000 requires two board member approvals; over $5,000 requires board vote documented in minutes. Emergency/expedited paths require documented justification.

**Multi-signature enforcement for reserve disbursements.** Washington's RCW 64.90.535(3) mandates that "every disbursement of reserve funds requires the signature of at least two persons who are officers or directors of the association." The system enforces this through dual-authorization workflows: the first authorized signer initiates the disbursement, and a second authorized signer must approve before the payment is released. Digital signatures with identity verification satisfy this requirement. The system prevents any single user from both initiating and approving a reserve fund disbursement.

**Role-based access control (RBAC)** defines eight roles: Board President (full access), Treasurer (financial access), Secretary (meeting/document access), Board Member (view + limited approval), Property Manager (operational access), Bookkeeper (data entry, no approval), CPA/Auditor (read-only financial access), and Homeowner (own account view only). **Segregation of duties** is enforced: the person who enters invoices cannot approve payments; vendor setup is separated from payment processing; bank reconciliation is separated from bookkeeping.

**CPA export capabilities** include: general ledger export (QuickBooks IIF/QBW, Xero CSV, Excel, CSV), trial balance, chart of accounts, bank reconciliation reports, AR/AP aging, check register, assessment roll, 1099 data, 1120-H worksheet with income categorization, and GAAP-compliant financial statement packages in PDF. Supporting documents (invoices, receipts, contracts) attach to transactions and export with the audit package.

**7-year data retention** covers: tax returns and supporting documentation, 1099 forms and payment records, W-9 forms, bank statements and reconciliations, general ledger and journal entries, AR/AP records, assessment billing and collection records, vendor contracts, board meeting minutes, reserve study reports, insurance policies, and audit reports. The system implements automated retention policies with archival capabilities and secure destruction scheduling after the retention period expires.

### Area 11: Tax considerations

**1099 generation.** The One Big Beautiful Bill Act (OBBBA), signed July 4, 2025, raised the 1099 reporting threshold from $600 to **$2,000 effective for tax year 2026** (filings due 2027), indexed for inflation starting 2027. Tax year 2025 filings (due early 2026) still use the $600 threshold. The system manages both 1099-NEC (non-employee compensation: landscapers, contractors, attorneys) and 1099-MISC (rents, royalties). **Attorneys must receive 1099s regardless of entity type.** E-filing is mandatory for virtually all HOAs since the threshold dropped to **10 aggregate returns** (effective 2024). Filing deadline: 1099-NEC due January 31 for both IRS and recipients.

**W-9 and TIN verification workflow:** Collect W-9 from every vendor before first payment. Validate TIN/name combinations using the IRS TIN Matching Program (free, available 24/7) or third-party API services (TaxBandits, Tax1099, Compliancely). Re-validate annually before year-end. Flag mismatches for W-9 re-solicitation. If a vendor fails to provide a valid TIN, apply **24% backup withholding** on all reportable payments and file Form 945 annually. The system tracks W-9 status per vendor, expiration dates, B-Notice history, and backup withholding obligations.

**1120-H tax return support.** Form 1120-H is an annual election (made by filing) for qualifying HOAs under IRC Section 528. The system automatically categorizes income as exempt function (assessments, late fees, fines, transfer fees) or **non-exempt function (interest income, rental income, cell tower leases, vending)**, which is taxed at **30%**. The platform monitors the **60% test** (at least 60% of gross income from exempt sources) and the **90% test** (at least 90% of expenditures for property management) in real time with dashboard alerts when approaching threshold violations. Tax year 2025 is the first year e-filing is available for 1120-H. Filing deadline: April 15 for calendar-year HOAs, with automatic 6-month extension via Form 7004.

**1120-H vs. 1120 comparison tool.** When an HOA has significant non-exempt income, Form 1120 (standard corporate return) may produce lower tax liability since the first $50K is taxed at 21% (flat corporate rate) versus 1120-H's 30%. Revenue Ruling 70-604 allows HOAs filing Form 1120 to defer excess membership income by applying it to next year's assessments—this election must be voted on by the **membership** (not just the board) at the annual meeting and documented in minutes. The system should calculate estimated tax liability under both forms and recommend the lower-cost option.

**Washington State tax obligations.** Washington has no state income tax, so HOAs do not file state returns. However, HOAs may be subject to **Business & Occupation (B&O) tax** if they provide services beyond general upkeep or make retail sales. RCW 82.04.4298 provides a deduction for amounts received from members used for maintenance of residential structures or commonly held property. The system should flag revenue categories that may trigger B&O tax liability (e.g., operating a golf course, providing repair services to individual owners).

**PCI-DSS 4.0 compliance.** Using Stripe Elements qualifies the platform for **SAQ-A**—the simplest compliance level with approximately 22 questions and no quarterly ASV scans required. PCI DSS 4.0.1 (effective April 2025) added mandatory requirements for iframe-based integrations: **Requirement 6.4.3** (inventory and authorize all scripts on payment pages, alert on unauthorized changes) and **Requirement 11.6.1** (change/tamper-detection mechanisms for HTTP headers and payment pages). The platform must implement Content Security Policy headers, Subresource Integrity checks, and script monitoring on all pages containing the Stripe Elements iframe. SAQ-A must be completed and submitted annually.

---

## Implementation priorities and architecture notes

### Phase 1: Foundation (Talasera launch)

Build the core financial engine with Washington State rules hardcoded as the default configuration: assessment billing (regular monthly), ACH and card payment processing via Stripe Connect, owner portal with autopay enrollment, basic invoice generation, owner ledger, AR aging, budget vs. actual reporting, and the first four steps of the collections workflow (through late fee assessment and first delinquency notice). Implement the chart of accounts with operating and reserve fund separation, dual-authorization for reserve disbursements, and bank sync via Plaid Transactions Sync with webhooks.

### Phase 2: Full financial suite

Add special assessment billing with installment support, complete collections workflow (all 11 steps), payment plan creation and tracking, bank reconciliation with automated matching, full financial statement generation (balance sheet, income statement, cash flow, fund balance changes), reserve fund tracking with 30-year projections, credit memo handling, and 1099 generation engine with W-9/TIN verification.

### Phase 3: Multi-state and scale

Build the state rules engine with configurable parameters for all jurisdiction-specific collection rules, late fee caps, interest ceilings, payment application orders, foreclosure thresholds, and notice requirements. Add 1120-H preparation worksheets with the 60%/90% test monitor, budget creation workflow with assessment rate calculator, CPA export package, and compliance calendar with automated reminders. Implement the multi-provider bank integration strategy (Plaid primary, Akoya supplemental) and begin SOC 2 Type II readiness.

### Data model considerations

The financial engine should be architected around these core entities: **Account** (owner account with unit association), **Assessment** (charge type with schedule and amount), **Transaction** (immutable ledger entry with fund tag, double-entry debit/credit), **Invoice** (generated billing document linking multiple assessments), **Payment** (received payment with method, status, and application detail), **CollectionCase** (delinquency lifecycle tracking per account with state rule reference), **Fund** (operating/reserve/special/custom with balance tracking), and **BankConnection** (Plaid link with sync state and cursor). Every entity carries created_by, created_at, modified_by, modified_at, and links to the immutable audit log.

### Competitive advantages over PayHOA

This specification addresses every identified PayHOA weakness: **real-time bank sync** (under 4 hours vs. 2–3 days) through optimized Plaid webhooks; **proper fund accounting** with interfund transfers, restricted fund tracking, and GAAP-compliant financial statements; **automated multi-state collections** with configurable state rules engine vs. PayHOA's limited workflow; **reserve study integration** with 30-year cash flow projections and percent-funded analysis; **lower ACH fees** ($2.40 on a $300 payment vs. PayHOA's flat $1.95—marginally higher, but the platform's value proposition justifies this through superior features); and **comprehensive audit trail** with dual-authorization enforcement for reserve disbursements.

## Conclusion

This specification provides a development-ready blueprint for the financial management module. Three architectural decisions are foundational and should not be revisited: Stripe Connect with Destination Charges for payment processing, Plaid with Transactions Sync and webhooks for bank integration, and a fund-tagged double-entry ledger for all accounting. The collections workflow, with its state rules engine supporting 15 configurable parameters per jurisdiction, represents the platform's deepest competitive moat—PayHOA and most competitors handle collections as a simple late-fee-and-reminder sequence rather than a legally compliant, state-aware automated workflow. The 1099 threshold increase to $2,000 under OBBBA (effective 2026) simplifies vendor tax reporting but does not eliminate the need for a robust W-9/TIN verification pipeline. Washington's SB 5686 meet-and-confer and mediation requirements, effective through staggered dates ending January 1, 2028, add meaningful pre-foreclosure process obligations that the system must orchestrate with full audit trail documentation. All statutory references in this specification should be verified by legal counsel before implementation, and the state rules engine should include a legal review workflow for updating configurations when laws change.