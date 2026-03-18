import postgres from 'postgres';

const sql = postgres('postgresql://trellis_admin:TrellisDevDB2026!@localhost:15432/trellis', { ssl: 'require' });

const PAID_PROPERTY_COUNT = 44;
const TOTAL_PROPERTIES = 55;
const MONTHLY_AMOUNT = '100.00';
const MONTHS = [
  { start: '2026-01-01', end: '2026-01-31', label: 'January 2026' },
  { start: '2026-02-01', end: '2026-02-28', label: 'February 2026' },
  { start: '2026-03-01', end: '2026-03-31', label: 'March 2026' },
];

async function seed(): Promise<void> {
  console.log('Seeding assessment data for Talasera…');

  const [tenant] = await sql`
    SELECT id FROM tenants WHERE slug = 'talasera-hoa'
  `;
  if (!tenant) throw new Error('Run seed-talasera.ts first');
  const tenantId: number = tenant.id;
  console.log(`  tenant_id=${tenantId}`);

  const [community] = await sql`
    SELECT id FROM communities WHERE tenant_id = ${tenantId} AND name = 'Talasera'
  `;
  if (!community) throw new Error('Community not found');
  const communityId: string = community.id;

  const properties = await sql`
    SELECT id, lot_number FROM properties
    WHERE tenant_id = ${tenantId} AND community_id = ${communityId}
    ORDER BY lot_number::int
  `;
  console.log(`  found ${properties.length} properties`);

  // 1. Create members
  const memberIds: string[] = [];
  for (let i = 0; i < properties.length; i++) {
    const firstName = `Owner`;
    const lastName = `${i + 1}`;
    const email = `owner${i + 1}@talasera.example.com`;

    const [row] = await sql`
      INSERT INTO members (tenant_id, first_name, last_name, email, member_type)
      VALUES (${tenantId}, ${firstName}, ${lastName}, ${email}, 'owner')
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    if (row) {
      memberIds.push(row.id);
    } else {
      const [existing] = await sql`
        SELECT id FROM members
        WHERE tenant_id = ${tenantId} AND email = ${email}
      `;
      memberIds.push(existing.id);
    }
  }
  console.log(`  ${memberIds.length} members created/found`);

  // 2. Create property ownerships
  for (let i = 0; i < properties.length; i++) {
    await sql`
      INSERT INTO property_ownerships (tenant_id, property_id, member_id, ownership_type)
      VALUES (${tenantId}, ${properties[i].id}, ${memberIds[i]}, 'primary')
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`  ${properties.length} property ownerships created`);

  // 3. Create assessment schedule
  const [schedule] = await sql`
    INSERT INTO assessment_schedules (
      tenant_id, community_id, name, assessment_type, frequency,
      amount, assessment_class, fund_allocation, is_active, effective_date
    ) VALUES (
      ${tenantId}, ${communityId}, 'Monthly HOA Assessment', 'regular', 'monthly',
      ${MONTHLY_AMOUNT}, 'standard', '{"operating": 0.8, "reserve": 0.2}',
      true, '2026-01-01'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  const scheduleId: string = schedule?.id
    ?? (await sql`
      SELECT id FROM assessment_schedules
      WHERE tenant_id = ${tenantId} AND name = 'Monthly HOA Assessment'
    `)[0].id;
  console.log(`  schedule_id=${scheduleId}`);

  // 4. Record rate history
  await sql`
    INSERT INTO assessment_rate_history (tenant_id, schedule_id, new_amount, effective_date, reason)
    SELECT ${tenantId}, ${scheduleId}, ${MONTHLY_AMOUNT}, '2026-01-01', 'Initial assessment'
    WHERE NOT EXISTS (
      SELECT 1 FROM assessment_rate_history
      WHERE schedule_id = ${scheduleId} AND effective_date = '2026-01-01'
    )
  `;

  // 5. Generate charges for 3 months
  let chargesCreated = 0;
  const allChargeIds: { propertyIdx: number; chargeId: string; month: number }[] = [];

  for (let m = 0; m < MONTHS.length; m++) {
    const month = MONTHS[m];
    for (let i = 0; i < properties.length; i++) {
      const [existing] = await sql`
        SELECT id FROM charges
        WHERE schedule_id = ${scheduleId}
          AND property_id = ${properties[i].id}
          AND period_start = ${month.start}
      `;

      if (existing) {
        allChargeIds.push({ propertyIdx: i, chargeId: existing.id, month: m });
        continue;
      }

      const [charge] = await sql`
        INSERT INTO charges (
          tenant_id, member_id, property_id, schedule_id,
          charge_type, description, amount, balance_remaining,
          due_date, period_start, period_end, fund_tag, status
        ) VALUES (
          ${tenantId}, ${memberIds[i]}, ${properties[i].id}, ${scheduleId},
          'assessment', ${'Monthly HOA Assessment — ' + month.label},
          ${MONTHLY_AMOUNT}, ${MONTHLY_AMOUNT},
          ${month.start}, ${month.start}, ${month.end}, 'operating', 'due'
        )
        RETURNING id
      `;

      allChargeIds.push({ propertyIdx: i, chargeId: charge.id, month: m });
      chargesCreated++;
    }
  }
  console.log(`  ${chargesCreated} charges created (${allChargeIds.length} total)`);

  // 6. Mark ~80% as paid (first 44 properties)
  let paymentsCreated = 0;
  for (const entry of allChargeIds) {
    if (entry.propertyIdx >= PAID_PROPERTY_COUNT) continue;

    const month = MONTHS[entry.month];
    const payDate = month.start.replace(/-01$/, '-05');

    const [existingPayment] = await sql`
      SELECT pa.id FROM payment_applications pa
      WHERE pa.charge_id = ${entry.chargeId}
    `;
    if (existingPayment) continue;

    const [payment] = await sql`
      INSERT INTO payments (
        tenant_id, member_id, amount, payment_method,
        status, payment_date, reference_number
      ) VALUES (
        ${tenantId}, ${memberIds[entry.propertyIdx]}, ${MONTHLY_AMOUNT}, 'ach',
        'succeeded', ${payDate}, ${'SEED-' + entry.chargeId.slice(0, 8)}
      )
      RETURNING id
    `;

    await sql`
      INSERT INTO payment_applications (tenant_id, payment_id, charge_id, amount_applied)
      VALUES (${tenantId}, ${payment.id}, ${entry.chargeId}, ${MONTHLY_AMOUNT})
    `;

    await sql`
      UPDATE charges
      SET balance_remaining = '0.00', status = 'paid', updated_at = now()
      WHERE id = ${entry.chargeId}
    `;

    paymentsCreated++;
  }
  console.log(`  ${paymentsCreated} payments created (properties 1–${PAID_PROPERTY_COUNT})`);
  console.log(`  ${TOTAL_PROPERTIES - PAID_PROPERTY_COUNT} properties remain unpaid across ${MONTHS.length} months`);

  console.log('Done.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
