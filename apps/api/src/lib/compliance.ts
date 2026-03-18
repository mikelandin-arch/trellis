import { eq, and, isNull } from 'drizzle-orm';
import { complianceProfiles, violationTransitionRules } from '@repo/db';
import { VALID_TRANSITIONS } from '@repo/shared';
import type { ViolationStatus } from '@repo/shared';
import type { DbClient } from '@repo/db';

// ── Types ──────────────────────────────────────────────────────────────

export interface TransitionRequirements {
  allowed: true;
  requiresHearing: boolean;
  minNoticeDays: number | null;
  requiresCertifiedMail: boolean;
}

export interface TransitionDenied {
  allowed: false;
  reason: string;
}

export type TransitionResult = TransitionRequirements | TransitionDenied;

export interface FineCapResult {
  valid: boolean;
  cap: number | null;
  message?: string;
}

const DEFAULT_CURE_PERIOD_DAYS = 30;

// ── Helpers ────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

async function getStateProfile(
  db: DbClient,
  stateCode: string,
): Promise<typeof complianceProfiles.$inferSelect | null> {
  const rows = await db
    .select()
    .from(complianceProfiles)
    .where(
      and(
        eq(complianceProfiles.scope, 'state'),
        eq(complianceProfiles.stateCode, stateCode),
        isNull(complianceProfiles.tenantId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// ── Public API ─────────────────────────────────────────────────────────

export async function getCureDeadline(
  db: DbClient,
  violationDate: string,
  stateCode: string,
): Promise<string> {
  const profile = await getStateProfile(db, stateCode);
  const cureDays = profile?.curePeriodDays ?? DEFAULT_CURE_PERIOD_DAYS;
  return addDays(violationDate, cureDays);
}

export async function validateTransition(
  db: DbClient,
  fromState: ViolationStatus,
  toState: ViolationStatus,
  stateCode: string,
): Promise<TransitionResult> {
  const validNextStates = VALID_TRANSITIONS[fromState];
  if (!validNextStates?.includes(toState)) {
    return {
      allowed: false,
      reason: `Transition from '${fromState}' to '${toState}' is not permitted`,
    };
  }

  const profile = await getStateProfile(db, stateCode);
  if (!profile) {
    return {
      allowed: true,
      requiresHearing: false,
      minNoticeDays: null,
      requiresCertifiedMail: false,
    };
  }

  const ruleRows = await db
    .select()
    .from(violationTransitionRules)
    .where(
      and(
        eq(violationTransitionRules.profileId, profile.id),
        eq(violationTransitionRules.fromState, fromState),
        eq(violationTransitionRules.toState, toState),
      ),
    )
    .limit(1);

  const rule = ruleRows[0];
  return {
    allowed: true,
    requiresHearing: rule?.requiresHearing ?? false,
    minNoticeDays: rule?.minNoticeDays ?? null,
    requiresCertifiedMail: rule?.requiresCertifiedMail ?? false,
  };
}

export async function getRequiredNoticeMethod(
  db: DbClient,
  stateCode: string,
  noticeType: 'courtesy' | 'formal' | 'hearing' | 'fine' | 'lien',
): Promise<string[]> {
  const profile = await getStateProfile(db, stateCode);
  if (!profile) {
    return ['email'];
  }

  const rules = profile.rules as Record<string, unknown>;
  const noticeRules = rules?.['noticeDelivery'] as Record<string, string[]> | undefined;

  if (noticeRules?.[noticeType]) {
    return noticeRules[noticeType];
  }

  if (profile.certifiedMailRequired && (noticeType === 'formal' || noticeType === 'hearing')) {
    return ['email', 'certified_mail'];
  }

  if (noticeType === 'courtesy') {
    return ['email', 'first_class_mail'];
  }

  return ['email'];
}

export async function checkFineCap(
  db: DbClient,
  amount: number,
  stateCode: string,
): Promise<FineCapResult> {
  const profile = await getStateProfile(db, stateCode);

  if (!profile) {
    return { valid: true, cap: null };
  }

  const capStr = profile.fineCapPerViolation;
  if (capStr == null) {
    return { valid: true, cap: null };
  }

  const cap = Number(capStr);
  if (amount > cap) {
    return {
      valid: false,
      cap,
      message: `Fine amount $${amount.toFixed(2)} exceeds the per-violation cap of $${cap.toFixed(2)} for ${stateCode}`,
    };
  }

  return { valid: true, cap };
}
