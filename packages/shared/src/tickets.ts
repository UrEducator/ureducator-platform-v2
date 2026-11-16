import { z } from 'zod';

export const TICKET_DEPTS = ['PAY', 'EXM', 'ACC', 'SYS'] as const;
export type TicketDept = (typeof TICKET_DEPTS)[number];

export const TICKET_SEVERITIES = ['L1', 'L2', 'L3'] as const;
export type TicketSeverity = (typeof TICKET_SEVERITIES)[number];

export const TICKET_STATUSES = ['OPEN', 'INVESTIGATING', 'ESCALATED', 'RESOLVED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const DEPT_LABELS: Record<TicketDept, string> = {
  PAY: 'Billing & Payments',
  EXM: 'Mock Tests & Exam Content',
  ACC: 'Account & Login',
  SYS: 'Platform & Technical Issues',
};

export const SEVERITY_LABELS: Record<TicketSeverity, string> = {
  L1: 'Critical / Blocker',
  L2: 'Standard',
  L3: 'Minor',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  ESCALATED: 'Escalated (>24h SLA)',
  RESOLVED: 'Resolved',
};

export interface CategoryMapping {
  dept: TicketDept;
  type: string;
  defaultSeverity: TicketSeverity;
  label: string;
  description: string;
}

export const CATEGORY_MAP: Record<string, CategoryMapping> = {
  payment: {
    dept: 'PAY',
    type: 'FAIL',
    defaultSeverity: 'L1',
    label: 'Payment & Billing',
    description: 'Payment failure, plan activation issue, refund inquiry',
  },
  exam_content: {
    dept: 'EXM',
    type: 'QUES',
    defaultSeverity: 'L2',
    label: 'Exam Content & Questions',
    description: 'Question typo, answer key doubt, missing explanation',
  },
  login: {
    dept: 'ACC',
    type: 'AUTH',
    defaultSeverity: 'L1',
    label: 'Login & Account Access',
    description: 'Sign in difficulty, email verification, password reset',
  },
  bug: {
    dept: 'SYS',
    type: 'BUGX',
    defaultSeverity: 'L2',
    label: 'Platform Bug & UI Issue',
    description: 'Button unresponsive, timer glitch, display misalignment',
  },
};

export const TicketHistoryItemSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  timestamp: z.number().int(),
  updatedBy: z.string().optional(),
  note: z.string().optional(),
});
export type TicketHistoryItem = z.infer<typeof TicketHistoryItemSchema>;

export const SmartTicketSchema = z.object({
  ticketId: z.string().regex(/^[A-Z]{3}-L[1-3]-[A-Z0-9]{4}-[0-9]{4}$/, 'Invalid Semantic Ticket ID format'),
  studentUid: z.string().min(1),
  studentEmail: z.string().optional(),
  studentName: z.string().optional(),
  dept: z.enum(TICKET_DEPTS),
  severity: z.enum(TICKET_SEVERITIES),
  type: z.string().min(1).max(20),
  category: z.string().min(1).max(50),
  status: z.enum(TICKET_STATUSES),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  history: z.array(TicketHistoryItemSchema),
  createdAtMs: z.number().int(),
  updatedAtMs: z.number().int(),
});
export type SmartTicket = z.infer<typeof SmartTicketSchema>;

/**
 * Generates a semantic ticket ID matching the format:
 * [DEPT]-[SEVERITY]-[TYPE]-[4_DIGIT_HASH]
 * e.g., PAY-L1-FAIL-9021, EXM-L2-QUES-4819
 */
export function generateTicketId(
  dept: TicketDept,
  severity: TicketSeverity,
  type: string,
  hash?: string
): string {
  const cleanType = (type || 'GEN')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');

  const cleanHash =
    hash && /^[0-9]{4}$/.test(hash)
      ? hash
      : Math.floor(1000 + Math.random() * 9000).toString();

  return `${dept}-${severity}-${cleanType}-${cleanHash}`;
}

/**
 * Checks whether a ticket open duration exceeds the 24-hour SLA limit (86,400,000 ms).
 */
export const ESCALATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function isTicketEscalationEligible(ticket: { status: TicketStatus; createdAtMs: number }, now = Date.now()): boolean {
  if (ticket.status !== 'OPEN') return false;
  return now - ticket.createdAtMs >= ESCALATION_THRESHOLD_MS;
}
