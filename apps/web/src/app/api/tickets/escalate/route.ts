import { NextResponse } from 'next/server';
import { checkAndEscalateTickets } from '@/lib/escalationHelper';

export async function POST() {
  try {
    const result = await checkAndEscalateTickets();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[API /api/tickets/escalate] Escalation check error:', err);
    return NextResponse.json(
      { success: false, error: 'Escalation check failed' },
      { status: 500 }
    );
  }
}
