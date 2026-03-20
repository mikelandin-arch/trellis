import postgres from 'postgres';

const sql = postgres('postgresql://trellis_admin:TrellisDevDB2026!@localhost:15432/trellis', { ssl: 'require' });

interface ModTypeDef {
  name: string;
  complexityTier: number;
  requiresSiteVisit: boolean;
  defaultReviewDays: number;
  requiredDocuments: string[];
  feeAmount: number | null;
  sortOrder: number;
}

const MODIFICATION_TYPES: ModTypeDef[] = [
  // Tier 1 — Fast Track (14-day review)
  { name: 'Paint color change', complexityTier: 1, requiresSiteVisit: false, defaultReviewDays: 14, requiredDocuments: ['Color sample or manufacturer code'], feeAmount: null, sortOrder: 10 },
  { name: 'Landscaping changes', complexityTier: 1, requiresSiteVisit: false, defaultReviewDays: 14, requiredDocuments: ['Landscape plan or sketch'], feeAmount: null, sortOrder: 11 },
  { name: 'Mailbox replacement', complexityTier: 1, requiresSiteVisit: false, defaultReviewDays: 14, requiredDocuments: ['Mailbox model/style description'], feeAmount: null, sortOrder: 12 },
  { name: 'Window covering', complexityTier: 1, requiresSiteVisit: false, defaultReviewDays: 14, requiredDocuments: [], feeAmount: null, sortOrder: 13 },
  { name: 'Solar panel installation', complexityTier: 1, requiresSiteVisit: false, defaultReviewDays: 14, requiredDocuments: ['Site plan with panel placement', 'Equipment specifications', 'Licensed contractor information'], feeAmount: null, sortOrder: 14 },
  { name: 'Satellite dish installation', complexityTier: 1, requiresSiteVisit: false, defaultReviewDays: 14, requiredDocuments: ['Proposed location diagram'], feeAmount: null, sortOrder: 15 },
  { name: 'EV charger installation', complexityTier: 1, requiresSiteVisit: false, defaultReviewDays: 14, requiredDocuments: ['Charger specifications', 'Licensed electrician information', 'Proof of insurance'], feeAmount: null, sortOrder: 16 },
  { name: 'Flag display', complexityTier: 1, requiresSiteVisit: false, defaultReviewDays: 14, requiredDocuments: [], feeAmount: null, sortOrder: 17 },

  // Tier 2 — Standard (30-day review)
  { name: 'Fence install or replacement', complexityTier: 2, requiresSiteVisit: false, defaultReviewDays: 30, requiredDocuments: ['Site plan with fence layout', 'Material and style description', 'Neighbor notification form'], feeAmount: 25.00, sortOrder: 20 },
  { name: 'Deck or patio', complexityTier: 2, requiresSiteVisit: false, defaultReviewDays: 30, requiredDocuments: ['Site plan with dimensions', 'Material specifications', 'Building permit (if required)'], feeAmount: 50.00, sortOrder: 21 },
  { name: 'Exterior lighting', complexityTier: 2, requiresSiteVisit: false, defaultReviewDays: 30, requiredDocuments: ['Fixture specifications', 'Placement diagram'], feeAmount: null, sortOrder: 22 },
  { name: 'Driveway modification', complexityTier: 2, requiresSiteVisit: false, defaultReviewDays: 30, requiredDocuments: ['Site plan', 'Material description', 'Contractor information'], feeAmount: 25.00, sortOrder: 23 },
  { name: 'Roof replacement', complexityTier: 2, requiresSiteVisit: false, defaultReviewDays: 30, requiredDocuments: ['Material type and color', 'Licensed contractor information'], feeAmount: null, sortOrder: 24 },
  { name: 'Gutter and downspout', complexityTier: 2, requiresSiteVisit: false, defaultReviewDays: 30, requiredDocuments: ['Material and color description'], feeAmount: null, sortOrder: 25 },

  // Tier 3 — Complex (45-day review, requires site visit)
  { name: 'Room addition', complexityTier: 3, requiresSiteVisit: true, defaultReviewDays: 45, requiredDocuments: ['Architectural drawings', 'Building permit', 'Licensed contractor information', 'Site plan', 'Engineering report'], feeAmount: 200.00, sortOrder: 30 },
  { name: 'Accessory dwelling unit (ADU)', complexityTier: 3, requiresSiteVisit: true, defaultReviewDays: 45, requiredDocuments: ['Architectural drawings', 'Building permit', 'Site plan', 'Utility connection plan', 'Licensed contractor information'], feeAmount: 250.00, sortOrder: 31 },
  { name: 'Pool or spa installation', complexityTier: 3, requiresSiteVisit: true, defaultReviewDays: 45, requiredDocuments: ['Site plan with setbacks', 'Fencing plan', 'Building permit', 'Licensed contractor information'], feeAmount: 150.00, sortOrder: 32 },
  { name: 'Retaining wall', complexityTier: 3, requiresSiteVisit: true, defaultReviewDays: 45, requiredDocuments: ['Engineering report', 'Site plan', 'Material specifications', 'Building permit (if >4ft)'], feeAmount: 100.00, sortOrder: 33 },
  { name: 'Major landscaping overhaul', complexityTier: 3, requiresSiteVisit: true, defaultReviewDays: 45, requiredDocuments: ['Professional landscape plan', 'Plant species list', 'Irrigation plan'], feeAmount: 75.00, sortOrder: 34 },
  { name: 'Tree removal', complexityTier: 3, requiresSiteVisit: true, defaultReviewDays: 45, requiredDocuments: ['Arborist report', 'Replacement planting plan', 'City permit (if required)'], feeAmount: 50.00, sortOrder: 35 },
];

async function seed(): Promise<void> {
  console.log('Seeding ARC modification types for Talasera HOA...');

  const clerkOrgId = 'org_3B0ke05kRyhNKSjphKtcJyycHcd';
  const [tenant] = await sql`SELECT id FROM tenants WHERE clerk_org_id = ${clerkOrgId}`;
  if (!tenant) {
    console.error('Talasera tenant not found. Run seed-talasera.ts first.');
    process.exit(1);
  }
  const tenantId: number = tenant.id;
  console.log(`  tenant id=${tenantId}`);

  let count = 0;

  for (const mt of MODIFICATION_TYPES) {
    const [row] = await sql`
      INSERT INTO arc_modification_types (
        tenant_id, name, complexity_tier, requires_site_visit,
        default_review_days, required_documents, fee_amount, sort_order
      ) VALUES (
        ${tenantId}, ${mt.name}, ${mt.complexityTier}, ${mt.requiresSiteVisit},
        ${mt.defaultReviewDays}, ${mt.requiredDocuments}, ${mt.feeAmount},
        ${mt.sortOrder}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (row) count++;
  }

  console.log(`  ${count} modification types created`);
  console.log(`  Tier 1 (Fast Track): ${MODIFICATION_TYPES.filter((t) => t.complexityTier === 1).length} types`);
  console.log(`  Tier 2 (Standard):   ${MODIFICATION_TYPES.filter((t) => t.complexityTier === 2).length} types`);
  console.log(`  Tier 3 (Complex):    ${MODIFICATION_TYPES.filter((t) => t.complexityTier === 3).length} types`);
  console.log('Done.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
