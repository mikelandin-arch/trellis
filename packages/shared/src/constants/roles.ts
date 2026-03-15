export const CLERK_ROLES = {
  SUPER_ADMIN: 'org:super_admin',
  BOARD_OFFICER: 'org:board_officer',
  BOARD_MEMBER: 'org:board_member',
  PROPERTY_MANAGER: 'org:property_manager',
  COMMITTEE_MEMBER: 'org:committee_member',
  HOMEOWNER: 'org:homeowner',
  VENDOR: 'org:vendor',
} as const;
export type ClerkRole = (typeof CLERK_ROLES)[keyof typeof CLERK_ROLES];
