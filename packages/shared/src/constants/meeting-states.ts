export const MEETING_TYPE = {
  ANNUAL: 'annual',
  BOARD: 'board',
  SPECIAL: 'special',
  COMMITTEE: 'committee',
  EXECUTIVE_SESSION: 'executive_session',
} as const;

export type MeetingType = (typeof MEETING_TYPE)[keyof typeof MEETING_TYPE];

export const MEETING_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type MeetingStatus = (typeof MEETING_STATUS)[keyof typeof MEETING_STATUS];

export const AGENDA_ITEM_TYPE = {
  ACTION_ITEM: 'action_item',
  DISCUSSION: 'discussion',
  INFORMATION: 'information',
  VOTE: 'vote',
  STANDING: 'standing',
} as const;

export type AgendaItemType = (typeof AGENDA_ITEM_TYPE)[keyof typeof AGENDA_ITEM_TYPE];

export const ATTENDANCE_TYPE = {
  IN_PERSON: 'in_person',
  VIRTUAL: 'virtual',
  PROXY: 'proxy',
  ABSENT: 'absent',
} as const;

export type AttendanceType = (typeof ATTENDANCE_TYPE)[keyof typeof ATTENDANCE_TYPE];

// ── UI Display Helpers ─────────────────────────────────────────────────

type BadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  [MEETING_STATUS.DRAFT]: 'Draft',
  [MEETING_STATUS.SCHEDULED]: 'Scheduled',
  [MEETING_STATUS.IN_PROGRESS]: 'In Progress',
  [MEETING_STATUS.COMPLETED]: 'Completed',
  [MEETING_STATUS.CANCELLED]: 'Cancelled',
};

export const MEETING_STATUS_BADGE_VARIANT: Record<MeetingStatus, BadgeVariant> = {
  [MEETING_STATUS.DRAFT]: 'neutral',
  [MEETING_STATUS.SCHEDULED]: 'info',
  [MEETING_STATUS.IN_PROGRESS]: 'warning',
  [MEETING_STATUS.COMPLETED]: 'success',
  [MEETING_STATUS.CANCELLED]: 'neutral',
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  [MEETING_TYPE.ANNUAL]: 'Annual Meeting',
  [MEETING_TYPE.BOARD]: 'Board Meeting',
  [MEETING_TYPE.SPECIAL]: 'Special Meeting',
  [MEETING_TYPE.COMMITTEE]: 'Committee Meeting',
  [MEETING_TYPE.EXECUTIVE_SESSION]: 'Executive Session',
};

export const AGENDA_ITEM_TYPE_LABELS: Record<AgendaItemType, string> = {
  [AGENDA_ITEM_TYPE.ACTION_ITEM]: 'Action Item',
  [AGENDA_ITEM_TYPE.DISCUSSION]: 'Discussion',
  [AGENDA_ITEM_TYPE.INFORMATION]: 'Information',
  [AGENDA_ITEM_TYPE.VOTE]: 'Vote',
  [AGENDA_ITEM_TYPE.STANDING]: 'Standing Item',
};

export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  [ATTENDANCE_TYPE.IN_PERSON]: 'In Person',
  [ATTENDANCE_TYPE.VIRTUAL]: 'Virtual',
  [ATTENDANCE_TYPE.PROXY]: 'Proxy',
  [ATTENDANCE_TYPE.ABSENT]: 'Absent',
};
