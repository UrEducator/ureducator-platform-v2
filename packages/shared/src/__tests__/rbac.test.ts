import { describe, expect, it } from 'vitest';
import { ROLES } from '../constants';
import { can, canAssign, canTransition } from '../rbac';

describe('rbac', () => {
  it('only the owner can assign roles and nobody can assign owner', () => {
    expect(canAssign('owner', 'admin')).toBe(true);
    expect(canAssign('owner', 'owner')).toBe(false);
    for (const role of ROLES.filter((r) => r !== 'owner')) expect(canAssign(role, 'analyst')).toBe(false);
    expect(canAssign(undefined, 'admin')).toBe(false);
  });
  it('enforces the publication workflow draft -> review -> approved -> published', () => {
    expect(canTransition('content_editor', 'draft', 'review')).toBe(true);
    expect(canTransition('content_editor', 'review', 'approved')).toBe(false);
    expect(canTransition('subject_reviewer', 'review', 'approved')).toBe(true);
    expect(canTransition('subject_reviewer', 'approved', 'published')).toBe(false);
    expect(canTransition('admin', 'approved', 'published')).toBe(true);
    expect(canTransition('admin', 'draft', 'published')).toBe(false);
    expect(canTransition('support_agent', 'draft', 'review')).toBe(false);
    expect(canTransition(undefined, 'draft', 'review')).toBe(false);
  });
  it('support agents and analysts cannot write content', () => {
    expect(can('support_agent', 'questions.write')).toBe(false);
    expect(can('analyst', 'tests.publish')).toBe(false);
    expect(can('analyst', 'analytics.read')).toBe(true);
  });
});
