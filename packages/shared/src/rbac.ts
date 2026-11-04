import type { Role } from './constants';

export const PERMISSIONS = [
  'roles.assign', 'students.read', 'catalogue.write', 'questions.write', 'questions.review', 'questions.publish',
  'tests.write', 'tests.publish', 'resources.write', 'pricing.write', 'coupons.write', 'payments.read', 'analytics.read',
  'leads.read', 'leads.write', 'support.read', 'support.write', 'audit.read', 'settings.write',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  super_admin: ALL.filter((p) => p !== 'roles.assign'),
  admin: ['students.read', 'catalogue.write', 'questions.write', 'questions.review', 'questions.publish', 'tests.write', 'tests.publish', 'resources.write', 'payments.read', 'analytics.read', 'leads.read', 'leads.write', 'support.read', 'support.write'],
  content_editor: ['catalogue.write', 'questions.write', 'tests.write', 'resources.write'],
  subject_reviewer: ['questions.review'],
  support_agent: ['students.read', 'support.read', 'support.write'],
  analyst: ['analytics.read', 'payments.read', 'leads.read'],
};
export function can(role: Role | undefined | null, p: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role]?.includes(p) === true;
}
/** Who may assign which role. Nobody can assign a role equal to or above their own except the owner. */
const RANK: Record<Role, number> = { owner: 7, super_admin: 6, admin: 5, content_editor: 3, subject_reviewer: 3, support_agent: 2, analyst: 2 };
export function canAssign(actor: Role | undefined | null, target: Role | null): boolean {
  if (!actor || !can(actor, 'roles.assign')) return false;
  if (target === 'owner') return false; // the owner role is bootstrapped out-of-band only
  return target === null || RANK[actor] > RANK[target];
}

/** Publication workflow: Draft -> Review -> Approved -> Published. Backwards moves allowed only to Draft. */
export const TRANSITIONS: Record<string, { to: string; needs: Permission }[]> = {
  draft: [{ to: 'review', needs: 'questions.write' }],
  review: [{ to: 'approved', needs: 'questions.review' }, { to: 'draft', needs: 'questions.review' }],
  approved: [{ to: 'published', needs: 'questions.publish' }, { to: 'draft', needs: 'questions.review' }],
  published: [{ to: 'draft', needs: 'questions.publish' }],
};
export function canTransition(role: Role | undefined | null, from: string, to: string): boolean {
  const t = TRANSITIONS[from]?.find((x) => x.to === to);
  return !!t && can(role, t.needs);
}
