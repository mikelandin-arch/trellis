# Talasera HOA: Complete Notification Infrastructure Design

**The Talasera platform's existing vendor selections — Expo Push Service, AWS SES, Twilio, and Lob — form an optimal notification stack that will cost under $10/month at 55 units and scale cleanly to 5,000+ units for under $150/month in delivery costs alone.** This design validates and extends those choices with a complete queuing pipeline, preference management system, compliance engine, and emergency priority architecture. The infrastructure centers on an SQS-based fan-out pipeline with Lambda workers per channel, DynamoDB for idempotency, and PostgreSQL for preference storage and delivery tracking — all integrated through a notification orchestrator that enforces legal delivery requirements before any message leaves the system.

The critical architectural insight for HOA communications is that **legal compliance must drive channel selection, not user preferences alone**. Arizona's ARS §33-1807 requires certified mail for assessment lien demands. California's Civil Code §5660 mandates the same. No amount of user preference for "email only" can override these statutory requirements, which means the orchestration layer must include a legal override engine that sits above the preference system.

---

## 1. Architecture: from trigger to delivery confirmation

The complete notification pipeline flows through seven stages, each with explicit error handling and observability. Every notification originates from a tRPC endpoint or scheduled Lambda, passes through orchestration that resolves preferences and legal requirements, fans out to per-channel queues, and feeds delivery status back through provider webhooks.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NOTIFICATION TRIGGERS                            │
│  tRPC Endpoints │ Scheduled Lambda (cron) │ Event-Driven (DB triggers)  │
│  ─ Violation created    ─ Assessment due    ─ Payment received          │
│  ─ Board action         ─ Meeting reminder  ─ Emergency manual          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     NOTIFICATION ORCHESTRATOR (Lambda)                    │
│                                                                          │
│  1. Intent Resolution ─── Map event → notification_type(s)              │
│  2. Recipient Resolution ─ Fetch recipients (unit owners, board, etc.)  │
│  3. Legal Override Check ─ Query legal_override_channels table          │
│     └─ AZ lien notice? → MUST include certified_mail channel           │
│  4. Preference Check ──── Query user_notification_preferences           │
│     └─ Merge: legal_required ∪ (user_preferred ∩ available_channels)   │
│  5. E-Consent Validation ─ Verify active e-consent for electronic       │
│  6. Quiet Hours Check ──── Skip for emergency priority; defer others    │
│  7. Idempotency Check ──── DynamoDB conditional write                   │
│  8. Template Resolution ── Select versioned template per channel/state  │
│  9. Fan-out ──────────────  Publish to per-channel SQS queues          │
│                                                                          │
└───────┬──────────┬───────────┬──────────┬───────────┬───────────────────┘
        │          │           │          │           │
        ▼          ▼           ▼          ▼           ▼
   ┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
   │ SQS     │ │ SQS    │ │ SQS    │ │ SQS    │ │ SQS      │
   │ email   │ │ sms    │ │ push   │ │ in_app │ │ mail     │
   │ _queue  │ │ _queue │ │ _queue │ │ _queue │ │ _queue   │
   └────┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘
        │          │          │          │            │
        ▼          ▼          ▼          ▼            ▼
   ┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
   │ Lambda  │ │ Lambda │ │ Lambda │ │ Lambda │ │ Lambda   │
   │ email   │ │ sms    │ │ push   │ │ in_app │ │ mail     │
   │ worker  │ │ worker │ │ worker │ │ worker │ │ worker   │
   └────┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘
        │          │          │          │            │
        ▼          ▼          ▼          ▼            ▼
   ┌─────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────┐
   │ AWS SES │ │ Twilio │ │ Expo     │ │Postgres│ │ Lob  │
   │         │ │        │ │ Push/FCM │ │ + SSE  │ │      │
   └────┬────┘ └───┬────┘ └────┬─────┘ └───┬────┘ └──┬───┘
        │          │           │           │          │
        ▼          ▼           ▼           ▼          ▼
   ┌──────────────────────────────────────────────────────────┐
   │              WEBHOOK INGESTION (API Gateway + Lambda)     │
   │  SES → SNS → Lambda    Twilio → HTTPS → Lambda          │
   │  Expo Push Receipts ← Polling Lambda (every 15 min)      │
   │  Lob → HTTPS → Lambda                                    │
   └──────────────────────────┬───────────────────────────────┘
                              │
                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │              DELIVERY STATUS PIPELINE                     │
   │  SQS (status_updates) → Lambda → PostgreSQL              │
   │  ┌─ notification_deliveries table (per-channel status)   │
   │  ├─ notification_events table (full event log)           │
   │  └─ notification_analytics (materialized views)          │
   └──────────────────────────────────────────────────────────┘

  PRIORITY LANES (Emergency Override):
  ┌──────────────────────────────────────────────────────────┐
  │  SQS emergency_email  ──→ Lambda (reserved concurrency)  │
  │  SQS emergency_sms    ──→ Lambda (reserved concurrency)  │
  │  SQS emergency_push   ──→ Lambda (reserved concurrency)  │
  │  SQS emergency_voice  ──→ Lambda → Twilio Voice API      │
  │                                                           │
  │  Escalation Lambda (EventBridge Scheduler):               │
  │  If delivery not confirmed in 5 min → escalate channel    │
  └──────────────────────────────────────────────────────────┘

  SUPPORTING INFRASTRUCTURE:
  ┌──────────────────────────────────────────────────────────┐
  │  DynamoDB: notification_idempotency (TTL: 48hr)          │
  │  DynamoDB: circuit_breaker_state (TTL: 5min)             │
  │  CloudWatch: Alarms on all DLQs, provider error rates    │
  │  EventBridge: Scheduled sends, escalation timers          │
  │  S3: Email template assets, MMS media, mail PDFs          │
  └──────────────────────────────────────────────────────────┘
```

Each SQS queue has a corresponding dead letter queue (DLQ) with `maxReceiveCount: 3` for routine notifications and `maxReceiveCount: 7` for emergency notifications. All DLQs have CloudWatch alarms triggering at `ApproximateNumberOfMessagesVisible >= 5`. Lambda workers use ARM/Graviton2 for **20% cost savings**, and all event source mappings enable `ReportBatchItemFailures` to prevent duplicate sends from partial batch failures.

---

## 2. Vendor comparison validates existing stack choices

### Push notifications: Expo Push Service is the right call

| Criterion | Expo Push Service | OneSignal | Direct FCM/APNs |
|---|---|---|---|
| **Cost at any scale** | **$0** | $0 (Free) / $79/mo (5K MAU Growth) | $0 + server costs |
| **Setup time** | 30 minutes | 45–60 minutes | 2–4 hours |
| **Expo SDK 53 compatibility** | First-class | Plugin required | Native tokens available |
| **Token management** | Automatic via `ExpoPushToken` | SDK-managed Player ID | Manual implementation |
| **Rich notifications** | Requires config plugin for iOS | Built-in | Full native control |
| **Analytics** | Basic (tickets + receipts) | Rich (delivery, opens, A/B) | DIY |
| **Segmentation** | Server-side DIY | Built-in (6 free segments) | DIY |
| **Deep linking** | Expo Router integration | Built-in URL handling | Custom implementation |
| **Vendor lock-in** | Low (can read native tokens) | Moderate (replaces expo-notifications) | None |
| **FCM v1 ready** | Yes (automatic) | Yes | Must implement OAuth2 |
| **Notification grouping** | Android channels + iOS threadId | Built-in | Full native |
| **Payload limit** | 4 KB (FCM/APNs limit) | 4 KB | 4 KB |

**Recommendation: Stay with Expo Push Service.** At $0 cost with 600 notifications/second throughput, it handles the HOA platform's needs through 5,000+ units without friction. The critical best practice: **store native device tokens alongside ExpoPushTokens from day one** using `getDevicePushTokenAsync()`. This preserves the option to migrate to OneSignal or direct FCM later without requiring app updates. OneSignal's Growth plan ($79/mo at 5K MAU) adds analytics and segmentation, but at HOA scale, server-side segmentation (by lot, street, community) is more natural than OneSignal's tag-based approach.

FCM v1 is now mandatory — the legacy API shut down July 2024. Expo handles this transparently. Expo Go dropped push notification support in SDK 53, so all testing requires development builds via EAS.

### Email delivery: SES wins on cost, requires infrastructure investment

| Criterion | AWS SES | SendGrid | Postmark |
|---|---|---|---|
| **Cost at 500 emails/mo** | **$0.05** | $19.95 (Essentials) | $15.00 (Basic minimum) |
| **Cost at 10K emails/mo** | **$1.00** | $19.95 | $16.50 |
| **Cost at 50K emails/mo** | **$5.00** | $19.95–$34.95 | ~$50–$70 |
| **Cost at 200K emails/mo** | **$20.00** | ~$90–$190 | ~$160–$264 |
| **Deliverability** | Good (self-managed) | Inconsistent (shared IP issues 2025) | **Best-in-class (93–98%+)** |
| **Sandbox friction** | High (72hr review, may be denied) | None (pay to unlock) | None (pay to unlock) |
| **Template engine** | Basic substitution | **Handlebars (full)** | Mustachio (Mustache) |
| **Webhook delivery events** | Via SNS intermediary | Direct HTTP POST | Direct HTTP POST |
| **TypeScript SDK** | `@aws-sdk/client-sesv2` | `@sendgrid/mail` | `postmark` npm |
| **SPF/DKIM/DMARC** | Manual DNS + required for production | Guided DNS setup | Guided + DMARC monitoring ($14/mo) |
| **Transactional/marketing split** | Manual (configuration sets) | Separate products/billing | Built-in Message Streams |
| **Dedicated IP** | $24.95/mo per IP | $30/mo (1 free with Pro) | $50/mo (300K+ only) |
| **Warm-up required** | Yes (dedicated IPs) | Yes (dedicated IPs) | Yes (dedicated IPs) |

**Recommendation: Stay with AWS SES.** The cost advantage is overwhelming — **$20/month at 200K emails vs. $160–$264 for Postmark**. Since the platform is already AWS-native, SES integrates seamlessly with Lambda, SNS for events, and CloudWatch for monitoring. The sandbox exit process requires SPF/DKIM/DMARC configuration and a use case justification (72-hour review). Initial production quota is 50,000 emails/day at 14/second, which far exceeds needs.

**Mitigation for SES's weaker template system**: handle template rendering in the Lambda worker before sending via SES, using Handlebars on the server side. This provides full Handlebars power (conditionals, loops, partials) regardless of which email provider is downstream.

SES bounce rate must stay under **5%** and complaint rate under **0.1%** to avoid account suspension. Implement automatic suppression list management from day one.

### SMS/MMS: Twilio is the only serious option for HOA

| Criterion | Twilio | AWS SNS | Bird (MessageBird) |
|---|---|---|---|
| **Outbound SMS cost** | $0.0079–$0.0083/segment | ~$0.00645 + carrier fees | ~$0.008 (opaque) |
| **Outbound MMS** | $0.0200/msg | $0.03/msg (base + carrier) | Not publicly listed |
| **Inbound MMS** | **$0.0100/msg** | **Not supported** | Contact sales |
| **Two-way SMS** | Excellent (webhooks) | Via SNS topic | Supported |
| **Programmable Voice** | **$0.014/min out, $0.0085/min in** | Requires Amazon Connect | Voice API available |
| **10DLC registration time** | **1–3 weeks** | 6–10 weeks | 2–4 weeks |
| **ISV multi-tenant support** | **API-based brand/campaign reg** | Manual console work | Limited |
| **Opt-out management** | Built-in (STOP/START) | Self-managed | Basic |
| **Scheduled sending** | Native (Messaging Service) | DIY with Lambda | Via Flow Builder |
| **Node.js SDK quality** | Gold standard | AWS SDK style | Legacy package |
| **Quiet hours enforcement** | Built-in | Self-managed | Limited |

**Recommendation: Stay with Twilio, emphatically.** Three capabilities make Twilio non-negotiable for HOA:

1. **Inbound MMS** — residents can reply to violation notices with photos. AWS SNS cannot receive MMS at all.
2. **Programmable Voice** — emergency alerts via voice call ($0.014/min) for water main breaks, security threats. AWS would require standing up Amazon Connect, a contact center product far beyond this need.
3. **ISV 10DLC registration** — as a SaaS platform onboarding multiple HOAs, Twilio's API-based brand and campaign registration is essential. AWS takes 6–10 weeks per campaign review.

**10DLC is mandatory since February 2025.** Unregistered A2P messages are blocked by US carriers. Registration costs: ~$46 brand registration (one-time, includes secondary vetting) + $15 campaign vetting (one-time) + $1.50–$10/month campaign fee. Start with Low Volume Mixed campaign type (sufficient for <6,000 messages/day). Standard registration with vetting unlocks 4.5–75+ messages/second as the platform scales.

Use a **Twilio Messaging Service** rather than individual numbers — it provides geo-matching (sender matched to recipient area code), sticky sender (consistent number per recipient), queue management, and scheduled sends.

### Physical mail: Lob for programmatic certified mail

| Product | Lob (Startup) | Lob (Growth) |
|---|---|---|
| B&W letter, 1st class | $0.859 | $0.829 |
| Color letter, 1st class | $0.899 | $0.859 |
| **Certified mail** | **$6.70** | **$6.70** |
| Certified + electronic return receipt | **$9.52** | **$9.52** |
| Address verification | $450/mo (50K verifications) | Included |
| Platform fee | $260/mo | $550/mo |

Certified mail at **$6.70–$9.52 per piece** is non-negotiable for assessment lien demands (AZ ARS §33-1807, CA Civil Code §5660) and violation notices in Texas. Lob's API-first approach with delivery tracking webhooks, CASS-certified address verification, and SOC 2 compliance makes it the right choice. At the Developer tier (free, 500 pieces/month limit), the 55-unit HOA won't need the Startup plan until sending volume exceeds 500 pieces monthly.

---

## 3. Notification preference data model in PostgreSQL

This schema supports per-user, per-type, per-channel preferences with legal overrides, quiet hours, and e-consent tracking. All tables use Row Level Security (RLS) scoped to Clerk's organization-based multi-tenancy.

```sql
-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE notification_channel AS ENUM (
  'email', 'sms', 'push', 'in_app', 'voice', 'physical_mail', 'certified_mail'
);

CREATE TYPE notification_priority AS ENUM (
  'emergency',    -- Bypasses all preferences and quiet hours
  'urgent',       -- Bypasses quiet hours, respects channel preferences
  'standard',     -- Respects all preferences
  'low'           -- Deferrable, batched/digested
);

CREATE TYPE notification_category AS ENUM (
  'assessment',        -- Dues, payments, liens
  'violation',         -- CC&R violations
  'meeting',           -- Board and member meetings
  'maintenance',       -- Scheduled maintenance, repairs
  'community',         -- Newsletters, social events
  'emergency',         -- Safety, weather, infrastructure
  'governance',        -- Elections, rule changes, votes
  'account'            -- Password resets, login alerts
);

CREATE TYPE delivery_status AS ENUM (
  'pending',           -- Created, not yet queued
  'queued',            -- In SQS queue
  'processing',        -- Lambda picked up
  'sent',              -- Handed to provider
  'delivered',         -- Provider confirmed delivery
  'opened',            -- Recipient opened (email/push)
  'clicked',           -- Recipient clicked link
  'bounced',           -- Hard or soft bounce
  'failed',            -- Permanent failure
  'rejected',          -- Blocked by preference/legal check
  'deferred'           -- Delayed (quiet hours, rate limit)
);

CREATE TYPE consent_status AS ENUM (
  'active', 'revoked', 'expired', 'pending'
);

CREATE TYPE preference_mode AS ENUM (
  'essential_only',    -- Legal-required + emergency only
  'standard',          -- All except low-priority community
  'everything',        -- Every notification
  'custom'             -- Per-type granular control
);

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Defines all notification types in the system
CREATE TABLE notification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,                -- Clerk organization ID
  slug TEXT NOT NULL,                  -- e.g., 'assessment_reminder'
  name TEXT NOT NULL,                  -- 'Assessment Reminder'
  description TEXT,
  category notification_category NOT NULL,
  default_priority notification_priority NOT NULL DEFAULT 'standard',
  default_channels notification_channel[] NOT NULL DEFAULT '{email,push,in_app}',
  user_can_disable BOOLEAN NOT NULL DEFAULT true,
  -- Some types cannot be disabled (emergency, legal-required)
  supports_batching BOOLEAN NOT NULL DEFAULT false,
  batch_window_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

-- Per-user notification preferences
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,               -- Clerk user ID
  notification_type_id UUID REFERENCES notification_types(id),
  -- NULL notification_type_id = global default for this user
  mode preference_mode NOT NULL DEFAULT 'standard',
  -- Per-channel overrides (only used when mode = 'custom')
  channel_email BOOLEAN DEFAULT true,
  channel_sms BOOLEAN DEFAULT true,
  channel_push BOOLEAN DEFAULT true,
  channel_in_app BOOLEAN DEFAULT true,
  channel_voice BOOLEAN DEFAULT false,
  channel_physical_mail BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id, notification_type_id)
);

-- Channel-level configuration per organization
CREATE TABLE channel_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  channel notification_channel NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  provider_config JSONB NOT NULL DEFAULT '{}',
  -- e.g., {"ses_config_set": "talasera", "from_email": "notices@talasera.org"}
  -- e.g., {"twilio_messaging_service_sid": "MG...", "from_number": "+1480..."}
  rate_limit_per_second INTEGER,
  rate_limit_per_day INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, channel)
);

-- Quiet hours per user
CREATE TABLE quiet_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Phoenix',
  -- Arizona doesn't observe DST, but other states do
  start_time TIME NOT NULL DEFAULT '21:00',
  end_time TIME NOT NULL DEFAULT '08:00',
  days_of_week INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
  -- 0=Sunday, 6=Saturday
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Emergency and urgent notifications bypass quiet hours
  bypass_for_priority notification_priority[] DEFAULT '{emergency}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

-- Legal requirements that override user preferences
CREATE TABLE legal_override_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code CHAR(2) NOT NULL,         -- 'AZ', 'CA', 'FL', 'TX', 'CO'
  notification_type_id UUID REFERENCES notification_types(id),
  -- Can also match by category for broader rules:
  notification_category notification_category,
  required_channels notification_channel[] NOT NULL,
  -- e.g., '{certified_mail}' for AZ lien notices
  statute_reference TEXT,
  -- e.g., 'ARS §33-1807(L)'
  description TEXT,
  min_advance_days INTEGER,
  -- e.g., 10 days for AZ member meeting notices
  max_advance_days INTEGER,
  -- e.g., 50 days for AZ member meeting notices
  required_legal_text TEXT,
  -- Statutory disclaimer text that MUST appear in notice
  legal_text_formatting TEXT,
  -- 'ALL_CAPS', 'BOLDFACE', '14PT_BOLD'
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,                    -- NULL = currently in effect
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (notification_type_id IS NOT NULL OR notification_category IS NOT NULL)
);

-- E-consent tracking per homeowner per channel
CREATE TABLE e_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel notification_channel NOT NULL,
  consent_status consent_status NOT NULL DEFAULT 'pending',
  -- E-SIGN Act required fields:
  consent_method TEXT NOT NULL,
  -- 'web_form', 'paper_scan', 'email_confirmation', 'in_app'
  consent_text TEXT NOT NULL,
  -- Exact text the user agreed to
  ip_address INET,
  user_agent TEXT,
  email_address TEXT,
  phone_number TEXT,
  hardware_software_requirements TEXT,
  -- E-SIGN requires disclosure of access requirements
  paper_delivery_instructions TEXT,
  -- How to request paper copies
  consented_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_method TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATION DELIVERY TRACKING
-- ============================================================

-- Master notification record
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  notification_type_id UUID REFERENCES notification_types(id),
  priority notification_priority NOT NULL,
  idempotency_key TEXT NOT NULL,
  -- Batch tracking
  batch_id UUID,                       -- Groups community-wide sends
  -- Content
  subject TEXT,
  body_plain TEXT,
  body_data JSONB NOT NULL DEFAULT '{}',
  -- Template variables: {owner_name, property_address, amount, etc.}
  template_id UUID,
  template_version INTEGER,
  -- Targeting
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  created_by TEXT,                      -- User or system that triggered
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, idempotency_key)
);

-- Per-recipient, per-channel delivery record
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  notification_id UUID NOT NULL REFERENCES notifications(id),
  user_id TEXT NOT NULL,
  channel notification_channel NOT NULL,
  status delivery_status NOT NULL DEFAULT 'pending',
  -- Provider tracking
  provider_message_id TEXT,
  -- SES MessageId, Twilio SID, Expo push ticket ID, Lob letter ID
  provider_status TEXT,
  -- Raw provider status string
  -- Delivery metadata
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  bounce_type TEXT,                     -- 'hard', 'soft', 'complaint'
  -- Retry tracking
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  -- Legal compliance
  is_legal_required BOOLEAN NOT NULL DEFAULT false,
  legal_override_id UUID REFERENCES legal_override_channels(id),
  proof_of_delivery JSONB,
  -- {tracking_number, certified_mail_receipt, delivery_confirmation}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Granular event log for audit trail
CREATE TABLE notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  delivery_id UUID NOT NULL REFERENCES notification_deliveries(id),
  event_type TEXT NOT NULL,
  -- 'queued', 'sent', 'delivered', 'opened', 'bounced', etc.
  event_data JSONB DEFAULT '{}',
  -- Provider webhook payload, error details
  provider_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TEMPLATE MANAGEMENT
-- ============================================================

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT,                          -- NULL = system-wide default
  notification_type_slug TEXT NOT NULL,
  channel notification_channel NOT NULL,
  state_code CHAR(2),                   -- NULL = all states
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Template content
  subject_template TEXT,                -- Handlebars: "Assessment Due: {{amount}}"
  body_template TEXT NOT NULL,          -- Handlebars template
  -- For email: full HTML; for SMS: plain text; for push: short text
  legal_text_blocks JSONB DEFAULT '[]',
  -- [{id, text, formatting, statute_ref, effective_date}]
  -- Metadata
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, notification_type_slug, channel, state_code, version)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_notif_prefs_user ON user_notification_preferences(org_id, user_id);
CREATE INDEX idx_notif_prefs_type ON user_notification_preferences(notification_type_id);
CREATE INDEX idx_quiet_hours_user ON quiet_hours(org_id, user_id);
CREATE INDEX idx_legal_overrides_state ON legal_override_channels(state_code);
CREATE INDEX idx_legal_overrides_category ON legal_override_channels(notification_category);
CREATE INDEX idx_econsent_user ON e_consent_records(org_id, user_id, channel);
CREATE INDEX idx_econsent_status ON e_consent_records(consent_status)
  WHERE consent_status = 'active';
CREATE INDEX idx_notifications_batch ON notifications(batch_id)
  WHERE batch_id IS NOT NULL;
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for)
  WHERE scheduled_for IS NOT NULL AND scheduled_for > NOW();
CREATE INDEX idx_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX idx_deliveries_user ON notification_deliveries(org_id, user_id);
CREATE INDEX idx_deliveries_status ON notification_deliveries(status)
  WHERE status IN ('pending', 'queued', 'processing', 'sent');
CREATE INDEX idx_deliveries_retry ON notification_deliveries(next_retry_at)
  WHERE status = 'failed' AND attempt_count < max_attempts;
CREATE INDEX idx_events_delivery ON notification_events(delivery_id);
CREATE INDEX idx_events_created ON notification_events(created_at);
CREATE INDEX idx_templates_lookup
  ON notification_templates(notification_type_slug, channel, state_code)
  WHERE is_active = true;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- All tables scoped to org_id via Clerk JWT claim
ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiet_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (applied to all tables with org_id)
-- The app_user role extracts org_id from Clerk JWT via current_setting
CREATE POLICY org_isolation ON notification_types
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- Users can only read/write their own preferences
CREATE POLICY user_own_prefs ON user_notification_preferences
  USING (
    org_id = current_setting('app.current_org_id', true)
    AND (
      user_id = current_setting('app.current_user_id', true)
      OR current_setting('app.current_role', true) = 'admin'
    )
  );

-- Legal overrides are global (no org_id) — readable by all, writable by system only
-- No RLS on legal_override_channels — it uses state_code, not org_id
```

The schema separates **what notifications exist** (notification_types), **what users want** (user_notification_preferences), **what the law requires** (legal_override_channels), and **what was actually sent** (notification_deliveries + notification_events). The legal override table is intentionally organization-agnostic — a lien notice in Arizona requires certified mail regardless of which HOA sends it.

---

## 4. Delivery pipeline: step-by-step from trigger to confirmation

### Step 1 — Trigger and intent resolution

A tRPC mutation or scheduled Lambda emits a notification intent:

```typescript
// Example: violation notice created
notificationService.send({
  type: 'violation_notice',
  orgId: 'org_abc',
  recipients: [{ userId: 'user_123', unitId: 'unit_45' }],
  data: {
    owner_name: 'John Smith',
    property_address: '1234 Talasera Way',
    violation_type: 'Unapproved Exterior Modification',
    violation_date: '2026-03-01',
    cure_deadline: '2026-03-31',
    photo_urls: ['https://s3.../violation-photo-1.jpg']
  },
  priority: 'standard'
});
```

The orchestrator Lambda resolves the notification type from `notification_types`, loading default channels, priority, and category. **Error handling**: if the notification type doesn't exist, log and reject with a descriptive error. If recipients list is empty, skip silently.

### Step 2 — Legal override check

Query `legal_override_channels` for the HOA's state and this notification type/category:

```sql
SELECT required_channels, required_legal_text, legal_text_formatting,
       min_advance_days, statute_reference
FROM legal_override_channels
WHERE (state_code = 'AZ')
  AND (notification_type_id = $1 OR notification_category = 'violation')
  AND effective_date <= CURRENT_DATE
  AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE);
```

If Arizona violation notice: no special channel override (CC&Rs govern method). If Arizona assessment lien demand: **certified_mail is required** — add to channel set regardless of user preferences. The legal override result merges with channel selection as `required_channels ∪ preferred_channels`.

### Step 3 — Preference resolution and e-consent check

For each recipient, load preferences and validate consent:

```
channels = legal_required_channels                        -- Always included
if user.mode == 'essential_only':
    channels += [in_app]                                  -- Minimum digital
elif user.mode == 'standard':
    channels += notification_type.default_channels        -- System defaults
elif user.mode == 'everything':
    channels += all_enabled_channels
elif user.mode == 'custom':
    channels += user_selected_channels_for_this_type

-- Validate e-consent for electronic channels
for channel in [email, sms]:
    if not has_active_econsent(user, channel):
        remove channel; add physical_mail as fallback

-- in_app and push don't require e-consent (app installation = implicit consent)
```

**Error handling**: if a user has no preferences record, fall back to organization defaults. If e-consent is revoked for all electronic channels, route to physical mail only.

### Step 4 — Quiet hours check

```
if notification.priority == 'emergency':
    skip quiet hours check — send immediately
elif notification.priority == 'urgent':
    skip quiet hours for push/in_app; defer SMS/email/voice
else:
    if current_time_in_user_timezone within quiet_hours:
        defer notification; schedule for quiet_hours.end_time
        set status = 'deferred' in notification_deliveries
```

TCPA mandates no automated calls/texts before **8:00 AM or after 9:00 PM** in the recipient's local time. Arizona doesn't observe DST (always MST/UTC-7), simplifying timezone handling for the primary market.

### Step 5 — Idempotency check

Write to DynamoDB with a conditional expression:

```typescript
const idempotencyKey = `${notificationType}:${userId}:${contentHash}:${hourBucket}`;
await dynamodb.putItem({
  TableName: 'notification_idempotency',
  Item: { idempotencyKey, status: 'inProgress', ttl: now + 48h },
  ConditionExpression: 'attribute_not_exists(idempotencyKey)'
});
// ConditionalCheckFailedException → duplicate, skip
```

### Step 6 — Template rendering

Load the active template for this notification type, channel, and state. Render with Handlebars on the server side:

```typescript
const template = await getActiveTemplate({
  slug: 'violation_notice',
  channel: 'email',
  stateCode: 'AZ',
});
const html = Handlebars.compile(template.body_template)(notificationData);
// Inject required legal text blocks if present
for (const block of template.legal_text_blocks) {
  html = injectLegalBlock(html, block);
}
```

**Handlebars** is the recommended template engine — it supports conditionals (`{{#if overdue}}`), loops (`{{#each violations}}`), and partials, which are essential for complex HOA notices that vary by state and violation type. Template rendering happens in the orchestrator Lambda before queueing, so channel-specific workers receive pre-rendered content.

### Step 7 — Queue dispatch

Publish one SQS message per recipient per channel:

```typescript
// For each (recipient, channel) pair:
await sqs.sendMessage({
  QueueUrl: channelQueues[channel],    // email_queue, sms_queue, etc.
  MessageBody: JSON.stringify({
    deliveryId,
    notificationId,
    userId,
    channel,
    renderedContent,                   // Pre-rendered HTML/text
    priority,
    metadata: { providerConfig, recipientAddress }
  }),
  MessageAttributes: {
    priority: { DataType: 'String', StringValue: priority }
  }
});
```

Emergency notifications route to dedicated `emergency_*` queues with Lambda event source mappings configured with **reserved concurrency** and no batching window (immediate processing).

### Step 8 — Channel worker sends

Each Lambda worker calls its provider API:

- **Email worker** → AWS SES `SendEmail` via `@aws-sdk/client-sesv2`
- **SMS worker** → Twilio `messages.create()` via `twilio` SDK
- **Push worker** → Expo Push API `POST /--/api/v2/push/send`
- **In-app worker** → INSERT into `notification_deliveries` + SSE broadcast
- **Mail worker** → Lob API `POST /v1/letters` (or `/v1/letters` with certified mail options)

Each worker updates `notification_deliveries.status` to `sent` and records `provider_message_id`. **Error handling**: on provider error, throw to let SQS retry (visibility timeout = 180s, max receives = 3). On permanent errors (invalid address, unsubscribed), mark as `failed` and delete from queue.

### Step 9 — Webhook processing and status updates

Provider webhooks flow through API Gateway → Lambda → SQS (status_updates) → Lambda → PostgreSQL:

- **SES**: SNS subscription on configuration set events → Lambda normalizes `Delivery`, `Bounce`, `Complaint`, `Open`, `Click` events
- **Twilio**: StatusCallback URL receives `MessageStatus` updates (queued → sending → sent → delivered/failed/undelivered)
- **Expo Push**: Polling Lambda runs every 15 minutes, fetches push receipts for recent ticket IDs, processes `DeviceNotRegistered` errors to prune tokens
- **Lob**: Webhooks for `letter.mailed`, `letter.in_transit`, `letter.delivered`, `letter.returned`

All webhook handlers verify signatures (SES via X.509 SNS verification, Twilio via `X-Twilio-Signature` HMAC-SHA1, Lob via webhook secret) before processing.

### Step 10 — Analytics materialization

A scheduled Lambda (hourly) refreshes materialized views:

```sql
CREATE MATERIALIZED VIEW notification_analytics AS
SELECT
  n.org_id,
  nt.category,
  nt.slug AS notification_type,
  nd.channel,
  DATE_TRUNC('day', nd.created_at) AS day,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE nd.status = 'delivered') AS delivered,
  COUNT(*) FILTER (WHERE nd.status = 'opened') AS opened,
  COUNT(*) FILTER (WHERE nd.status = 'clicked') AS clicked,
  COUNT(*) FILTER (WHERE nd.status IN ('bounced', 'failed')) AS failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE nd.status = 'delivered') / NULLIF(COUNT(*), 0), 1)
    AS delivery_rate_pct
FROM notification_deliveries nd
JOIN notifications n ON nd.notification_id = n.id
JOIN notification_types nt ON n.notification_type_id = nt.id
GROUP BY 1, 2, 3, 4, 5;
```

---

## 5. Cost projections across five scaling milestones

These projections assume realistic HOA communication volumes derived from typical community management patterns: monthly assessment reminders, bi-monthly violation notices, monthly board meeting announcements, quarterly community newsletters, and emergency alerts averaging one per quarter per community.

### Monthly notification volumes by scale

| Notification Type | 55 units (1 HOA) | 200 units (4 HOAs) | 500 units (10 HOAs) | 2,000 units (40 HOAs) | 5,000 units (100 HOAs) |
|---|---|---|---|---|---|
| Assessment reminders | 55 | 200 | 500 | 2,000 | 5,000 |
| Payment confirmations | 55 | 200 | 500 | 2,000 | 5,000 |
| Violation notices | 8 | 30 | 75 | 300 | 750 |
| Board meeting notices | 55 | 200 | 500 | 2,000 | 5,000 |
| Community updates | 55 | 200 | 500 | 2,000 | 5,000 |
| Emergency alerts | 14 | 50 | 125 | 500 | 1,250 |
| Account/system | 20 | 80 | 200 | 800 | 2,000 |
| **Total notifications** | **~262** | **~960** | **~2,400** | **~9,600** | **~24,000** |

Each notification fans out to **~2.5 channels on average** (push + email + in_app, with occasional SMS), producing:

| Metric | 55 units | 200 units | 500 units | 2,000 units | 5,000 units |
|---|---|---|---|---|---|
| **Push messages** | 250 | 900 | 2,300 | 9,200 | 23,000 |
| **Emails** | 250 | 900 | 2,300 | 9,200 | 23,000 |
| **SMS messages** | 80 | 300 | 750 | 3,000 | 7,500 |
| **MMS (violation photos)** | 8 | 30 | 75 | 300 | 750 |
| **In-app notifications** | 262 | 960 | 2,400 | 9,600 | 24,000 |
| **Physical mail pieces** | 10 | 40 | 100 | 400 | 1,000 |
| **Certified mail** | 2 | 8 | 20 | 80 | 200 |
| **Total channel sends** | **~862** | **~3,138** | **~7,945** | **~31,780** | **~79,450** |

### Monthly cost breakdown

| Cost Component | 55 units | 200 units | 500 units | 2,000 units | 5,000 units |
|---|---|---|---|---|---|
| **Push (Expo/FCM)** | $0 | $0 | $0 | $0 | $0 |
| **Email (SES @ $0.10/1K)** | $0.03 | $0.09 | $0.23 | $0.92 | $2.30 |
| **SMS (Twilio)** | | | | | |
| — Messages ($0.0079 + $0.003 carrier) | $0.87 | $3.26 | $8.15 | $32.58 | $81.45 |
| — MMS ($0.02 + $0.0075 carrier) | $0.22 | $0.83 | $2.06 | $8.25 | $20.63 |
| — Phone number | $1.15 | $2.30 | $5.75 | $23.00 | $57.50 |
| — 10DLC campaign fee | $1.50 | $6.00 | $15.00 | $60.00 | $150.00 |
| **Physical mail (Lob)** | | | | | |
| — Letters ($0.86 avg) | $8.60 | $34.40 | $86.00 | $344.00 | $860.00 |
| — Certified ($9.52 each) | $19.04 | $76.16 | $190.40 | $761.60 | $1,904.00 |
| — Platform fee | $0 | $0 | $260.00 | $260.00 | $550.00 |
| **Queue infra (SQS)** | $0 | $0 | $0 | $0 | $0.01 |
| **Lambda compute** | $0 | $0 | $0 | $0 | $0 |
| **DynamoDB (idempotency)** | $0.25 | $0.25 | $0.25 | $0.28 | $0.35 |
| **CloudWatch monitoring** | $5.00 | $5.00 | $5.00 | $7.00 | $10.00 |
| | | | | | |
| **TOTAL (all channels)** | **$36.66** | **$128.29** | **$572.84** | **$1,497.63** | **$3,636.24** |
| **TOTAL (digital only)** | **$8.77** | **$16.90** | **$36.19** | **$131.78** | **$321.61** |

**Physical mail dominates cost at every scale.** Certified mail at $9.52/piece for lien notices is the single largest line item. Digital-only notification costs remain remarkably low: **under $9/month at 55 units** and **$322/month at 5,000 units**. These digital costs align closely with the project's existing projections ($2/mo Twilio at 50 units, $0.01 SES, $0 FCM).

The Lob platform fee ($260–$550/month) kicks in at scale but is avoidable at the 55-unit tier using the free Developer plan (500 pieces/month limit). **Cost optimization opportunity**: at 5,000 units, negotiating Lob Enterprise pricing or switching to Click2Mail for routine letters while keeping Lob for certified mail could save $200–$400/month.

SQS and Lambda costs are effectively **$0 through 5,000 units** because SQS offers 1 million free requests/month (permanently) and Lambda provides 1 million free invocations/month. Even at 5,000 units, total queue messages (~80K × 4 API calls each = ~320K requests) stays well within free tier.

---

## 6. In-app notification center and real-time delivery

The in-app notification system stores notifications in PostgreSQL (the `notification_deliveries` table with `channel = 'in_app'`) and delivers them through Server-Sent Events for real-time updates. This aligns with the project's existing decision to use **push + SSE initially, deferring WebSockets until live chat**.

The notification center UI should implement a **grouped, chronological feed** with these interaction patterns:

- **Unread badge count** tracked per user via a `last_read_at` timestamp on a `user_notification_state` table, avoiding expensive COUNT queries
- **Notification grouping** by type and time window — "3 community updates" rather than three separate cards
- **Swipe actions**: swipe right to mark read, swipe left to archive; long-press for "mute this type"
- **Pagination** via cursor-based pagination on `notification_deliveries.created_at` (keyset pagination, not OFFSET) for consistent performance
- **Read tracking**: UPDATE `notification_deliveries SET opened_at = NOW()` when notification is viewed; batch-mark-as-read for "mark all read"

SSE connection from the Expo app maintains a persistent HTTP connection to the Fastify server. When the in-app worker Lambda writes a new notification, it publishes to a Redis pub/sub channel (or SNS topic → Fastify subscriber). The Fastify SSE handler pushes the event to the connected client. On reconnection, the client fetches missed notifications via the tRPC `notifications.list` query with a `since` cursor.

---

## 7. Emergency notification priority system

Emergency notifications activate a dedicated fast path that **bypasses quiet hours, preference overrides, and batching delays**, sending simultaneously across all available channels for each recipient.

**Emergency notification flow:**

1. **Trigger**: Board member or property manager activates emergency alert via admin UI (confirmed with "This will contact ALL residents immediately" dialog)
2. **Priority routing**: Orchestrator detects `priority = 'emergency'`, skips preference checks and quiet hours, selects ALL channels where user has a valid contact method
3. **Dedicated queues**: Messages route to `emergency_email`, `emergency_sms`, `emergency_push`, `emergency_voice` SQS queues, each with Lambda event source mappings configured with **reserved concurrency of 10** (guaranteeing capacity even during routine notification spikes) and **batch window of 0 seconds** (immediate processing)
4. **Multi-channel blast**: Push + SMS + email + voice fire simultaneously. Voice calls use Twilio's Programmable Voice with a TwiML `<Say>` message ($0.014/minute outbound)
5. **Escalation timer**: An EventBridge Scheduler rule fires 5 minutes after the emergency send. The escalation Lambda checks delivery confirmations — for any recipient without a confirmed delivery on at least one channel, it triggers a secondary attempt via voice call (the highest-confirmation channel)

**Emergency notification types and response patterns:**

- **Water main break / gas leak**: Voice + SMS + push + email. Include safety instructions and evacuation zones if applicable
- **Security alert**: SMS + push (fastest channels). Include "call 911 if in danger" language
- **Natural disaster (monsoon, wildfire)**: All channels. Link to IPAWS government alert feed for official guidance
- **Utility outage**: Push + email. Lower urgency but still bypasses quiet hours

**FCC compliance**: Emergency notifications to homeowners who have an existing relationship with the HOA are generally exempt from TCPA consent requirements when the communication concerns genuine safety emergencies. However, maintain SMS consent records regardless. The platform should consume (not originate) IPAWS alerts — private HOAs do not qualify as IPAWS alerting authorities, but can subscribe to the IPAWS All-Hazards Information Feed via CAP (Common Alerting Protocol) to supplement community alerts with official government warnings.

---

## 8. Template management with legal versioning

Templates live in PostgreSQL (`notification_templates` table) with Handlebars as the rendering engine, versioned by effective date and state jurisdiction. This is critical because **HOA legal language changes with legislation** — Arizona's ARS §33-1807(L) requires specific ALL CAPS disclaimer text in assessment lien demands, and California's Civil Code §5660 requires 14-point boldface warnings in pre-lien notices.

**Template resolution hierarchy**: When rendering a notification for a homeowner in Arizona, the system queries:
1. Organization-specific template for this type + channel + state → if exists, use it
2. System-wide template for this type + channel + state → if exists, use it
3. System-wide template for this type + channel + no state → fallback

**Variable substitution** uses Handlebars with a standard context object:

```typescript
interface NotificationContext {
  owner_name: string;
  property_address: string;
  unit_number: string;
  community_name: string;
  // Assessment-specific
  amount_due?: string;          // Formatted: "$450.00"
  due_date?: string;            // "April 1, 2026"
  late_fee?: string;
  payment_link?: string;
  // Violation-specific
  violation_type?: string;
  violation_date?: string;
  cure_deadline?: string;
  violation_description?: string;
  photo_urls?: string[];
  // Meeting-specific
  meeting_date?: string;
  meeting_time?: string;
  meeting_location?: string;
  agenda_url?: string;
  // Legal blocks injected by state
  legal_disclaimers?: LegalBlock[];
}
```

Each template stores `legal_text_blocks` as a JSONB array referencing the exact statutory language required. When a state updates its HOA statute (as Arizona did in 2024), the platform creates a new template version with the updated legal text and an `effective_date` matching the law's enforcement date. Previous versions remain queryable for audit purposes — proving what text was included in a notification sent on a specific date.

**Multi-channel template pattern**: A single notification type has separate templates per channel. The assessment reminder might render as a full HTML email with payment button, a 160-character SMS with payment link, a push notification title/body, and a formatted letter PDF for physical mail. All share the same variable context but optimize for their channel's constraints (SMS at 160 characters per segment, push at 4 KB payload, email with full HTML).

---

## Conclusion: a compliance-first, cost-efficient architecture

Three insights emerged from this design that should shape implementation priorities:

**Physical mail is the hidden cost center.** Digital notification infrastructure (SES + Twilio + FCM + SQS + Lambda) costs under $10/month at 55 units. But a single certified mail piece costs $9.52. At 5,000 units, certified mail alone could exceed $1,900/month. The most impactful cost optimization is maximizing e-consent adoption to reduce physical mail volume — every homeowner who consents to electronic delivery for non-lien notices saves $0.86–$9.52 per communication.

**Legal overrides are not edge cases.** Arizona requires certified mail for assessment lien demands. California requires certified mail for pre-lien notices. Texas requires three written notices over 120 days before filing a lien. Colorado requires correspondence in a homeowner's requested language. These requirements must be enforced at the orchestration layer, not left to individual channel workers. The `legal_override_channels` table and the orchestrator's merge logic (`required_channels ∪ preferred_channels`) are the architectural core that distinguishes an HOA notification system from a generic notification platform.

**The existing vendor stack is optimal.** Expo Push Service (free at any scale, perfect Expo integration), AWS SES ($0.10/1,000 emails, native AWS integration), Twilio (only provider with two-way MMS + voice + ISV 10DLC management), and Lob (only serious API for programmatic certified mail) each represent the best option for their channel. The total digital delivery cost of **$322/month at 5,000 units** is a fraction of the revenue a platform charging $10–$50/unit/month would generate. The architecture's real value lies not in cost savings but in compliance automation — ensuring every notification reaches its recipient through legally required channels with proper legal language, consent verification, and an immutable audit trail.