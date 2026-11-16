import { describe, expect, it } from 'vitest';
import {
  CATEGORY_MAP,
  generateTicketId,
  isTicketEscalationEligible,
  SmartTicketSchema,
  TICKET_DEPTS,
  TICKET_SEVERITIES,
  TICKET_STATUSES,
  ESCALATION_THRESHOLD_MS,
} from '../tickets';

describe('Phase Q: Smart Ticketing & Semantic Codes', () => {
  it('generates a valid Semantic Ticket ID matching [DEPT]-[SEVERITY]-[TYPE]-[4_DIGIT_HASH]', () => {
    const id1 = generateTicketId('PAY', 'L1', 'FAIL', '9021');
    expect(id1).toBe('PAY-L1-FAIL-9021');

    const id2 = generateTicketId('EXM', 'L2', 'QUES', '4819');
    expect(id2).toBe('EXM-L2-QUES-4819');

    const id3 = generateTicketId('ACC', 'L1', 'AUTH');
    expect(id3).toMatch(/^ACC-L1-AUTH-[0-9]{4}$/);

    const id4 = generateTicketId('SYS', 'L3', 'BUG');
    expect(id4).toMatch(/^SYS-L3-BUGX-[0-9]{4}$/);
  });

  it('validates a complete SmartTicket document against SmartTicketSchema', () => {
    const now = Date.now();
    const doc = {
      ticketId: 'PAY-L1-FAIL-9021',
      studentUid: 'student_123',
      studentEmail: 'student@example.com',
      studentName: 'Bunty Aspirant',
      dept: 'PAY' as const,
      severity: 'L1' as const,
      type: 'FAIL',
      category: 'Payment & Billing',
      status: 'OPEN' as const,
      title: 'Payment deducted but plan not active',
      description: 'I attempted payment via UPI, funds were debited but plan still shows inactive.',
      history: [
        {
          status: 'OPEN' as const,
          timestamp: now,
          updatedBy: 'student_123',
          note: 'Ticket opened by student',
        },
      ],
      createdAtMs: now,
      updatedAtMs: now,
    };

    const parsed = SmartTicketSchema.safeParse(doc);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid Semantic Ticket ID patterns', () => {
    const now = Date.now();
    const invalidDoc = {
      ticketId: 'INVALID_ID',
      studentUid: 'student_123',
      dept: 'PAY' as const,
      severity: 'L1' as const,
      type: 'FAIL',
      category: 'Payment',
      status: 'OPEN' as const,
      title: 'Invalid ticket',
      description: 'Long enough description for testing validation failure.',
      history: [],
      createdAtMs: now,
      updatedAtMs: now,
    };

    const parsed = SmartTicketSchema.safeParse(invalidDoc);
    expect(parsed.success).toBe(false);
  });

  it('verifies category mappings define valid depts and types', () => {
    expect(TICKET_STATUSES).toEqual(['OPEN', 'INVESTIGATING', 'ESCALATED', 'RESOLVED']);
    for (const [, mapping] of Object.entries(CATEGORY_MAP)) {
      expect(TICKET_DEPTS).toContain(mapping.dept);
      expect(TICKET_SEVERITIES).toContain(mapping.defaultSeverity);
      expect(mapping.type).toMatch(/^[A-Z0-9]{4}$/);
      expect(mapping.label.length).toBeGreaterThan(0);
    }
  });

  it('correctly assesses escalation eligibility for tickets > 24 hours in OPEN state', () => {
    const now = 100_000_000;
    const exactly24hAgo = now - ESCALATION_THRESHOLD_MS;
    const open25hAgo = now - (ESCALATION_THRESHOLD_MS + 3600_000);
    const open2hAgo = now - 7200_000;

    // Open > 24 hours -> eligible
    expect(isTicketEscalationEligible({ status: 'OPEN', createdAtMs: open25hAgo }, now)).toBe(true);
    // Open exactly 24 hours -> eligible
    expect(isTicketEscalationEligible({ status: 'OPEN', createdAtMs: exactly24hAgo }, now)).toBe(true);
    // Open 2 hours ago -> not eligible
    expect(isTicketEscalationEligible({ status: 'OPEN', createdAtMs: open2hAgo }, now)).toBe(false);
    // Non-open ticket > 24 hours ago -> not eligible
    expect(isTicketEscalationEligible({ status: 'INVESTIGATING', createdAtMs: open25hAgo }, now)).toBe(false);
    expect(isTicketEscalationEligible({ status: 'RESOLVED', createdAtMs: open25hAgo }, now)).toBe(false);
    expect(isTicketEscalationEligible({ status: 'ESCALATED', createdAtMs: open25hAgo }, now)).toBe(false);
  });
});
