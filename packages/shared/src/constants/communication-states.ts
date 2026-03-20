export const COMMUNICATION_TYPE = {
  ANNOUNCEMENT: 'announcement',
  VIOLATION_NOTICE: 'violation_notice',
  ASSESSMENT_NOTICE: 'assessment_notice',
  MEETING_NOTICE: 'meeting_notice',
  ARC_NOTIFICATION: 'arc_notification',
  COLLECTION_NOTICE: 'collection_notice',
  GENERAL: 'general',
  EMERGENCY: 'emergency',
} as const;

export type CommunicationType = (typeof COMMUNICATION_TYPE)[keyof typeof COMMUNICATION_TYPE];

export const COMMUNICATION_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type CommunicationStatus = (typeof COMMUNICATION_STATUS)[keyof typeof COMMUNICATION_STATUS];

export const COMMUNICATION_PRIORITY = {
  EMERGENCY: 'emergency',
  URGENT: 'urgent',
  STANDARD: 'standard',
  LOW: 'low',
} as const;

export type CommunicationPriority = (typeof COMMUNICATION_PRIORITY)[keyof typeof COMMUNICATION_PRIORITY];

export const AUDIENCE_TYPE = {
  ALL_MEMBERS: 'all_members',
  BOARD: 'board',
  SPECIFIC_MEMBERS: 'specific_members',
  ROLE_BASED: 'role_based',
} as const;

export type AudienceType = (typeof AUDIENCE_TYPE)[keyof typeof AUDIENCE_TYPE];

export const DELIVERY_CHANNEL = {
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  IN_APP: 'in_app',
  PHYSICAL_MAIL: 'physical_mail',
  CERTIFIED_MAIL: 'certified_mail',
} as const;

export type DeliveryChannel = (typeof DELIVERY_CHANNEL)[keyof typeof DELIVERY_CHANNEL];

export const DELIVERY_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  OPENED: 'opened',
  BOUNCED: 'bounced',
  FAILED: 'failed',
} as const;

export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

// ── UI Display Helpers ─────────────────────────────────────────────────

type BadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export const COMMUNICATION_STATUS_LABELS: Record<CommunicationStatus, string> = {
  [COMMUNICATION_STATUS.DRAFT]: 'Draft',
  [COMMUNICATION_STATUS.SCHEDULED]: 'Scheduled',
  [COMMUNICATION_STATUS.SENDING]: 'Sending',
  [COMMUNICATION_STATUS.SENT]: 'Sent',
  [COMMUNICATION_STATUS.FAILED]: 'Failed',
  [COMMUNICATION_STATUS.CANCELLED]: 'Cancelled',
};

export const COMMUNICATION_STATUS_BADGE_VARIANT: Record<CommunicationStatus, BadgeVariant> = {
  [COMMUNICATION_STATUS.DRAFT]: 'neutral',
  [COMMUNICATION_STATUS.SCHEDULED]: 'info',
  [COMMUNICATION_STATUS.SENDING]: 'info',
  [COMMUNICATION_STATUS.SENT]: 'success',
  [COMMUNICATION_STATUS.FAILED]: 'error',
  [COMMUNICATION_STATUS.CANCELLED]: 'neutral',
};

export const PRIORITY_LABELS: Record<CommunicationPriority, string> = {
  [COMMUNICATION_PRIORITY.EMERGENCY]: 'Emergency',
  [COMMUNICATION_PRIORITY.URGENT]: 'Urgent',
  [COMMUNICATION_PRIORITY.STANDARD]: 'Standard',
  [COMMUNICATION_PRIORITY.LOW]: 'Low',
};

export const PRIORITY_BADGE_VARIANT: Record<CommunicationPriority, BadgeVariant> = {
  [COMMUNICATION_PRIORITY.EMERGENCY]: 'error',
  [COMMUNICATION_PRIORITY.URGENT]: 'warning',
  [COMMUNICATION_PRIORITY.STANDARD]: 'info',
  [COMMUNICATION_PRIORITY.LOW]: 'neutral',
};

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  [COMMUNICATION_TYPE.ANNOUNCEMENT]: 'Announcement',
  [COMMUNICATION_TYPE.VIOLATION_NOTICE]: 'Violation Notice',
  [COMMUNICATION_TYPE.ASSESSMENT_NOTICE]: 'Assessment Notice',
  [COMMUNICATION_TYPE.MEETING_NOTICE]: 'Meeting Notice',
  [COMMUNICATION_TYPE.ARC_NOTIFICATION]: 'ARC Notification',
  [COMMUNICATION_TYPE.COLLECTION_NOTICE]: 'Collection Notice',
  [COMMUNICATION_TYPE.GENERAL]: 'General',
  [COMMUNICATION_TYPE.EMERGENCY]: 'Emergency',
};
