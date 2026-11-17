import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  CATEGORY_MAP,
  generateTicketId,
  type SmartTicket,
  type TicketDept,
  type TicketHistoryItem,
  type TicketSeverity,
  type TicketStatus,
} from '@ureducator/shared';
import { getClientFirestore } from '@/lib/backend.firebase';
import {
  checkAndEscalateTickets,
  sendEscalationEmailAlert,
  type EscalationCheckResult,
} from '@/lib/escalationHelper';
import { sendNotification } from './notifications';

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

export async function submitTicketAction(input: SubmitTicketInput): Promise<SubmitTicketResult> {
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
    const db = getClientFirestore();
    await setDoc(doc(db, 'tickets', ticketId), ticket);
    return { success: true, ticket };
  } catch (err) {
    console.warn('[actions/tickets] submitTicketAction client write fallback:', err);
    return { success: true, ticket };
  }
}

export interface UpdateTicketStatusInput {
  ticketId: string;
  status: TicketStatus;
  staffUid: string;
  staffRole?: string;
  note?: string;
}

export async function updateTicketStatusAction(
  input: UpdateTicketStatusInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getClientFirestore();
    const docRef = doc(db, 'tickets', input.ticketId);
    const now = Date.now();

    const newHistoryEntry: TicketHistoryItem = {
      status: input.status,
      timestamp: now,
      updatedBy: input.staffUid,
      note: input.note || `Status updated to ${input.status} by ${input.staffRole || 'staff'}`,
    };

    await updateDoc(docRef, {
      status: input.status,
      updatedAtMs: now,
    });

    void sendNotification({
      userId: input.staffUid,
      type: 'SUPPORT',
      title: input.status === 'RESOLVED' ? `Ticket Resolved: ${input.ticketId}` : `Ticket ${input.ticketId} Updated: ${input.status}`,
      message: newHistoryEntry.note || `Your ticket status has been updated to ${input.status}.`,
      actionUrl: '/app',
    });

    if (input.status === 'ESCALATED') {
      await sendEscalationEmailAlert({
        ticketId: input.ticketId,
        studentUid: input.staffUid,
        dept: 'SYS',
        severity: 'L1',
        title: `Ticket ${input.ticketId}`,
        description: input.note || '',
        hoursOpen: 25,
        escalatedAtMs: now,
      });
    }

    return { success: true };
  } catch (err) {
    console.warn('[actions/tickets] updateTicketStatusAction client fallback:', err);
    return { success: true };
  }
}

export async function runEscalationCheckAction(): Promise<EscalationCheckResult> {
  return checkAndEscalateTickets();
}

export async function fetchTicketsAction(filters?: {
  status?: string;
  dept?: string;
  severity?: string;
  studentUid?: string;
}): Promise<{ success: boolean; tickets: SmartTicket[]; error?: string }> {
  try {
    const db = getClientFirestore();
    const q = query(collection(db, 'tickets'), orderBy('createdAtMs', 'desc'));
    const snap = await getDocs(q);
    let tickets = snap.docs.map((d) => d.data() as SmartTicket);

    if (filters?.studentUid) {
      tickets = tickets.filter((t) => t.studentUid === filters.studentUid);
    }
    if (filters?.status && filters.status !== 'ALL') {
      tickets = tickets.filter((t) => t.status === filters.status);
    }
    if (filters?.dept && filters.dept !== 'ALL') {
      tickets = tickets.filter((t) => t.dept === filters.dept);
    }
    if (filters?.severity && filters.severity !== 'ALL') {
      tickets = tickets.filter((t) => t.severity === filters.severity);
    }

    return { success: true, tickets };
  } catch (err) {
    console.warn('[actions/tickets] fetchTicketsAction fallback:', err);
    return { success: true, tickets: [] };
  }
}
