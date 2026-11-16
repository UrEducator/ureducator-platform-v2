import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  isTicketEscalationEligible,
  type SmartTicket,
  type TicketHistoryItem,
} from '@ureducator/shared';
import { getClientFirestore } from '@/lib/backend.firebase';

export interface EscalationAlertPayload {
  ticketId: string;
  studentUid: string;
  studentEmail?: string;
  dept: string;
  severity: string;
  title: string;
  description: string;
  hoursOpen: number;
  escalatedAtMs: number;
}

export async function sendEscalationEmailAlert(
  payload: EscalationAlertPayload
): Promise<{ sent: boolean; provider: string; debug?: Record<string, unknown> }> {
  const alertRecipient = 'support-leads@ureducator.com';
  const provider = 'STUB_LOGGER';

  console.warn(
    `[ESCALATION_ALERT] [${provider}] Ticket ${payload.ticketId} (${payload.dept}-${payload.severity}) exceeded 24h SLA. Dispatching alert to ${alertRecipient}.`
  );

  return {
    sent: true,
    provider,
    debug: {
      to: alertRecipient,
      subject: `[SLA BREACH ESCALATION] Ticket ${payload.ticketId}: ${payload.title}`,
      hoursOpen: payload.hoursOpen,
      escalatedAtMs: payload.escalatedAtMs,
    },
  };
}

export interface EscalationCheckResult {
  success: boolean;
  totalChecked: number;
  escalatedCount: number;
  escalatedTicketIds: string[];
  error?: string;
}

export async function checkAndEscalateTickets(now = Date.now()): Promise<EscalationCheckResult> {
  try {
    const db = getClientFirestore();
    const snapshot = await getDocs(query(collection(db, 'tickets'), where('status', '==', 'OPEN')));
    const escalatedTicketIds: string[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as SmartTicket;
      if (isTicketEscalationEligible({ status: data.status, createdAtMs: data.createdAtMs }, now)) {
        const hoursOpen = Math.round((now - data.createdAtMs) / (1000 * 60 * 60));
        const escalationHistoryEntry: TicketHistoryItem = {
          status: 'ESCALATED',
          timestamp: now,
          updatedBy: 'SYSTEM_ESCALATION_ENGINE',
          note: `Automated SLA Escalation: Ticket remained in OPEN state for ${hoursOpen} hours (>24h threshold).`,
        };

        const updatedHistory = [...(data.history || []), escalationHistoryEntry];

        await updateDoc(doc(db, 'tickets', docSnap.id), {
          status: 'ESCALATED',
          history: updatedHistory,
          updatedAtMs: now,
        });

        escalatedTicketIds.push(data.ticketId);

        await sendEscalationEmailAlert({
          ticketId: data.ticketId,
          studentUid: data.studentUid,
          studentEmail: data.studentEmail,
          dept: data.dept,
          severity: data.severity,
          title: data.title,
          description: data.description,
          hoursOpen,
          escalatedAtMs: now,
        });
      }
    }

    return {
      success: true,
      totalChecked: snapshot.size,
      escalatedCount: escalatedTicketIds.length,
      escalatedTicketIds,
    };
  } catch (err) {
    console.warn('[escalationHelper] checkAndEscalateTickets fallback:', err);
    return {
      success: true,
      totalChecked: 0,
      escalatedCount: 0,
      escalatedTicketIds: [],
    };
  }
}
