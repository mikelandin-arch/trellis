# HOA data migration strategy for a new SaaS platform

**Moving HOAs from PayHOA, other platforms, and spreadsheets to a PostgreSQL/Fastify/React Native stack requires a phased, repeatable migration pipeline — not a one-off script.** The biggest risk isn't technical; it's financial data integrity and homeowner re-adoption. PayHOA offers no public API, so all extraction depends on CSV/PDF report exports and manual document downloads. For a platform that will onboard hundreds of HOAs over time, the right investment is a custom TypeScript migration package inside the Turborepo monorepo, with source-specific adapters and a four-layer validation framework. This report covers every dimension of the migration: data extraction, financial cutover, document handling, technical architecture, homeowner onboarding, and operational planning.

---

## What you can actually extract from PayHOA

PayHOA explicitly states that all data belongs to the association and can be exported in **CSV or PDF format at any time**, with no contracts or cancellation fees. In practice, the export surface is narrower than it sounds.

**Financial data is the strongest export category.** PayHOA offers 30+ accounting reports — General Ledger, Balance Sheet, P&L, Budget vs. Actual, Aging, Bank Reconciliation, Vendor Transactions — all exportable to CSV or PDF. Budget data exports to Excel. The platform's blog confirms these exports are compatible with QuickBooks and other accounting software. Owner account statements (charges, payments, running balances) export as per-homeowner PDFs.

**Owner/property records require custom reports.** There's no documented "export all homeowners" button. Instead, PayHOA's FAQ confirms that custom reports can pull "any piece of contact information stored in PayHOA including tags, notes and custom fields." This means names, addresses, lot numbers, contact info, and custom fields are accessible, but through report generation rather than a direct data dump.

**Documents have no bulk download.** PayHOA offers unlimited document storage (PDFs, Excel, Word, images), organized in folders. However, no bulk export or "download all" tool is documented. Each document or folder must be downloaded individually — a significant manual burden for HOAs with years of CC&Rs, meeting minutes, and financial reports.

**Violations export only as individual PDFs**, not structured CSV data. Communication logs (emails, texts, USPS mail sent through the platform) have **no documented export path**. Architectural review histories, maintenance request details, and message board content are similarly locked in. Most critically, **PayHOA has no public API** — confirmed by GetApp and absent from all documentation. All extraction must go through the manual report-generation interface.

| Data type | Exportable | Format | Migration difficulty |
|---|---|---|---|
| Financial reports (GL, P&L, Balance Sheet) | ✅ Yes | CSV, PDF | Low |
| Budget data | ✅ Yes | PDF, Excel | Low |
| Owner/property directory | ✅ Via custom reports | CSV | Medium |
| Payment history | ✅ Yes | CSV (reports), PDF (per-owner) | Medium |
| Vendor records and 1099 data | ✅ Yes | CSV, PDF | Low |
| Assessment/AR aging | ✅ Yes | CSV, PDF | Low |
| Violation records | ⚠️ Individual PDFs only | PDF | High |
| Stored documents (CC&Rs, minutes) | ⚠️ Manual download | Original format | High |
| Communication logs | ❌ No export documented | N/A | Not feasible |
| Architectural review history | ❌ No export documented | N/A | Not feasible |

The practical implication: plan for a **"forward-looking" migration** from PayHOA, carrying current balances and core records while archiving historical detail as static PDFs. Full transactional history import is possible for financial data but impractical for violations, communications, and architectural records.

---

## Financial migration is the highest-stakes piece

Financial data integrity determines whether an HOA can collect dues, pursue liens, file taxes, and produce accurate board reports after migration. Getting this wrong costs 2-3x the original implementation investment to fix.

**The opening balance method is industry standard.** On the cutover date (ideally the first day of a month, preferably January 1), extract a Trial Balance and Balance Sheet from the old system, then enter all account balances as a single journal entry in the new system. Use a temporary "Conversion Clearing" account as the offset — after all entries, this account must net to **exactly zero**. If it doesn't, there's an error that must be resolved before go-live.

**Outstanding receivables require individual entry with original dates.** This is the most critical financial migration step. Each unpaid charge per homeowner must be entered as a separate receivable preserving the original charge date, because aging (30/60/90-day delinquency) drives collections actions and lien placement. Courts require documented proof of charges and non-payment. Bulk-importing a single "balance forward" per owner destroys the aging detail needed for legal proceedings.

**Mid-year migration demands dual-system reporting.** When migrating outside fiscal year boundaries, the old system holds January-through-cutover transactions while the new system holds cutover-through-December. Year-end financial statements must be manually consolidated from both systems. Budget tracking requires entering the full annual budget in the new system plus year-to-date actuals from the old system. For 1099 reporting, vendor payments from both systems must be aggregated for the full calendar year — Stripe Connect offers a "split tax forms" feature that can divide 1099 reporting at a specified date.

**Fund accounting separation is non-negotiable.** HOAs use fund accounting with distinct operating, reserve, and special assessment funds. Many states legally require reserve funds in physically separate bank accounts. During migration, verify that each fund's balance matches both the GL and actual bank statements. Never combine operating and reserve balances, even temporarily.

**Stripe Connect payment migration has a viable path.** For ACH, Stripe supports a "skip verification" flow where migrated bank accounts bypass re-verification if you provide the original mandate authorization date, account holder name, routing number, and account number. For credit cards, Stripe facilitates encrypted PAN imports from the old processor. However, **recurring payment subscriptions cannot transfer** — assessment billing schedules must be recreated in the new system from scratch. Payment history from the old processor does not migrate to Stripe; it must be preserved in your application database as archived records.

**Reconciliation after migration follows a four-point checklist:** Trial Balance comparison (line-by-line match), A/R aging verification (per-owner balances and aging buckets), bank balance verification against statements, and fund balance cross-check between GL and bank accounts. Run parallel reports from both systems for at least one full monthly close cycle.

---

## Build custom migration tooling as a Turborepo package

For a startup that will migrate many HOAs over time from heterogeneous sources — PayHOA CSVs, AppFolio exports, Buildium data, raw spreadsheets — off-the-shelf ETL tools like Fivetran and Airbyte are the wrong choice. No pre-built connectors exist for HOA management software. Transformation logic is deeply domain-specific (mapping units, owners, assessments, violations). Subscription-based ETL pricing is wasteful for periodic batch migrations.

**The right architecture is a custom `@repo/migration` package** in the Turborepo monorepo with a source adapter pattern:

```
packages/migration/
  src/
    adapters/        # PayHOA, AppFolio, CSV-generic, Excel adapters
    transformers/    # Domain transformers (owners, units, assessments)
    loaders/         # PostgreSQL COPY loader, S3 document loader
    validators/      # Row counts, checksums, FK integrity, business logic
    pipeline/        # Migration runner, config, rollback
```

Each source system implements a `SourceAdapter` interface while sharing transformation and loading logic. The adapter for PayHOA maps its CSV export columns to the target schema; the spreadsheet adapter handles messy, inconsistent data with flexible parsing. This architecture lets the team build once and reuse across hundreds of HOA onboardings, with source-specific adapters added as new platform migrations arise.

**PostgreSQL bulk loading should use the COPY command** with triggers and non-primary-key indexes temporarily disabled — this is 100x faster than individual INSERTs. Use a dedicated `migration_admin` database role with the `BYPASSRLS` attribute so Row-Level Security policies don't interfere during bulk loads. Load tables in foreign key dependency order: `hoas` → `units` → `owners` → `assessments` → `payments` → `documents` → `violations`. After loading, re-enable triggers, recreate indexes, run `ANALYZE`, and explicitly validate foreign key integrity.

**For documents, use a prefix-per-tenant S3 structure** rather than bucket-per-tenant (S3 has a hard limit of 1,000 buckets per account). Store document metadata — original filename, upload date, category, source system, checksum — in PostgreSQL with RLS on `hoa_id`, not in S3 object metadata (which is immutable). Upload via the `@aws-sdk/lib-storage` Upload class with SHA-256 checksums verified post-upload. For post-migration searchability, trigger AWS Lambda on S3 PUT events to invoke Amazon Textract for OCR on PDFs.

**Every migration script must be idempotent.** Check whether a migration already completed for the target HOA before running. Use `INSERT ON CONFLICT DO UPDATE` (upsert) for individual records, or `DELETE-then-COPY` within a transaction for bulk loads. Track migration runs in a `migration_runs` table with status, row counts, and checksums.

---

## In-flight transactions and rollback planning

**A short freeze window is the right approach for HOA migrations.** Unlike e-commerce platforms requiring 24/7 uptime, HOAs can tolerate a weekend maintenance window. The pattern: pre-migrate all historical data while the old system remains active (safe because historical data is immutable), then execute a freeze window (Friday evening to Sunday) during which you disable new transactions in the old system, capture the final delta, complete the migration, validate, and cut over. Post-cutover, enable payments on the new system via Stripe Connect.

Dual-write approaches — writing simultaneously to both old and new systems — are unnecessarily complex for batch HOA migration and risk data inconsistency. Change Data Capture (CDC) via PostgreSQL logical replication is appropriate only if zero-downtime migration becomes a hard requirement for larger management company migrations.

**For Stripe specifically, webhooks are replayable.** Keep webhook URLs pointed to the old system until cutover, then update them to the new system. Any webhooks missed during the transition can be recovered via Stripe's event replay API (events retained for 30 days).

**Rollback is straightforward because of multi-tenancy isolation.** Since each HOA's data is scoped by `hoa_id`, rolling back a single HOA's migration means executing `DELETE FROM <table> WHERE hoa_id = '{hoa_id}'` across all migrated tables in reverse foreign key order. No other tenant is affected. For defense-in-depth, take an RDS snapshot before each migration batch. Keep the old system accessible in read-only mode for **30-90 days** post-migration. Only decommission after formal HOA board sign-off.

**Validation follows a four-layer pyramid:** volume checks (row counts match source ±0%), structural checks (FK constraints hold, no orphaned records), content checksums (table-level MD5 aggregates), and business logic validation (assessment totals match, owner counts match unit counts, financial balances reconcile to the penny). Define explicit go/no-go criteria that must pass before confirming any migration.

---

## Getting homeowners onto the new platform

Portal adoption across HOA communities typically sits at **15-30%** for baseline implementations, making re-onboarding the biggest adoption risk during migration. The single most effective lever is making the portal the only way to pay dues online.

**The communication sequence should start 4-6 weeks before migration:**

1. **Week -6:** Board announcement explaining why the platform is changing, framed around benefits (lower costs, faster communication, easier payments)
2. **Week -4:** Formal letter/email to all homeowners with timeline, FAQs, and portal preview screenshots
3. **Week -1:** Reminder with specific go-live date and setup instructions
4. **Launch day:** Welcome email via Clerk Invitations API with a one-click account activation link. Pre-populate `publicMetadata` on each invitation with lot number and community ID so the account is auto-configured on signup
5. **Week +1-2:** Follow-up to non-registrants; offer virtual "office hours" for setup help
6. **Week +3-4:** Second-chance reminder with a deadline for autopay enrollment

**Clerk's Invitations API is well-suited for this flow.** Admins create invitations via the API with each homeowner's email. Clerk sends an email with a unique link that auto-verifies the email on click — no extra verification step. Invitations expire after 30 days, with expired links redirecting to normal signup. One critical caveat: **Clerk's Expo SDK does not support email magic links.** For the React Native app, use email verification codes (OTP) instead.

For homeowners who don't register, pre-load their information as "unregistered resident" records so managers can still track payments and send communications. Continue paper statement fallbacks for 3-6 months, then introduce a paper statement fee (where legal) to incentivize digital adoption. Offer in-person signup help at board meetings. Well-executed deployments have pushed adoption past **50%** within the first month and toward **90%+** in exceptional cases — usually by requiring online payment as the primary method.

---

## Spreadsheet HOAs need white-glove treatment

Approximately **30-40% of U.S. HOAs are self-managed**, and many rely entirely on Excel or Google Sheets. Their data typically spans 6-9 disconnected files: an owner contact directory, a payment tracking ledger, budget spreadsheets, an expense register, violation logs, bank reconciliation sheets, and Word documents for meeting minutes. Every HOA's spreadsheet is messy in its own way — inconsistent date formats, name variations ("Smith, John" vs. "John Smith"), no unique identifiers, merged cells, and formula-dependent layouts.

**Provide CSV templates but don't require them.** Downloadable templates with clear column headers, sample data, and instructions give structure-minded treasurers a target format. But also accept flexible uploads via smart column mapping — tools like **Flatfile** or **CSVBox** (both embeddable React components) can auto-match user columns to your schema and show validation errors inline during upload.

**Default to concierge onboarding for spreadsheet HOAs.** Every major HOA platform (PayHOA, HOALife, Vantaca, 3.0 Management) offers dedicated onboarding specialists who handle data migration. For a startup, this is the right early approach — it builds trust, catches data quality issues self-service would miss, and dramatically reduces churn. The cost of concierge onboarding is lower than the cost of building a perfect self-service import tool. Patrick McKenzie has estimated that building a robust generic CSV importer costs roughly **$100,000** in engineering time. Start with "one smart person with an inbox," build efficient internal tooling to make that person fast, and layer in self-service tools as the process matures.

**Phase the spreadsheet migration:** start with owner directory and current balances (minimum viable data to operate), then layer in historical payment records, then violations and documents. This gets the HOA operational on the new platform quickly while allowing deeper data migration to happen over the first 30 days.

---

## Timelines vary from days to months

| HOA type | Expected timeline | Key driver |
|---|---|---|
| Small self-managed (under 100 units) | **2-6 weeks** | Data readiness, board volunteer availability |
| Mid-size (100-500 units) | **6-12 weeks** | Financial complexity, document volume |
| Management company (1-50 associations) | **45-90 days** | Staff training, phased rollout |
| Management company (50-500 associations) | **60-90 days** | Wave-based migration, 5-15 communities per wave |
| Enterprise (500+ associations) | **90-120+ days** | Pilot group validation, standardization |

**January 1 is the optimal migration date** — most HOAs operate on calendar-year fiscal years, and a January cutover eliminates mid-year reporting complexity. Planning should begin in Q3 (September-October), data cleanup in Q4, and go-live January 1. The worst times to migrate are during annual meeting season, fall budget season, or mid-month (which splits transactions across systems).

**Parallel running of 60-90 days is standard.** Both platforms remain active — the old system in read-only mode, the new system handling all new activity. This dual period lets the team verify data accuracy, catch discrepancies, and gives homeowners time to transition. Only decommission old system access after at least one full monthly close cycle has been successfully completed in the new system and bank reconciliations match across both.

For management companies migrating entire portfolios, the proven approach is a **pilot-then-waves** strategy: migrate 1-3 communities of varying size/complexity as a pilot, refine the process, then roll out in waves of 5-15 communities each. Each wave builds on lessons from the previous one. Real-world examples include Kai Management (30,000+ doors migrated to Vantaca without disruption) and Silverleaf Management (51 acquired associations onboarded in year one).

---

## Conclusion

The migration strategy for this platform should be built around three principles. First, **accept data loss gracefully** — communication logs, architectural review histories, and detailed violation records will not survive migration from PayHOA or most other platforms. Design the migration to carry forward what matters (financial balances, owner records, documents, outstanding receivables with original dates) and archive everything else as static PDFs. Second, **invest in reusable tooling early** — the `@repo/migration` Turborepo package with source adapters, PostgreSQL COPY-based bulk loading, and four-layer validation will pay dividends across hundreds of future onboardings. Third, **treat homeowner onboarding as a product problem, not a technical one** — the Clerk invitation flow, a 4-6 week communication sequence, and making online payment the default path will drive adoption far more than any technical migration of user accounts. The platform that makes switching painless for the board treasurer and invisible to the homeowner wins the market.