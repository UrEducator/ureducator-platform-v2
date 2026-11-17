import { NextResponse } from 'next/server';
import { callCloudFunction } from '../../_lib/serverAuth';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    const body = (await req.json().catch(() => ({}))) as { ticketIds?: string[]; force?: boolean };

    const res = await callCloudFunction<
      { ticketIds?: string[]; force?: boolean },
      { success: boolean; totalChecked: number; escalatedCount: number; escalatedTicketIds: string[] }
    >('adminEscalateTicket', body, idToken);

    if (!res.ok || !res.data) {
      return NextResponse.json(
        { success: false, error: res.error || 'Escalation check failed' },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json(res.data);
  } catch (err) {
    console.error('[API /api/tickets/escalate] Escalation check error:', err);
    return NextResponse.json(
      { success: false, error: 'Escalation check failed' },
      { status: 500 }
    );
  }
}
