import { and, eq, sql as drizzleSql, lte, inArray } from 'drizzle-orm';
import {
  charges,
  complianceProfiles,
  type DbClient,
} from '@repo/db';

const DEFAULT_GRACE_PERIOD_DAYS = 15;
const DEFAULT_PAYMENT_ORDER = [
  'interest',
  'late_fee',
  'fine',
  'assessment',
  'special_assessment',
  'arc_fee',
  'transfer_fee',
  'credit',
] as const;

export async function assessLateFees(
  db: DbClient,
  tenantId: number,
  asOfDate: Date,
): Promise<{ created: number; skipped: number }> {
  const profile = await getComplianceProfile(db, tenantId);
  const graceDays = DEFAULT_GRACE_PERIOD_DAYS;
  const lateFeeCap = profile?.lateFeeCap ? Number(profile.lateFeeCap) : undefined;

  const cutoff = new Date(asOfDate);
  cutoff.setDate(cutoff.getDate() - graceDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const periodKey = `${asOfDate.getFullYear()}-${String(asOfDate.getMonth() + 1).padStart(2, '0')}`;

  const overdueCharges = await db
    .select()
    .from(charges)
    .where(
      and(
        inArray(charges.status, ['due', 'overdue', 'partial']),
        lte(charges.dueDate, cutoffStr),
        inArray(charges.chargeType, ['assessment', 'special_assessment']),
      ),
    );

  let created = 0;
  let skipped = 0;

  for (const charge of overdueCharges) {
    const existing = await db
      .select({ id: charges.id })
      .from(charges)
      .where(
        and(
          eq(charges.sourceId, charge.id),
          eq(charges.chargeType, 'late_fee'),
          eq(charges.periodStart, periodKey),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const balanceRemaining = Number(charge.balanceRemaining);
    const percentFee = balanceRemaining * 0.05;
    let lateFeeAmount = Math.min(percentFee, 50);

    if (lateFeeCap !== undefined) {
      lateFeeAmount = Math.min(lateFeeAmount, lateFeeCap);
    }

    lateFeeAmount = Math.round(lateFeeAmount * 100) / 100;

    if (lateFeeAmount <= 0) {
      skipped++;
      continue;
    }

    await db.insert(charges).values({
      tenantId,
      memberId: charge.memberId,
      propertyId: charge.propertyId,
      chargeType: 'late_fee',
      description: `Late fee for ${charge.description}`,
      amount: String(lateFeeAmount),
      balanceRemaining: String(lateFeeAmount),
      dueDate: asOfDate.toISOString().slice(0, 10),
      periodStart: periodKey,
      fundTag: charge.fundTag,
      status: 'due',
      sourceType: 'manual',
      sourceId: charge.id,
    });

    if (charge.status === 'due') {
      await db
        .update(charges)
        .set({ status: 'overdue', updatedAt: new Date() })
        .where(eq(charges.id, charge.id));
    }

    created++;
  }

  return { created, skipped };
}

export async function getDelinquencyStatus(
  db: DbClient,
  memberId: string,
): Promise<'current' | '30-day' | '60-day' | '90-day' | 'lien-eligible'> {
  const [oldest] = await db
    .select({ dueDate: charges.dueDate })
    .from(charges)
    .where(
      and(
        eq(charges.memberId, memberId),
        inArray(charges.status, ['due', 'overdue', 'partial']),
      ),
    )
    .orderBy(charges.dueDate)
    .limit(1);

  if (!oldest) return 'current';

  const dueDate = new Date(oldest.dueDate);
  const now = new Date();
  const daysPastDue = Math.floor(
    (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysPastDue >= 180) return 'lien-eligible';
  if (daysPastDue >= 90) return '90-day';
  if (daysPastDue >= 60) return '60-day';
  if (daysPastDue >= 30) return '30-day';
  return 'current';
}

export async function getPaymentApplicationOrder(
  db: DbClient,
  tenantId: number,
  stateCode: string,
): Promise<readonly string[]> {
  const profiles = await db
    .select({
      priority: complianceProfiles.priority,
      paymentApplicationOrder: complianceProfiles.paymentApplicationOrder,
    })
    .from(complianceProfiles)
    .where(
      drizzleSql`(
        (${complianceProfiles.tenantId} = ${tenantId})
        OR (${complianceProfiles.tenantId} IS NULL AND ${complianceProfiles.stateCode} = ${stateCode})
        OR (${complianceProfiles.tenantId} IS NULL AND ${complianceProfiles.scope} = 'platform')
      )`,
    )
    .orderBy(drizzleSql`${complianceProfiles.priority} DESC`);

  for (const profile of profiles) {
    if (profile.paymentApplicationOrder && profile.paymentApplicationOrder.length > 0) {
      return profile.paymentApplicationOrder;
    }
  }

  return DEFAULT_PAYMENT_ORDER;
}

async function getComplianceProfile(
  db: DbClient,
  tenantId: number,
): Promise<{ lateFeeCap: string | null } | undefined> {
  const [profile] = await db
    .select({ lateFeeCap: complianceProfiles.lateFeeCap })
    .from(complianceProfiles)
    .where(
      drizzleSql`(
        ${complianceProfiles.tenantId} = ${tenantId}
        OR (${complianceProfiles.tenantId} IS NULL AND ${complianceProfiles.scope} = 'state')
      )`,
    )
    .orderBy(drizzleSql`${complianceProfiles.priority} DESC`)
    .limit(1);

  return profile;
}
