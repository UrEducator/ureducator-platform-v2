import { NextResponse } from 'next/server';
import { verifyAuthToken, callCloudFunction } from '../../_lib/serverAuth';

export async function POST(req: Request) {
  try {
    const user = await verifyAuthToken(req);
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Valid authorization token is required.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      reportId?: string;
      action?: string;
      method?: string;
      meta?: Record<string, unknown>;
    };

    const { reportId, action, method, meta } = body;

    if (!reportId) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'reportId is required.' },
        { status: 400 }
      );
    }

    const res = await callCloudFunction<
      { reportId: string; action?: string; method?: string; meta?: Record<string, unknown> },
      { success: boolean; logId?: string; error?: string }
    >(
      'recordPrintAudit',
      {
        reportId,
        action: action || 'ANALYTICS_REPORT_PRINTED',
        method: method || 'print',
        meta,
      },
      user.token
    );

    if (!res.ok || !res.data?.success) {
      return NextResponse.json(
        { error: 'AUDIT_WRITE_FAILED', message: res.error || 'Failed to record audit' },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({ success: true, logId: res.data.logId });
  } catch (err) {
    console.error('[API /api/audit/print] Error writing audit log:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to record print audit entry.' },
      { status: 500 }
    );
  }
}
