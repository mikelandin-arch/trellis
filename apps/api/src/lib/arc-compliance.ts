import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { arcRequests } from '@repo/db';
import type { DbClient } from '@repo/db';

// ── Types ──────────────────────────────────────────────────────────────

export interface ArcDeadlines {
  reviewDeadline: string;
  deemedApprovedDeadline: string;
}

export interface DeemedApprovedResult {
  isDeemedApproved: boolean;
  daysOverdue: number;
}

export interface ProtectedModificationResult {
  isProtected: boolean;
  law: string;
  restriction: string;
}

export interface ConsistencyScoreResult {
  score: number;
  totalPrior: number;
  matchingPrior: number;
  requiresAcknowledgment: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!;
}

function daysBetween(from: string, to: string): number {
  return Math.ceil(
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000,
  );
}

// ── WA protected modification types ────────────────────────────────────

interface ProtectedType {
  keywords: readonly string[];
  law: string;
  restriction: string;
}

const WA_PROTECTED_TYPES: readonly ProtectedType[] = [
  {
    keywords: ['solar', 'solar panel', 'solar energy'],
    law: 'RCW 64.38.055 / RCW 64.90.510',
    restriction: 'HOA cannot prohibit solar panels. May impose reasonable restrictions on placement that do not significantly increase cost or decrease efficiency.',
  },
  {
    keywords: ['satellite', 'satellite dish', 'antenna'],
    law: 'FCC OTARD Rule (47 CFR 1.4000)',
    restriction: 'Federal law prohibits restrictions on satellite dishes under 1 meter. HOA may set reasonable, non-binding placement preferences.',
  },
  {
    keywords: ['ev charger', 'ev charging', 'electric vehicle', 'charging station'],
    law: 'RCW 64.38.062 / RCW 64.90.513',
    restriction: 'HOA cannot unreasonably prohibit EV charging installations. 60-day deemed-approved deadline applies. May require licensed electrician and insurance.',
  },
  {
    keywords: ['flag', 'american flag', 'flag display', 'flagpole'],
    law: 'Freedom to Display the American Flag Act of 2005 (HR 42)',
    restriction: 'Federal law protects the right to display the US flag. HOA may impose reasonable time, place, and manner restrictions.',
  },
] as const;

const EV_CHARGER_KEYWORDS = ['ev charger', 'ev charging', 'electric vehicle', 'charging station'];

const EV_DEEMED_APPROVED_DAYS = 60;

const CONSISTENCY_THRESHOLD = 70;

// ── Public API ─────────────────────────────────────────────────────────

export function calculateDeadlines(
  submissionDate: string,
  modType: { defaultReviewDays: number; name: string },
  _stateCode: string,
): ArcDeadlines {
  const reviewDeadline = addDays(submissionDate, modType.defaultReviewDays);

  const nameLower = modType.name.toLowerCase();
  const isEvCharger = EV_CHARGER_KEYWORDS.some((kw) => nameLower.includes(kw));

  const deemedApprovedDays = isEvCharger
    ? EV_DEEMED_APPROVED_DAYS
    : modType.defaultReviewDays;

  const deemedApprovedDeadline = addDays(submissionDate, deemedApprovedDays);

  return { reviewDeadline, deemedApprovedDeadline };
}

export function checkDeemedApproved(request: {
  deemedApprovedDeadline: string | null;
  decisionDate: string | null;
}): DeemedApprovedResult {
  if (!request.deemedApprovedDeadline) {
    return { isDeemedApproved: false, daysOverdue: 0 };
  }

  if (request.decisionDate) {
    return { isDeemedApproved: false, daysOverdue: 0 };
  }

  const today = todayIso();
  const daysOverdue = daysBetween(request.deemedApprovedDeadline, today);

  return {
    isDeemedApproved: daysOverdue > 0,
    daysOverdue: Math.max(0, daysOverdue),
  };
}

export function isProtectedModification(
  modTypeName: string,
  _stateCode: string,
): ProtectedModificationResult {
  const nameLower = modTypeName.toLowerCase();

  for (const pt of WA_PROTECTED_TYPES) {
    if (pt.keywords.some((kw) => nameLower.includes(kw))) {
      return {
        isProtected: true,
        law: pt.law,
        restriction: pt.restriction,
      };
    }
  }

  return { isProtected: false, law: '', restriction: '' };
}

const DECISION_STATUSES = ['approved', 'approved_with_conditions', 'denied'] as const;

export async function getConsistencyScore(
  db: DbClient,
  modificationTypeId: string,
  proposedDecision: string,
): Promise<ConsistencyScoreResult> {
  const priorRequests = await db
    .select({ decisionType: arcRequests.decisionType })
    .from(arcRequests)
    .where(
      and(
        eq(arcRequests.modificationTypeId, modificationTypeId),
        isNotNull(arcRequests.decisionType),
        inArray(arcRequests.status, [...DECISION_STATUSES]),
      ),
    );

  const totalPrior = priorRequests.length;

  if (totalPrior === 0) {
    return {
      score: 100,
      totalPrior: 0,
      matchingPrior: 0,
      requiresAcknowledgment: false,
    };
  }

  const normalizedDecision = proposedDecision === 'approved_with_conditions'
    ? 'approved'
    : proposedDecision;

  const matchingPrior = priorRequests.filter((r) => {
    const prior = r.decisionType === 'approved_with_conditions'
      ? 'approved'
      : r.decisionType;
    return prior === normalizedDecision;
  }).length;

  const score = Math.round((matchingPrior / totalPrior) * 100);

  return {
    score,
    totalPrior,
    matchingPrior,
    requiresAcknowledgment: score < CONSISTENCY_THRESHOLD,
  };
}
