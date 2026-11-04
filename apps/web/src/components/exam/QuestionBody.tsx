'use client';
import { pickText, type Lang, type PaperQuestion } from '@ureducator/shared';

export function QuestionBody({ q, lang, children }: { q: PaperQuestion; lang: Lang; children: React.ReactNode }) {
  const c = q.content; const t = (x: { en: string; hi?: string }) => pickText(x, lang);
  return (
    <div className="read" lang={lang}>
      {c.passage && <blockquote className="mb-4 rounded-sheet border-l-4 border-pen-200 bg-paper px-4 py-3 text-[1.02rem]">{t(c.passage)}</blockquote>}
      <p className="text-[1.15rem] leading-relaxed">{t(c.stem)}</p>
      {c.statements && <ol className="mt-3 grid gap-1.5 text-[1.05rem]">{c.statements.map((s, i) => <li key={i} className="flex gap-2"><span className="font-semibold">{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i]}.</span><span>{t(s)}</span></li>)}</ol>}
      {c.matchLists && (
        <div className="mt-3 grid grid-cols-2 gap-x-6 rounded-sheet border border-line text-[1.02rem]">
          <div className="border-r border-line p-3"><p className="mb-1 font-sans text-sm font-semibold text-muted">List I</p><ol className="grid gap-1">{c.matchLists.listI.map((x, i) => <li key={i}><span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {t(x)}</li>)}</ol></div>
          <div className="p-3"><p className="mb-1 font-sans text-sm font-semibold text-muted">List II</p><ol className="grid gap-1">{c.matchLists.listII.map((x, i) => <li key={i}><span className="font-semibold">{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i]}.</span> {t(x)}</li>)}</ol></div>
        </div>
      )}
      {c.image && <p className="mt-3 rounded-sheet border border-dashed border-line-strong p-3 font-sans text-sm text-muted">Figure: {c.image.alt}. Images are not enabled in this preview.</p>}
      {children}
    </div>
  );
}
