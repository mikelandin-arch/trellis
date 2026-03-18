import { describe, it, expect } from 'vitest';
import {
  VALID_TRANSITIONS,
  TERMINAL_STATES,
} from '@repo/shared';
import type { ViolationStatus } from '@repo/shared';
import {
  validateTransition,
  getCureDeadline,
  checkFineCap,
} from '../lib/compliance';
import { checkRepeatOffender } from '../routers/violation';
import type { DbClient } from '@repo/db';

// ── Mock DbClient Factory ──────────────────────────────────────────────
//
// Compliance functions use the Drizzle chain: db.select().from().where().limit()
// Some calls use db.select({ id: col }) with a column map.
// The mock returns rows configured per-call via a queue. When the queue is
// empty it returns [].

type RowQueue = unknown[][];

function createMockDb(rowQueue: RowQueue = []): DbClient {
  let callIndex = 0;

  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => {
      const rows = rowQueue[callIndex] ?? [];
      callIndex++;
      return Promise.resolve(rows);
    },
  };

  return {
    select: () => chain,
  } as unknown as DbClient;
}

// ── Helpers ────────────────────────────────────────────────────────────

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-wa',
    scope: 'state' as const,
    stateCode: 'WA',
    tenantId: null,
    curePeriodDays: 30,
    fineCapPerViolation: null,
    certifiedMailRequired: false,
    rules: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Group 1: Valid Transitions ─────────────────────────────────────────

describe('valid transitions', () => {
  for (const [fromState, toStates] of Object.entries(VALID_TRANSITIONS)) {
    for (const toState of toStates) {
      it(`${fromState} -> ${toState} is allowed`, async () => {
        const db = createMockDb([
          [],  // getStateProfile returns no profile
        ]);
        const result = await validateTransition(
          db,
          fromState as ViolationStatus,
          toState,
          'WA',
        );
        expect(result.allowed).toBe(true);
      });
    }
  }
});

// ── Group 2: Invalid Transitions ───────────────────────────────────────

describe('invalid transitions are rejected', () => {
  const validPairs = new Set<string>();
  for (const [from, toStates] of Object.entries(VALID_TRANSITIONS)) {
    for (const to of toStates) {
      validPairs.add(`${from}->${to}`);
    }
  }

  const invalidCases: Array<[string, string]> = [
    ['reported', 'fine_assessed'],
    ['reported', 'lien_filed'],
    ['verified', 'lien_filed'],
    ['verified', 'fine_assessed'],
    ['courtesy_notice_sent', 'hearing_scheduled'],
    ['courtesy_notice_sent', 'fine_assessed'],
    ['formal_notice_sent', 'lien_filed'],
    ['escalated', 'fine_assessed'],
    ['hearing_scheduled', 'lien_filed'],
    ['fine_assessed', 'hearing_scheduled'],
    ['payment_plan', 'hearing_scheduled'],
    ['lien_filed', 'dismissed'],
  ];

  for (const [from, to] of invalidCases) {
    it(`${from} -> ${to} is rejected`, async () => {
      expect(validPairs.has(`${from}->${to}`)).toBe(false);

      const db = createMockDb([]);
      const result = await validateTransition(
        db,
        from as ViolationStatus,
        to as ViolationStatus,
        'WA',
      );
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain(from);
        expect(result.reason).toContain(to);
      }
    });
  }

  describe('terminal states have no outbound transitions', () => {
    for (const terminal of TERMINAL_STATES) {
      it(`${terminal} has no valid transitions`, () => {
        const transitions = VALID_TRANSITIONS[terminal];
        expect(transitions).toBeUndefined();
      });

      it(`${terminal} -> reported is rejected by validateTransition`, async () => {
        const db = createMockDb([]);
        const result = await validateTransition(
          db,
          terminal,
          'reported' as ViolationStatus,
          'WA',
        );
        expect(result.allowed).toBe(false);
      });
    }
  });
});

// ── Group 3: Cure Deadline Calculation ─────────────────────────────────

describe('cure deadline calculation', () => {
  it('uses curePeriodDays from compliance profile', async () => {
    const db = createMockDb([
      [makeProfile({ curePeriodDays: 14 })],
    ]);
    const deadline = await getCureDeadline(db, '2026-03-01', 'WA');
    expect(deadline).toBe('2026-03-15');
  });

  it('defaults to 30 days when no compliance profile exists', async () => {
    const db = createMockDb([
      [],
    ]);
    const deadline = await getCureDeadline(db, '2026-03-01', 'XX');
    expect(deadline).toBe('2026-03-31');
  });

  it('handles month boundary rollover', async () => {
    const db = createMockDb([
      [makeProfile({ curePeriodDays: 14 })],
    ]);
    const deadline = await getCureDeadline(db, '2026-01-25', 'WA');
    expect(deadline).toBe('2026-02-08');
  });

  it('handles year boundary rollover', async () => {
    const db = createMockDb([
      [makeProfile({ curePeriodDays: 10 })],
    ]);
    const deadline = await getCureDeadline(db, '2025-12-28', 'WA');
    expect(deadline).toBe('2026-01-07');
  });
});

// ── Group 4: Fine Cap Validation ───────────────────────────────────────

describe('fine cap validation', () => {
  it('accepts fine under the cap', async () => {
    const db = createMockDb([
      [makeProfile({ fineCapPerViolation: '500.00' })],
    ]);
    const result = await checkFineCap(db, 250, 'WA');
    expect(result.valid).toBe(true);
    expect(result.cap).toBe(500);
  });

  it('accepts fine exactly at the cap', async () => {
    const db = createMockDb([
      [makeProfile({ fineCapPerViolation: '500.00' })],
    ]);
    const result = await checkFineCap(db, 500, 'WA');
    expect(result.valid).toBe(true);
    expect(result.cap).toBe(500);
  });

  it('rejects fine over the cap', async () => {
    const db = createMockDb([
      [makeProfile({ fineCapPerViolation: '500.00' })],
    ]);
    const result = await checkFineCap(db, 501, 'WA');
    expect(result.valid).toBe(false);
    expect(result.cap).toBe(500);
    expect(result.message).toContain('501.00');
    expect(result.message).toContain('500.00');
  });

  it('allows any amount when no profile exists', async () => {
    const db = createMockDb([
      [],
    ]);
    const result = await checkFineCap(db, 99999, 'XX');
    expect(result.valid).toBe(true);
    expect(result.cap).toBeNull();
  });

  it('allows any amount when profile has no fine cap', async () => {
    const db = createMockDb([
      [makeProfile({ fineCapPerViolation: null })],
    ]);
    const result = await checkFineCap(db, 10000, 'WA');
    expect(result.valid).toBe(true);
    expect(result.cap).toBeNull();
  });
});

// ── Group 5: Repeat Offender 12-Month Lookback ─────────────────────────

describe('repeat offender 12-month lookback', () => {
  it('detects repeat offender when prior violation exists', async () => {
    const db = createMockDb([
      [{ id: 'prev-violation-abc' }],
    ]);
    const result = await checkRepeatOffender(
      db,
      'property-1',
      'category-1',
    );
    expect(result.isRepeat).toBe(true);
    expect(result.previousViolationId).toBe('prev-violation-abc');
  });

  it('returns not repeat when no prior violations', async () => {
    const db = createMockDb([
      [],
    ]);
    const result = await checkRepeatOffender(
      db,
      'property-1',
      'category-1',
    );
    expect(result.isRepeat).toBe(false);
    expect(result.previousViolationId).toBeUndefined();
  });

  it('returns not repeat when categoryId is null', async () => {
    const db = createMockDb([]);
    const result = await checkRepeatOffender(
      db,
      'property-1',
      null,
    );
    expect(result.isRepeat).toBe(false);
  });

  it('returns not repeat when categoryId is undefined', async () => {
    const db = createMockDb([]);
    const result = await checkRepeatOffender(
      db,
      'property-1',
      undefined,
    );
    expect(result.isRepeat).toBe(false);
  });
});

// ── Bonus: validateTransition with compliance rules ────────────────────

describe('validateTransition with compliance profile and rules', () => {
  it('returns rule requirements when profile and rule exist', async () => {
    const profile = makeProfile({ id: 'prof-wa' });
    const rule = {
      requiresHearing: true,
      minNoticeDays: 14,
      requiresCertifiedMail: true,
    };
    const db = createMockDb([
      [profile],  // getStateProfile
      [rule],     // transition rule lookup
    ]);
    const result = await validateTransition(
      db,
      'formal_notice_sent' as ViolationStatus,
      'hearing_scheduled' as ViolationStatus,
      'WA',
    );
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.requiresHearing).toBe(true);
      expect(result.minNoticeDays).toBe(14);
      expect(result.requiresCertifiedMail).toBe(true);
    }
  });

  it('returns defaults when profile exists but no specific rule', async () => {
    const profile = makeProfile();
    const db = createMockDb([
      [profile],  // getStateProfile
      [],         // no transition rule
    ]);
    const result = await validateTransition(
      db,
      'reported' as ViolationStatus,
      'verified' as ViolationStatus,
      'WA',
    );
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.requiresHearing).toBe(false);
      expect(result.minNoticeDays).toBeNull();
      expect(result.requiresCertifiedMail).toBe(false);
    }
  });
});
