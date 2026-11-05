# M9 — Official Source Register

| | |
|---|---|
| **Milestone** | M9 — Academic Content Foundation (architecture only) |
| **Baseline** | Repository commit `694999a` (M8.8.5 accepted) |
| **Author** | Claude (architecture and security lead) |
| **Date** | 5 November 2026 |
| **Status** | PROPOSAL for owner review. Nothing here has been implemented, written to Firestore or deployed. |

## 0. How to read this register (read this first)

This register records **what was actually reached and read** from official sources, and what was **not**. Every entry carries one of these verification levels:

| Level | Meaning |
|---|---|
| **V0** | Not reached. The page or file could not be fetched. Nothing is claimed about its content. |
| **V1** | Observed. Fetched on 5 Nov 2026 through an automated page-reading tool that summarises documents. The content is probably right but has **not** been checked by a person against the PDF. Do not mark anything `fully_verified` on V1. |
| **V2** | Human-verified. A named person compared the record with the downloaded PDF, and the file's SHA-256 is recorded. This is the minimum for `fully_verified`. |
| **V3** | Dual-verified. Two different people did V2 independently. Required for exam-pattern facts that drive scoring and for anything labelled official PYQ. |

**Everything in this register is V0 or V1. Nothing is V2.** That is deliberate and honest: no syllabus unit or topic text was verified in this session (section 5 explains why). M9.0 (section 8) is the human step that turns V1 into V2.

Rules that follow from this:

1. No syllabus unit, topic or sub-topic is invented or filled from memory or from coaching websites. Where a fact is missing, this register says so.
2. A third-party site (coaching blogs, news sites) is never an authority. Two were seen in search results; they are noted as **leads only** in section 6.
3. Nothing here says UrEducator is an official NTA or UGC product. Source names are cited as sources, not as endorsements.

## 1. Method and its limits

* Pages were read with the session's WebFetch tool. It converts a page or PDF to text and answers a question about it. It is **not** a byte-exact download.
* The session's network allowlist blocked some official URLs (section 7, D1, D2, D4). A blocked URL was not worked around.
* PDF text extraction is unreliable for these documents (section 5). The tool's output was never treated as a verbatim copy.
* No file was downloaded to disk and no hash was computed, because the shell cannot reach these hosts. Hashing is part of M9.0 and must be done by a person (or Antigravity) on a normal machine.

## 2. Source inventory

| ID | Source | URL | Reached? | Level | What it gave |
|---|---|---|---|---|---|
| S1 | NTA UGC-NET home page | https://ugcnet.nta.nic.in/ | Yes | V1 | Page says "Last updated Nov 02, 2026". Current cycle is **UGC-NET December 2026**. Lists six public notices (S7) and a link to the corrigendum PDF (S6). Contains no syllabus and no subject list. |
| S2 | NTA information-bulletin listing | https://ugcnet.nta.nic.in/information-bulletin/ | Yes | V1 | Lists: "Updated Information Bulletin of UGC-NET December 2026 as on 16.10.2026"; "Information Bulletin of UGC-NET December 2026 as on 08.10.2026"; June 2026 bulletin "as on 30.04.2026"; one 2025 bulletin; the 2023 bulletin in the archive. |
| S2a | The URL named in the assignment | https://ugcnet.nta.nic.in/document-category/information-bulletin/ | **No** | V0 | Blocked by the session allowlist. S2 is the same listing at a different path, but this is **not proven identical**. |
| S3 | **Updated Information Bulletin, December 2026 ("as on 16.10.2026")** | https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/20261016860019603.pdf | Yes, about 100,000 of 104,802 characters, plus the final part | V1 | Exam pattern, marking rules, language rule, subject list (Annexure II), syllabus pointer, exam dates. See section 3. |
| S3b | Earlier bulletin "as on 08.10.2026" | https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/202610081852912625.pdf | No | V0 | Not opened. Needed only to see what changed between the two versions. |
| S4 | **UGC syllabus catalogue** | https://ugcnetonline.in/syllabus-new.php | Yes | V1 | Page heading: "Updated Syllabi of UGC-NET (Applicable from June 2019 UGC-NET Onwards)". 88 rows (Paper I plus 87 subjects) with English and Hindi file links. No dates, no version history. See section 4. |
| S5 | **UGC subject list** | https://ugcnetonline.in/subjects.php | **No** | V0 | Blocked by the allowlist for both `ugcnetonline.in` and `www.ugcnetonline.in`. The bulletin's Annexure II (S3) was used instead. |
| S6 | **Corrigendum to the Information Bulletin of UGC-NET December 2026** | https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/202610161905649093.pdf | **No** | V0 | Blocked. The file exists (it is linked from S1, and its path suggests an upload on 16 Oct 2026). **Its contents are unknown.** This is the most important open item (D4). |
| S7 | Other public notices on S1 | Six PDFs under `.../uploads/2026/09`, `/2026/10`, `/2026/11` | No | V0 | Titles only: extension of application date (Oct 2026), extension of fee date (1 Nov 2026), correction of particulars (2 Nov 2026), opening of registration (Oct 2026), e-certificates for June 2026 (Sep 2026). Their contents were not read, so the dates in S3 may have been changed by them. |
| S8 | Syllabus PDFs (88 files, EN/HI) | `https://www.ugcnetonline.in/showPdf.php?p1=NTA_All_R_Syllabus%2F<code>%2F<file>.pdf` | **Not usefully** | V0 for all content | See section 5. No Paper I or Paper II syllabus text was verified. |
| S9 | Careers360 news article (29 Apr 2026) | news.careers360.com (search result) | Yes | **Lead only, not an authority** | Says Statistics was added and the subject count went from 85 to 86 (see D9). |

## 3. Official exam pattern — from the December 2026 bulletin (S3), level V1

These are the facts that matter most for the exam engine. Section numbers are the bulletin's own, as reported by the reading tool.

| Fact | What the bulletin says (paraphrased) | Bulletin ref | Level |
|---|---|---|---|
| Mode | Computer-based test only | Important Information | V1 |
| Paper I | 50 MCQs, 100 marks. Teaching and research aptitude, reasoning, reading comprehension, divergent thinking, general awareness | §3.2 | V1 |
| Paper II | 100 MCQs, 200 marks. The candidate's chosen subject | §3.2 | V1 |
| Duration | 3 hours (180 minutes) for both papers together, no break between them. No separate duration per paper is stated | §3.2 | V1 |
| Marks per question | 2 | §3.5 | V1 |
| Negative marking | **None.** "There is no negative marking for incorrect response" | §3.5 | V1 |
| Unattempted | Not evaluated | §3.5 | V1 |
| Question with more than one correct option | The 2 marks go to candidates who chose **any** of the correct options | §3.5 (6a) | V1 |
| All options correct | 2 marks to **all candidates who attempted** the question | §3.5 (6b) | V1 |
| No correct option, wrong question, or dropped question | 2 marks to **all candidates who attempted** it, whatever they chose | §3.5 (6c) | V1 |
| Language of papers | English and Hindi (bilingual), except language papers, which are in the language concerned. Candidate picks a medium on the application form. If a translation is ambiguous, the English version is final | §3.4 | V1 |
| Syllabus | Downloadable from `https://www.ugcnetonline.in/syllabus-new.php`. NTA will not send a copy to candidates. The bulletin makes **no statement** that the syllabus was revised or applies from a date | §3.3 | V1 |
| Subjects | 87 subjects with codes in Annexure II. Paper I (General Paper) is compulsory for all | Annex. II | V1 |
| Dates in this bulletin | Applications 08–28 Oct 2026; correction window 02–04 Nov 2026; exam 14–18 Dec 2026 and 21 Dec 2026; admit card from 07 Dec 2026. **Later notices (S7) extended some deadlines, so treat these dates as possibly superseded.** | Various | V1 |
| Shifts | A subject is planned for one shift. If a subject runs in several shifts, scores are normalised by the equi-percentile method (Annexure XI) | Annex. XI | V1 |
| Answer-key challenges | Provisional key shown for about 2–3 days; Rs 200 per challenged question; NTA's decision is final | §11.1 | V1 |
| Internal date or version | The PDF has **no issue date or version number** inside it. "as on 16.10.2026" appears only in the NTA listing title (S2) | — | V1 |

### 3.1 What this means for the platform (impact notes — proposals, not facts)

* **The existing default blueprint matches the bulletin on the numbers.** `DEFAULT_BLUEPRINT` (id `ugcnet-practice-full-v1`) is 180 minutes, `paper1` = 50 questions, `paper2` = 100 questions, +2 correct, 0 incorrect, 0 unattempted. It currently carries `officialPatternVerified: false`. After a person confirms §3.2, §3.4 and §3.5 against the PDF (V3), the owner can decide to set it to true through the existing owner-only blueprint path.
* **The scoring engine does not implement §3.5 (6a)–(6c).** `scoreQuestion` treats a multi-answer question as "exact set match" and has no notion of "any listed option is accepted" or "dropped question, credit everyone who attempted". These cases only arise when an answer key is **revised**, which is exactly what a trustworthy platform must be able to do when a mistake is found. This is recorded as engine change request **CE-1** in the architecture document, not as part of the content foundation.
* **Raw score only.** The platform cannot reproduce equi-percentile normalisation. Result screens must keep saying the score is a practice score. This already exists as `DISCLAIMERS`.
* **Language rule.** `LANGS = ['en','hi']` fits the subject papers that are bilingual. The bulletin says language papers are set in the language concerned, but it gives **no per-subject medium table**, so which of the 87 subjects are language papers is not stated. The table in section 4 marks 29 rows as "language subject (inferred)" from their names only; that is the author's reading, not an official list. The data model must therefore carry a per-subject medium policy (data dictionary, `subjects.mediumPolicy`) that an editor sets from the official source, instead of assuming English plus Hindi everywhere.

## 4. Subject and code catalogue — 88 rows, level V1

**Cross-check performed:** the code set on the syllabus page (S4) and the code set in the bulletin's Annexure II (S3) were compared mechanically. They are **identical** except that S4 additionally has code `00` (Paper I). Both give 87 subjects plus Paper I. Subject codes in this table are therefore consistent across two official sources, although both are V1.

**"Syllabus page: files listed"** only records what the S4 table showed in its two link columns. It does not say the files open, are correct, or are current.

Rows whose note says "language subject (inferred)" are the author's classification from the subject name. The bulletin has no per-subject medium table (§3.4 states the rule only in general terms), so this classification must be confirmed in M9.0.

Counts from the S4 table: 56 rows list separate English and Hindi files; 26 list one file in both columns; 4 list a Hindi file only (codes 20, 73, 94, 95); 2 list an English file only (codes 88, 89).

| Code | Subject (official name as printed) | Syllabus page: files listed | Notes |
|---|---|---|---|
| 00 | General Paper on Teaching & Research Aptitude (Paper-I)  [name as on syllabus page; not in Annexure II] | separate EN and HI files |  |
| 01 | Economics / Rural Economics /Co-operation / Demography / Development Planning/Development Studies / Econometrics/ Applied Economics / Development Economics /Business Economics | separate EN and HI files | Umbrella title |
| 02 | Political Science | separate EN and HI files |  |
| 03 | Philosophy | separate EN and HI files |  |
| 04 | Psychology | separate EN and HI files |  |
| 05 | Sociology | separate EN and HI files |  |
| 06 | History | separate EN and HI files |  |
| 07 | Anthropology | separate EN and HI files |  |
| 08 | Commerce | separate EN and HI files |  |
| 09 | Education | separate EN and HI files |  |
| 10 | Social Work | separate EN and HI files |  |
| 11 | Defence and Strategic Studies | separate EN and HI files |  |
| 12 | Home Science | separate EN and HI files |  |
| 14 | Public Administration | separate EN and HI files |  |
| 15 | Population Studies | separate EN and HI files | Bulletin footnote prints the code as 015 (table prints 15) |
| 16 | Music | separate EN and HI files |  |
| 17 | Management (including Business Admn. Mgt./Marketing / Marketing Mgt./ Industrial Relations and Personnel Mgt./ Personnel Mgt./Financial Mgt. /Co- operative Management) | separate EN and HI files |  |
| 18 | Maithili | one file in both columns | Language subject (inferred) |
| 19 | Bengali | one file in both columns | Language subject (inferred) |
| 20 | Hindi | Hindi only | Language subject (inferred); English cell blank |
| 21 | Kannada | one file in both columns | Language subject (inferred) |
| 22 | Malayalam | one file in both columns | Language subject (inferred) |
| 23 | Oriya | one file in both columns | Language subject (inferred); file on the page is named Odia |
| 24 | Punjabi | one file in both columns | Language subject (inferred) |
| 25 | Sanskrit | separate EN and HI files | Language subject (inferred) |
| 26 | Tamil | one file in both columns | Language subject (inferred) |
| 27 | Telugu | one file in both columns | Language subject (inferred) |
| 28 | Urdu | one file in both columns | Language subject (inferred) |
| 29 | Arabic | one file in both columns | Language subject (inferred) |
| 30 | English | one file in both columns | Language subject (inferred) |
| 31 | Linguistics | separate EN and HI files |  |
| 32 | Chinese | one file in both columns | Language subject (inferred) |
| 33 | Dogri | one file in both columns | Language subject (inferred) |
| 34 | Nepali | one file in both columns | Language subject (inferred) |
| 35 | Manipuri | one file in both columns | Language subject (inferred) |
| 36 | Assamese | one file in both columns | Language subject (inferred) |
| 37 | Gujarati | one file in both columns | Language subject (inferred) |
| 38 | Marathi | one file in both columns | Language subject (inferred) |
| 39 | French (French Version) | separate EN and HI files | Language subject (inferred) |
| 40 | Spanish | one file in both columns | Language subject (inferred) |
| 41 | Russian | separate EN and HI files | Language subject (inferred) |
| 42 | Persian | one file in both columns | Language subject (inferred) |
| 43 | Rajasthani | one file in both columns | Language subject (inferred); the single file is named Rajasthani_Hindi |
| 44 | German | one file in both columns | Language subject (inferred) |
| 45 | Japanese | one file in both columns | Language subject (inferred) |
| 46 | Adult Education/ Continuing Education/ Andragogy/ Non-Formal Education | separate EN and HI files |  |
| 47 | Physical Education | separate EN and HI files |  |
| 49 | Arab Culture and Islamic Studies | separate EN and HI files |  |
| 50 | Indian Culture | separate EN and HI files |  |
| 55 | Labour Welfare / Personnel Management / Industrial Relations/ Labour and Social Welfare / Human Resource Management | separate EN and HI files |  |
| 58 | Law | separate EN and HI files |  |
| 59 | Library and Information Science | separate EN and HI files |  |
| 60 | Buddhist, Jaina, Gandhian and Peace Studies | separate EN and HI files | Hindi file name on the page contains a typo (Peaces Stusies) |
| 62 | Comparative Study of Religions | separate EN and HI files |  |
| 63 | Mass Communication and Journalism | separate EN and HI files |  |
| 65 | Performing Art - Dance/Drama/Theatre | separate EN and HI files |  |
| 66 | Museology & Conservation | separate EN and HI files |  |
| 67 | Archaeology | separate EN and HI files |  |
| 68 | Criminology | separate EN and HI files |  |
| 70 | Tribal and Regional Language/Literature | separate EN and HI files |  |
| 71 | Folk Literature | separate EN and HI files |  |
| 72 | Comparative Literature | separate EN and HI files |  |
| 73 | Sanskrit traditional subjects (including Jyotisha/Sidhanta Jyotish/ Navya Vyakarna/ Vyakarna/ Mimansa/ Navya Nyaya/ Sankhya Yoga/ Tulanatmaka Darsan/ Shukla Yajurveda/ Madhav Vedant/ Dharmasasta/ Sahitya/ Puranotihasa /Agama) | Hindi only | Hindi file only; English cell blank |
| 74 | Women Studies | separate EN and HI files | Bulletin footnote (eligibility for Humanities/Social Sciences masters) has a ** marker that is not attached to any table row |
| 79 | Visual Art (including Drawing & Painting/Sculpture Graphics/Applied Art/History of Art) | separate EN and HI files |  |
| 80 | Geography | separate EN and HI files |  |
| 81 | Social Medicine & Community Health | separate EN and HI files |  |
| 82 | Forensic Science | separate EN and HI files |  |
| 83 | Pali | separate EN and HI files |  |
| 84 | Kashmiri | one file in both columns | Language subject (inferred) |
| 85 | Konkani | one file in both columns | Language subject (inferred) |
| 87 | Computer Science and Applications | one file in both columns | Same file in both columns; file name says English Only |
| 88 | Electronic Science | English only | English file only; Hindi cell blank; file name says English Only |
| 89 | Environmental Sciences | English only | English file only; Hindi cell blank; file name says English Only |
| 90 | Politics including International Relations/International Studies including Defence / Strategic Studies, West Asian Studies, Southeast Asian Studies, African Studies, South Asian Studies, Soviet Studies, American Studies | separate EN and HI files |  |
| 91 | Prakrit | separate EN and HI files |  |
| 92 | Human Rights and Duties | separate EN and HI files |  |
| 93 | Tourism Administration and Management | separate EN and HI files |  |
| 94 | Bodo | Hindi only | Hindi file only (named Hindi_Only); English cell blank |
| 95 | Santali | Hindi only | Hindi file only (named Hindi_Only); English cell blank |
| 100 | Yoga | separate EN and HI files |  |
| 101 | Sindhi | separate EN and HI files | English-column file is named Sindhi_Arabic |
| 102 | Hindu Studies | separate EN and HI files |  |
| 103 | Indian Knowledge System | separate EN and HI files |  |
| 104 | Disaster Management | separate EN and HI files |  |
| 105 | Ayurveda Biology | separate EN and HI files |  |
| 106 | Forestry | separate EN and HI files |  |
| 107 | Statistics | separate EN and HI files | Only syllabus document actually opened in this session (Hindi PDF); see section 5 |

## 5. Syllabus content — coverage status: NONE VERIFIED

**No unit, topic or sub-topic of Paper I or of any Paper II subject was verified in this session.** The reasons are factual and are recorded so nobody repeats the same attempt:

1. Three fetches of `showPdf.php` links, for Paper I English (twice) and Commerce English, all returned **the same document: the Statistics (code 107) syllabus in Hindi**. The three links differ only in an encoded query string, so this looks like a fetch-tool or proxy artefact rather than evidence about the UGC server. Treat all three results as unusable for Paper I and Commerce.
2. Fetching the same link with an un-encoded path returned a **302 redirect** to a pre-signed storage URL on `ugc-web-files.s3.ap-south-1.amazonaws.com` that expires in 60 seconds. The tool could not follow it (the URL was rejected as too long). Pre-signed, expiring links also mean **no stable direct URL exists for a syllabus PDF**. Provenance must therefore rest on the downloaded file's hash, not on a URL.
3. The one document that did open (Statistics, Hindi) came back with **corrupted Devanagari text** — letters dropped or replaced inside words, for example in unit and topic lines. This is the classic result of legacy-font Hindi PDFs. **Automatic text extraction of Hindi syllabus PDFs must not be trusted**; Hindi records need typed, human-checked entry (see M9_CONTENT_INGESTION_SPEC.md).
4. The Paper I syllabus was therefore not read at all. The ten-unit list in the existing seed (`SEED_SUBJECTS`, labelled `under_development`) matches what is widely published, but that is the author's recollection and the repository's own note says it "has NOT been checked against the official syllabus". **It stays unverified.**

### 5.1 One structural observation (V1, sample size one)

The Statistics (107) Hindi document, as the tool read it, has **10 units**. Each unit is a title followed by a series of long bullet lines, each line often holding several comma-separated ideas. There are no numbered topics and no sub-topics.

This is one subject and one language, so it proves little, but it supports a design decision made in the architecture document: **the official syllabus is "unit → verbatim statements", not "unit → topic → sub-topic".** The platform's topic and sub-topic tree is an editorial layer that must point back to the verbatim official lines, so that nobody can claim an editor's topic is an official one.

The ten unit titles the tool reported for code 107 (English rendering by the tool, **unverified**): Probability and Distributions; Real Analysis and Matrix Algebra; Sampling Methods and Design of Experiments; Theory of Estimation; Testing of Hypotheses; Linear Estimation, Regression Analysis and Econometrics; Time Series; Multivariate Analysis; Stochastic Processes; Indian Official Statistics System and Research Methodology. They are listed here only as an example of what a record looks like. They must not be copied into the catalogue until a person has checked them against the PDF.

## 6. Did any later amendment to the syllabus exist? — what was and was not established

The assignment says the catalogue presents its syllabi as applying "from June 2019 onwards" and asks that this not be assumed final. What was established:

| Finding | Level | Consequence |
|---|---|---|
| The page banner still says "Applicable from June 2019 UGC-NET Onwards" (S4) | V1 | — |
| The same page lists subject codes **102–107** (Hindu Studies, Indian Knowledge System, Disaster Management, Ayurveda Biology, Forestry, Statistics). The page does not say when each was added. The author believes these are later additions but **did not verify it** | V1 | The banner year cannot be used to conclude that nothing changed since 2019. Each subject needs its own effective date. |
| The page has no per-subject date, version or amendment history | V1 | Version history must be created by UrEducator (hash and retrieval date per file). |
| The December 2026 bulletin contains no statement that the syllabus was revised and no effective date (§3.3) | V1 | — |
| A **corrigendum** to the December 2026 bulletin exists (S6) and its contents are unknown | V0 | Cannot rule out syllabus, subject or pattern changes. **Owner action O-3.** |
| A secondary news article (S9) says Statistics was added in 2026 and that the count rose from 85 to 86 | lead | See D9 |
| No NTA or UGC notice announcing a revised Paper I or Paper II syllabus was found in the pages that could be read | V1, absence of evidence only | Not proof that none exists. |

**Conclusion:** no later amendment was found, but the search was incomplete (S5 and S6 could not be read, and no syllabus PDF was read). The correct statement is "no amendment found in the pages reached", **not** "no amendment exists".

Search-result pages from coaching sites were seen (for example pages claiming "new syllabus" or "latest changes"). They were **not** used and are not cited as sources.

## 7. Discrepancies and open items for owner review

| # | Item | Detail | Needs |
|---|---|---|---|
| D1 | Assignment URL not reachable | `.../document-category/information-bulletin/` was blocked. `.../information-bulletin/` worked and shows what looks like the same list. | Owner to confirm it is the same list when browsing normally. |
| D2 | `subjects.php` not reachable | Blocked for both host spellings. Annexure II of the bulletin was used instead, and agrees with the syllabus page. | Owner to open it once and confirm the 87 subjects and codes match. |
| D3 | "June 2019" banner vs newer subjects | See section 6. | Per-subject effective dates from UGC notices. |
| D4 | **Corrigendum unread** | S6 was blocked. Unknown whether the 16.10.2026 "updated" bulletin already includes it. | **Owner to download S6 and S3 and send both, or have Antigravity capture them with hashes (M9.0).** |
| D5 | Bulletin footnote codes | Population Studies is printed as `015` in a footnote and `15` in the table. Women Studies is `074` in a footnote and `74` in the table; its `**` marker is attached to no row. | Treat codes as strings, normalise on import, keep the printed form in a `printedCode` field. |
| D6 | Syllabus language availability | Four subjects list only a Hindi file (20, 73, 94, 95); two list only an English file (88, 89); 26 list one file twice. Files for 87, 88, 89 are named "English Only", yet §3.4 says papers are bilingual. This may be fine (syllabus language is not paper language) but is not explained. | Owner/UGC clarification of paper medium per subject. |
| D7 | Hindi PDF text corruption | Section 5, point 3. | Design consequence only: no automatic Hindi extraction. |
| D8 | Fetch returned an unrelated PDF | Section 5, point 1. | Do not rely on this session's fetches for any syllabus file. |
| D9 | Subject count drift | Bulletin (Dec 2026): 87 subjects. Secondary article (Apr 2026): 85 → 86 with Statistics. A search-result headline also mentions Forestry. The numbers do not obviously reconcile. | Check against UGC's own notice. Low impact on architecture. |
| D10 | Printed names vs display names | Annexure II uses long umbrella titles (for example code 01 lists nine fields) and spellings such as "Oriya" where files say "Odia". | Store `officialName` exactly as printed and a separate `displayName`. Never edit the official one. |
| D11 | Internal handoff vs repository (not a source issue) | `docs/AI_HANDOFF.md` §12.2 says the staging seed has subjects Paper 1, History, Commerce and Computer Science and tests `mt-unit` and `mt-quick`. The code in `functions/src/devtools/demoSeed.ts` seeds Education (not History) and tests `mt-mini`, `mt-mini-late`, `mt-full`. Counts (4 subjects, 13 units, 15 topics, 3 tests) match either way. **Staging was not inspected.** | Antigravity to do a read-only listing of staging to settle it (no write). |
| D12 | Scoring rule vs engine | Bulletin §3.5 (6a)–(6c) vs `scoreQuestion`. | CE-1 in the architecture document. |

## 8. M9.0 verification procedure (this is the first implementation milestone, and it needs a human)

The goal is to turn V1 into V2/V3 and to freeze a hashed copy of every source used.

**Who:** the owner (or a delegate the owner names) downloads; a second person verifies; Antigravity writes the manifest. Claude reviews the manifest and the first sample.

**Step 1 — capture (owner, normal browser).**
1. Download S3 (updated bulletin) and S6 (corrigendum) and, for comparison, S3b (08.10.2026 bulletin).
2. From S4, download the Paper I English and Hindi PDFs first. Download Paper II files subject by subject as each subject is scheduled (M9.5), not all 176 at once.
3. For each file record: file name, source page URL, **date retrieved**, size, page count, and **SHA-256**.
4. Keep the originals in a private place (the private repository folder `content-sources/` or the owner's drive). They are public government documents, but the copy kept is an evidence copy, not something the app serves.

**Step 2 — verify the exam pattern (two people, V3).** Compare section 3 of this register with S3 and S6 line by line. Record agreement or differences. Only then may the owner decide whether to set `officialPatternVerified` on the default blueprint.

**Step 3 — verify the Paper I syllabus (two people, V3).** For each of the ten Paper I units: unit number, title, and each verbatim line, in English and in Hindi, with page number. Hindi lines are **typed or visually checked**, never pasted from a text layer.

**Step 4 — record discrepancies.** Anything that differs between the English and Hindi versions, between S3 and S4, or between a PDF and an earlier recollection goes in the table in section 7. It is not silently resolved.

**Step 5 — freeze.** The verified record becomes `syllabusVersions/{subject}_{n}` with status `verified`, the manifest of source hashes, and the names of the two verifiers. The source register is updated to V2/V3 entries.

**Acceptance for M9.0:** S3 and S6 captured and hashed; section 3 re-confirmed or corrected at V3; Paper I English and Hindi captured, hashed and checked at V3; the 87-subject code list confirmed against `subjects.php`; every row of section 7 either closed or explicitly accepted by the owner.

## 9. What this register does not claim

* It does not claim any syllabus text is correct.
* It does not claim the corrigendum changes nothing.
* It does not claim the exam dates in the bulletin are still current.
* It does not claim which subjects are language papers.
* It does not claim that using official past-year question text in a commercial product is permitted. That is a legal question for the owner (decision O-1 in the roadmap). Nothing here is legal advice.
