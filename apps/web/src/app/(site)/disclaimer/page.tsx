import type { Metadata } from 'next';
import { DISCLAIMERS } from '@ureducator/shared';
import { Prose } from '@/components/Prose';
export const metadata: Metadata = { title: 'Disclaimer' };
export default function Page() {
  return (
    <Prose title="Disclaimer">
      <p>{DISCLAIMERS.notNta}</p>
      <p>The exam interface on UrEducator is our own design. It follows the general idea of a computer-based test, with a timer, a question palette and a review flag. It does not copy any official software, logo or branding.</p>
      <p>Scores and ranks on UrEducator are practice indicators calculated from the marking scheme of the test you took. They are not official results, and they do not predict how any official body will mark your answers.</p>
      <p>Exam patterns, syllabi and rules can change. Always read the current notification on the official NTA website before you rely on any detail you see here.</p>
      <p>{DISCLAIMERS.report}</p>
    </Prose>
  );
}
