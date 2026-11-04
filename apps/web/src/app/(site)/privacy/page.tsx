import type { Metadata } from 'next';
import { Alert } from '@/components/ui';
import { Prose } from '@/components/Prose';
export const metadata: Metadata = { title: 'Privacy notice (draft)' };
export default function Page() {
  return (
    <Prose title="Privacy notice" updated="Draft for staging. Last edited 4 November 2026." notice={<Alert tone="warn" title="Draft, not yet reviewed by a lawyer">This text describes what the staging build actually does. A qualified professional must review it before the public launch.</Alert>}>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address and sign-in records, handled by Firebase Authentication.</li>
        <li>Practice data: your answers, time spent per question, scores and study settings.</li>
        <li>If you join the notification list: your name, email address and a record of your consent.</li>
        <li>Support messages you send us.</li>
      </ul>
      <h2>What we do not collect</h2>
      <p>We do not collect payment details in this build because payments are switched off. We do not sell your data. We do not run advertising trackers.</p>
      <h2>Where it is stored</h2>
      <p>Data is stored in Google Cloud Firestore in the Mumbai region (asia-south1). Internet addresses are stored only as a one-way hash, for abuse limits and consent records.</p>
      <h2>Your choices</h2>
      <p>You can ask us to export or delete your account and practice data through the <a href="/contact">contact page</a>. You can withdraw marketing consent at any time.</p>
    </Prose>
  );
}
