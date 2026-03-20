import postgres from 'postgres';

const sql = postgres('postgresql://trellis_admin:TrellisDevDB2026!@localhost:15432/trellis', { ssl: 'require' });

async function seed(): Promise<void> {
  console.log('Seeding communications, documents, meetings…');

  const [tenant] = await sql`SELECT id FROM tenants WHERE slug = 'talasera-hoa' LIMIT 1`;
  if (!tenant) { console.error('Run seed-talasera.ts first'); process.exit(1); }
  const tenantId: number = tenant.id;

  const [community] = await sql`SELECT id FROM communities WHERE tenant_id = ${tenantId} LIMIT 1`;
  if (!community) { console.error('No community found'); process.exit(1); }
  const communityId: string = community.id;

  const [user] = await sql`SELECT id FROM users LIMIT 1`;
  const userId: string | null = user?.id ?? null;

  // ── Document Categories ──────────────────────────────────────────────
  const categories = [
    'Governing Documents', 'Financial', 'Meeting Minutes', 'Correspondence',
    'Violation Evidence', 'ARC Documents', 'Insurance', 'Contracts',
    'Maintenance', 'Forms',
  ];
  for (let i = 0; i < categories.length; i++) {
    await sql`
      INSERT INTO document_categories (tenant_id, name, sort_order, is_system)
      VALUES (${tenantId}, ${categories[i]!}, ${i}, true)
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`  ${categories.length} document categories created`);

  // ── Documents ────────────────────────────────────────────────────────
  const docs = [
    { category: 'governing_docs', title: 'Talasera CC&Rs', description: 'Covenants, Conditions & Restrictions', mimeType: 'application/pdf', isPublic: true },
    { category: 'financial', title: '2026 Annual Budget', description: 'Approved operating and reserve budget', mimeType: 'application/pdf', isPublic: false },
    { category: 'meeting_minutes', title: 'January 2026 Board Meeting Minutes', description: 'Regular board meeting minutes', mimeType: 'application/pdf', isPublic: true },
    { category: 'meeting_minutes', title: 'February 2026 Board Meeting Minutes', description: 'Regular board meeting minutes', mimeType: 'application/pdf', isPublic: true },
    { category: 'insurance', title: 'Insurance Certificate 2026', description: 'General liability and D&O coverage', mimeType: 'application/pdf', isPublic: false },
  ];
  for (const doc of docs) {
    const fileKey = `documents/${tenantId}/${doc.category}/2026/${crypto.randomUUID()}-${doc.title.replace(/\s+/g, '_')}.pdf`;
    await sql`
      INSERT INTO documents (tenant_id, community_id, category, title, description, file_key, file_url, mime_type, is_public, uploaded_by, search_text)
      SELECT ${tenantId}, ${communityId}, ${doc.category}, ${doc.title}, ${doc.description},
             ${fileKey}, ${'https://trellis-documents-dev.s3.amazonaws.com/' + fileKey},
             ${doc.mimeType}, ${doc.isPublic}, ${userId}, ${doc.title + ' ' + doc.description}
      WHERE NOT EXISTS (
        SELECT 1 FROM documents WHERE tenant_id = ${tenantId} AND title = ${doc.title}
      )
    `;
  }
  console.log(`  ${docs.length} documents created`);

  // ── Communications ───────────────────────────────────────────────────
  const now = new Date();
  const comms = [
    { type: 'announcement', subject: 'Summer Community BBQ', body: 'Join us for the annual community BBQ on June 15th at the clubhouse! Bring a dish to share. Activities for kids, live music, and raffle prizes. RSVP by June 10th.', priority: 'standard', status: 'sent' },
    { type: 'announcement', subject: 'Landscaping Schedule Update', body: 'Starting April 1st, the landscaping crew will service the community every Tuesday and Friday. Please remove personal items from common areas on those days.', priority: 'standard', status: 'sent' },
    { type: 'announcement', subject: '2026 Board Election Notice', body: 'The annual board election will be held at the Annual Meeting on May 15th. Three positions are open: President, Treasurer, and At-Large Member. Nomination forms are due by April 30th.', priority: 'urgent', status: 'scheduled' },
    { type: 'meeting_notice', subject: 'March Board Meeting', body: 'The regular March board meeting will be held on March 25th at 6:00 PM at the clubhouse. Agenda includes: budget review, landscaping contract renewal, and community event planning.', priority: 'standard', status: 'sent' },
    { type: 'meeting_notice', subject: 'Annual Meeting Reminder', body: 'This is a reminder that the Annual Meeting is scheduled for May 15th at 6:00 PM. Your attendance is important for achieving quorum. Proxy forms are available at the office.', priority: 'urgent', status: 'sent' },
  ];
  for (const c of comms) {
    await sql`
      INSERT INTO communications (tenant_id, community_id, communication_type, subject, body, priority, status, audience_type, channels, sent_at, sent_by)
      SELECT ${tenantId}, ${communityId}, ${c.type}, ${c.subject}, ${c.body}, ${c.priority},
             ${c.status}, 'all_members', ARRAY['email'], 
             ${c.status === 'sent' ? now : null},
             ${c.status === 'sent' ? userId : null}
      WHERE NOT EXISTS (
        SELECT 1 FROM communications WHERE tenant_id = ${tenantId} AND subject = ${c.subject}
      )
    `;
  }
  console.log(`  ${comms.length} communications created`);

  // ── Meetings ─────────────────────────────────────────────────────────
  // Upcoming board meeting
  const upcomingDate = new Date();
  upcomingDate.setDate(upcomingDate.getDate() + 14);
  upcomingDate.setHours(18, 0, 0, 0);

  const [existingUpcoming] = await sql`
    SELECT id FROM meetings WHERE tenant_id = ${tenantId} AND title = 'April Board Meeting' LIMIT 1
  `;
  if (!existingUpcoming) {
    const [upcomingMeeting] = await sql`
      INSERT INTO meetings (tenant_id, community_id, meeting_type, title, scheduled_at, location, status, quorum_required, quorum_present, quorum_met)
      VALUES (${tenantId}, ${communityId}, 'board', 'April Board Meeting', ${upcomingDate}, 'Talasera Clubhouse, 12000 Talasera Ln', 'scheduled', 28, 0, false)
      RETURNING id
    `;
    const meetingId = upcomingMeeting!.id;

    const agendaItems = [
      { type: 'standing', title: 'Call to Order', duration: 5, order: 0 },
      { type: 'standing', title: 'Approval of Previous Meeting Minutes', duration: 5, order: 1 },
      { type: 'discussion', title: 'Landscaping Contract Renewal', duration: 20, order: 2 },
      { type: 'vote', title: 'Approve 2026 Reserve Study', duration: 15, order: 3 },
      { type: 'standing', title: 'Owner Comment Period', duration: 15, order: 4 },
      { type: 'standing', title: 'Adjournment', duration: 5, order: 5 },
    ];
    for (const item of agendaItems) {
      await sql`
        INSERT INTO meeting_agenda_items (tenant_id, meeting_id, item_type, title, duration_minutes, sort_order)
        VALUES (${tenantId}, ${meetingId}, ${item.type}, ${item.title}, ${item.duration}, ${item.order})
      `;
    }
    console.log('  Upcoming board meeting with 6 agenda items created');
  }

  // Past annual meeting
  const pastDate = new Date();
  pastDate.setMonth(pastDate.getMonth() - 2);
  pastDate.setHours(18, 0, 0, 0);

  const [existingPast] = await sql`
    SELECT id FROM meetings WHERE tenant_id = ${tenantId} AND title = '2026 Annual Meeting' LIMIT 1
  `;
  if (!existingPast) {
    const [pastMeeting] = await sql`
      INSERT INTO meetings (
        tenant_id, community_id, meeting_type, title, scheduled_at, location, status,
        quorum_required, quorum_present, quorum_met, minutes_text, minutes_approved, notice_sent_at
      ) VALUES (
        ${tenantId}, ${communityId}, 'annual', '2026 Annual Meeting', ${pastDate},
        'Talasera Clubhouse, 12000 Talasera Ln', 'completed',
        28, 32, true,
        'The 2026 Annual Meeting of the Talasera HOA was called to order at 6:05 PM. Quorum was established with 32 of 55 voting members present. The 2025 meeting minutes were approved unanimously. The Treasurer presented the 2025 financial report showing a positive operating surplus. The 2026 budget was approved by a vote of 30-2. Three board positions were filled by election. The meeting was adjourned at 7:45 PM.',
        true,
        ${new Date(pastDate.getTime() - 14 * 24 * 60 * 60 * 1000)}
      )
      RETURNING id
    `;
    const pastMeetingId = pastMeeting!.id;

    // Record attendance for ~30 members
    const memberRows = await sql`SELECT id FROM members WHERE tenant_id = ${tenantId} ORDER BY id LIMIT 55`;
    const attendanceCount = Math.min(32, memberRows.length);
    for (let i = 0; i < attendanceCount; i++) {
      const memberId = memberRows[i]!.id;
      const attendanceType = i < 25 ? 'in_person' : 'virtual';
      await sql`
        INSERT INTO meeting_attendees (tenant_id, meeting_id, member_id, attendance_type, checked_in_at)
        VALUES (${tenantId}, ${pastMeetingId}, ${memberId}, ${attendanceType}, ${pastDate})
        ON CONFLICT (tenant_id, meeting_id, member_id) DO NOTHING
      `;
    }
    console.log(`  Past annual meeting with ${attendanceCount} attendees created`);
  }

  console.log('Done.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
