import type { ContentLabel } from './constants';

/**
 * Seed catalogue. IMPORTANT: nothing here is labelled "fully_verified".
 * The Paper I unit list reflects the commonly published 10-unit structure but has NOT yet been checked
 * against the current official NTA / UGC-NET syllabus document, so every entry is "under_development".
 * Paper II entries are sample placeholders only; the complete official subject list must be imported and verified by an editor.
 */
export type SeedSubject = { id: string; paper: 'paper1' | 'paper2'; name: { en: string; hi?: string }; label: ContentLabel; units: { id: string; name: { en: string }; topics: { id: string; name: { en: string } }[] }[] };

export const SEED_SUBJECTS: SeedSubject[] = [
  {
    id: 'paper1', paper: 'paper1', name: { en: 'Paper I — Teaching & Research Aptitude', hi: 'प्रश्नपत्र I — शिक्षण एवं शोध अभियोग्यता' }, label: 'under_development',
    units: [
      { id: 'p1-teaching', name: { en: 'Teaching Aptitude' }, topics: [{ id: 'p1-teaching-nature', name: { en: 'Nature, objectives and characteristics of teaching' } }, { id: 'p1-teaching-methods', name: { en: 'Teaching methods and evaluation' } }] },
      { id: 'p1-research', name: { en: 'Research Aptitude' }, topics: [{ id: 'p1-research-types', name: { en: 'Types and steps of research' } }, { id: 'p1-research-ethics', name: { en: 'Research ethics and thesis writing' } }] },
      { id: 'p1-comprehension', name: { en: 'Comprehension' }, topics: [{ id: 'p1-comprehension-passage', name: { en: 'Passage-based questions' } }] },
      { id: 'p1-communication', name: { en: 'Communication' }, topics: [{ id: 'p1-communication-basics', name: { en: 'Communication process and barriers' } }] },
      { id: 'p1-maths', name: { en: 'Mathematical Reasoning and Aptitude' }, topics: [{ id: 'p1-maths-series', name: { en: 'Number series and arithmetic reasoning' } }] },
      { id: 'p1-logical', name: { en: 'Logical Reasoning' }, topics: [{ id: 'p1-logical-arguments', name: { en: 'Arguments, syllogism and inference' } }] },
      { id: 'p1-data', name: { en: 'Data Interpretation' }, topics: [{ id: 'p1-data-tables', name: { en: 'Tables and graphs' } }] },
      { id: 'p1-ict', name: { en: 'Information and Communication Technology' }, topics: [{ id: 'p1-ict-basics', name: { en: 'ICT fundamentals and internet' } }] },
      { id: 'p1-environment', name: { en: 'People, Development and Environment' }, topics: [{ id: 'p1-environment-issues', name: { en: 'Environmental issues and sustainable development' } }] },
      { id: 'p1-higher-ed', name: { en: 'Higher Education System' }, topics: [{ id: 'p1-higher-ed-structure', name: { en: 'Structure, governance and policies' } }] },
    ],
  },
  { id: 'sample-commerce', paper: 'paper2', name: { en: 'Commerce (sample)' }, label: 'sample', units: [{ id: 'sample-commerce-u1', name: { en: 'Sample unit' }, topics: [{ id: 'sample-commerce-u1-t1', name: { en: 'Sample topic' } }] }] },
  { id: 'sample-education', paper: 'paper2', name: { en: 'Education (sample)' }, label: 'sample', units: [{ id: 'sample-education-u1', name: { en: 'Sample unit' }, topics: [{ id: 'sample-education-u1-t1', name: { en: 'Sample topic' } }] }] },
  { id: 'sample-cs', paper: 'paper2', name: { en: 'Computer Science and Applications (sample)' }, label: 'sample', units: [{ id: 'sample-cs-u1', name: { en: 'Sample unit' }, topics: [{ id: 'sample-cs-u1-t1', name: { en: 'Sample topic' } }] }] },
];

export const LABEL_TEXT: Record<ContentLabel, string> = {
  fully_verified: 'Fully verified', under_development: 'Under development', sample: 'Sample content', coming_soon: 'Coming soon',
};
