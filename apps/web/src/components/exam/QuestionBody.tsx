'use client';
import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { pickText, type Lang, type PaperQuestion } from '@ureducator/shared';

export function QuestionBody({
  q,
  lang,
  children,
}: {
  q: PaperQuestion;
  lang: Lang;
  children: React.ReactNode;
}) {
  const c = q.content;
  const t = (x: { en: string; hi?: string }) => pickText(x, lang);
  const [mobilePassageExpanded, setMobilePassageExpanded] = useState(true);

  const hasPassage = Boolean(c.passage);

  const passageContent = c.passage ? (
    <div className="rounded-sheet border border-pen-200/80 bg-paper/60 p-4 sm:p-5 transition-colors">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pen-700">
          <BookOpen className="size-3.5" aria-hidden="true" />
          Reading Comprehension Passage
        </span>
      </div>
      <div className="read text-[1.025rem] leading-relaxed text-ink/90 space-y-3">
        {t(c.passage).split('\n\n').map((paragraph, pIdx) => (
          <p key={pIdx}>{paragraph}</p>
        ))}
      </div>
    </div>
  ) : null;

  const questionContent = (
    <div className="read flex flex-col justify-start" lang={lang}>
      <p className="text-[1.125rem] font-medium leading-relaxed text-ink">{t(c.stem)}</p>

      {c.statements && (
        <ol className="mt-4 grid gap-2 text-[1.05rem]" aria-label="Statements">
          {c.statements.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-md bg-paper/40 p-2 border border-line/60">
              <span className="font-semibold text-pen-700 tabular-nums shrink-0">
                {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i]}.
              </span>
              <span className="text-ink">{t(s)}</span>
            </li>
          ))}
        </ol>
      )}

      {c.matchLists && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-sheet border border-line bg-surface p-4 text-[1.02rem]">
          <div className="border-b sm:border-b-0 sm:border-r border-line pb-3 sm:pb-0 sm:pr-4">
            <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted">List I</p>
            <ol className="grid gap-1.5">
              {c.matchLists.listI.map((x, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-semibold text-pen-700 shrink-0">{String.fromCharCode(65 + i)}.</span>
                  <span>{t(x)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="sm:pl-2">
            <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted">List II</p>
            <ol className="grid gap-1.5">
              {c.matchLists.listII.map((x, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-semibold text-pen-700 shrink-0">
                    {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i]}.
                  </span>
                  <span>{t(x)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {c.image && (
        <div className="mt-4 rounded-sheet border border-dashed border-line-strong p-4 font-sans text-sm text-muted bg-paper/50 text-center">
          <p className="font-medium text-ink">Figure: {c.image.alt}</p>
          <p className="text-xs text-muted mt-1">Image rendering will be available in the upcoming verified dataset release.</p>
        </div>
      )}

      {children}
    </div>
  );

  if (hasPassage) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-8 items-start">
        {/* Mobile / Tablet Accordion View */}
        <div className="lg:hidden rounded-sheet border border-pen-200 bg-paper/70">
          <button
            type="button"
            onClick={() => setMobilePassageExpanded(!mobilePassageExpanded)}
            className="flex w-full items-center justify-between p-3.5 text-left text-sm font-semibold text-pen-900 cursor-pointer"
            aria-expanded={mobilePassageExpanded}
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="size-4 text-pen-600" aria-hidden="true" />
              Reading Passage {mobilePassageExpanded ? '(Tap to collapse)' : '(Tap to expand)'}
            </span>
            {mobilePassageExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {mobilePassageExpanded && (
            <div className="border-t border-line p-4 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {passageContent}
            </div>
          )}
        </div>

        {/* Desktop Sticky Passage View */}
        <div className="hidden lg:block custom-scrollbar sticky top-24 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
          {passageContent}
        </div>

        {/* Single Question Content */}
        <div className="min-w-0">{questionContent}</div>
      </div>
    );
  }

  return questionContent;
}
