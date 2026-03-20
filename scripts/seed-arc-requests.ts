import postgres from 'postgres';

const sql = postgres('postgresql://trellis_admin:TrellisDevDB2026!@localhost:15432/trellis', { ssl: 'require' });

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

async function seed(): Promise<void> {
  console.log('Seeding sample ARC requests for Talasera HOA...');

  const clerkOrgId = 'org_3B0ke05kRyhNKSjphKtcJyycHcd';
  const [tenant] = await sql`SELECT id FROM tenants WHERE clerk_org_id = ${clerkOrgId}`;
  if (!tenant) {
    console.error('Talasera tenant not found. Run seed-talasera.ts first.');
    process.exit(1);
  }
  const tenantId: number = tenant.id;

  const [community] = await sql`
    SELECT id FROM communities WHERE tenant_id = ${tenantId} AND name = 'Talasera'
  `;
  if (!community) {
    console.error('Talasera community not found.');
    process.exit(1);
  }
  const communityId: string = community.id;

  const properties = await sql`
    SELECT id, lot_number FROM properties
    WHERE tenant_id = ${tenantId} AND community_id = ${communityId}
    ORDER BY lot_number::int
  `;
  if (properties.length < 42) {
    console.error('Not enough properties. Run seed-talasera.ts first.');
    process.exit(1);
  }

  const members = await sql`
    SELECT id FROM members WHERE tenant_id = ${tenantId} ORDER BY created_at LIMIT 55
  `;
  if (members.length === 0) {
    console.error('No members found. Run seed-assessments.ts first.');
    process.exit(1);
  }

  const clerkUserId = 'user_3B0lenUBBFeWFai0wg1f6G6fxRk';
  const [user] = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId}`;
  const userId: string | null = user?.id ?? null;

  const modTypes = await sql`
    SELECT id, name, complexity_tier, default_review_days
    FROM arc_modification_types
    WHERE tenant_id = ${tenantId}
  `;
  if (modTypes.length === 0) {
    console.error('No modification types found. Run seed-arc-types.ts first.');
    process.exit(1);
  }

  function findModType(name: string): { id: string; name: string; default_review_days: number } {
    const mt = modTypes.find((m) => m.name.toLowerCase().includes(name.toLowerCase()));
    if (!mt) throw new Error(`Modification type not found: ${name}`);
    return mt;
  }

  function getProp(lotNum: number): { id: string } {
    const p = properties.find((pr) => pr.lot_number === String(lotNum));
    if (!p) throw new Error(`Property lot ${lotNum} not found`);
    return p;
  }

  function getMember(index: number): { id: string } {
    return members[Math.min(index, members.length - 1)]!;
  }

  let requestCount = 0;

  // ── 1. Approved: Fence (Lot 5) ────────────────────────────────────────

  const fenceMt = findModType('fence');
  const fenceSubmission = '2025-11-15';
  const [fenceReq] = await sql`
    INSERT INTO arc_requests (
      tenant_id, community_id, property_id, applicant_id, modification_type_id,
      status, complexity_tier, title, description, estimated_cost,
      submission_date, review_deadline, deemed_approved_deadline,
      decision_type, decision_rationale, decision_date
    ) VALUES (
      ${tenantId}, ${communityId}, ${getProp(5).id}, ${getMember(4).id}, ${fenceMt.id},
      'approved', 2, 'Replace front yard fence', 'Replacing existing wood fence with cedar 6ft privacy fence. Same footprint as existing.',
      '3500.00', ${fenceSubmission}, ${addDays(fenceSubmission, fenceMt.default_review_days)},
      ${addDays(fenceSubmission, fenceMt.default_review_days)},
      'approved', 'Consistent with neighborhood standards. Cedar material approved.', '2025-12-05'
    ) ON CONFLICT DO NOTHING RETURNING id
  `;
  if (fenceReq) {
    requestCount++;
    await sql`
      INSERT INTO arc_transitions (tenant_id, request_id, from_state, to_state, triggered_by, reason)
      VALUES
        (${tenantId}, ${fenceReq.id}, '_initial', 'submitted', ${userId}, 'ARC request submitted'),
        (${tenantId}, ${fenceReq.id}, 'submitted', 'under_review', ${userId}, 'Application complete'),
        (${tenantId}, ${fenceReq.id}, 'under_review', 'committee_review', ${userId}, 'Forwarded to ARC committee'),
        (${tenantId}, ${fenceReq.id}, 'committee_review', 'approved', ${userId}, 'Unanimous approval')
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO arc_votes (tenant_id, request_id, committee_member_id, vote_value, rationale)
      VALUES (${tenantId}, ${fenceReq.id}, ${getMember(0).id}, 'approve', 'Cedar fence matches neighborhood character. Dimensions are within guidelines.')
      ON CONFLICT DO NOTHING
    `;
  }

  // ── 2. Approved: Paint (Lot 12) ──────────────────────────────────────

  const paintMt = findModType('paint');
  const paintSubmission = '2025-12-01';
  const [paintReq] = await sql`
    INSERT INTO arc_requests (
      tenant_id, community_id, property_id, applicant_id, modification_type_id,
      status, complexity_tier, title, description,
      submission_date, review_deadline, deemed_approved_deadline,
      decision_type, decision_rationale, decision_date
    ) VALUES (
      ${tenantId}, ${communityId}, ${getProp(12).id}, ${getMember(11).id}, ${paintMt.id},
      'approved', 1, 'Exterior paint — Sherwin-Williams Alabaster', 'Repainting exterior from current beige to Sherwin-Williams Alabaster (SW 7008). Trim to remain white.',
      ${paintSubmission}, ${addDays(paintSubmission, paintMt.default_review_days)},
      ${addDays(paintSubmission, paintMt.default_review_days)},
      'approved', 'Color within approved palette. Fast-track approval.', '2025-12-08'
    ) ON CONFLICT DO NOTHING RETURNING id
  `;
  if (paintReq) {
    requestCount++;
    await sql`
      INSERT INTO arc_transitions (tenant_id, request_id, from_state, to_state, triggered_by, reason)
      VALUES
        (${tenantId}, ${paintReq.id}, '_initial', 'submitted', ${userId}, 'ARC request submitted'),
        (${tenantId}, ${paintReq.id}, 'submitted', 'under_review', ${userId}, 'Fast-track review'),
        (${tenantId}, ${paintReq.id}, 'under_review', 'committee_review', ${userId}, 'Committee review'),
        (${tenantId}, ${paintReq.id}, 'committee_review', 'approved', ${userId}, 'Approved — color within palette')
      ON CONFLICT DO NOTHING
    `;
  }

  // ── 3. Approved: Solar panels (Lot 23) ────────────────────────────────

  const solarMt = findModType('solar');
  const solarSubmission = '2026-01-10';
  const [solarReq] = await sql`
    INSERT INTO arc_requests (
      tenant_id, community_id, property_id, applicant_id, modification_type_id,
      status, complexity_tier, title, description, estimated_cost,
      submission_date, review_deadline, deemed_approved_deadline,
      decision_type, decision_rationale, decision_date
    ) VALUES (
      ${tenantId}, ${communityId}, ${getProp(23).id}, ${getMember(22).id}, ${solarMt.id},
      'approved', 1, 'Rooftop solar panel installation', 'Installing 20-panel SunPower Maxeon array on south-facing roof. Licensed installer: Puget Sound Solar.',
      '28000.00', ${solarSubmission}, ${addDays(solarSubmission, solarMt.default_review_days)},
      ${addDays(solarSubmission, solarMt.default_review_days)},
      'approved', 'Protected modification per RCW 64.38.055. Reasonable placement restrictions met.', '2026-01-20'
    ) ON CONFLICT DO NOTHING RETURNING id
  `;
  if (solarReq) {
    requestCount++;
    await sql`
      INSERT INTO arc_transitions (tenant_id, request_id, from_state, to_state, triggered_by, reason)
      VALUES
        (${tenantId}, ${solarReq.id}, '_initial', 'submitted', ${userId}, 'ARC request submitted'),
        (${tenantId}, ${solarReq.id}, 'submitted', 'under_review', ${userId}, 'Protected modification — expedited review'),
        (${tenantId}, ${solarReq.id}, 'under_review', 'committee_review', ${userId}, 'Committee confirmation'),
        (${tenantId}, ${solarReq.id}, 'committee_review', 'approved', ${userId}, 'Approved — protected by RCW 64.38.055')
      ON CONFLICT DO NOTHING
    `;
  }

  // ── 4. Under Review: Deck (Lot 8) ────────────────────────────────────

  const deckMt = findModType('deck');
  const deckSubmission = '2026-03-05';
  const [deckReq] = await sql`
    INSERT INTO arc_requests (
      tenant_id, community_id, property_id, applicant_id, modification_type_id,
      status, complexity_tier, title, description, estimated_cost,
      estimated_start_date, estimated_completion_date,
      submission_date, review_deadline, deemed_approved_deadline
    ) VALUES (
      ${tenantId}, ${communityId}, ${getProp(8).id}, ${getMember(7).id}, ${deckMt.id},
      'under_review', 2, 'New backyard composite deck', 'Building 12x16 composite deck (Trex Transcend Tropics) with built-in bench seating. Permit obtained from Bothell.',
      '8500.00', '2026-04-15', '2026-06-01',
      ${deckSubmission}, ${addDays(deckSubmission, deckMt.default_review_days)},
      ${addDays(deckSubmission, deckMt.default_review_days)}
    ) ON CONFLICT DO NOTHING RETURNING id
  `;
  if (deckReq) {
    requestCount++;
    await sql`
      INSERT INTO arc_transitions (tenant_id, request_id, from_state, to_state, triggered_by, reason)
      VALUES
        (${tenantId}, ${deckReq.id}, '_initial', 'submitted', ${userId}, 'ARC request submitted'),
        (${tenantId}, ${deckReq.id}, 'submitted', 'under_review', ${userId}, 'Application complete, under review')
      ON CONFLICT DO NOTHING
    `;
  }

  // ── 5. Under Review: Landscaping (Lot 31) ────────────────────────────

  const landscapeMt = findModType('landscaping changes');
  const lsSubmission = '2026-03-10';
  const [lsReq] = await sql`
    INSERT INTO arc_requests (
      tenant_id, community_id, property_id, applicant_id, modification_type_id,
      status, complexity_tier, title, description, estimated_cost,
      submission_date, review_deadline, deemed_approved_deadline
    ) VALUES (
      ${tenantId}, ${communityId}, ${getProp(31).id}, ${getMember(30).id}, ${landscapeMt.id},
      'under_review', 1, 'Front yard drought-resistant conversion', 'Converting front lawn to drought-resistant native plants. Keeping existing border shrubs. Adding decorative gravel pathways.',
      '4200.00',
      ${lsSubmission}, ${addDays(lsSubmission, landscapeMt.default_review_days)},
      ${addDays(lsSubmission, landscapeMt.default_review_days)}
    ) ON CONFLICT DO NOTHING RETURNING id
  `;
  if (lsReq) {
    requestCount++;
    await sql`
      INSERT INTO arc_transitions (tenant_id, request_id, from_state, to_state, triggered_by, reason)
      VALUES
        (${tenantId}, ${lsReq.id}, '_initial', 'submitted', ${userId}, 'ARC request submitted'),
        (${tenantId}, ${lsReq.id}, 'submitted', 'under_review', ${userId}, 'Fast-track review initiated')
      ON CONFLICT DO NOTHING
    `;
  }

  // ── 6. Denied: Shed color (Lot 17) ───────────────────────────────────

  const paintMt2 = findModType('paint');
  const shedSubmission = '2026-01-20';
  const [shedReq] = await sql`
    INSERT INTO arc_requests (
      tenant_id, community_id, property_id, applicant_id, modification_type_id,
      status, complexity_tier, title, description,
      submission_date, review_deadline, deemed_approved_deadline,
      decision_type, decision_rationale, decision_date
    ) VALUES (
      ${tenantId}, ${communityId}, ${getProp(17).id}, ${getMember(16).id}, ${paintMt2.id},
      'denied', 1, 'Paint shed bright purple', 'Requesting approval to paint storage shed in Behr Purple Lotus (P570-7). Shed is visible from street.',
      ${shedSubmission}, ${addDays(shedSubmission, paintMt2.default_review_days)},
      ${addDays(shedSubmission, paintMt2.default_review_days)},
      'denied', 'Color does not fall within the approved exterior color palette per CC&R Art. 5.3. Bright/neon colors are specifically prohibited for structures visible from the street.', '2026-02-01'
    ) ON CONFLICT DO NOTHING RETURNING id
  `;
  if (shedReq) {
    requestCount++;
    await sql`
      INSERT INTO arc_transitions (tenant_id, request_id, from_state, to_state, triggered_by, reason)
      VALUES
        (${tenantId}, ${shedReq.id}, '_initial', 'submitted', ${userId}, 'ARC request submitted'),
        (${tenantId}, ${shedReq.id}, 'submitted', 'under_review', ${userId}, 'Review started'),
        (${tenantId}, ${shedReq.id}, 'under_review', 'committee_review', ${userId}, 'Committee review'),
        (${tenantId}, ${shedReq.id}, 'committee_review', 'denied', ${userId}, 'Color outside approved palette')
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO arc_votes (tenant_id, request_id, committee_member_id, vote_value, rationale)
      VALUES (${tenantId}, ${shedReq.id}, ${getMember(0).id}, 'deny', 'Purple Lotus is not on the approved palette. CC&R Art. 5.3 prohibits bright/neon colors on street-facing structures.')
      ON CONFLICT DO NOTHING
    `;
  }

  // ── 7. Approved with conditions: Patio (Lot 42) ──────────────────────

  const patioMt = findModType('deck');
  const patioSubmission = '2026-02-01';
  const [patioReq] = await sql`
    INSERT INTO arc_requests (
      tenant_id, community_id, property_id, applicant_id, modification_type_id,
      status, complexity_tier, title, description, estimated_cost,
      submission_date, review_deadline, deemed_approved_deadline,
      decision_type, decision_rationale, decision_date,
      conditions
    ) VALUES (
      ${tenantId}, ${communityId}, ${getProp(42).id}, ${getMember(41).id}, ${patioMt.id},
      'approved_with_conditions', 2, 'Covered patio extension', 'Extending existing patio by 10ft with a covered pergola structure. Adding drainage system to prevent runoff to neighboring lots.',
      '12000.00',
      ${patioSubmission}, ${addDays(patioSubmission, patioMt.default_review_days)},
      ${addDays(patioSubmission, patioMt.default_review_days)},
      'approved_with_conditions', 'Approved contingent on proper drainage installation to prevent impact on neighboring properties.',
      '2026-02-25',
      ${JSON.stringify([
        { condition: 'Install French drain system along patio perimeter to direct runoff away from neighboring lots 41 and 43', dueDate: '2026-04-15', addedAt: '2026-02-25T00:00:00.000Z' },
        { condition: 'Submit final drainage plan to ARC liaison before construction begins', dueDate: '2026-03-15', addedAt: '2026-02-25T00:00:00.000Z' },
      ])}
    ) ON CONFLICT DO NOTHING RETURNING id
  `;
  if (patioReq) {
    requestCount++;
    await sql`
      INSERT INTO arc_transitions (tenant_id, request_id, from_state, to_state, triggered_by, reason)
      VALUES
        (${tenantId}, ${patioReq.id}, '_initial', 'submitted', ${userId}, 'ARC request submitted'),
        (${tenantId}, ${patioReq.id}, 'submitted', 'under_review', ${userId}, 'Application complete'),
        (${tenantId}, ${patioReq.id}, 'under_review', 'committee_review', ${userId}, 'Forwarded to committee'),
        (${tenantId}, ${patioReq.id}, 'committee_review', 'approved_with_conditions', ${userId}, 'Approved with drainage conditions')
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO arc_votes (tenant_id, request_id, committee_member_id, vote_value, rationale, conditions_proposed)
      VALUES (${tenantId}, ${patioReq.id}, ${getMember(0).id}, 'conditional', 'Design is acceptable but drainage must be addressed to prevent runoff issues for adjacent properties.',
        ${JSON.stringify([{ condition: 'Install French drain system', dueDate: '2026-04-15' }])})
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`  ${requestCount} ARC requests created`);
  console.log('Done.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
