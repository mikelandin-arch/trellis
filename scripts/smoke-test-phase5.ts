import postgres from 'postgres';

const API = 'http://localhost:3001';
const AUTH = 'Bearer mock-dev-token';

const sql = postgres('postgresql://trellis_admin:TrellisDevDB2026!@localhost:15432/trellis', { ssl: 'require' });

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function trpcQuery<T>(path: string, input?: unknown): Promise<T> {
  const url = input
    ? `${API}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
    : `${API}/trpc/${path}`;
  const res = await fetch(url, { headers: { Authorization: AUTH } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} returned ${res.status}: ${body}`);
  }
  const json = await res.json() as { result: { data: T } };
  return json.result.data;
}

async function trpcMutation<T>(path: string, input: unknown): Promise<T> {
  const res = await fetch(`${API}/trpc/${path}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} returned ${res.status}: ${body}`);
  }
  const json = await res.json() as { result: { data: T } };
  return json.result.data;
}

async function testCommunications(): Promise<{ createdId: string }> {
  console.log('\n📢 COMMUNICATIONS');

  // 1. communication.list
  const list = await trpcQuery<{ items: Array<{ id: string; subject: string; status: string }>; nextCursor?: string }>('communication.list', { limit: 20 });
  assert(list.items.length >= 5, `communication.list returned ${list.items.length} items (expected ≥5)`);

  // 2. communication.create — test announcement
  const created = await trpcMutation<{ id: string; status: string; subject: string }>('communication.create', {
    communicationType: 'announcement',
    subject: 'Smoke Test Announcement',
    body: 'This is a smoke test communication created during automated testing.',
    priority: 'standard',
    audienceType: 'all_members',
    channels: ['email'],
  });
  assert(created.status === 'draft', `communication.create status='${created.status}' (expected 'draft')`);
  assert(created.subject === 'Smoke Test Announcement', 'communication.create subject matches');

  // 3. communication.send
  const sent = await trpcMutation<{ id: string; status: string; deliveryCount: number }>('communication.send', {
    id: created.id,
  });
  assert(sent.status === 'sent', `communication.send status='${sent.status}' (expected 'sent')`);
  assert(sent.deliveryCount > 0, `communication.send created ${sent.deliveryCount} deliveries`);

  // 4. communication.getById
  const detail = await trpcQuery<{ id: string; deliveryStats: Record<string, number> }>('communication.getById', { id: created.id });
  assert(detail.id === created.id, 'communication.getById returned correct record');
  const totalDeliveries = Object.values(detail.deliveryStats).reduce((a, b) => a + b, 0);
  assert(totalDeliveries > 0, `communication.getById deliveryStats total=${totalDeliveries}`);

  // 5. communication.getDeliveryStatus
  const deliveryStatus = await trpcQuery<{ total: number; byChannel: Array<{ channel: string; status: string; count: number }> }>('communication.getDeliveryStatus', { id: created.id });
  assert(deliveryStatus.total > 0, `communication.getDeliveryStatus total=${deliveryStatus.total}`);
  assert(deliveryStatus.byChannel.length > 0, `communication.getDeliveryStatus byChannel has ${deliveryStatus.byChannel.length} entries`);

  return { createdId: created.id };
}

async function testDocuments(): Promise<void> {
  console.log('\n📄 DOCUMENTS');

  // 1. document.list
  const list = await trpcQuery<{ items: Array<{ id: string; title: string; category: string }>; nextCursor?: string }>('document.list', { limit: 20 });
  assert(list.items.length >= 5, `document.list returned ${list.items.length} items (expected ≥5)`);

  // 2. document.search — search for "budget"
  const searchResults = await trpcQuery<Array<{ id: string; title: string; rank: number }>>('document.search', { query: 'budget', limit: 10 });
  assert(searchResults.length >= 1, `document.search('budget') returned ${searchResults.length} results`);
  const budgetDoc = searchResults.find(d => d.title.toLowerCase().includes('budget'));
  assert(!!budgetDoc, `document.search found budget document: ${budgetDoc?.title ?? 'not found'}`);

  // 3. document.getById
  if (list.items[0]) {
    const doc = await trpcQuery<{ id: string; title: string; downloadUrl: string; versions: unknown[] }>('document.getById', { id: list.items[0].id });
    assert(doc.id === list.items[0].id, 'document.getById returned correct document');
    assert(typeof doc.downloadUrl === 'string' && doc.downloadUrl.length > 0, 'document.getById includes downloadUrl');
  }

  // 4. document.getUploadUrl
  const uploadResult = await trpcMutation<{ uploadUrl: string; fileKey: string }>('document.getUploadUrl', {
    filename: 'test-smoke-doc.pdf',
    mimeType: 'application/pdf',
    category: 'forms',
  });
  assert(typeof uploadResult.uploadUrl === 'string' && uploadResult.uploadUrl.includes('s3'), `document.getUploadUrl returned S3 URL`);
  assert(typeof uploadResult.fileKey === 'string' && uploadResult.fileKey.length > 0, 'document.getUploadUrl returned fileKey');
}

async function testDocumentCategories(): Promise<void> {
  console.log('\n📁 DOCUMENT CATEGORIES');

  const categories = await trpcQuery<Array<{ id: string; name: string; isSystem: boolean }>>('documentCategory.list', undefined);
  assert(categories.length >= 10, `documentCategory.list returned ${categories.length} categories (expected ≥10)`);
  const systemCats = categories.filter(c => c.isSystem);
  assert(systemCats.length >= 10, `${systemCats.length} are system categories`);
}

async function testMeetings(): Promise<{ upcomingMeetingId: string; createdMeetingId: string }> {
  console.log('\n🗓️ MEETINGS');

  // 1. meeting.list
  const list = await trpcQuery<{ items: Array<{ id: string; title: string; meetingType: string; status: string }>; nextCursor?: string }>('meeting.list', { limit: 20 });
  assert(list.items.length >= 2, `meeting.list returned ${list.items.length} items (expected ≥2)`);

  // 2. meeting.getById — upcoming board meeting
  const upcomingMeeting = list.items.find(m => m.title === 'April Board Meeting');
  assert(!!upcomingMeeting, `Found upcoming board meeting: ${upcomingMeeting?.title ?? 'not found'}`);

  let upcomingMeetingId = upcomingMeeting?.id ?? '';
  if (upcomingMeetingId) {
    const detail = await trpcQuery<{
      id: string;
      title: string;
      agendaItems: Array<{ id: string; title: string; durationMinutes: number | null; itemType: string }>;
      attendees: unknown[];
      quorumRequired: number | null;
      quorumPresent: number | null;
      quorumMet: boolean | null;
    }>('meeting.getById', { id: upcomingMeetingId });
    assert(detail.agendaItems.length >= 5, `meeting.getById returned ${detail.agendaItems.length} agenda items`);
    const ownerComment = detail.agendaItems.find(a => a.title.toLowerCase().includes('owner comment'));
    assert(!!ownerComment, `WA-required Owner Comment Period found in agenda`);
    if (ownerComment) {
      assert(ownerComment.durationMinutes === 15, `Owner Comment Period is ${ownerComment.durationMinutes} min (expected 15)`);
    }
  }

  // 3. meeting.create — new board meeting with auto-agenda
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  futureDate.setHours(18, 0, 0, 0);
  const created = await trpcMutation<{
    id: string;
    meetingType: string;
    title: string;
    status: string;
    quorumRequired: number | null;
  }>('meeting.create', {
    meetingType: 'board',
    title: 'Smoke Test Board Meeting',
    scheduledAt: futureDate.toISOString(),
    location: 'Test Location',
  });
  assert(created.status === 'scheduled', `meeting.create status='${created.status}'`);
  assert((created.quorumRequired ?? 0) > 0, `meeting.create quorumRequired=${created.quorumRequired}`);

  // Verify auto-populated agenda
  const createdDetail = await trpcQuery<{
    agendaItems: Array<{ title: string; durationMinutes: number | null; itemType: string }>;
  }>('meeting.getById', { id: created.id });
  assert(createdDetail.agendaItems.length >= 3, `Auto-populated ${createdDetail.agendaItems.length} agenda items`);
  const autoOwnerComment = createdDetail.agendaItems.find(a => a.title.toLowerCase().includes('owner comment'));
  assert(!!autoOwnerComment, 'Auto-populated agenda includes Owner Comment Period');
  if (autoOwnerComment) {
    assert(autoOwnerComment.durationMinutes === 15, `Auto Owner Comment is 15 minutes`);
  }

  // 4. meeting.sendNotice — notice compliance (board = 2 business days)
  const sendNotice = await trpcMutation<{ communicationId: string; noticeDueDate: string }>('meeting.sendNotice', {
    meetingId: created.id,
  });
  assert(typeof sendNotice.communicationId === 'string', `meeting.sendNotice created communication ${sendNotice.communicationId}`);
  assert(typeof sendNotice.noticeDueDate === 'string', `meeting.sendNotice noticeDueDate=${sendNotice.noticeDueDate}`);

  // 5. meeting.checkQuorum
  const quorum = await trpcQuery<{ quorumRequired: number | null; quorumPresent: number | null; quorumMet: boolean | null }>('meeting.checkQuorum', { id: created.id });
  assert(typeof quorum.quorumRequired === 'number', `meeting.checkQuorum quorumRequired=${quorum.quorumRequired}`);
  assert(quorum.quorumMet === false, `meeting.checkQuorum quorumMet=${quorum.quorumMet} (expected false before attendance)`);

  return { upcomingMeetingId, createdMeetingId: created.id };
}

async function testAgendaItems(meetingId: string): Promise<void> {
  console.log('\n📋 AGENDA ITEMS');

  // 1. agendaItem.create
  const created = await trpcMutation<{ id: string; title: string; sortOrder: number }>('agendaItem.create', {
    meetingId,
    itemType: 'discussion',
    title: 'Smoke Test Agenda Item',
    durationMinutes: 10,
  });
  assert(typeof created.sortOrder === 'number', `agendaItem.create sortOrder=${created.sortOrder}`);
  assert(created.title === 'Smoke Test Agenda Item', 'agendaItem.create title matches');

  // 2. agendaItem.list
  const items = await trpcQuery<Array<{ id: string; title: string; sortOrder: number }>>('agendaItem.list', { id: meetingId });
  assert(items.length >= 2, `agendaItem.list returned ${items.length} items`);

  // 3. agendaItem.reorder
  if (items.length >= 2) {
    const reordered = items.map((item, index) => ({
      id: item.id,
      sortOrder: items.length - 1 - index,
    }));
    const result = await trpcMutation<Array<{ id: string; sortOrder: number }>>('agendaItem.reorder', {
      meetingId,
      items: reordered,
    });
    assert(result.length >= 2, `agendaItem.reorder returned ${result.length} items`);
    const firstItemNewOrder = result.find(r => r.id === items[0]!.id);
    assert(
      firstItemNewOrder?.sortOrder === items.length - 1,
      `agendaItem.reorder new order verified (first item sortOrder=${firstItemNewOrder?.sortOrder})`,
    );
  }
}

async function testRecordAttendance(meetingId: string): Promise<void> {
  console.log('\n🙋 ATTENDANCE');

  const [tenant] = await sql`SELECT id FROM tenants WHERE slug = 'talasera-hoa' LIMIT 1`;
  if (!tenant) {
    console.error('  ⚠️ Cannot test attendance — no tenant found');
    return;
  }
  const memberRows = await sql`SELECT id FROM members WHERE tenant_id = ${tenant.id} ORDER BY id LIMIT 3`;

  if (memberRows.length === 0) {
    console.error('  ⚠️ Cannot test attendance — no members found');
    return;
  }

  // Record first member attendance
  const result1 = await trpcMutation<{ quorumRequired: number; quorumPresent: number; quorumMet: boolean }>('meeting.recordAttendance', {
    meetingId,
    memberId: memberRows[0]!.id,
    attendanceType: 'in_person',
    isBoardMember: true,
  });
  assert(result1.quorumPresent >= 1, `recordAttendance quorumPresent=${result1.quorumPresent} after first attendee`);

  // Record second member attendance
  if (memberRows.length >= 2) {
    const result2 = await trpcMutation<{ quorumRequired: number; quorumPresent: number; quorumMet: boolean }>('meeting.recordAttendance', {
      meetingId,
      memberId: memberRows[1]!.id,
      attendanceType: 'virtual',
      isBoardMember: false,
    });
    assert(result2.quorumPresent >= 2, `recordAttendance quorumPresent=${result2.quorumPresent} after second attendee`);
  }

  // Verify quorum update
  const quorum = await trpcQuery<{ quorumRequired: number | null; quorumPresent: number | null; quorumMet: boolean | null }>('meeting.checkQuorum', { id: meetingId });
  assert((quorum.quorumPresent ?? 0) >= 1, `checkQuorum after attendance: quorumPresent=${quorum.quorumPresent}`);
}

async function main(): Promise<void> {
  console.log('🔥 Phase 5 Smoke Tests — Communications, Documents, Meetings');
  console.log('═'.repeat(60));

  try {
    await testCommunications();
    await testDocuments();
    await testDocumentCategories();
    const { createdMeetingId } = await testMeetings();
    await testAgendaItems(createdMeetingId);
    await testRecordAttendance(createdMeetingId);
  } catch (err) {
    console.error('\n💥 Unhandled error:', err);
    failed++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  await sql.end();

  if (failed > 0) {
    process.exit(1);
  }
}

main();
