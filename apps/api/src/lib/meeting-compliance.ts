import type { MeetingType, AgendaItemType } from '@repo/shared';

interface RequiredAgendaItem {
  itemType: AgendaItemType;
  title: string;
  durationMinutes: number;
  isRequired: boolean;
}

const PERMITTED_EXECUTIVE_SESSION_TOPICS = new Set([
  'legal',
  'litigation',
  'personnel',
  'contract_negotiation',
  'member_discipline',
  'security',
]);

function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }
  return result;
}

function subtractCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * WA notice requirements:
 * - Board meetings: 2 business days (RCW 64.38.035)
 * - Annual meetings: per CC&Rs, default 14 calendar days
 * - Special meetings: 10 calendar days (RCW 64.38.035)
 * - Committee meetings: same as board (2 business days)
 * - Executive sessions: same as board (2 business days)
 */
export function calculateNoticeDueDate(
  meetingDate: Date,
  meetingType: MeetingType,
  _stateCode = 'WA',
): Date {
  switch (meetingType) {
    case 'board':
    case 'committee':
    case 'executive_session':
      return subtractBusinessDays(meetingDate, 2);
    case 'annual':
      return subtractCalendarDays(meetingDate, 14);
    case 'special':
      return subtractCalendarDays(meetingDate, 10);
    default:
      return subtractCalendarDays(meetingDate, 7);
  }
}

/**
 * WA board meetings require a 15-minute owner comment period (RCW 64.90).
 * Annual meetings include standard parliamentary agenda items.
 */
export function getRequiredAgendaItems(
  meetingType: MeetingType,
  _stateCode = 'WA',
): RequiredAgendaItem[] {
  const items: RequiredAgendaItem[] = [];

  items.push({
    itemType: 'standing',
    title: 'Call to Order',
    durationMinutes: 5,
    isRequired: true,
  });

  if (meetingType === 'annual') {
    items.push(
      {
        itemType: 'standing',
        title: 'Quorum Verification',
        durationMinutes: 5,
        isRequired: true,
      },
      {
        itemType: 'standing',
        title: 'Approval of Previous Meeting Minutes',
        durationMinutes: 10,
        isRequired: true,
      },
      {
        itemType: 'information',
        title: 'Financial Report',
        durationMinutes: 15,
        isRequired: true,
      },
      {
        itemType: 'standing',
        title: 'Owner Comment Period',
        durationMinutes: 15,
        isRequired: true,
      },
      {
        itemType: 'standing',
        title: 'Adjournment',
        durationMinutes: 5,
        isRequired: true,
      },
    );
  }

  if (meetingType === 'board' || meetingType === 'committee') {
    items.push(
      {
        itemType: 'standing',
        title: 'Approval of Previous Meeting Minutes',
        durationMinutes: 5,
        isRequired: true,
      },
      {
        itemType: 'standing',
        title: 'Owner Comment Period',
        durationMinutes: 15,
        isRequired: true,
      },
      {
        itemType: 'standing',
        title: 'Adjournment',
        durationMinutes: 5,
        isRequired: true,
      },
    );
  }

  if (meetingType === 'special') {
    items.push({
      itemType: 'standing',
      title: 'Owner Comment Period',
      durationMinutes: 15,
      isRequired: true,
    });
  }

  return items;
}

export function validateExecutiveSession(
  agendaItems: Array<{ title: string; description?: string | null; itemType: string }>,
): { valid: boolean; invalidItems: string[] } {
  const invalidItems: string[] = [];

  for (const item of agendaItems) {
    if (item.itemType === 'standing') continue;

    const titleLower = item.title.toLowerCase();
    const descLower = (item.description ?? '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    const isPermitted = Array.from(PERMITTED_EXECUTIVE_SESSION_TOPICS).some(
      (topic) => combined.includes(topic.replace('_', ' ')) || combined.includes(topic),
    );

    if (!isPermitted) {
      invalidItems.push(item.title);
    }
  }

  return {
    valid: invalidItems.length === 0,
    invalidItems,
  };
}
