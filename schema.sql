-- ============================================================================
-- Trellis HOA Platform — Complete Database Schema
-- PostgreSQL 16 on RDS with Row-Level Security
-- Source: Multi-Tenancy Strategy and Core Data Model specification
-- ============================================================================
-- Run: psql -h <rds-host> -U postgres -d trellis_dev -f schema.sql
-- ============================================================================

-- ── Extensions ───────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;    -- temporal EXCLUDE constraints
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid() (v4; upgrade to uuidv7 on PG18)

-- ── Database Roles ───────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin WITH LOGIN BYPASSRLS;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'migration_admin') THEN
    CREATE ROLE migration_admin WITH LOGIN BYPASSRLS;
  END IF;
END $$;

-- ── Helper Functions ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS BIGINT AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::BIGINT;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION trigger_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- DOMAIN 1: PLATFORM (3 tables) — NO RLS
-- ============================================================================

CREATE TABLE tenants (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clerk_org_id           TEXT UNIQUE NOT NULL,
    name                   TEXT NOT NULL,
    slug                   TEXT UNIQUE NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('trial','active','suspended','cancelled')),
    stripe_customer_id     TEXT UNIQUE,
    stripe_subscription_id TEXT,
    stripe_connect_account_id TEXT UNIQUE,
    stripe_connect_onboarded BOOLEAN NOT NULL DEFAULT false,
    plan_tier              TEXT NOT NULL DEFAULT 'starter'
                           CHECK (plan_tier IN ('starter','professional','enterprise')),
    billing_cycle          TEXT NOT NULL DEFAULT 'monthly'
                           CHECK (billing_cycle IN ('monthly','annual')),
    feature_flags          JSONB NOT NULL DEFAULT '{}',
    settings               JSONB NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id          TEXT UNIQUE NOT NULL,
    email                  TEXT NOT NULL,
    display_name           TEXT NOT NULL,
    phone                  TEXT,
    avatar_url             TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_memberships (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    user_id                UUID NOT NULL REFERENCES users(id),
    role                   TEXT NOT NULL DEFAULT 'homeowner'
                           CHECK (role IN (
                               'super_admin','platform_admin','community_manager',
                               'board_president','board_member','committee_member',
                               'homeowner','tenant_resident','vendor'
                           )),
    is_active              BOOLEAN NOT NULL DEFAULT true,
    joined_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id)
);


-- ============================================================================
-- DOMAIN 2: COMMUNITY (4 tables)
-- ============================================================================

CREATE TABLE communities (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    name                   TEXT NOT NULL,
    legal_name             TEXT,
    address_line1          TEXT NOT NULL,
    address_line2          TEXT,
    city                   TEXT NOT NULL,
    state_code             CHAR(2) NOT NULL,
    zip                    VARCHAR(10) NOT NULL,
    county                 TEXT,
    formation_date         DATE,
    ein                    VARCHAR(10),
    community_type         TEXT NOT NULL DEFAULT 'hoa'
                           CHECK (community_type IN ('hoa','condo','cooperative','mixed_use')),
    total_units            INTEGER NOT NULL DEFAULT 0,
    total_voting_weight    NUMERIC(10,4) NOT NULL DEFAULT 0,
    fiscal_year_start_month SMALLINT NOT NULL DEFAULT 1
                           CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    compliance_config      JSONB NOT NULL DEFAULT '{}',
    settings               JSONB NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shared reference table: 5-layer compliance priority hierarchy
-- platform/state rows have NULL tenant_id and are readable by all tenants
-- community-scoped rows have tenant_id set and are restricted by RLS
CREATE TABLE compliance_profiles (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT REFERENCES tenants(id),  -- NULL for platform/state scope
    scope                  TEXT NOT NULL CHECK (scope IN ('platform','state','community_type','community')),
    state_code             CHAR(2),
    community_type         TEXT,
    community_id           UUID REFERENCES communities(id),
    priority               INTEGER NOT NULL DEFAULT 0,
    fine_cap_per_violation  NUMERIC(10,2),
    fine_cap_aggregate     NUMERIC(10,2),
    daily_fine_permitted   BOOLEAN NOT NULL DEFAULT true,
    daily_fine_cap         NUMERIC(10,2),
    cure_period_days       INTEGER NOT NULL DEFAULT 30,
    hearing_notice_days    INTEGER NOT NULL DEFAULT 14,
    hearing_decision_days  INTEGER,
    fining_committee_required BOOLEAN NOT NULL DEFAULT false,
    certified_mail_required BOOLEAN NOT NULL DEFAULT false,
    late_fee_cap           NUMERIC(10,2),
    interest_rate_cap      NUMERIC(5,4),
    payment_application_order TEXT[] NOT NULL DEFAULT '{}',
    super_lien_enabled     BOOLEAN NOT NULL DEFAULT false,
    super_lien_months      INTEGER,
    enforcement_retention_years INTEGER NOT NULL DEFAULT 7,
    financial_retention_years INTEGER NOT NULL DEFAULT 7,
    rules                  JSONB NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE properties (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    address_line1          TEXT NOT NULL,
    address_line2          TEXT,
    city                   TEXT NOT NULL,
    state_code             CHAR(2) NOT NULL,
    zip                    VARCHAR(10) NOT NULL,
    lot_number             TEXT,
    unit_number            TEXT,
    building               TEXT,
    unit_type              TEXT NOT NULL DEFAULT 'residential'
                           CHECK (unit_type IN ('residential','commercial','mixed','parking','storage')),
    square_footage         INTEGER,
    voting_weight          NUMERIC(8,4) NOT NULL DEFAULT 1.0,
    assessment_class       TEXT NOT NULL DEFAULT 'standard',
    parcel_number          TEXT,
    legal_description      TEXT,
    status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','sold','foreclosure','vacant','under_construction','annexed')),
    status_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    amenity_access         JSONB NOT NULL DEFAULT '[]',
    custom_fields          JSONB NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, community_id, lot_number),
    UNIQUE (tenant_id, community_id, address_line1, unit_number)
);

CREATE TABLE members (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    user_id                UUID REFERENCES users(id),
    first_name             TEXT NOT NULL,
    last_name              TEXT NOT NULL,
    email                  TEXT,
    phone                  TEXT,
    mailing_address_line1  TEXT,
    mailing_address_city   TEXT,
    mailing_address_state  CHAR(2),
    mailing_address_zip    VARCHAR(10),
    member_type            TEXT NOT NULL DEFAULT 'owner'
                           CHECK (member_type IN ('owner','tenant','non_resident_owner','trust','corporate')),
    communication_preferences JSONB NOT NULL DEFAULT '{"email": true, "sms": false, "push": true, "mail": false}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- DOMAIN 3: OWNERSHIP (4 tables)
-- ============================================================================

CREATE TABLE property_ownerships (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    property_id            UUID NOT NULL REFERENCES properties(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    ownership_type         TEXT NOT NULL DEFAULT 'primary'
                           CHECK (ownership_type IN ('primary','co_owner','trust','corporate','estate')),
    ownership_percentage   NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    is_primary_resident    BOOLEAN NOT NULL DEFAULT true,
    valid_during           daterange NOT NULL DEFAULT daterange(CURRENT_DATE, NULL, '[)'),
    recorded_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by            UUID,
    notes                  TEXT,
    EXCLUDE USING gist (
        tenant_id WITH =,
        property_id WITH =,
        member_id WITH =,
        valid_during WITH &&
    )
);

CREATE TABLE board_terms (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    officer_role           TEXT NOT NULL
                           CHECK (officer_role IN ('president','vice_president','secretary','treasurer','at_large')),
    appointment_type       TEXT NOT NULL DEFAULT 'elected'
                           CHECK (appointment_type IN ('elected','appointed')),
    valid_during           daterange NOT NULL,
    elected_date           DATE,
    notes                  TEXT,
    EXCLUDE USING gist (
        tenant_id WITH =,
        community_id WITH =,
        member_id WITH =,
        valid_during WITH &&
    ),
    EXCLUDE USING gist (
        tenant_id WITH =,
        community_id WITH =,
        officer_role WITH =,
        valid_during WITH &&
    )
);

CREATE TABLE committees (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    name                   TEXT NOT NULL,
    committee_type         TEXT NOT NULL DEFAULT 'standing'
                           CHECK (committee_type IN ('standing','ad_hoc','required')),
    purpose                TEXT,
    is_active              BOOLEAN NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE committee_memberships (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    committee_id           UUID NOT NULL REFERENCES committees(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    role                   TEXT NOT NULL DEFAULT 'member'
                           CHECK (role IN ('chair','vice_chair','member')),
    valid_during           daterange NOT NULL DEFAULT daterange(CURRENT_DATE, NULL, '[)'),
    EXCLUDE USING gist (
        committee_id WITH =,
        member_id WITH =,
        valid_during WITH &&
    )
);


-- ============================================================================
-- DOMAIN 4: FINANCIAL (6 tables)
-- ============================================================================

CREATE TABLE assessment_schedules (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    name                   TEXT NOT NULL,
    assessment_type        TEXT NOT NULL
                           CHECK (assessment_type IN ('regular','special','late_fee','fine','arc_fee','transfer_fee')),
    frequency              TEXT NOT NULL DEFAULT 'monthly'
                           CHECK (frequency IN ('monthly','quarterly','semi_annual','annual','one_time')),
    amount                 NUMERIC(12,2) NOT NULL,
    assessment_class       TEXT NOT NULL DEFAULT 'standard',
    fund_allocation        JSONB NOT NULL DEFAULT '{"operating": 1.0}',
    late_fee_config        JSONB NOT NULL DEFAULT '{}',
    is_active              BOOLEAN NOT NULL DEFAULT true,
    effective_date         DATE NOT NULL,
    end_date               DATE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assessment_rate_history (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    schedule_id            UUID NOT NULL REFERENCES assessment_schedules(id),
    previous_amount        NUMERIC(12,2),
    new_amount             NUMERIC(12,2) NOT NULL,
    effective_date         DATE NOT NULL,
    approved_date          DATE,
    reason                 TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE charges (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    property_id            UUID NOT NULL REFERENCES properties(id),
    schedule_id            UUID REFERENCES assessment_schedules(id),
    charge_type            TEXT NOT NULL
                           CHECK (charge_type IN ('assessment','special_assessment','late_fee','interest','fine','arc_fee','transfer_fee','credit')),
    description            TEXT NOT NULL,
    amount                 NUMERIC(12,2) NOT NULL,
    balance_remaining      NUMERIC(12,2) NOT NULL,
    due_date               DATE NOT NULL,
    period_start           DATE,
    period_end             DATE,
    fund_tag               TEXT NOT NULL DEFAULT 'operating'
                           CHECK (fund_tag IN ('operating','reserve','special','custom')),
    status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','due','overdue','partial','paid','waived','void')),
    source_type            TEXT CHECK (source_type IN ('violation','arc_request','manual')),
    source_id              UUID,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    amount                 NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method         TEXT NOT NULL
                           CHECK (payment_method IN ('ach','credit_card','check','cash','lockbox','wire','online_portal')),
    stripe_payment_intent_id TEXT,
    stripe_charge_id       TEXT,
    stripe_transfer_id     TEXT,
    status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','processing','succeeded','failed','refunded','disputed')),
    payment_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    check_details          JSONB,
    reference_number       TEXT,
    notes                  TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_applications (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    payment_id             UUID NOT NULL REFERENCES payments(id),
    charge_id              UUID NOT NULL REFERENCES charges(id),
    amount_applied         NUMERIC(12,2) NOT NULL,
    applied_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_by             UUID
);

CREATE TABLE autopay_enrollments (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    stripe_payment_method_id TEXT NOT NULL,
    payment_method_type    TEXT NOT NULL CHECK (payment_method_type IN ('ach','card')),
    schedule_day           SMALLINT NOT NULL CHECK (schedule_day BETWEEN 1 AND 28),
    is_active              BOOLEAN NOT NULL DEFAULT true,
    authorized_at          TIMESTAMPTZ NOT NULL,
    cancelled_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, member_id)
);


-- ============================================================================
-- DOMAIN 5: GOVERNANCE — VIOLATIONS (5 tables)
-- ============================================================================

CREATE TABLE violation_categories (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    parent_id              UUID REFERENCES violation_categories(id),
    name                   TEXT NOT NULL,
    description            TEXT,
    default_severity       TEXT NOT NULL DEFAULT 'minor'
                           CHECK (default_severity IN ('minor','moderate','major','health_safety')),
    default_cure_days      INTEGER NOT NULL DEFAULT 14,
    default_fine_amount    NUMERIC(10,2),
    governing_doc_section  TEXT,
    is_active              BOOLEAN NOT NULL DEFAULT true,
    sort_order             INTEGER NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE violations (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    property_id            UUID NOT NULL REFERENCES properties(id),
    category_id            UUID REFERENCES violation_categories(id),
    reported_by            UUID REFERENCES members(id),
    assigned_to            UUID REFERENCES members(id),
    status                 TEXT NOT NULL DEFAULT 'reported'
                           CHECK (status IN (
                               'reported','verified','courtesy_notice_sent','formal_notice_sent',
                               'escalated','hearing_scheduled','fine_assessed','payment_plan',
                               'lien_filed','legal_referral','resolved_cured','resolved_paid','dismissed'
                           )),
    severity               TEXT NOT NULL DEFAULT 'minor'
                           CHECK (severity IN ('minor','moderate','major','health_safety')),
    title                  TEXT NOT NULL,
    description            TEXT,
    governing_doc_section  TEXT,
    reported_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    verified_date          DATE,
    cure_deadline          DATE,
    hearing_date           TIMESTAMPTZ,
    resolved_date          DATE,
    fine_amount            NUMERIC(10,2),
    total_fines_accrued    NUMERIC(10,2) NOT NULL DEFAULT 0,
    compliance_rules       JSONB NOT NULL DEFAULT '{}',
    source                 TEXT NOT NULL DEFAULT 'board_inspection'
                           CHECK (source IN ('board_inspection','resident_report','drive_by','scheduled_inspection','anonymous','ai_detected')),
    is_anonymous_report    BOOLEAN NOT NULL DEFAULT false,
    latitude               NUMERIC(10,7),
    longitude              NUMERIC(10,7),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE violations ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) STORED;

CREATE TABLE violation_transitions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    violation_id           UUID NOT NULL REFERENCES violations(id),
    from_state             TEXT NOT NULL,
    to_state               TEXT NOT NULL,
    triggered_by           UUID REFERENCES users(id),
    reason                 TEXT,
    metadata               JSONB NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shared reference: transition rules per compliance profile
-- tenant_id is nullable — platform/state rules have NULL, community rules have tenant_id
CREATE TABLE violation_transition_rules (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT REFERENCES tenants(id),  -- NULL for shared rules
    profile_id             UUID NOT NULL REFERENCES compliance_profiles(id),
    from_state             TEXT NOT NULL,
    to_state               TEXT NOT NULL,
    requires_hearing       BOOLEAN NOT NULL DEFAULT false,
    min_notice_days        INTEGER,
    requires_certified_mail BOOLEAN NOT NULL DEFAULT false,
    auto_transition_days   INTEGER,
    conditions             JSONB NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE violation_evidence (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    violation_id           UUID NOT NULL REFERENCES violations(id),
    evidence_type          TEXT NOT NULL
                           CHECK (evidence_type IN ('photo','video','document','note','gps_coords')),
    file_url               TEXT,
    file_key               TEXT,
    thumbnail_url          TEXT,
    description            TEXT,
    captured_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    captured_by            UUID REFERENCES users(id),
    latitude               NUMERIC(10,7),
    longitude              NUMERIC(10,7),
    file_hash              TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- DOMAIN 5 (cont): GOVERNANCE — ARC REQUESTS (4 tables)
-- ============================================================================

CREATE TABLE arc_modification_types (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    name                   TEXT NOT NULL,
    complexity_tier        SMALLINT NOT NULL DEFAULT 2
                           CHECK (complexity_tier BETWEEN 1 AND 3),
    requires_site_visit    BOOLEAN NOT NULL DEFAULT false,
    default_review_days    INTEGER NOT NULL DEFAULT 30,
    required_documents     TEXT[] NOT NULL DEFAULT '{}',
    fee_amount             NUMERIC(10,2),
    is_active              BOOLEAN NOT NULL DEFAULT true,
    sort_order             INTEGER NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE arc_requests (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    property_id            UUID NOT NULL REFERENCES properties(id),
    applicant_id           UUID NOT NULL REFERENCES members(id),
    modification_type_id   UUID REFERENCES arc_modification_types(id),
    status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN (
                               'draft','submitted','under_review','info_requested',
                               'site_visit_scheduled','committee_review','approved',
                               'approved_with_conditions','denied','withdrawn',
                               'expired','appealed','construction_active',
                               'compliance_check','completed','violation_issued'
                           )),
    complexity_tier        SMALLINT NOT NULL DEFAULT 2,
    title                  TEXT NOT NULL,
    description            TEXT NOT NULL,
    estimated_cost         NUMERIC(12,2),
    estimated_start_date   DATE,
    estimated_completion_date DATE,
    decision_type          TEXT CHECK (decision_type IN ('approved','approved_with_conditions','denied')),
    decision_rationale     TEXT,
    decision_date          DATE,
    conditions             JSONB NOT NULL DEFAULT '[]',
    precedent_tags         TEXT[] NOT NULL DEFAULT '{}',
    submission_date        DATE,
    review_deadline        DATE,
    deemed_approved_deadline DATE,
    completion_deadline    DATE,
    linked_violation_id    UUID REFERENCES violations(id),
    previous_application_id UUID REFERENCES arc_requests(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE arc_transitions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    request_id             UUID NOT NULL REFERENCES arc_requests(id),
    from_state             TEXT NOT NULL,
    to_state               TEXT NOT NULL,
    triggered_by           UUID REFERENCES users(id),
    reason                 TEXT,
    metadata               JSONB NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE arc_votes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    request_id             UUID NOT NULL REFERENCES arc_requests(id),
    committee_member_id    UUID NOT NULL REFERENCES members(id),
    vote_value             TEXT NOT NULL
                           CHECK (vote_value IN ('approve','deny','conditional')),
    rationale              TEXT NOT NULL,
    conditions_proposed    JSONB NOT NULL DEFAULT '[]',
    guideline_citations    TEXT[] NOT NULL DEFAULT '{}',
    precedent_references   UUID[] NOT NULL DEFAULT '{}',
    conflict_of_interest   BOOLEAN NOT NULL DEFAULT false,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, request_id, committee_member_id)
);


-- ============================================================================
-- DOMAIN 6: OPERATIONS (9 tables)
-- ============================================================================

CREATE TABLE meetings (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    meeting_type           TEXT NOT NULL
                           CHECK (meeting_type IN ('annual','board','special','committee','executive_session')),
    title                  TEXT NOT NULL,
    scheduled_at           TIMESTAMPTZ NOT NULL,
    location               TEXT,
    virtual_meeting_url    TEXT,
    is_virtual             BOOLEAN NOT NULL DEFAULT false,
    is_hybrid              BOOLEAN NOT NULL DEFAULT false,
    status                 TEXT NOT NULL DEFAULT 'scheduled'
                           CHECK (status IN ('draft','scheduled','in_progress','completed','cancelled')),
    notice_sent_at         TIMESTAMPTZ,
    notice_method          TEXT[],
    minutes_text           TEXT,
    minutes_approved       BOOLEAN NOT NULL DEFAULT false,
    minutes_approved_at    TIMESTAMPTZ,
    recording_url          TEXT,
    transcript_url         TEXT,
    quorum_required        INTEGER,
    quorum_present         INTEGER,
    quorum_met             BOOLEAN,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE meeting_agenda_items (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    meeting_id             UUID NOT NULL REFERENCES meetings(id),
    item_type              TEXT NOT NULL DEFAULT 'discussion'
                           CHECK (item_type IN ('action_item','discussion','information','vote','standing')),
    title                  TEXT NOT NULL,
    description            TEXT,
    duration_minutes       INTEGER,
    sort_order             INTEGER NOT NULL DEFAULT 0,
    presenter_id           UUID REFERENCES members(id),
    resolution             TEXT,
    vote_result            TEXT,
    attachments            JSONB NOT NULL DEFAULT '[]',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE meeting_attendees (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    meeting_id             UUID NOT NULL REFERENCES meetings(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    attendance_type        TEXT NOT NULL DEFAULT 'in_person'
                           CHECK (attendance_type IN ('in_person','virtual','proxy','absent')),
    is_board_member        BOOLEAN NOT NULL DEFAULT false,
    proxy_for_member_id    UUID REFERENCES members(id),
    checked_in_at          TIMESTAMPTZ,
    UNIQUE (tenant_id, meeting_id, member_id)
);

CREATE TABLE elections (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    meeting_id             UUID REFERENCES meetings(id),
    title                  TEXT NOT NULL,
    election_type          TEXT NOT NULL
                           CHECK (election_type IN ('board_election','amendment','special_assessment','recall','policy')),
    status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','nominations_open','voting_open','closed','certified','cancelled')),
    voting_method          TEXT NOT NULL DEFAULT 'electronic'
                           CHECK (voting_method IN ('electronic','in_person','mail','mixed')),
    is_secret_ballot       BOOLEAN NOT NULL DEFAULT true,
    nominations_open_at    TIMESTAMPTZ,
    nominations_close_at   TIMESTAMPTZ,
    voting_open_at         TIMESTAMPTZ,
    voting_close_at        TIMESTAMPTZ,
    quorum_threshold       NUMERIC(5,4) NOT NULL DEFAULT 0.50,
    approval_threshold     NUMERIC(5,4) NOT NULL DEFAULT 0.50,
    ballot_config          JSONB NOT NULL DEFAULT '{}',
    results                JSONB,
    certified_at           TIMESTAMPTZ,
    certified_by           UUID REFERENCES users(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ballot_options (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    election_id            UUID NOT NULL REFERENCES elections(id),
    label                  TEXT NOT NULL,
    description            TEXT,
    candidate_member_id    UUID REFERENCES members(id),
    sort_order             INTEGER NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vote_records (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    election_id            UUID NOT NULL REFERENCES elections(id),
    ballot_option_id       UUID NOT NULL REFERENCES ballot_options(id),
    voter_member_id        UUID REFERENCES members(id),
    vote_token             UUID,
    voting_weight          NUMERIC(8,4) NOT NULL DEFAULT 1.0,
    is_proxy_vote          BOOLEAN NOT NULL DEFAULT false,
    proxy_form_document_id UUID,
    cast_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE voter_registry (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    election_id            UUID NOT NULL REFERENCES elections(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    has_voted              BOOLEAN NOT NULL DEFAULT false,
    vote_token             UUID,
    checked_in_at          TIMESTAMPTZ,
    vote_method            TEXT CHECK (vote_method IN ('in_person','electronic','mail','proxy')),
    UNIQUE (tenant_id, election_id, member_id)
);

CREATE TABLE documents (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    category               TEXT NOT NULL
                           CHECK (category IN (
                               'governing_docs','financial','meeting_minutes','correspondence',
                               'violation_evidence','arc_documents','insurance','contracts',
                               'maintenance','forms','other'
                           )),
    title                  TEXT NOT NULL,
    description            TEXT,
    file_key               TEXT NOT NULL,
    file_url               TEXT NOT NULL,
    file_size_bytes        BIGINT,
    mime_type              TEXT NOT NULL,
    version                INTEGER NOT NULL DEFAULT 1,
    is_public              BOOLEAN NOT NULL DEFAULT false,
    uploaded_by            UUID REFERENCES users(id),
    access_override        JSONB,
    search_text            TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE documents ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(search_text, '')), 'C')
    ) STORED;

CREATE TABLE document_versions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    document_id            UUID NOT NULL REFERENCES documents(id),
    version                INTEGER NOT NULL,
    file_key               TEXT NOT NULL,
    file_url               TEXT NOT NULL,
    file_size_bytes        BIGINT,
    change_summary         TEXT,
    uploaded_by            UUID REFERENCES users(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- DOMAIN 7: COMMUNICATIONS (3 tables)
-- ============================================================================

CREATE TABLE communications (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    community_id           UUID NOT NULL REFERENCES communities(id),
    communication_type     TEXT NOT NULL
                           CHECK (communication_type IN (
                               'announcement','violation_notice','assessment_notice',
                               'meeting_notice','arc_notification','collection_notice',
                               'general','emergency','election_notice'
                           )),
    subject                TEXT NOT NULL,
    body                   TEXT NOT NULL,
    body_html              TEXT,
    priority               TEXT NOT NULL DEFAULT 'standard'
                           CHECK (priority IN ('emergency','urgent','standard','low')),
    status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','scheduled','sending','sent','failed','cancelled')),
    audience_type          TEXT NOT NULL DEFAULT 'all_members'
                           CHECK (audience_type IN ('all_members','board','specific_members','role_based')),
    audience_filter        JSONB NOT NULL DEFAULT '{}',
    scheduled_at           TIMESTAMPTZ,
    sent_at                TIMESTAMPTZ,
    sent_by                UUID REFERENCES users(id),
    source_type            TEXT CHECK (source_type IN ('violation','arc_request','meeting','assessment','manual')),
    source_id              UUID,
    channels               TEXT[] NOT NULL DEFAULT '{email}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE communication_deliveries (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    communication_id       UUID NOT NULL REFERENCES communications(id),
    member_id              UUID NOT NULL REFERENCES members(id),
    channel                TEXT NOT NULL
                           CHECK (channel IN ('email','sms','push','in_app','physical_mail','certified_mail')),
    status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN (
                               'pending','queued','processing','sent','delivered',
                               'opened','clicked','bounced','failed','rejected','deferred'
                           )),
    provider_message_id    TEXT,
    provider_status        TEXT,
    queued_at              TIMESTAMPTZ,
    sent_at                TIMESTAMPTZ,
    delivered_at           TIMESTAMPTZ,
    opened_at              TIMESTAMPTZ,
    failed_at              TIMESTAMPTZ,
    failure_reason         TEXT,
    retry_count            SMALLINT NOT NULL DEFAULT 0,
    next_retry_at          TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_categories (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(id),
    name                   TEXT NOT NULL,
    parent_id              UUID REFERENCES document_categories(id),
    sort_order             INTEGER NOT NULL DEFAULT 0,
    is_system              BOOLEAN NOT NULL DEFAULT false,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              BIGINT,
    table_name             TEXT NOT NULL,
    record_id              UUID NOT NULL,
    operation              TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    old_values             JSONB,
    new_values             JSONB,
    changed_by             TEXT,
    changed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address             INET,
    user_agent             TEXT
);


-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

-- Standard tenant-scoped tables: strict tenant isolation
DO $$ 
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN VALUES 
        ('communities'), ('properties'), ('members'), ('property_ownerships'),
        ('board_terms'), ('committees'), ('committee_memberships'),
        ('assessment_schedules'), ('assessment_rate_history'), ('charges'),
        ('payments'), ('payment_applications'), ('autopay_enrollments'),
        ('violation_categories'), ('violations'), ('violation_transitions'),
        ('violation_evidence'),
        ('arc_modification_types'), ('arc_requests'), ('arc_transitions'), ('arc_votes'),
        ('meetings'), ('meeting_agenda_items'), ('meeting_attendees'),
        ('elections'), ('ballot_options'), ('vote_records'), ('voter_registry'),
        ('documents'), ('document_versions'), ('document_categories'),
        ('communications'), ('communication_deliveries')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I FOR ALL
             USING (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_id()) IS NOT NULL)
             WITH CHECK (tenant_id = (SELECT current_tenant_id()))',
            tbl
        );
    END LOOP;
END $$;

-- Shared reference tables: NULL tenant_id rows readable by all, non-NULL rows restricted
-- This covers compliance_profiles and violation_transition_rules which have
-- platform/state scope (NULL tenant_id) readable by any tenant, plus
-- community scope (populated tenant_id) restricted to that tenant
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN VALUES
        ('compliance_profiles'), ('violation_transition_rules')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
        EXECUTE format(
            'CREATE POLICY shared_reference ON %I FOR SELECT
             USING (tenant_id IS NULL OR tenant_id = (SELECT current_tenant_id()))',
            tbl
        );
        EXECUTE format(
            'CREATE POLICY tenant_write ON %I FOR INSERT
             WITH CHECK (tenant_id = (SELECT current_tenant_id()))',
            tbl
        );
        EXECUTE format(
            'CREATE POLICY tenant_modify ON %I FOR UPDATE
             USING (tenant_id = (SELECT current_tenant_id()))
             WITH CHECK (tenant_id = (SELECT current_tenant_id()))',
            tbl
        );
        EXECUTE format(
            'CREATE POLICY tenant_delete ON %I FOR DELETE
             USING (tenant_id = (SELECT current_tenant_id()))',
            tbl
        );
    END LOOP;
END $$;

-- Audit log: tenant_id can be NULL for platform-level events
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant_isolation ON audit_log FOR ALL
    USING (tenant_id IS NULL OR tenant_id = (SELECT current_tenant_id()));


-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_tenant_memberships_user ON tenant_memberships (user_id);
CREATE INDEX idx_tenant_memberships_tenant ON tenant_memberships (tenant_id, role);

CREATE INDEX idx_communities_tenant ON communities (tenant_id);
CREATE INDEX idx_compliance_profiles_scope ON compliance_profiles (scope, state_code);
CREATE INDEX idx_properties_tenant_community ON properties (tenant_id, community_id);
CREATE INDEX idx_properties_status ON properties (tenant_id, status) WHERE status != 'active';
CREATE INDEX idx_members_tenant ON members (tenant_id);
CREATE INDEX idx_members_email ON members (tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_members_user ON members (tenant_id, user_id) WHERE user_id IS NOT NULL;

CREATE INDEX idx_ownership_current ON property_ownerships (tenant_id, property_id)
    WHERE upper(valid_during) IS NULL;
CREATE INDEX idx_ownership_temporal ON property_ownerships
    USING gist (tenant_id, property_id, valid_during);
CREATE INDEX idx_ownership_member ON property_ownerships (tenant_id, member_id);
CREATE INDEX idx_board_current ON board_terms (tenant_id, community_id)
    WHERE upper(valid_during) IS NULL;

CREATE INDEX idx_charges_owner ON charges (tenant_id, member_id, status);
CREATE INDEX idx_charges_property ON charges (tenant_id, property_id, due_date);
CREATE INDEX idx_charges_unpaid ON charges (tenant_id, member_id, due_date)
    WHERE status IN ('pending','due','overdue');
CREATE INDEX idx_payments_member ON payments (tenant_id, member_id, payment_date);
CREATE INDEX idx_payments_stripe ON payments (stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_autopay_member ON autopay_enrollments (tenant_id, member_id);

CREATE INDEX idx_violations_property ON violations (tenant_id, property_id, status);
CREATE INDEX idx_violations_community ON violations (tenant_id, community_id, status);
CREATE INDEX idx_violations_status ON violations (tenant_id, status, cure_deadline);
CREATE INDEX idx_violations_search ON violations USING gin(search_vector);
CREATE INDEX idx_violation_transitions ON violation_transitions (tenant_id, violation_id, created_at);
CREATE INDEX idx_violation_evidence ON violation_evidence (tenant_id, violation_id);

CREATE INDEX idx_arc_requests_property ON arc_requests (tenant_id, property_id, status);
CREATE INDEX idx_arc_requests_community ON arc_requests (tenant_id, community_id, status);
CREATE INDEX idx_arc_precedents ON arc_requests USING gin(precedent_tags);

CREATE INDEX idx_meetings_community ON meetings (tenant_id, community_id, scheduled_at);
CREATE INDEX idx_elections_community ON elections (tenant_id, community_id, status);
CREATE INDEX idx_documents_community ON documents (tenant_id, community_id, category);
CREATE INDEX idx_documents_search ON documents USING gin(search_vector);

CREATE INDEX idx_communications_community ON communications (tenant_id, community_id, sent_at);
CREATE INDEX idx_deliveries_status ON communication_deliveries (tenant_id, status, next_retry_at)
    WHERE status IN ('pending','queued','deferred');

CREATE INDEX idx_audit_record ON audit_log (table_name, record_id, changed_at);
CREATE INDEX idx_audit_tenant ON audit_log (tenant_id, changed_at);


-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN VALUES
        ('tenants'), ('users'), ('communities'), ('properties'), ('members'),
        ('assessment_schedules'), ('charges'), ('payments'), ('autopay_enrollments'),
        ('violation_categories'), ('violations'), ('arc_requests'),
        ('meetings'), ('meeting_agenda_items'), ('elections'),
        ('documents'), ('communications'), ('communication_deliveries'),
        ('committees')
    LOOP
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
            tbl
        );
    END LOOP;
END $$;


-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_admin;

GRANT ALL ON ALL TABLES IN SCHEMA public TO migration_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO migration_admin;
