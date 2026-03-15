import {
  pgTable, uuid, bigint, text, integer, numeric,
  boolean, jsonb, timestamp, unique,
} from 'drizzle-orm/pg-core';
import { tenants, users } from './platform';
import { communities, members } from './community';

export const meetings = pgTable('meetings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  meetingType: text('meeting_type').notNull(),
  title: text('title').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  location: text('location'),
  virtualMeetingUrl: text('virtual_meeting_url'),
  isVirtual: boolean('is_virtual').notNull().default(false),
  isHybrid: boolean('is_hybrid').notNull().default(false),
  status: text('status').notNull().default('scheduled'),
  noticeSentAt: timestamp('notice_sent_at', { withTimezone: true }),
  noticeMethod: text('notice_method').array(),
  minutesText: text('minutes_text'),
  minutesApproved: boolean('minutes_approved').notNull().default(false),
  minutesApprovedAt: timestamp('minutes_approved_at', { withTimezone: true }),
  recordingUrl: text('recording_url'),
  transcriptUrl: text('transcript_url'),
  quorumRequired: integer('quorum_required'),
  quorumPresent: integer('quorum_present'),
  quorumMet: boolean('quorum_met'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const meetingAgendaItems = pgTable('meeting_agenda_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id),
  itemType: text('item_type').notNull().default('discussion'),
  title: text('title').notNull(),
  description: text('description'),
  durationMinutes: integer('duration_minutes'),
  sortOrder: integer('sort_order').notNull().default(0),
  presenterId: uuid('presenter_id').references(() => members.id),
  resolution: text('resolution'),
  voteResult: text('vote_result'),
  attachments: jsonb('attachments').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const meetingAttendees = pgTable('meeting_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  attendanceType: text('attendance_type').notNull().default('in_person'),
  isBoardMember: boolean('is_board_member').notNull().default(false),
  proxyForMemberId: uuid('proxy_for_member_id').references(() => members.id),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
}, (t) => [
  unique().on(t.tenantId, t.meetingId, t.memberId),
]);

export const elections = pgTable('elections', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  meetingId: uuid('meeting_id').references(() => meetings.id),
  title: text('title').notNull(),
  electionType: text('election_type').notNull(),
  status: text('status').notNull().default('draft'),
  votingMethod: text('voting_method').notNull().default('electronic'),
  isSecretBallot: boolean('is_secret_ballot').notNull().default(true),
  nominationsOpenAt: timestamp('nominations_open_at', { withTimezone: true }),
  nominationsCloseAt: timestamp('nominations_close_at', { withTimezone: true }),
  votingOpenAt: timestamp('voting_open_at', { withTimezone: true }),
  votingCloseAt: timestamp('voting_close_at', { withTimezone: true }),
  quorumThreshold: numeric('quorum_threshold', { precision: 5, scale: 4 }).notNull().default('0.50'),
  approvalThreshold: numeric('approval_threshold', { precision: 5, scale: 4 }).notNull().default('0.50'),
  ballotConfig: jsonb('ballot_config').notNull().default({}),
  results: jsonb('results'),
  certifiedAt: timestamp('certified_at', { withTimezone: true }),
  certifiedBy: uuid('certified_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ballotOptions = pgTable('ballot_options', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  electionId: uuid('election_id').notNull().references(() => elections.id),
  label: text('label').notNull(),
  description: text('description'),
  candidateMemberId: uuid('candidate_member_id').references(() => members.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const voteRecords = pgTable('vote_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  electionId: uuid('election_id').notNull().references(() => elections.id),
  ballotOptionId: uuid('ballot_option_id').notNull().references(() => ballotOptions.id),
  voterMemberId: uuid('voter_member_id').references(() => members.id),
  voteToken: uuid('vote_token'),
  votingWeight: numeric('voting_weight', { precision: 8, scale: 4 }).notNull().default('1.0'),
  isProxyVote: boolean('is_proxy_vote').notNull().default(false),
  proxyFormDocumentId: uuid('proxy_form_document_id'),
  castAt: timestamp('cast_at', { withTimezone: true }).notNull().defaultNow(),
});

export const voterRegistry = pgTable('voter_registry', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  electionId: uuid('election_id').notNull().references(() => elections.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  hasVoted: boolean('has_voted').notNull().default(false),
  voteToken: uuid('vote_token'),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  voteMethod: text('vote_method'),
}, (t) => [
  unique().on(t.tenantId, t.electionId, t.memberId),
]);

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  category: text('category').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  fileKey: text('file_key').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  mimeType: text('mime_type').notNull(),
  version: integer('version').notNull().default(1),
  isPublic: boolean('is_public').notNull().default(false),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  accessOverride: jsonb('access_override'),
  searchText: text('search_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // search_vector is GENERATED ALWAYS AS ... STORED — managed by PostgreSQL
});

export const documentVersions = pgTable('document_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull().references(() => tenants.id),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  version: integer('version').notNull(),
  fileKey: text('file_key').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  changeSummary: text('change_summary'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
