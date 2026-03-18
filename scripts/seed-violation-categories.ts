import postgres from 'postgres';

const sql = postgres('postgresql://trellis_admin:TrellisDevDB2026!@localhost:15432/trellis', { ssl: 'require' });

interface CategoryDef {
  name: string;
  description: string;
  defaultSeverity: string;
  defaultCureDays: number;
  defaultFineAmount: number | null;
  governingDocSection: string | null;
  children: Omit<CategoryDef, 'children'>[];
}

const CATEGORIES: CategoryDef[] = [
  {
    name: 'Landscaping',
    description: 'Yard maintenance and landscaping violations',
    defaultSeverity: 'minor',
    defaultCureDays: 14,
    defaultFineAmount: null,
    governingDocSection: 'CC&R Art. 6.1',
    children: [
      { name: 'Overgrown vegetation', description: 'Grass, hedges, or plants exceeding height limits', defaultSeverity: 'minor', defaultCureDays: 14, defaultFineAmount: null, governingDocSection: 'CC&R Art. 6.1(a)' },
      { name: 'Dead plants', description: 'Dead or dying landscaping requiring removal or replacement', defaultSeverity: 'minor', defaultCureDays: 21, defaultFineAmount: null, governingDocSection: 'CC&R Art. 6.1(b)' },
      { name: 'Unapproved modifications', description: 'Landscaping changes without ARC approval', defaultSeverity: 'moderate', defaultCureDays: 30, defaultFineAmount: 50.00, governingDocSection: 'CC&R Art. 6.1(c)' },
      { name: 'Weed control', description: 'Excessive weeds in yard, walkways, or common boundaries', defaultSeverity: 'minor', defaultCureDays: 14, defaultFineAmount: null, governingDocSection: 'CC&R Art. 6.1(d)' },
    ],
  },
  {
    name: 'Parking',
    description: 'Vehicle and parking violations',
    defaultSeverity: 'moderate',
    defaultCureDays: 7,
    defaultFineAmount: 50.00,
    governingDocSection: 'CC&R Art. 7.3',
    children: [
      { name: 'Street parking', description: 'Overnight or extended street parking in restricted areas', defaultSeverity: 'minor', defaultCureDays: 3, defaultFineAmount: 25.00, governingDocSection: 'CC&R Art. 7.3(a)' },
      { name: 'Commercial vehicles', description: 'Commercial vehicles parked in residential areas', defaultSeverity: 'moderate', defaultCureDays: 7, defaultFineAmount: 50.00, governingDocSection: 'CC&R Art. 7.3(b)' },
      { name: 'Inoperable vehicles', description: 'Non-running vehicles visible from street or neighbors', defaultSeverity: 'major', defaultCureDays: 14, defaultFineAmount: 75.00, governingDocSection: 'CC&R Art. 7.3(c)' },
      { name: 'Garage conversion', description: 'Garage used for non-vehicle purposes preventing parking', defaultSeverity: 'moderate', defaultCureDays: 30, defaultFineAmount: 50.00, governingDocSection: 'CC&R Art. 7.3(d)' },
    ],
  },
  {
    name: 'Exterior Maintenance',
    description: 'Home exterior upkeep and repair violations',
    defaultSeverity: 'moderate',
    defaultCureDays: 30,
    defaultFineAmount: null,
    governingDocSection: 'CC&R Art. 5.2',
    children: [
      { name: 'Paint/siding', description: 'Peeling, faded, or unapproved paint or siding damage', defaultSeverity: 'moderate', defaultCureDays: 30, defaultFineAmount: null, governingDocSection: 'CC&R Art. 5.2(a)' },
      { name: 'Roof condition', description: 'Damaged, missing, or deteriorating roofing materials', defaultSeverity: 'major', defaultCureDays: 30, defaultFineAmount: null, governingDocSection: 'CC&R Art. 5.2(b)' },
      { name: 'Fencing', description: 'Damaged, leaning, or unapproved fencing', defaultSeverity: 'moderate', defaultCureDays: 21, defaultFineAmount: null, governingDocSection: 'CC&R Art. 5.2(c)' },
      { name: 'Windows/doors', description: 'Broken windows, damaged doors, or missing screens', defaultSeverity: 'moderate', defaultCureDays: 14, defaultFineAmount: null, governingDocSection: 'CC&R Art. 5.2(d)' },
    ],
  },
  {
    name: 'Holiday Decorations',
    description: 'Seasonal and holiday decoration violations',
    defaultSeverity: 'minor',
    defaultCureDays: 7,
    defaultFineAmount: null,
    governingDocSection: 'CC&R Art. 5.5',
    children: [
      { name: 'Timing violations', description: 'Decorations displayed outside allowed date range', defaultSeverity: 'minor', defaultCureDays: 7, defaultFineAmount: null, governingDocSection: 'CC&R Art. 5.5(a)' },
      { name: 'Size/placement', description: 'Decorations exceeding size limits or placed in restricted areas', defaultSeverity: 'minor', defaultCureDays: 7, defaultFineAmount: null, governingDocSection: 'CC&R Art. 5.5(b)' },
    ],
  },
  {
    name: 'Noise',
    description: 'Noise-related disturbance violations',
    defaultSeverity: 'moderate',
    defaultCureDays: 1,
    defaultFineAmount: 50.00,
    governingDocSection: 'CC&R Art. 8.1',
    children: [
      { name: 'Excessive noise', description: 'Loud music, parties, or disturbances during quiet hours', defaultSeverity: 'moderate', defaultCureDays: 1, defaultFineAmount: 50.00, governingDocSection: 'CC&R Art. 8.1(a)' },
      { name: 'Construction hours', description: 'Construction or loud work outside permitted hours', defaultSeverity: 'moderate', defaultCureDays: 1, defaultFineAmount: 50.00, governingDocSection: 'CC&R Art. 8.1(b)' },
    ],
  },
  {
    name: 'Trash/Debris',
    description: 'Waste management and cleanliness violations',
    defaultSeverity: 'minor',
    defaultCureDays: 3,
    defaultFineAmount: 25.00,
    governingDocSection: 'CC&R Art. 6.4',
    children: [
      { name: 'Visible trash', description: 'Trash, litter, or refuse visible from street or common areas', defaultSeverity: 'minor', defaultCureDays: 3, defaultFineAmount: 25.00, governingDocSection: 'CC&R Art. 6.4(a)' },
      { name: 'Bin storage', description: 'Trash bins left out past collection day or stored visibly', defaultSeverity: 'minor', defaultCureDays: 1, defaultFineAmount: null, governingDocSection: 'CC&R Art. 6.4(b)' },
    ],
  },
  {
    name: 'Unauthorized Structures',
    description: 'Unapproved construction or structural modifications',
    defaultSeverity: 'major',
    defaultCureDays: 30,
    defaultFineAmount: 100.00,
    governingDocSection: 'CC&R Art. 4.1',
    children: [
      { name: 'Sheds', description: 'Unapproved storage sheds or outbuildings', defaultSeverity: 'major', defaultCureDays: 30, defaultFineAmount: 100.00, governingDocSection: 'CC&R Art. 4.1(a)' },
      { name: 'Fences', description: 'Unapproved fence installation or modification', defaultSeverity: 'moderate', defaultCureDays: 30, defaultFineAmount: 75.00, governingDocSection: 'CC&R Art. 4.1(b)' },
      { name: 'Additions', description: 'Structural additions or room extensions without approval', defaultSeverity: 'health_safety', defaultCureDays: 30, defaultFineAmount: 200.00, governingDocSection: 'CC&R Art. 4.1(c)' },
    ],
  },
  {
    name: 'Pet Violations',
    description: 'Pet-related community rule violations',
    defaultSeverity: 'moderate',
    defaultCureDays: 7,
    defaultFineAmount: 50.00,
    governingDocSection: 'CC&R Art. 9.2',
    children: [
      { name: 'Leash', description: 'Pets off-leash in common areas or outside property', defaultSeverity: 'moderate', defaultCureDays: 1, defaultFineAmount: 50.00, governingDocSection: 'CC&R Art. 9.2(a)' },
      { name: 'Waste', description: 'Failure to clean up pet waste in common areas', defaultSeverity: 'minor', defaultCureDays: 1, defaultFineAmount: 25.00, governingDocSection: 'CC&R Art. 9.2(b)' },
      { name: 'Aggressive behavior', description: 'Pet exhibiting aggressive behavior toward residents or other animals', defaultSeverity: 'health_safety', defaultCureDays: 1, defaultFineAmount: 100.00, governingDocSection: 'CC&R Art. 9.2(c)' },
      { name: 'Unapproved animals', description: 'Pets exceeding count or breed restrictions', defaultSeverity: 'major', defaultCureDays: 14, defaultFineAmount: 75.00, governingDocSection: 'CC&R Art. 9.2(d)' },
    ],
  },
];

async function seed(): Promise<void> {
  console.log('Seeding violation categories for Talasera HOA...');

  const clerkOrgId = 'org_3B0ke05kRyhNKSjphKtcJyycHcd';
  const [tenant] = await sql`SELECT id FROM tenants WHERE clerk_org_id = ${clerkOrgId}`;
  if (!tenant) {
    console.error('Talasera tenant not found. Run seed-talasera.ts first.');
    process.exit(1);
  }
  const tenantId: number = tenant.id;
  console.log(`  tenant id=${tenantId}`);

  let parentCount = 0;
  let childCount = 0;

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i]!;

    const [parentRow] = await sql`
      INSERT INTO violation_categories (
        tenant_id, parent_id, name, description,
        default_severity, default_cure_days, default_fine_amount,
        governing_doc_section, sort_order
      ) VALUES (
        ${tenantId}, NULL, ${cat.name}, ${cat.description},
        ${cat.defaultSeverity}, ${cat.defaultCureDays},
        ${cat.defaultFineAmount}, ${cat.governingDocSection},
        ${(i + 1) * 10}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    const parentId: string = parentRow?.id
      ?? (await sql`
        SELECT id FROM violation_categories
        WHERE tenant_id = ${tenantId} AND name = ${cat.name} AND parent_id IS NULL
      `)[0]?.id;

    if (parentRow) parentCount++;

    for (let j = 0; j < cat.children.length; j++) {
      const child = cat.children[j]!;
      const [childRow] = await sql`
        INSERT INTO violation_categories (
          tenant_id, parent_id, name, description,
          default_severity, default_cure_days, default_fine_amount,
          governing_doc_section, sort_order
        ) VALUES (
          ${tenantId}, ${parentId}, ${child.name}, ${child.description},
          ${child.defaultSeverity}, ${child.defaultCureDays},
          ${child.defaultFineAmount}, ${child.governingDocSection},
          ${(i + 1) * 10 + j + 1}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      if (childRow) childCount++;
    }
  }

  console.log(`  ${parentCount} parent categories created`);
  console.log(`  ${childCount} subcategories created`);
  console.log('Done.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
