import { getApps, initializeApp, getApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  isTicketEscalationEligible,
  type SmartTicket,
  type TicketHistoryItem,
} from '@ureducator/shared';

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
    console.error('[escalationHelper] Failed to initialize Firebase Admin app:', err);
    return null;
  }
}

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

/**
 * Extension hook / stub for email alerts on escalated tickets.
 * Can be connected to Resend, NodeMailer, SendGrid, or Postmark.
 */
export async function sendEscalationEmailAlert(
  payload: EscalationAlertPayload
): Promise<{ sent: boolean; provider: string; debug?: Record<string, unknown> }> {
  // Configured recipient
  const alertRecipient = process.env.SUPPORT_LEAD_EMAIL || 'support-leads@ureducator.com';
  const provider = process.env.EMAIL_PROVIDER || 'STUB_LOGGER';

  console.warn(
    `[ESCALATION_ALERT] [${provider}] Ticket ${payload.ticketId} (${payload.dept}-${payload.severity}) exceeded 24h SLA. Dispatching alert to ${alertRecipient}.`
  );

  // If a live Resend or SMTP provider is added in the future:
  // e.g.:
  // if (process.env.RESEND_API_KEY) {
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   await resend.emails.send({ from: 'alerts@ureducator.com', to: alertRecipient, ... });
  // }

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

/**
 * Scans the 'tickets' collection for OPEN tickets older than 24 hours (86,400,000 ms),
 * transitions their status to ESCALATED, records a timestamped history entry,
 * and triggers an escalation alert.
 */
export async function checkAndEscalateTickets(now = Date.now()): Promise<EscalationCheckResult> {
  const app = getAdminApp();
  if (!app) {
    return {
      success: false,
      totalChecked: 0,
      escalatedCount: 0,
      escalatedTicketIds: [],
      error: 'Firebase Admin not initialized',
    };
  }

  const db = getFirestore(app);

  try {
    const snapshot = await db.collection('tickets').where('status', '==', 'OPEN').get();
    const escalatedTicketIds: string[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data() as SmartTicket;
      if (isTicketEscalationEligible({ status: data.status, createdAtMs: data.createdAtMs }, now)) {
        const hoursOpen = Math.round((now - data.createdAtMs) / (1000 * 60 * 60));
        const escalationHistoryEntry: TicketHistoryItem = {
          status: 'ESCALATED',
          timestamp: now,
          updatedBy: 'SYSTEM_ESCALATION_ENGINE',
          note: `Automated SLA Escalation: Ticket remained in OPEN state for ${hoursOpen} hours (>24h threshold).`,
        };

        const updatedHistory = [...(data.history || []), escalationHistoryEntry];

        await doc.ref.update({
          status: 'ESCALATED',
          history: updatedHistory,
          updatedAtMs: now,
        });

        escalatedTicketIds.push(data.ticketId);

        // Fire escalation alert hook
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
    console.error('[escalationHelper] Error during checkAndEscalateTickets:', err);
    return {
      success: false,
      totalChecked: 0,
      escalatedCount: 0,
      escalatedTicketIds: [],
      error: String(err),
    };
  }
}
