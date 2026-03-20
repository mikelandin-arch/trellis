import { eq, inArray, sql } from 'drizzle-orm';
import { members, communicationDeliveries, boardTerms } from '@repo/db';
import type { DbClient } from '@repo/db';
import type { AudienceType, CommunicationPriority, DeliveryChannel } from '@repo/shared';

interface MemberRow {
  id: string;
  communicationPreferences: Record<string, boolean>;
}

const LEGAL_NOTICE_TYPES = new Set([
  'violation_notice',
  'collection_notice',
  'assessment_notice',
]);

export async function resolveAudience(
  db: DbClient,
  _communityId: string,
  audienceType: AudienceType,
  audienceFilter?: Record<string, unknown>,
): Promise<MemberRow[]> {
  switch (audienceType) {
    case 'all_members': {
      const rows = await db
        .select({ id: members.id, communicationPreferences: members.communicationPreferences })
        .from(members);
      return rows as MemberRow[];
    }
    case 'board': {
      const rows = await db
        .select({
          id: members.id,
          communicationPreferences: members.communicationPreferences,
        })
        .from(members)
        .innerJoin(boardTerms, eq(members.id, boardTerms.memberId))
        .where(sql`${boardTerms.validDuring} @> CURRENT_DATE`);
      return rows as MemberRow[];
    }
    case 'specific_members': {
      const memberIds = (audienceFilter?.memberIds ?? []) as string[];
      if (memberIds.length === 0) return [];
      const rows = await db
        .select({ id: members.id, communicationPreferences: members.communicationPreferences })
        .from(members)
        .where(inArray(members.id, memberIds));
      return rows as MemberRow[];
    }
    case 'role_based': {
      const roles = (audienceFilter?.roles ?? []) as string[];
      if (roles.length === 0) return [];
      const rows = await db
        .select({ id: members.id, communicationPreferences: members.communicationPreferences })
        .from(members)
        .where(inArray(members.memberType, roles));
      return rows as MemberRow[];
    }
    default:
      return [];
  }
}

export function resolveChannels(
  member: MemberRow,
  priority: CommunicationPriority,
  communicationType?: string,
): DeliveryChannel[] {
  const prefs = member.communicationPreferences ?? {};
  const channels: DeliveryChannel[] = [];

  if (priority === 'emergency') {
    return ['email', 'sms', 'push', 'in_app'];
  }

  if (communicationType && LEGAL_NOTICE_TYPES.has(communicationType)) {
    channels.push('email');
    if (!channels.includes('physical_mail')) {
      channels.push('physical_mail');
    }
  }

  if (channels.length > 0) return channels;

  if (prefs.email !== false) channels.push('email');
  if (prefs.sms === true) channels.push('sms');
  if (prefs.push !== false) channels.push('push');
  channels.push('in_app');

  return channels;
}

export async function createDeliveries(
  db: DbClient,
  communicationId: string,
  tenantId: number,
  memberChannels: Array<{ memberId: string; channels: DeliveryChannel[] }>,
): Promise<number> {
  const now = new Date();
  const rows = memberChannels.flatMap(({ memberId, channels }) =>
    channels.map((channel) => ({
      tenantId,
      communicationId,
      memberId,
      channel,
      status: 'sent' as const,
      queuedAt: now,
      sentAt: now,
    })),
  );

  if (rows.length === 0) return 0;

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(communicationDeliveries).values(batch);
  }

  return rows.length;
}
