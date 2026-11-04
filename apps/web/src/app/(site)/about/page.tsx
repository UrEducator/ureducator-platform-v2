import type { Metadata } from 'next';
import { DISCLAIMERS } from '@ureducator/shared';
import { Prose } from '@/components/Prose';
export const metadata: Metadata = { title: 'About' };
export default function Page() {
  return (
    <Prose title="About UrEducator">
      <p>UrEducator is a practice platform for people preparing for the UGC NET. We build computer-based mock tests that behave the way the real test screen does, and we show you what the result means for your next week of study.</p>
      <h2>What we are careful about</h2>
      <ul>
        <li>We label every subject and test as fully verified, under development, sample or coming soon, and we never use &ldquo;verified&rdquo; for content nobody has checked against the official documents.</li>
        <li>Your answers are marked on our servers. The answer key is not sent to your browser while you sit a test.</li>
        <li>Every number on your result page has a plain-language definition.</li>
      </ul>
      <h2>What we are not</h2>
      <p>{DISCLAIMERS.notNta} Practice scores are not a prediction of an official score.</p>
    </Prose>
  );
}
