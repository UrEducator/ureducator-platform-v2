import { NextResponse } from 'next/server';
import { recordPrintAuditLog } from '../../_lib/serverAuth';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      action?: string;
      reportId?: string;
      method?: string;
      meta?: Record<string, unknown>;
    };

    const { userId, action, reportId, method, meta } = body;

    if (!userId || !reportId) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'userId and reportId are required.' },
        { status: 400 }
      );
    }

    const result = await recordPrintAuditLog({
      userId,
      action: action || 'ANALYTICS_REPORT_PRINTED',
      reportId,
      method: method || 'print',
      meta,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'AUDIT_WRITE_FAILED', message: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, logId: result.logId });
  } catch (err) {
    console.error('[API /api/audit/print] Error writing audit log:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to record print audit entry.' },
      { status: 500 }
    );
  }
}
