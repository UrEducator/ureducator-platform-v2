'use client';
import { useRouter } from 'next/navigation';
import { PageHeader, Sheet } from '@/components/ui';
import { useDocumentTitle } from '@/lib/hooks';
import { ProfileForm } from '../settings/page';

export default function Page() {
  useDocumentTitle('Set up your plan'); const router = useRouter();
  return (
    <>
      <PageHeader title="Set up your plan" intro="These answers shape your revision planner. You can change them later in Settings." />
      <Sheet className="max-w-xl p-6"><ProfileForm completing submitLabel="Save and continue" onDone={() => router.replace('/app')} /></Sheet>
    </>
  );
}
