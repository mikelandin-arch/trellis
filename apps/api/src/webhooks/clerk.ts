import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Webhook } from 'svix';
import { eq, and } from 'drizzle-orm';
import { adminDb, tenants, users, tenantMemberships } from '@repo/db';

// ---------------------------------------------------------------------------
// Clerk webhook event payload types (minimal shapes for the events we handle)
// ---------------------------------------------------------------------------

interface OrganizationEventData {
  id: string;
  name: string;
  slug: string;
}

interface PublicUserData {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  identifier: string;
}

interface MembershipEventData {
  organization: { id: string };
  public_user_data: PublicUserData;
  role: string;
}

interface UserEmailAddress {
  id: string;
  email_address: string;
}

interface UserPhoneNumber {
  id: string;
  phone_number: string;
}

interface UserEventData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email_addresses: UserEmailAddress[];
  primary_email_address_id: string | null;
  phone_numbers: UserPhoneNumber[];
  primary_phone_number_id: string | null;
}

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Clerk role -> DB role mapping
// ---------------------------------------------------------------------------

const CLERK_ROLE_TO_DB_ROLE: Readonly<Record<string, string>> = {
  'org:super_admin': 'super_admin',
  'org:board_officer': 'board_president',
  'org:board_member': 'board_member',
  'org:property_manager': 'community_manager',
  'org:committee_member': 'committee_member',
  'org:homeowner': 'homeowner',
  'org:vendor': 'vendor',
  'org:admin': 'super_admin',
  'org:member': 'homeowner',
} as const;

function mapClerkRole(clerkRole: string): string {
  return CLERK_ROLE_TO_DB_ROLE[clerkRole] ?? 'homeowner';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDisplayName(
  firstName: string | null,
  lastName: string | null,
  fallback: string,
): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : fallback;
}

function resolvePrimaryEmail(data: UserEventData): string {
  if (data.primary_email_address_id) {
    const match = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );
    if (match) return match.email_address;
  }
  return data.email_addresses[0]?.email_address ?? '';
}

function resolvePrimaryPhone(data: UserEventData): string | null {
  if (data.primary_phone_number_id) {
    const match = data.phone_numbers.find(
      (p) => p.id === data.primary_phone_number_id,
    );
    if (match) return match.phone_number;
  }
  return data.phone_numbers[0]?.phone_number ?? null;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleOrganizationCreated(
  data: OrganizationEventData,
  log: FastifyRequest['log'],
): Promise<void> {
  await adminDb
    .insert(tenants)
    .values({
      clerkOrgId: data.id,
      name: data.name,
      slug: data.slug,
      status: 'active',
    })
    .onConflictDoNothing({ target: tenants.clerkOrgId });

  log.info({ clerkOrgId: data.id }, 'Tenant created from organization.created');
}

async function handleOrganizationUpdated(
  data: OrganizationEventData,
  log: FastifyRequest['log'],
): Promise<void> {
  await adminDb
    .update(tenants)
    .set({
      name: data.name,
      slug: data.slug,
      updatedAt: new Date(),
    })
    .where(eq(tenants.clerkOrgId, data.id));

  log.info({ clerkOrgId: data.id }, 'Tenant updated from organization.updated');
}

async function upsertUserFromPublicData(
  userData: PublicUserData,
): Promise<string> {
  const email = userData.identifier;
  const displayName = buildDisplayName(
    userData.first_name,
    userData.last_name,
    email,
  );

  const [row] = await adminDb
    .insert(users)
    .values({
      clerkUserId: userData.user_id,
      email,
      displayName,
      avatarUrl: userData.image_url,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email,
        displayName,
        avatarUrl: userData.image_url,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  if (!row) {
    throw new Error(`Failed to upsert user ${userData.user_id}`);
  }
  return row.id;
}

async function resolveInternalTenantId(
  clerkOrgId: string,
): Promise<number | null> {
  const [row] = await adminDb
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.clerkOrgId, clerkOrgId))
    .limit(1);

  return row?.id ?? null;
}

async function handleMembershipCreated(
  data: MembershipEventData,
  log: FastifyRequest['log'],
): Promise<void> {
  const internalUserId = await upsertUserFromPublicData(data.public_user_data);

  const tenantId = await resolveInternalTenantId(data.organization.id);
  if (tenantId === null) {
    log.warn(
      { clerkOrgId: data.organization.id },
      'Tenant not found for membership.created — skipping',
    );
    return;
  }

  const dbRole = mapClerkRole(data.role);

  await adminDb
    .insert(tenantMemberships)
    .values({
      tenantId,
      userId: internalUserId,
      role: dbRole,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [tenantMemberships.tenantId, tenantMemberships.userId],
      set: {
        role: dbRole,
        isActive: true,
      },
    });

  log.info(
    { clerkOrgId: data.organization.id, clerkUserId: data.public_user_data.user_id, role: dbRole },
    'Membership created',
  );
}

async function handleMembershipUpdated(
  data: MembershipEventData,
  log: FastifyRequest['log'],
): Promise<void> {
  const tenantId = await resolveInternalTenantId(data.organization.id);
  if (tenantId === null) {
    log.warn(
      { clerkOrgId: data.organization.id },
      'Tenant not found for membership.updated — skipping',
    );
    return;
  }

  const [userRow] = await adminDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, data.public_user_data.user_id))
    .limit(1);

  if (!userRow) {
    log.warn(
      { clerkUserId: data.public_user_data.user_id },
      'User not found for membership.updated — skipping',
    );
    return;
  }

  const dbRole = mapClerkRole(data.role);

  await adminDb
    .update(tenantMemberships)
    .set({ role: dbRole })
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.userId, userRow.id),
      ),
    );

  log.info(
    { clerkOrgId: data.organization.id, clerkUserId: data.public_user_data.user_id, role: dbRole },
    'Membership role updated',
  );
}

async function handleMembershipDeleted(
  data: MembershipEventData,
  log: FastifyRequest['log'],
): Promise<void> {
  const tenantId = await resolveInternalTenantId(data.organization.id);
  if (tenantId === null) {
    log.warn(
      { clerkOrgId: data.organization.id },
      'Tenant not found for membership.deleted — skipping',
    );
    return;
  }

  const [userRow] = await adminDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, data.public_user_data.user_id))
    .limit(1);

  if (!userRow) {
    log.warn(
      { clerkUserId: data.public_user_data.user_id },
      'User not found for membership.deleted — skipping',
    );
    return;
  }

  await adminDb
    .update(tenantMemberships)
    .set({ isActive: false })
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.userId, userRow.id),
      ),
    );

  log.info(
    { clerkOrgId: data.organization.id, clerkUserId: data.public_user_data.user_id },
    'Membership deactivated',
  );
}

async function handleUserUpsert(
  data: UserEventData,
  log: FastifyRequest['log'],
): Promise<void> {
  const email = resolvePrimaryEmail(data);
  const phone = resolvePrimaryPhone(data);
  const displayName = buildDisplayName(data.first_name, data.last_name, email);

  await adminDb
    .insert(users)
    .values({
      clerkUserId: data.id,
      email,
      displayName,
      phone,
      avatarUrl: data.image_url,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email,
        displayName,
        phone,
        avatarUrl: data.image_url,
        updatedAt: new Date(),
      },
    });

  log.info({ clerkUserId: data.id }, 'User upserted');
}

// ---------------------------------------------------------------------------
// Fastify plugin (encapsulated — raw body parser scoped to this plugin only)
// ---------------------------------------------------------------------------

export async function clerkWebhookPlugin(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.post(
    '/webhooks/clerk',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      if (!webhookSecret) {
        req.log.error('CLERK_WEBHOOK_SECRET is not configured');
        return reply.code(500).send({ error: 'Webhook secret not configured' });
      }

      const svixId = req.headers['svix-id'] as string | undefined;
      const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
      const svixSignature = req.headers['svix-signature'] as string | undefined;

      if (!svixId || !svixTimestamp || !svixSignature) {
        return reply.code(400).send({ error: 'Missing Svix headers' });
      }

      const rawBody = req.body as string;

      let event: ClerkWebhookEvent;
      try {
        const wh = new Webhook(webhookSecret);
        event = wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as ClerkWebhookEvent;
      } catch (err) {
        req.log.warn({ err }, 'Clerk webhook signature verification failed');
        return reply.code(400).send({ error: 'Invalid signature' });
      }

      req.log.info(
        { eventType: event.type, svixId },
        'Processing Clerk webhook',
      );

      try {
        switch (event.type) {
          case 'organization.created':
            await handleOrganizationCreated(
              event.data as unknown as OrganizationEventData,
              req.log,
            );
            break;
          case 'organization.updated':
            await handleOrganizationUpdated(
              event.data as unknown as OrganizationEventData,
              req.log,
            );
            break;
          case 'organizationMembership.created':
            await handleMembershipCreated(
              event.data as unknown as MembershipEventData,
              req.log,
            );
            break;
          case 'organizationMembership.updated':
            await handleMembershipUpdated(
              event.data as unknown as MembershipEventData,
              req.log,
            );
            break;
          case 'organizationMembership.deleted':
            await handleMembershipDeleted(
              event.data as unknown as MembershipEventData,
              req.log,
            );
            break;
          case 'user.created':
          case 'user.updated':
            await handleUserUpsert(
              event.data as unknown as UserEventData,
              req.log,
            );
            break;
          default:
            req.log.info(
              { eventType: event.type },
              'Unhandled Clerk webhook event type',
            );
        }
      } catch (err) {
        req.log.error(
          { err, eventType: event.type },
          'Failed to process Clerk webhook',
        );
        return reply.code(500).send({ error: 'Internal processing error' });
      }

      return reply.code(200).send({ received: true });
    },
  );
}
