import { z } from 'zod';
import { paginationSchema } from './common';
import {
  MEETING_TYPE, MEETING_STATUS, AGENDA_ITEM_TYPE, ATTENDANCE_TYPE,
} from '../constants/meeting-states';

const allMeetingTypes = Object.values(MEETING_TYPE);
const allMeetingStatuses = Object.values(MEETING_STATUS);
const allAgendaItemTypes = Object.values(AGENDA_ITEM_TYPE);
const allAttendanceTypes = Object.values(ATTENDANCE_TYPE);

export const meetingTypeSchema = z.enum(allMeetingTypes as [string, ...string[]]);
export const meetingStatusSchema = z.enum(allMeetingStatuses as [string, ...string[]]);
export const agendaItemTypeSchema = z.enum(allAgendaItemTypes as [string, ...string[]]);
export const attendanceTypeSchema = z.enum(allAttendanceTypes as [string, ...string[]]);

// ── Create Meeting ─────────────────────────────────────────────────────

export const createMeetingSchema = z.object({
  meetingType: meetingTypeSchema,
  title: z.string().min(1).max(300),
  scheduledAt: z.coerce.date(),
  location: z.string().max(500).optional(),
  virtualMeetingUrl: z.string().url().max(2000).optional(),
  isVirtual: z.boolean().default(false),
  isHybrid: z.boolean().default(false),
});
export type CreateMeeting = z.infer<typeof createMeetingSchema>;

// ── Update Meeting ─────────────────────────────────────────────────────

export const updateMeetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  scheduledAt: z.coerce.date().optional(),
  location: z.string().max(500).nullable().optional(),
  virtualMeetingUrl: z.string().url().max(2000).nullable().optional(),
  isVirtual: z.boolean().optional(),
  isHybrid: z.boolean().optional(),
  status: meetingStatusSchema.optional(),
  minutesText: z.string().max(100_000).optional(),
});
export type UpdateMeeting = z.infer<typeof updateMeetingSchema>;

// ── List / Filter ──────────────────────────────────────────────────────

export const meetingListSchema = paginationSchema.extend({
  meetingType: meetingTypeSchema.optional(),
  status: z.array(meetingStatusSchema).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type MeetingListInput = z.infer<typeof meetingListSchema>;

// ── Agenda Items ───────────────────────────────────────────────────────

export const createAgendaItemSchema = z.object({
  meetingId: z.string().uuid(),
  itemType: agendaItemTypeSchema.default('discussion'),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
  presenterId: z.string().uuid().optional(),
});
export type CreateAgendaItem = z.infer<typeof createAgendaItemSchema>;

export const updateAgendaItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(480).nullable().optional(),
  presenterId: z.string().uuid().nullable().optional(),
  resolution: z.string().max(5000).optional(),
  itemType: agendaItemTypeSchema.optional(),
});
export type UpdateAgendaItem = z.infer<typeof updateAgendaItemSchema>;

export const reorderAgendaItemsSchema = z.object({
  meetingId: z.string().uuid(),
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })).min(1),
});
export type ReorderAgendaItems = z.infer<typeof reorderAgendaItemsSchema>;

// ── Record Vote ────────────────────────────────────────────────────────

export const recordAgendaVoteSchema = z.object({
  id: z.string().uuid(),
  voteResult: z.string().min(1).max(500),
});
export type RecordAgendaVote = z.infer<typeof recordAgendaVoteSchema>;

// ── Attendance ─────────────────────────────────────────────────────────

export const recordAttendanceSchema = z.object({
  meetingId: z.string().uuid(),
  memberId: z.string().uuid(),
  attendanceType: attendanceTypeSchema.default('in_person'),
  isBoardMember: z.boolean().default(false),
  proxyForMemberId: z.string().uuid().optional(),
});
export type RecordAttendance = z.infer<typeof recordAttendanceSchema>;

// ── Send Notice ────────────────────────────────────────────────────────

export const sendMeetingNoticeSchema = z.object({
  meetingId: z.string().uuid(),
});
export type SendMeetingNotice = z.infer<typeof sendMeetingNoticeSchema>;
