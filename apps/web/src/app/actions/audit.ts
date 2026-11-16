'use server';

import { recordPrintAuditLog } from '@/app/api/_lib/serverAuth';

export async function logPrintEvent(params: {
  userId: string;
  action?: string;
  reportId: string;
  method?: 'print' | 'pdf';
  meta?: Record<string, unknown>;
}) {
  return recordPrintAuditLog({
    userId: params.userId,
    action: params.action || 'ANALYTICS_REPORT_PRINTED',
    reportId: params.reportId,
    method: params.method || 'print',
    meta: params.meta,
  });
}
