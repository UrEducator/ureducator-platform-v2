import { LABEL_TEXT, DEFAULT_BLUEPRINT, maxMarks, totalQuestions, type ContentLabel } from '@ureducator/shared';
import { ContentLabelPill } from '@/components/brand';
import { HeroExam } from '@/components/HeroExam';
import { LeadForm } from '@/components/LeadForm';
import { LinkButton } from '@/components/ui';

const FEATURES = [
  { t: 'Exam screen', d: 'Countdown timer, question palette, mark for review, English and Hindi, and autosave that survives a dropped connection.', s: 'Available in this preview' },
  { t: 'Marking on the server', d: 'The answer key never reaches your browser during a test. Your score is calculated on the server after you submit.', s: 'Available in this preview' },
  { t: 'Analysis by topic', d: 'Accuracy, attempt rate and time use for each unit and topic, with every metric defined in plain words.', s: 'Available in this preview' },
  { t: 'Error notebook', d: 'Every wrong or flagged question is saved and brought back on a spaced-repetition schedule.', s: 'Available in this preview' },
  { t: 'Revision planner', d: 'A weekly plan built from your weak topics and the notebook questions that are due.', s: 'Available in this preview' },
  { t: 'Study mentor', d: 'Answers from verified UrEducator notes only, with citations. Live AI is switched off in this preview; a stand-in answers from the same notes.', s: 'Preview, live model off' },
  { t: 'Printable report', d: 'A PDF with a QR code that anyone can use to confirm it came from UrEducator.', s: 'Available in this preview' },
] as const;

export default function Home() {
  const bp = DEFAULT_BLUEPRINT;
  return (
    <main className="w-full">
      <section className="w-full grid items-center gap-8 lg:gap-12 xl:gap-16 px-4 pb-16 pt-12 sm:px-6 lg:px-8 xl:px-12 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
        <div className="max-w-2xl">
          <h1 className="text-[2.6rem] leading-[1.04] sm:text-6xl">Sit full UGC NET mock tests on an exam screen you can trust.</h1>
          <p className="mt-5 text-lg text-muted">Timed papers, a question palette and mark for review, just like a computer-based test. Afterwards you see which topics cost you marks and what to revise next.</p>
          <div className="mt-8 flex flex-wrap gap-3"><LinkButton href="/signup" size="lg" variant="marker">Start a free practice test</LinkButton><LinkButton href="/syllabus" size="lg" variant="secondary">See what is verified</LinkButton></div>
          <p className="mt-4 max-w-md text-sm text-muted">Free tests in this preview use sample questions written for the demo. Verified question sets are labelled as such before you start.</p>
        </div>
        <HeroExam />
      </section>

      <section aria-labelledby="what" className="border-y border-line bg-surface">
        <div className="w-full grid gap-8 lg:gap-12 xl:gap-16 px-4 py-14 sm:px-6 lg:px-8 xl:px-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div><h2 id="what" className="text-3xl">What you can do here</h2><p className="mt-3 max-w-sm text-muted">Everything below works in this preview. Nothing is marked complete unless it has been tested.</p></div>
          <ul className="divide-y divide-line border-y border-line">
            {FEATURES.map((f) => (
              <li key={f.t} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr_auto] sm:items-baseline sm:gap-6"><h3 className="text-lg">{f.t}</h3><p className="text-[15px] text-muted">{f.d}</p><p className="text-sm font-medium text-pen-700">{f.s}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="status" className="w-full grid gap-8 lg:gap-12 xl:gap-16 px-4 py-16 sm:px-6 lg:px-8 xl:px-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div><h2 id="status" className="text-3xl">How we label content</h2><p className="mt-3 max-w-sm text-muted">Exam rules change and question sets vary in quality. Every subject and test carries one of these labels, and nothing is called verified until someone has checked it against the official documents.</p></div>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {([['fully_verified', 'Checked against the current official notification and syllabus by a named reviewer.'], ['under_development', 'Being built. Structure is in place but the content has not been fully checked.'], ['sample', 'Written to show how the product works. Not a prediction of the real paper.'], ['coming_soon', 'Planned. Not available to practise yet.']] as [ContentLabel, string][]).map(([k, v]) => (
            <div key={k} className="border-t-2 border-pen-200 pt-3"><dt><ContentLabelPill label={k} /><span className="sr-only">{LABEL_TEXT[k]}</span></dt><dd className="mt-2 text-[15px] text-muted">{v}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="pattern" className="border-y border-line bg-pen-50">
        <div className="w-full grid gap-8 lg:gap-12 xl:gap-16 px-4 py-14 sm:px-6 lg:px-8 xl:px-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div><h2 id="pattern" className="text-3xl">The paper at a glance</h2><p className="mt-3 max-w-sm text-muted">This is the pattern our full-length tests currently follow. It is configurable, and it has not yet been confirmed against the latest official notification, so check the NTA website for the current rules.</p></div>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[['Questions', String(totalQuestions(bp))], ['Maximum marks', String(maxMarks(bp))], ['Duration', `${bp.durationMinutes} min`], ['Marking', `+${bp.marking.correct}, no negative`]].map(([k, v]) => (
              <div key={k} className="border-l-2 border-pen-500 pl-4"><dt className="text-sm text-muted">{k}</dt><dd className="mt-0.5 text-2xl font-semibold">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="notify" className="w-full grid gap-8 lg:gap-12 xl:gap-16 px-4 py-16 sm:px-6 lg:px-8 xl:px-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div><h2 id="notify" className="text-3xl">Hear when verified tests are ready</h2><p className="mt-3 max-w-sm text-muted">Leave your email and we will write once, when the first verified set is published. You can ask us to delete your details at any time.</p></div>
        <div className="max-w-md"><LeadForm source="landing" /></div>
      </section>
    </main>
  );
}
