'use server';

import { getApps, initializeApp, getApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  CATEGORY_MAP,
  generateTicketId,
  type SmartTicket,
  type TicketDept,
  type TicketHistoryItem,
  type TicketSeverity,
  type TicketStatus,
} from '@ureducator/shared';
import {
  checkAndEscalateTickets,
  sendEscalationEmailAlert,
  type EscalationCheckResult,
} from '@/lib/escalationHelper';
import { sendNotification } from './notifications';

function getAdminApp(): App | null {
  try {
    if (getApps().length > 0) {
      return getApp();
    }
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'ugc-mock-test-staging';

    return initializeApp({ projectId });
  } catch (err) {
    console.error('[actions/tickets] Failed to initialize Firebase Admin app:', err);
    return null;
  }
}

export interface SubmitTicketInput {
  category: string;
  title: string;
  description: string;
  severity?: TicketSeverity;
  studentUid: string;
  studentEmail?: string;
  studentName?: string;
}

export interface SubmitTicketResult {
  success: boolean;
  ticket?: SmartTicket;
  error?: string;
}

/**
 * Creates a new Smart Ticket with Semantic ID: [DEPT]-[SEVERITY]-[TYPE]-[4_DIGIT_HASH]
 * and stores it in the Firestore 'tickets' collection.
 */
export async function submitTicketAction(input: SubmitTicketInput): Promise<SubmitTicketResult> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, error: 'Firebase Admin not available' };
  }

  const mapping = CATEGORY_MAP[input.category] || {
    dept: 'SYS' as TicketDept,
    type: 'GENX',
    defaultSeverity: 'L2' as TicketSeverity,
    label: 'General Inquiry',
    description: '',
  };

  const severity: TicketSeverity = input.severity || mapping.defaultSeverity;
  const dept: TicketDept = mapping.dept;
  const type: string = mapping.type;

  const ticketId = generateTicketId(dept, severity, type);
  const now = Date.now();

  const historyItem: TicketHistoryItem = {
    status: 'OPEN',
    timestamp: now,
    updatedBy: input.studentUid,
    note: 'Ticket opened by student',
  };

  const ticket: SmartTicket = {
    ticketId,
    studentUid: input.studentUid,
    studentEmail: input.studentEmail,
    studentName: input.studentName,
    dept,
    severity,
    type,
    category: mapping.label,
    status: 'OPEN',
    title: input.title.trim(),
    description: input.description.trim(),
    history: [historyItem],
    createdAtMs: now,
    updatedAtMs: now,
  };

  try {
    const db = getFirestore(app);
    await db.collection('tickets').doc(ticketId).set(ticket);
    return { success: true, ticket };
  } catch (err) {
    console.error('[actions/tickets] submitTicketAction error:', err);
    return { success: false, error: String(err) };
  }
}

export interface UpdateTicketStatusInput {
  ticketId: string;
  status: TicketStatus;
  staffUid: string;
  staffRole?: string;
  note?: string;
}

/**
 * Updates a ticket status in the 'tickets' collection, records history, and fires escalation hook if applicable.
 */
export async function updateTicketStatusAction(
  input: UpdateTicketStatusInput
): Promise<{ success: boolean; error?: string }> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, error: 'Firebase Admin not available' };
  }

  const db = getFirestore(app);
  const docRef = db.collection('tickets').doc(input.ticketId);

  try {
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return { success: false, error: `Ticket ${input.ticketId} not found` };
    }

    const currentTicket = docSnap.data() as SmartTicket;
    const now = Date.now();

    const newHistoryEntry: TicketHistoryItem = {
      status: input.status,
      timestamp: now,
      updatedBy: input.staffUid,
      note: input.note || `Status updated to ${input.status} by ${input.staffRole || 'staff'}`,
    };

    const updatedHistory = [...(currentTicket.history || []), newHistoryEntry];

    await docRef.update({
      status: input.status,
      history: updatedHistory,
      updatedAtMs: now,
    });

    if (input.status === 'ESCALATED') {
      const hoursOpen = Math.round((now - currentTicket.createdAtMs) / (1000 * 60 * 60));
      await sendEscalationEmailAlert({
        ticketId: currentTicket.ticketId,
        studentUid: currentTicket.studentUid,
        studentEmail: currentTicket.studentEmail,
        dept: currentTicket.dept,
        severity: currentTicket.severity,
        title: currentTicket.title,
        description: currentTicket.description,
        hoursOpen,
        escalatedAtMs: now,
      });
    }

    // Phase S: Universal Notification Hub Integration
    // Send automated notification to student when staff changes status or adds note
    try {
      const statusTitle =
        input.status === 'RESOLVED'
          ? `Ticket Resolved: ${currentTicket.ticketId}`
          : `Ticket ${currentTicket.ticketId} Updated: ${input.status}`;
      const statusMsg = input.note
        ? `${input.note} (Status: ${input.status})`
        : `Your support ticket status has been updated to ${input.status}.`;

      await sendNotification({
        userId: currentTicket.studentUid,
        type: 'SUPPORT',
        title: statusTitle,
        message: statusMsg,
        actionUrl: '/app',
      });
    } catch (notifErr) {
      console.warn('[actions/tickets] Failed to send student ticket update notification:', notifErr);
    }

    return { success: true };
  } catch (err) {
    console.error('[actions/tickets] updateTicketStatusAction error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Server action to manually or periodically trigger the 24h SLA escalation sweep.
 */
export async function runEscalationCheckAction(): Promise<EscalationCheckResult> {
  return checkAndEscalateTickets();
}

/**
 * Fetches tickets from Firestore with optional filtering.
 */
export async function fetchTicketsAction(filters?: {
  status?: string;
  dept?: string;
  severity?: string;
  studentUid?: string;
}): Promise<{ success: boolean; tickets: SmartTicket[]; error?: string }> {
  const app = getAdminApp();
  if (!app) {
    return { success: false, tickets: [], error: 'Firebase Admin not available' };
  }

  const db = getFirestore(app);
  let q: FirebaseFirestore.Query = db.collection('tickets');

  if (filters?.studentUid) {
    q = q.where('studentUid', '==', filters.studentUid);
  }
  if (filters?.status && filters.status !== 'ALL') {
    q = q.where('status', '==', filters.status);
  }
  if (filters?.dept && filters.dept !== 'ALL') {
    q = q.where('dept', '==', filters.dept);
  }
  if (filters?.severity && filters.severity !== 'ALL') {
    q = q.where('severity', '==', filters.severity);
  }

  try {
    const snap = await q.get();
    const tickets = snap.docs.map((d) => d.data() as SmartTicket);
    // Sort descending by createdAtMs
    tickets.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return { success: true, tickets };
  } catch (err) {
    console.error('[actions/tickets] fetchTicketsAction error:', err);
    return { success: false, tickets: [], error: String(err) };
  }
}
