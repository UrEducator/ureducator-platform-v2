'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExamScreen } from '@/components/exam/ExamScreen';
import { Alert } from '@/components/ui';

function Body() {
  const id = useSearchParams().get('s') ?? '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return <main className="mx-auto max-w-lg p-6"><Alert tone="warn" title="No test selected">Start a test from the mock test list.</Alert></main>;
  return <ExamScreen sessionId={id} />;
}
export default function Page() { return <Suspense><Body /></Suspense>; }
