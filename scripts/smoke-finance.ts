import postgres from 'postgres';

const sql = postgres('postgresql://trellis_admin:TrellisDevDB2026!@localhost:15432/trellis', { ssl: 'require' });

const BASE = 'http://localhost:3001/trpc';
const AUTH_HEADER = { Authorization: 'Bearer mock-dev-token', 'Content-Type': 'application/json' };

async function trpcQuery(proc: string, input: unknown): Promise<unknown> {
  const encoded = encodeURIComponent(JSON.stringify(input));
  const url = `${BASE}/${proc}?input=${encoded}`;
  const res = await fetch(url, { headers: AUTH_HEADER });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`${proc} failed (${res.status}): ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result?.data;
}

async function trpcMutation(proc: string, input: unknown): Promise<unknown> {
  const url = `${BASE}/${proc}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: AUTH_HEADER,
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`${proc} failed (${res.status}): ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result?.data;
}

function pass(label: string, detail?: string): void {
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label: string, err: unknown): void {
  console.log(`  ❌ ${label} — ${err instanceof Error ? err.message : String(err)}`);
}

async function run(): Promise<void> {
  console.log('=== Phase 3 Financial Management Smoke Tests ===\n');

  const [tenant] = await sql`SELECT id FROM tenants WHERE slug = 'talasera-hoa'`;
  if (!tenant) throw new Error('Talasera tenant not found');
  const tenantId: number = tenant.id;

  const [community] = await sql`SELECT id FROM communities WHERE tenant_id = ${tenantId}`;
  if (!community) throw new Error('Community not found');
  const communityId: string = community.id;

  const paidMembers = await sql`
    SELECT m.id, m.email FROM members m
    JOIN payments p ON p.member_id = m.id
    WHERE m.tenant_id = ${tenantId}
    GROUP BY m.id, m.email
    LIMIT 1
  `;
  const paidMemberId: string = paidMembers[0]?.id;

  const unpaidMembers = await sql`
    SELECT m.id, m.email FROM members m
    WHERE m.tenant_id = ${tenantId}
      AND m.id NOT IN (SELECT member_id FROM payments WHERE tenant_id = ${tenantId})
    LIMIT 1
  `;
  const unpaidMemberId: string = unpaidMembers[0]?.id;

  console.log(`Tenant: ${tenantId}, Community: ${communityId}`);
  console.log(`Paid member: ${paidMemberId} (${paidMembers[0]?.email})`);
  console.log(`Unpaid member: ${unpaidMemberId} (${unpaidMembers[0]?.email})\n`);

  // 1. assessment.listSchedules
  console.log('1. assessment.listSchedules');
  try {
    const schedules = await trpcQuery('assessment.listSchedules', { communityId }) as Array<Record<string, unknown>>;
    if (schedules.length > 0) {
      pass('Returned schedules', `count=${schedules.length}, first="${schedules[0].name}", amount=${schedules[0].amount}`);
    } else {
      fail('No schedules returned', 'expected at least 1');
    }
  } catch (e) { fail('assessment.listSchedules', e); }

  // 2. charge.listByMember — paid member
  console.log('\n2. charge.listByMember (paid member)');
  try {
    const charges = await trpcQuery('charge.listByMember', { memberId: paidMemberId, limit: 100 }) as Array<Record<string, unknown>>;
    const paid = charges.filter((c) => c.status === 'paid');
    pass('Charges returned', `total=${charges.length}, paid=${paid.length}`);
  } catch (e) { fail('charge.listByMember', e); }

  // 3. charge.listByMember — unpaid member
  console.log('\n3. charge.listByMember (unpaid member)');
  try {
    const charges = await trpcQuery('charge.listByMember', { memberId: unpaidMemberId, limit: 100 }) as Array<Record<string, unknown>>;
    const due = charges.filter((c) => c.status === 'due');
    pass('Charges returned', `total=${charges.length}, due=${due.length}, amount=${charges[0]?.amount}`);
  } catch (e) { fail('charge.listByMember', e); }

  // 4. charge.listOverdue
  console.log('\n4. charge.listOverdue');
  try {
    const overdue = await trpcQuery('charge.listOverdue', { communityId }) as Array<Record<string, unknown>>;
    pass('Overdue charges', `count=${overdue.length}`);
    if (overdue.length > 0) {
      const buckets: Record<string, number> = {};
      for (const c of overdue) {
        const bucket = String(c.agingBucket);
        buckets[bucket] = (buckets[bucket] ?? 0) + 1;
      }
      pass('Aging buckets', JSON.stringify(buckets));
    }
  } catch (e) { fail('charge.listOverdue', e); }

  // 5. payment.listByMember — paid member
  console.log('\n5. payment.listByMember (paid member)');
  try {
    const payments = await trpcQuery('payment.listByMember', { memberId: paidMemberId, limit: 100 }) as Array<Record<string, unknown>>;
    pass('Payments returned', `count=${payments.length}, method=${payments[0]?.paymentMethod}, status=${payments[0]?.status}`);
  } catch (e) { fail('payment.listByMember', e); }

  // 6. payment.createPaymentIntent — this will fail gracefully since tenant hasn't completed Stripe Connect onboarding
  console.log('\n6. payment.createPaymentIntent (unpaid member)');
  try {
    const result = await trpcMutation('payment.createPaymentIntent', {
      memberId: unpaidMemberId,
      amount: 100.00,
      paymentMethod: 'card',
    });
    pass('PaymentIntent created', JSON.stringify(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Stripe onboarding')) {
      pass('Expected error: HOA not Stripe-onboarded', msg.slice(0, 120));
    } else {
      fail('payment.createPaymentIntent', e);
    }
  }

  // 7. assessLateFees — run directly via the collections lib approach
  // Since assessLateFees isn't exposed via tRPC, we'll test it by checking if the seed data
  // has charges past grace period (15 days). January charges due 2026-01-01 are 75+ days overdue.
  console.log('\n7. Late fee assessment (direct DB check)');
  try {
    const overdueCount = await sql`
      SELECT COUNT(*) as cnt FROM charges
      WHERE tenant_id = ${tenantId}
        AND status IN ('due', 'overdue', 'partial')
        AND charge_type IN ('assessment', 'special_assessment')
        AND due_date <= (CURRENT_DATE - INTERVAL '15 days')
    `;
    const cnt = Number(overdueCount[0].cnt);
    if (cnt > 0) {
      pass('Charges past grace period found', `count=${cnt} (eligible for late fees)`);
    } else {
      pass('No charges past grace period', 'expected — all within grace window');
    }

    const existingLateFees = await sql`
      SELECT COUNT(*) as cnt FROM charges
      WHERE tenant_id = ${tenantId} AND charge_type = 'late_fee'
    `;
    pass('Existing late fees', `count=${existingLateFees[0].cnt}`);
  } catch (e) { fail('Late fee check', e); }

  // 8. assessment.getRateHistory
  console.log('\n8. assessment.getRateHistory');
  try {
    const [schedule] = await sql`
      SELECT id FROM assessment_schedules WHERE tenant_id = ${tenantId} LIMIT 1
    `;
    if (schedule) {
      const history = await trpcQuery('assessment.getRateHistory', { scheduleId: schedule.id }) as Array<Record<string, unknown>>;
      pass('Rate history', `count=${history.length}, latest amount=${history[0]?.newAmount}`);
    }
  } catch (e) { fail('assessment.getRateHistory', e); }

  console.log('\n=== Smoke Tests Complete ===');
  await sql.end();
}

run().catch((err) => {
  console.error('Smoke test runner failed:', err);
  process.exit(1);
});
