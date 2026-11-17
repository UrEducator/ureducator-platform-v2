export async function logPrintEvent(_params: {
  userId: string;
  action?: string;
  reportId: string;
  method?: 'print' | 'pdf';
  meta?: Record<string, unknown>;
}) {
  return {
    success: true,
    logId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  };
}
