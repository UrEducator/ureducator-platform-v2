import { createHash, randomBytes } from 'node:crypto';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { DISCLAIMERS, METRIC_DEFINITIONS, classifyTopics, insights, summarise, type Bucket } from '@ureducator/shared';
import type { Actor, ResultDoc, SessionDoc } from '../domain/types';
import { P } from '../domain/paths';
import { err } from '../infra/errors';
import type { Deps } from './exam';
import { hmacHex, safeEqualHex } from './payments';

export async function getSigningKey(d: Deps): Promise<string> {
  return d.store.transact(async (tx) => {
    const cur = await tx.get<{ key: string }>(P.setting('_reportKey'));
    if (cur?.key) return cur.key;
    const key = randomBytes(32).toString('hex');
    tx.set(P.setting('_reportKey'), { key, createdAtMs: d.clock() });
    return key;
  });
}

export const reportIdFor = (sid: string, uid: string) => 'UR-' + createHash('sha256').update(`${sid}:${uid}`).digest('hex').toUpperCase().slice(0, 12);
const signatureFor = (key: string, id: string, sid: string, marks: number, max: number) => hmacHex(key, `${id}|${sid}|${marks}|${max}`).slice(0, 32);

/** Helvetica only covers Latin-1. Replace anything else so PDF generation can never throw on a student's name. */
export const pdfSafe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, '?').slice(0, 120);

export async function generateReport(d: Deps, actor: Actor, i: { sessionId: string }, o: { baseUrl: string }) {
  const s = await d.store.get<SessionDoc>(P.session(i.sessionId));
  if (!s || s.uid !== actor.uid) throw err('not-found', 'SESSION_NOT_FOUND', 'Session not found.');
  const r = await d.store.get<ResultDoc>(P.result(i.sessionId));
  if (!s || s.status === 'in_progress' || !r) throw err('failed-precondition', 'REPORT_NOT_READY', 'Submit the test to get a report.');
  const key = await getSigningKey(d);
  const reportId = reportIdFor(i.sessionId, actor.uid);
  const sig = signatureFor(key, reportId, i.sessionId, r.marks, r.maxMarks);
  const existing = await d.store.get<{ issuedAtMs: number }>(P.report(reportId));
  const issuedAtMs = existing?.issuedAtMs ?? d.clock();
  if (!existing) await d.store.set(P.report(reportId), { sessionId: i.sessionId, uid: actor.uid, testTitle: r.testTitle, marks: r.marks, maxMarks: r.maxMarks, percentage: r.percentage, issuedAtMs });
  const user = await d.store.get<{ displayName?: string }>(P.user(actor.uid));
  const names = await nameMap(d, r);
  const url = `${o.baseUrl.replace(/\/$/, '')}/verify-report?id=${reportId}&sig=${sig}`;
  const bytes = await renderPdf({ student: user?.displayName ?? 'Student', result: r, reportId, issuedAtMs, url, names });
  return { reportId, fileName: `${reportId}.pdf`, mime: 'application/pdf', base64: Buffer.from(bytes).toString('base64') };
}

async function nameMap(d: Deps, r: ResultDoc) {
  const out: Record<string, string> = {};
  const ids = (m: Record<string, unknown>, col: string) => Promise.all(Object.keys(m).map(async (id) => { const doc = await d.store.get<{ name?: { en?: string } }>(`${col}/${id}`); out[`${col}:${id}`] = doc?.name?.en ?? id; }));
  await Promise.all([ids(r.byUnit, 'units'), ids(r.byTopic, 'topics')]);
  return out;
}

export async function renderPdf(o: { student: string; result: ResultDoc; reportId: string; issuedAtMs: number; url: string; names: Record<string, string> }): Promise<Uint8Array> {
  const { result: r } = o;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`UrEducator Practice Report ${o.reportId}`); pdf.setAuthor('UrEducator'); pdf.setSubject('Practice Examination Performance Report');
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.13, 0.24); const muted = rgb(0.38, 0.41, 0.48); const brand = rgb(0.06, 0.46, 0.43);
  const t = (s: string, x: number, y: number, size = 10, f = font, color = ink) => page.drawText(pdfSafe(s), { x, y, size, font: f, color });

  page.drawText('PRACTICE REPORT', { x: 90, y: 300, size: 74, font: bold, color: rgb(0.85, 0.87, 0.9), rotate: degrees(40), opacity: 0.35 });
  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: brand });
  t('UrEducator', 36, 808, 22, bold, rgb(1, 1, 1)); t('Practice Examination Performance Report', 36, 792, 10, font, rgb(0.9, 1, 0.98));
  t(DISCLAIMERS.report, 36, 766, 8.5, bold, rgb(0.6, 0.15, 0.1));

  t(`Student: ${o.student}`, 36, 740, 11, bold); t(`Test: ${r.testTitle}`, 36, 724, 10);
  t(`Date: ${new Date(r.submittedAtMs).toISOString().slice(0, 10)}   Report ID: ${o.reportId}`, 36, 710, 9, font, muted);

  const sm = summarise({ marks: r.marks, maxMarks: r.maxMarks, correct: r.correct, incorrect: r.incorrect, unattempted: r.unattempted, attempted: r.attempted, accuracy: r.accuracy, attemptRate: r.attemptRate, percentage: r.percentage, bySection: {}, byUnit: {}, byTopic: {}, byDifficulty: {}, perQuestion: { _all: { outcome: 'correct', marks: 0, timeMs: r.timeSpentMs } } }, r.durationMs);
  const cards: [string, string][] = [
    ['Score', `${r.marks} / ${r.maxMarks}`], ['Percentage', `${Math.round(sm.percentage.value * 100)}%`], ['Accuracy', `${Math.round(r.accuracy * 100)}%`],
    ['Attempted', `${r.attempted} (${Math.round(r.attemptRate * 100)}%)`], ['Time used', `${Math.round(sm.timeUtilisation.value * 100)}%`],
  ];
  cards.forEach(([k, v], idx) => { const x = 36 + idx * 108; page.drawRectangle({ x, y: 650, width: 100, height: 44, borderColor: rgb(0.8, 0.83, 0.87), borderWidth: 0.8, color: rgb(0.98, 0.98, 0.99) }); t(k, x + 8, 680, 8, font, muted); t(v, x + 8, 662, 12, bold); });

  let y = 626;
  const rows = (title: string, map: Record<string, unknown>, col: string) => {
    t(title, 36, y, 11, bold, brand); y -= 14;
    t('Name', 36, y, 8, bold, muted); t('Correct', 300, y, 8, bold, muted); t('Wrong', 350, y, 8, bold, muted); t('Skipped', 400, y, 8, bold, muted); t('Accuracy', 460, y, 8, bold, muted); y -= 12;
    for (const [id, bk] of Object.entries(map).slice(0, 8)) {
      const b = bk as Bucket; const att = b.correct + b.incorrect; const acc = att ? b.correct / att : 0;
      t(o.names[`${col}:${id}`] ?? id, 36, y, 9); t(String(b.correct), 300, y, 9); t(String(b.incorrect), 350, y, 9); t(String(b.unattempted), 400, y, 9);
      page.drawRectangle({ x: 460, y: y - 1, width: 60, height: 7, color: rgb(0.9, 0.91, 0.93) }); page.drawRectangle({ x: 460, y: y - 1, width: 60 * acc, height: 7, color: acc >= 0.5 ? brand : rgb(0.8, 0.3, 0.2) }); t(`${Math.round(acc * 100)}%`, 524, y, 8, font, muted);
      y -= 13;
    }
    y -= 8;
  };
  rows('Section analysis', r.bySection, 'sections'); rows('Unit-wise analysis', r.byUnit, 'units');

  const agg = Object.fromEntries(Object.entries(r.byTopic).map(([id, b]) => { const bb = b as Bucket; return [id, { topicId: id, attempted: bb.correct + bb.incorrect, correct: bb.correct, total: bb.total, timeMs: bb.timeMs, tests: 1 }]; }));
  const { weak, strong } = classifyTopics(agg, 2);
  t('Strengths', 36, y, 11, bold, brand); t('Needs work', 300, y, 11, bold, brand); y -= 14;
  for (let k = 0; k < 4; k++) { const sg = strong[k], wk = weak[k]; if (sg) t(`${o.names[`topics:${sg.topicId}`] ?? sg.topicId} (${sg.correct}/${sg.attempted})`, 36, y, 9); if (wk) t(`${o.names[`topics:${wk.topicId}`] ?? wk.topicId} (${wk.correct}/${wk.attempted})`, 300, y, 9); y -= 12; }
  if (!strong.length && !weak.length) { t('Not enough attempted questions per topic in this test to classify strengths or weaknesses.', 36, y, 9, font, muted); y -= 12; }
  y -= 8; t('Recommended next steps', 36, y, 11, bold, brand); y -= 14;
  const tips = insights(sm, weak); (tips.length ? tips : [{ text: 'Keep practising in timed conditions and review every wrong answer in your Error Notebook.' }]).slice(0, 4).forEach((x) => { t(`• ${x.text}`.slice(0, 105), 36, y, 9); y -= 12; });

  const png = await QRCode.toDataURL(o.url, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
  const img = await pdf.embedPng(Buffer.from(png.split(',')[1] as string, 'base64'));
  page.drawImage(img, { x: 470, y: 60, width: 90, height: 90 });
  t('Scan to verify this report', 462, 50, 8, font, muted);
  t(`Report ID ${o.reportId}`, 36, 110, 9, bold); t('Verification checks the report ID and a signature. It does not reveal personal details.', 36, 97, 8, font, muted);
  t(METRIC_DEFINITIONS.accuracy.slice(0, 110), 36, 84, 7.5, font, muted);
  t(DISCLAIMERS.notNta.slice(0, 120), 36, 40, 7.5, font, muted); t(DISCLAIMERS.report, 36, 30, 7.5, bold, muted);
  return pdf.save();
}

export async function verifyReport(d: Deps, i: { reportId: string; sig: string }) {
  const rep = await d.store.get<{ sessionId: string; testTitle: string; marks: number; maxMarks: number; issuedAtMs: number }>(P.report(i.reportId));
  const key = await getSigningKey(d);
  const expected = rep ? signatureFor(key, i.reportId, rep.sessionId, rep.marks, rep.maxMarks) : signatureFor(key, i.reportId, 'none', 0, 0);
  const ok = safeEqualHex(expected, i.sig) && !!rep;
  if (!ok || !rep) return { valid: false as const };
  return { valid: true as const, testTitle: rep.testTitle, marks: rep.marks, maxMarks: rep.maxMarks, issuedAt: new Date(rep.issuedAtMs).toISOString().slice(0, 10), notice: DISCLAIMERS.report };
}
