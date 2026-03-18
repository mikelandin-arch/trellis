import { TRPCError } from '@trpc/server';
import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import {
  assessmentSchedules,
  assessmentRateHistory,
  charges,
  properties,
  members,
  propertyOwnerships,
} from '@repo/db';
import {
  createAssessmentScheduleSchema,
  generateChargesSchema,
  rateHistorySchema,
} from '@repo/shared';
import { router } from '../trpc/router';
import { tenantProcedure, requirePermission } from '../trpc/procedures';

export const assessmentRouter = router({
  listSchedules: tenantProcedure
    .input(
      generateChargesSchema.pick({ communityId: true }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(assessmentSchedules)
        .where(
          and(
            eq(assessmentSchedules.communityId, input.communityId),
            eq(assessmentSchedules.isActive, true),
          ),
        )
        .orderBy(assessmentSchedules.name);
    }),

  createSchedule: tenantProcedure
    .use(requirePermission('org:finance:manage'))
    .input(createAssessmentScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .insert(assessmentSchedules)
        .values({
          tenantId: ctx.tenantId,
          communityId: input.communityId,
          name: input.name,
          assessmentType: input.assessmentType,
          frequency: input.frequency,
          amount: String(input.amount),
          assessmentClass: input.assessmentClass,
          fundAllocation: input.fundAllocation,
          effectiveDate: input.effectiveDate.toISOString().slice(0, 10),
          endDate: input.endDate?.toISOString().slice(0, 10),
        })
        .returning();

      const schedule = rows[0]!;

      await ctx.db.insert(assessmentRateHistory).values({
        tenantId: ctx.tenantId,
        scheduleId: schedule.id,
        newAmount: String(input.amount),
        effectiveDate: input.effectiveDate.toISOString().slice(0, 10),
        reason: 'Initial schedule creation',
      });

      return schedule;
    }),

  generateCharges: tenantProcedure
    .use(requirePermission('org:finance:manage'))
    .input(generateChargesSchema)
    .mutation(async ({ ctx, input }) => {
      const periodStart = input.periodStart.toISOString().slice(0, 10);
      const periodEnd = input.periodEnd.toISOString().slice(0, 10);

      const activeSchedules = await ctx.db
        .select()
        .from(assessmentSchedules)
        .where(
          and(
            eq(assessmentSchedules.communityId, input.communityId),
            eq(assessmentSchedules.isActive, true),
          ),
        );

      if (activeSchedules.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No active assessment schedules for this community',
        });
      }

      const ownerships = await ctx.db
        .select({
          propertyId: properties.id,
          memberId: members.id,
          assessmentClass: properties.assessmentClass,
        })
        .from(properties)
        .innerJoin(
          propertyOwnerships,
          and(
            eq(propertyOwnerships.propertyId, properties.id),
            eq(propertyOwnerships.tenantId, ctx.tenantId),
          ),
        )
        .innerJoin(members, eq(members.id, propertyOwnerships.memberId))
        .where(
          and(
            eq(properties.communityId, input.communityId),
            eq(properties.status, 'active'),
          ),
        );

      let created = 0;
      let skipped = 0;

      for (const schedule of activeSchedules) {
        for (const ownership of ownerships) {
          if (
            schedule.assessmentClass !== 'standard' &&
            ownership.assessmentClass !== schedule.assessmentClass
          ) {
            continue;
          }

          const existing = await ctx.db
            .select({ id: charges.id })
            .from(charges)
            .where(
              and(
                eq(charges.scheduleId, schedule.id),
                eq(charges.propertyId, ownership.propertyId),
                eq(charges.periodStart, periodStart),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            skipped++;
            continue;
          }

          const fundKeys = Object.keys(
            schedule.fundAllocation as Record<string, number>,
          );
          const primaryFund = fundKeys[0] ?? 'operating';

          await ctx.db.insert(charges).values({
            tenantId: ctx.tenantId,
            memberId: ownership.memberId,
            propertyId: ownership.propertyId,
            scheduleId: schedule.id,
            chargeType: schedule.assessmentType === 'special' ? 'special_assessment' : 'assessment',
            description: `${schedule.name} — ${periodStart} to ${periodEnd}`,
            amount: schedule.amount,
            balanceRemaining: schedule.amount,
            dueDate: periodStart,
            periodStart,
            periodEnd,
            fundTag: primaryFund,
            status: 'due',
          });

          created++;
        }
      }

      return { created, skipped };
    }),

  getRateHistory: tenantProcedure
    .input(rateHistorySchema)
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(assessmentRateHistory)
        .where(eq(assessmentRateHistory.scheduleId, input.scheduleId))
        .orderBy(drizzleSql`${assessmentRateHistory.effectiveDate} DESC`);
    }),
});
