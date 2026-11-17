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

/**
 * Initiates automated SLA breach escalation.
 * Invokes the secure serverless route /api/tickets/escalate which delegates Firestore mutations
 * to the audited Admin SDK Cloud Function.
 */
export async function checkAndEscalateTickets(): Promise<EscalationCheckResult> {
  try {
    const res = await fetch('/api/tickets/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[escalationHelper] checkAndEscalateTickets API error:', res.status, err);
      return {
        success: false,
        totalChecked: 0,
        escalatedCount: 0,
        escalatedTicketIds: [],
        error: `Server responded with ${res.status}`,
      };
    }

    const json = (await res.json()) as EscalationCheckResult;
    return json;
  } catch (err) {
    console.warn('[escalationHelper] checkAndEscalateTickets network error:', err);
    return {
      success: false,
      totalChecked: 0,
      escalatedCount: 0,
      escalatedTicketIds: [],
      error: String(err),
    };
  }
}
