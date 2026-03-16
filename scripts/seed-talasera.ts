import postgres from 'postgres';

const sql = postgres('postgresql://trellis_admin:TrellisDevDB2026!@localhost:15432/trellis', { ssl: 'require' });

async function seed(): Promise<void> {
  console.log('Seeding Talasera HOA data…');

  // 1. Tenant
  const clerkOrgId = 'org_3B0ke05kRyhNKSjphKtcJyycHcd';
  const [tenantRow] = await sql`
    INSERT INTO tenants (clerk_org_id, name, slug, status, plan_tier)
    VALUES (${clerkOrgId}, 'Talasera HOA', 'talasera-hoa', 'active', 'starter')
    ON CONFLICT (clerk_org_id) DO NOTHING
    RETURNING id
  `;
  const tenantId: number = tenantRow?.id
    ?? (await sql`SELECT id FROM tenants WHERE clerk_org_id = ${clerkOrgId}`)[0].id;
  console.log(`  tenant  id=${tenantId}`);

  // 2. User
  const clerkUserId = 'user_3B0lenUBBFeWFai0wg1f6G6fxRk';
  const [userRow] = await sql`
    INSERT INTO users (clerk_user_id, email, display_name)
    VALUES (${clerkUserId}, 'michaellzorn@gmail.com', 'Michael Zorn')
    ON CONFLICT (clerk_user_id) DO NOTHING
    RETURNING id
  `;
  const userId: string = userRow?.id
    ?? (await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId}`)[0].id;
  console.log(`  user    id=${userId}`);

  // 3. Tenant membership
  await sql`
    INSERT INTO tenant_memberships (tenant_id, user_id, role)
    VALUES (${tenantId}, ${userId}, 'board_president')
    ON CONFLICT (tenant_id, user_id) DO NOTHING
  `;
  console.log('  tenant_membership created');

  // 4. Community
  const [communityRow] = await sql`
    INSERT INTO communities (
      tenant_id, name, address_line1, city, state_code, zip,
      community_type, total_units, fiscal_year_start_month
    ) VALUES (
      ${tenantId}, 'Talasera', '12000 Talasera Ln', 'Bothell', 'WA', '98011',
      'hoa', 55, 1
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  const communityId: string = communityRow?.id
    ?? (await sql`
      SELECT id FROM communities
      WHERE tenant_id = ${tenantId} AND name = 'Talasera'
    `)[0].id;
  console.log(`  community id=${communityId}`);

  // 5. Properties (55 lots)
  const propertyValues = Array.from({ length: 55 }, (_, i) => ({
    tenant_id: tenantId,
    community_id: communityId,
    lot_number: String(i + 1),
    address_line1: `${12001 + i} Talasera Ln`,
    city: 'Bothell',
    state_code: 'WA',
    zip: '98011',
    status: 'active',
    voting_weight: 1.0,
  }));

  for (const p of propertyValues) {
    await sql`
      INSERT INTO properties (
        tenant_id, community_id, lot_number, address_line1,
        city, state_code, zip, status, voting_weight
      ) VALUES (
        ${p.tenant_id}, ${p.community_id}, ${p.lot_number}, ${p.address_line1},
        ${p.city}, ${p.state_code}, ${p.zip}, ${p.status}, ${p.voting_weight}
      )
      ON CONFLICT (tenant_id, community_id, lot_number) DO NOTHING
    `;
  }
  console.log('  55 properties created');

  // 6. Washington State compliance profile (state-scope, tenant_id NULL)
  await sql`
    INSERT INTO compliance_profiles (
      tenant_id, scope, state_code, cure_period_days, hearing_notice_days,
      enforcement_retention_years, financial_retention_years,
      daily_fine_permitted, certified_mail_required
    )
    SELECT
      NULL, 'state', 'WA', 30, 14, 7, 7, true, false
    WHERE NOT EXISTS (
      SELECT 1 FROM compliance_profiles
      WHERE scope = 'state' AND state_code = 'WA' AND tenant_id IS NULL
    )
  `;
  console.log('  WA compliance profile created');

  console.log('Done.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
