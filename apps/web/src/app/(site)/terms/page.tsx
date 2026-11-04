import type { Metadata } from 'next';
import { Alert } from '@/components/ui';
import { Prose } from '@/components/Prose';
export const metadata: Metadata = { title: 'Terms of use (draft)' };
export default function Page() {
  return (
    <Prose title="Terms of use" updated="Draft for staging. Last edited 4 November 2026." notice={<Alert tone="warn" title="Draft, not yet reviewed by a lawyer">These terms are a working draft for the staging preview and are not final.</Alert>}>
      <h2>Using UrEducator</h2>
      <p>UrEducator is a practice service. You agree to use your own account, to keep your password private and not to copy, share or resell test content or answer keys.</p>
      <h2>Practice scores</h2>
      <p>Scores are practice indicators, not official results. See the <a href="/disclaimer">disclaimer</a>.</p>
      <h2>Content status</h2>
      <p>Each test shows a content label. Tests labelled sample or under development may contain simplified or unverified questions.</p>
      <h2>Paid plans</h2>
      <p>No paid plan exists in this preview. Prices, refunds and invoicing terms will be published here before payments are switched on.</p>
      <h2>Changes</h2>
      <p>We may change these terms. We will tell you before a change that affects you takes effect.</p>
    </Prose>
  );
}
