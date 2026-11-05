# M9.0-A — Official UGC NET Curriculum Dataset: Validation Report, Source Register and Handoff

| | |
|---|---|
| **Milestone** | M9.0-A — research and data preparation (no code, no cloud, no database) |
| **Date** | 5 November 2026 |
| **Author** | Claude (architecture and security lead) |
| **Baseline** | Repository commit `694999a` (M8.8.5 accepted). Nothing in the repository was touched. |
| **Dataset version** | `0.1.0-skeleton`, release status `SKELETON_UNVERIFIED` |
| **Status** | For owner review. Nothing here was imported, written to Firestore or deployed. |

## 0. The answer in plain words

**What you asked for** was the complete official Paper I syllabus (10 units, topics, sub-topics, English and Hindi) and the unit structure of every Paper II subject, each with its source and verification status.

**What I can honestly give you today** is the full *identity layer*, and an exact map of what is still missing:

1. **All 88 rows are in the dataset** (Paper I plus 87 Paper II subjects) with their codes, official names as printed, and the link to every official syllabus file (144 file links). Three official sources agree on the code set. Level **V1** (read through a page-reading tool, not yet checked by a person against a PDF).
2. **No syllabus content is verified.** Not one unit, topic or sub-topic of Paper I or of any Paper II subject was read from an official document. The official syllabus PDFs cannot be opened from this environment (section 3.2 says exactly why). I did not fill the gap from memory or from coaching sites, because you told me not to, and because a wrong syllabus is worse than an empty one.
3. **One partial exception:** ten unit titles for Statistics (107) were seen earlier in the session. They are the reading tool's English rendering of a Hindi document, the file's identity is unproven, and they are marked `importEligible: false`. They are in the file only as an example of a correctly marked record.
4. **New official findings** (all V1): the NTA list of 30 Apr 2026 has 87 subjects while the June 2026 bulletin had 85, so Forestry (106) and Statistics (107) are newer than the "June 2019" banner (section 6.2). No official notice announcing a revised syllabus was found, but that is *absence of evidence*, not proof (section 6.1).
5. **The validator works.** It reports 0 errors on the dataset and caught all 17 defects I seeded on purpose. Its "gap" lines are the honest list of what is not yet read.

**The one thing that turns this skeleton into a real dataset** is capturing the official PDFs on a normal machine (browser download, SHA-256) and transcribing Paper I with two people. Section 9 is the step-by-step handoff for Antigravity, including a copy-ready prompt.

### 0.1 Verified versus unresolved — one table

| Layer | Status | Level |
|---|---|---|
| Subject identity: 88 rows, codes, official names, file links | Complete | V1 (codes agree in S3, S4, S14) |
| Paper I: 10 units, statements, topics, sub-topics, English and Hindi | **Not read** (GAP-01) | none |
| Paper II: units, statements, topics for 87 subjects | **Not read** (GAP-02); Statistics has 10 tool-translated unit titles only | none |
| Document title, issue date, revision date, page numbers | **Unknown** for all 144 documents (GAP-04) | none |
| SHA-256 and size of any source file | **None captured** (GAP-06) | none |
| Effective date per subject | **Unknown**; one catalogue-wide banner "June 2019 onwards" (GAP-05) | V1, banner only |
| Syllabus changed since June 2019? | **No notice found; not proven** (corrigendum S6 unread) | absence of evidence only |
| Exam scheme (50 + 100 questions, +2, no negative) | Observed in the bulletin, not part of the curriculum tree | V1 |

## 1. Deliverables

| File | What it is | Size / hash (SHA-256) |
|---|---|---|
| `docs/M9_OFFICIAL_CURRICULUM_DATA.json` | **Deliverable 1.** The dataset. UGC NET > Paper > Subject > Unit > Topic > Subtopic with provenance and verification at every level. | 447,507 bytes; `a2d902c22a93c49a4517534f1540f2841ff8c4135d820733230b8e645b5cb8f0` |
| `docs/M9_OFFICIAL_CURRICULUM_VALIDATION.md` | **Deliverable 2.** This report (source register, validation results, gaps, handoff). | (this file) |
| `docs/M9_OFFICIAL_CURRICULUM_DATA.schema.json` | Supporting. JSON Schema (draft 2020-12) that the dataset must satisfy. | 30,613 bytes; `eaa66e955e0b9bf7771a68f83a8bd34be369c47c6d6387005592cbf8ce075cb8` |
| `docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py` | Supporting. Runs the schema plus the Part E checks and a self-test. A research tool, not application code. | 30,854 bytes; `b398f3aba27d3ae4bef146675ab93e1630793983333961be65bbcdb22783ef5f` |

Counts in the dataset: 88 subject rows, 144 syllabus document records, 19 source records, 12 declared gaps, 10 unit records (all Statistics, none import-eligible), 0 official-text items, 0 topics, 0 sub-topics.

No file in the repository was created or changed. Nothing was written to any database. No cloud call was made.

## 2. How the dataset is built

### 2.1 Hierarchy

```
UGC NET                          ugcNet                        (V1, sources S3 S4)
└─ Paper (2)                     papers[]                      paper-1, paper-2
   └─ Subject (88 rows)          papers[].subjects[]           code, official name, document links, syllabus version
      └─ Unit                    subjects[].units[]            unit number, title (EN/HI), page
         ├─ Official text        units[].officialText[]        the verbatim statements the official PDF prints under the unit
         └─ Topic                units[].topics[]              origin = official | editorial, cites officialRefs
            └─ Subtopic          topics[].subtopics[]          same rule
```

**Why "official text" sits beside "topic".** The one syllabus document read so far (Statistics) is *unit → long verbatim lines*, with no numbered topics or sub-topics (source register section 5.1; architecture decision ADR-1). So the file stores the official lines exactly, and treats topics and sub-topics as an editorial layer that must point back to those lines through `officialRefs`. A topic with `origin: editorial` and no refs is rejected by the schema. This is how the file avoids presenting an editor's topic as an official one. Field names (`officialText`, `officialRefs`, `origin`) follow `M9_CONTENT_DATA_DICTIONARY.md`.

### 2.2 Verification levels (same as the source register)

| Level | Meaning | Used for |
|---|---|---|
| V0 | Not reached. Nothing claimed. | 6 sources (blocked or not opened) |
| V1 | Seen through a page-reading tool on 5 Nov 2026. Not checked by a person against the PDF. | 88 subjects, 144 documents (link listed), 13 sources, 10 Statistics unit titles |
| V2 | A named person compared the record with a downloaded PDF whose SHA-256 is recorded. | nothing yet |
| V3 | Two different people did V2 independently. | nothing yet |

`unit.importEligible: true` is allowed only at V2 or V3 (the schema enforces it). `OFFICIAL_VERBATIM` text needs a source document, a page number and a V2 unit (the validator enforces it).

### 2.3 Translations

Every piece of title or text is a `localizedText` with a `provenance`:

| Provenance | Needs | Meaning |
|---|---|---|
| `OFFICIAL_VERBATIM` | source document and page; unit at V2+ | Typed or visually checked from the official file in that language. |
| `TRANSLATION_UNVERIFIED` | `translatedFrom`, `translatedBy`, source document | A rendering by a person or tool, not yet reviewed. Never shown as official. |
| `TRANSLATION_REVIEWED` | same | A rendering a second person has reviewed. Still not official wording. |

The ten Statistics titles are `TRANSLATION_UNVERIFIED`, translated from Hindi by "page-reading tool (automatic rendering)". Their Hindi side is `null` because the text layer was corrupted (GAP-07). No Hindi was typed by me.

### 2.4 Part C — where each required provenance field lives

| Part C requirement | Field | State today |
|---|---|---|
| Official issuing authority | `documents[].issuingAuthority`, `sources[].issuingAuthority` | UGC for the 144 syllabus documents (basis: catalogue footer "© University Grants Commission (UGC)" and the bulletins' pointer to the UGC site; document front matter not read). NTA for notices and bulletins. |
| Source URL | `documents[].sourceUrl` and `catalogueUrl`; `sources[].url` | Present for all 144 documents and 19 sources. The document URL is a catalogue link that redirects to an expiring storage URL, so it is a pointer, not a stable address (S4, S8). |
| Document title | `documents[].documentTitle` | `null`/`NOT_READ` for 143; one search-result title for Paper I English, flagged as a lead only. |
| Publication or revision date | `documents[].publication` | `null`/`NOT_ESTABLISHED` for all 144. |
| Applicable examination period | `documents[].applicableExamPeriod`, `subjects[].effectiveFrom`, `syllabusVersions[]` | "June 2019 UGC-NET onwards" from the catalogue banner only, marked `CATALOGUE_BANNER_ONLY_NOT_PER_DOCUMENT`. Subjects 106 and 107 are `UNRESOLVED_SUBJECT_ADDED_LATER`. |
| PDF page number or section | `documents[].pageOrSection`, `units[].pageOrSection`, `officialText[].page` | Not read for any record. |
| Language | `documents[].language` (value, basis, verified) and each `localizedText` | English or Hindi by *catalogue column label*, unverified. 26 single files shown in both columns have language `null` with the file name as a hint. |
| Verification status | `verification` and `verificationScope` on every paper, subject, document, unit, topic, subtopic and source | V1 or V0 everywhere. |

## 3. Source register

### 3.1 Sources used (19). All were read through a summarising page-reading tool. None is above V1.

| ID | Source | Authority | Level | Read? | What it gave / limit |
|---|---|---|---|---|---|
| S1 | [NTA UGC-NET home page](https://ugcnet.nta.nic.in/) | National Testing Agency (NTA) | V1 | read tool summary | Current cycle is UGC-NET December 2026. Public-notice list incl. corrigendum link (S6), 2 Nov 2026 correction of particulars, 1 Nov 2026 fee-date extension, 27 Oct 2026 deadline extension. No syllabus link and no subject list on the page. **Limit:** Page prints no dates beside notices; dates were inferred from PDF file-name prefixes. Tool summary, not a human check. |
| S2 | [NTA information-bulletin listing](https://ugcnet.nta.nic.in/information-bulletin/) | National Testing Agency (NTA) | V1 | read tool summary | Lists the Updated Information Bulletin of UGC-NET December 2026 'as on 16.10.2026', the 08.10.2026 bulletin, June 2026 and earlier bulletins. **Limit:** The assignment path /document-category/information-bulletin/ was blocked; this is assumed to be the same list (register D1). |
| S3 | [Updated Information Bulletin, UGC-NET December 2026 (as on 16.10.2026), incl. Annexure II subject list](https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/20261016860019603.pdf) | University Grants Commission (UGC) / National Testing Agency (NTA) | V1 | read partial tool summary | Exam pattern, language rule, 87-subject list with codes (Annexure II), pointer to the syllabus catalogue (section 3.3). No statement that the syllabus was revised. **Limit:** About 100,000 of 104,802 characters read through a summarising tool. The PDF carries no issue date; 'as on 16.10.2026' comes from the NTA listing title only. |
| S3b | [Information Bulletin UGC-NET December 2026 (as on 08.10.2026)](https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/202610081852912625.pdf) | National Testing Agency (NTA) | V0 | not read | Nothing. **Limit:** Not opened. Needed only to diff against S3. |
| S4 | [UGC syllabus catalogue: 'Updated Syllabi of UGC-NET (Applicable from June 2019 UGC-NET Onwards)'](https://ugcnetonline.in/syllabus-new.php) | University Grants Commission (UGC) | V1 | read tool summary | 88 rows (Paper I + 87 subjects) with English-column and Hindi-column file links; page banner 'Applicable from June 2019 UGC-NET Onwards'; footer '(c) University Grants Commission (UGC), 2014'; no per-row date or version. Re-read on 5 Nov 2026 at https://www.ugcnetonline.in/syllabus-new.php (same page, www host). **Limit:** Links point to showPdf.php, which answers with a 302 to an expiring pre-signed storage URL (observed for Paper-I English). There is therefore no stable direct file URL; provenance must rest on a downloaded copy's SHA-256. Hrefs were read through a summarising tool and are V1, not byte-checked. |
| S5 | [UGC subject list page](https://ugcnetonline.in/subjects.php) | University Grants Commission (UGC) | V0 | blocked | Nothing. **Limit:** Blocked by the session network allowlist (both host spellings). Annexure II (S3) and the NTA list (S14) were used instead and agree with the catalogue code set. |
| S6 | [Corrigendum to the Information Bulletin of UGC-NET December 2026 Examination](https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/202610161905649093.pdf) | National Testing Agency (NTA) | V0 | blocked | Nothing. The file exists (linked from S1 and S16). Its contents are unknown. **Limit:** Blocked twice (first on an earlier attempt, again on 5 Nov 2026: URL_NOT_ON_ALLOWLIST). Cannot rule out a syllabus, subject or pattern change inside it. The FAQ (S15, Q20) says the Updated Bulletin was issued with this corrigendum. |
| S7 | [Other public notices listed on S1 (titles only)](https://ugcnet.nta.nic.in/) | National Testing Agency (NTA) | V0 | not read | Titles only: opening of registration (8 Oct 2026), 1 Nov 2026 fee-date extension (cdnbbsr .../2026/11/202611011602362868.pdf), 2 Nov 2026 correction of particulars, e-certificates for June 2026 (24 Sep 2026). **Limit:** Contents not opened. No title mentions the syllabus. |
| S8 | [Syllabus PDFs behind the catalogue links (88 rows, 144 distinct document links)](https://www.ugcnetonline.in/syllabus-new.php) | University Grants Commission (UGC) | V0 | not read usably | Link addresses only. No Paper I or Paper II syllabus text was verified. **Limit:** Three earlier fetches of showPdf links returned the Statistics (107) Hindi document instead of the document requested (register D8). On 5 Nov 2026 the Paper-I English link returned a 302 to a pre-signed storage URL and the follow-up fetch was rejected as too long (HTTP 403 PROXY_REJECTED). Neither was worked around. |
| S10 | [UGC site page https://www.ugc.gov.in/net/syllabus.aspx](https://www.ugc.gov.in/net/syllabus.aspx) | University Grants Commission (UGC) | V1 | read tool summary | The page held no syllabus text and no syllabus links; it points to ugcnetonline.in. Footer: 'Website last updated on 05-11-2026'. **Limit:** The tool noted error messages on the page, so it may not have rendered fully. |
| S11 | [Information Bulletin UGC-NET December 2023](https://ugcnet.nta.ac.in/images/information-bulletin-for-ugc-net-december-2023.pdf) | National Testing Agency (NTA) | V1 | read partial tool summary | Section 4.3 says syllabus for all NET subjects is downloaded from the UGC website and NTA does not send copies. No statement about a syllabus revision date. **Limit:** First 100,000 of 102,750 characters read. |
| S12 | [Information Bulletin UGC-NET June 2025](https://ugcnet.nta.ac.in/images/information-bulletin-for-ugc-net-june-2025-16042025.pdf) | National Testing Agency (NTA) | V0 | blocked | Nothing. **Limit:** Fetch refused (robots_disallowed). |
| S13 | [Information Bulletin UGC-NET June 2026](https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/04/202604291863555100.pdf) | National Testing Agency (NTA) | V1 | read tool summary | Section 2.3 points to the UGC website for syllabi. Appendix-II lists 85 subjects (codes 01 to 105) and does not list Statistics (107); Forestry (106) is also absent from that count. No statement of syllabus change. **Limit:** Bulletin shows no issue date or version. File path suggests 29 Apr 2026. 'Forestry absent' is an inference from the count of 85 and the code range 01-105. |
| S14 | [List of Subjects of UGC-NET June 2026 Examination (NTA notice dated 30.04.2026)](https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/04/20260430737599423.pdf) | National Testing Agency (NTA) | V1 | read tool summary | 87 subjects, codes printed as three digits (001 ... 107), including 106 Forestry and 107 Statistics. Paper I not listed. Names for long umbrella titles were abbreviated by the reading tool, so only the code set was used from this source. **Limit:** Tool summary. Same file appears in the NTA archive listing (S17). |
| S15 | [FAQs UGC-NET December 2026](https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/20261019257579260.pdf) | National Testing Agency (NTA) | V1 | read tool summary | Q35 points to https://www.ugcnetonline.in/syllabus-new.php for the subject-wise syllabus and to Annexure II for codes. Q20 says the Updated Bulletin (corrigendum of 16 Oct 2026) prevails. Nothing about a syllabus revision. **Limit:** No date inside the document. |
| S16 | [NTA UGC-NET 'Documents' page](https://ugcnet.nta.nic.in/documents/) | National Testing Agency (NTA) | V1 | read tool summary | Page 1 of 2 holds one title with 'Corrigendum' (S6) and no title mentioning syllabus, scheme, amendment or revised. **Limit:** Page 2 not read. |
| S17 | [NTA UGC-NET 'Archive' page](https://ugcnet.nta.nic.in/archive/) | National Testing Agency (NTA) | V1 | read tool summary | Listing from about April 2022 to September 2026. The only subject-related title is 'List of Subjects of UGC-NET June 2026 Examination' (S14). No title mentions a syllabus revision, a new subject, or an addition of a subject. **Limit:** Titles only; the 2022 section was cut off mid-entry so the archive may reach back further. |
| S18 | [NTA public notice, 16 Aug 2026 (re-conduct of June 2026 papers: English, Commerce, Sociology)](https://nta.ac.in/Download/Notice/Notice_20260816203522.pdf) | National Testing Agency (NTA) | V1 | read tool summary | Mentions 87 subjects. No mention of the syllabus. **Limit:** Tool summary. |
| S19 | [NTA public notice, 27 Oct 2026 (extension of last date for the December 2026 application form)](https://nta.ac.in/Download/Notice/Notice_20261027235155.pdf) | National Testing Agency (NTA) | V1 | read tool summary | Extends the application deadline to 31 Oct 2026. No mention of the syllabus. **Limit:** Tool summary. |

The register uses the same IDs as `M9_OFFICIAL_SOURCE_REGISTER.md` (S1–S8), so the two documents can be read together. S9 there is a news article that is deliberately not a source here. S10–S19 are new in this task.

### 3.2 Why the syllabus PDFs could not be read — so nobody repeats the attempt

1. The catalogue links open `showPdf.php`, which answers with a **302 redirect to a pre-signed storage URL that expires in 60 seconds**. Reading it on 5 Nov 2026 failed: the reading tool rejected the long URL (`HTTP 403 PROXY_REJECTED: url exceeds the maximum fetchable length`). I did not try to get around it.
2. Earlier in the session three fetches of `showPdf` links (Paper I English twice, Commerce English) each returned the **Statistics (107) Hindi document** instead (register D8). Those results were discarded for Paper I and Commerce.
3. The one Hindi document that did open had **corrupted Devanagari** (legacy-font PDF). Hindi syllabus text must be typed or visually checked by a person.
4. Because the links expire, **no stable URL exists for a syllabus file**. The only trustworthy provenance for a syllabus is a downloaded copy with its SHA-256. This is why the dataset has a `file.sha256` field that is `null` today.
5. Other official URLs not reachable: the corrigendum S6 (blocked twice), `subjects.php` S5, the June 2025 bulletin S12 (robots), the 08.10.2026 bulletin S3b (not opened).

## 4. Part A — Paper I (General Paper on Teaching & Research Aptitude)

**Status: identity only. The syllabus itself was not read.**

| Item | What the dataset holds | Source / level |
|---|---|---|
| Row | `00`, "General Paper on Teaching & Research Aptitude (Paper -I)". It is the catalogue's own row number for Paper I, not an official subject code, so `codeIsOfficialSubjectCode` is `false` and `codeCanonical3` is `null`. | S4, V1 |
| English file | `Paper-I_English.pdf`, link `https://www.ugcnetonline.in/showPdf.php?p1=NTA_All_R_Syllabus%2F00-Paper-I%2FPaper-I_English.pdf` | S4, V1 (link listed) |
| Hindi file | `Paper-I_Hindi.pdf`, link `https://www.ugcnetonline.in/showPdf.php?p1=NTA_All_R_Syllabus%2F00-Paper-I%2FPaper-I_Hindi.pdf` | S4, V1 (link listed) |
| Number of units | `unitsExpected = 10`, basis `OWNER_BRIEF`, `verified: false`. The count comes from your brief, not from a document. | owner brief |
| Units, statements, topics, sub-topics (English) | **None.** `units: []`, coverage `NOT_READ`, gap GAP-01. | — |
| Hindi equivalents | **None.** GAP-07 explains why Hindi must be typed by a person. | — |
| Document title | A search-result title "GENERAL PAPER ON TEACHING & RESEARCH APTITUDE" is recorded as `SEARCH_RESULT_TITLE_ONLY_NOT_FROM_OPENED_DOCUMENT`. | lead only |
| Exam scheme | 50 MCQ, 100 marks, +2 per correct answer, no negative marking, 180 minutes shared with Paper II. | S3 sections 3.2 and 3.5, V1 |

I know the commonly published ten Paper I unit names. I have not put them in the file. They would be my recollection, not an official reading, and the existing repository seed already carries the same unverified list (register section 5, point 4). Putting them in a dataset that has provenance fields would make an unverified list look sourced.

## 5. Part B — Paper II subjects

### 5.1 The 87 subjects

Legend for the **Flags** column: **L** language subject by *my inference from the name* (not official, GAP-08); **N** the catalogue spells the name differently from Annexure II; **F** a bulletin footnote prints the code differently; **A** added after the June 2026 bulletin (106, 107); **?** first appearance date unknown (102–105). **Files** says what the catalogue shows: `EN+HI` two files; `1 file` one file in both columns; `HI only`; `EN only`.

The **Subject name** column is Annexure II of the December 2026 bulletin exactly as the reading tool reported it (row 00 uses the catalogue's own label). It is the official wording; do not edit it. Column **Code3** is NTA's three-digit form from the 30.04.2026 list.

| Code | Code3 | Subject name (as printed) | Files | Flags | Syllabus version |
|---|---|---|---|---|---|
| 00 | — | General Paper on Teaching & Research Aptitude (Paper -I) | EN+HI |  | catalogue-banner |
| 01 | 001 | Economics / Rural Economics /Co-operation / Demography / Development Planning/Development Studies / Econometrics/ Applied Economics / Development Economics /Business Economics | EN+HI | N | catalogue-banner |
| 02 | 002 | Political Science | EN+HI |  | catalogue-banner |
| 03 | 003 | Philosophy | EN+HI |  | catalogue-banner |
| 04 | 004 | Psychology | EN+HI |  | catalogue-banner |
| 05 | 005 | Sociology | EN+HI |  | catalogue-banner |
| 06 | 006 | History | EN+HI |  | catalogue-banner |
| 07 | 007 | Anthropology | EN+HI |  | catalogue-banner |
| 08 | 008 | Commerce | EN+HI |  | catalogue-banner |
| 09 | 009 | Education | EN+HI |  | catalogue-banner |
| 10 | 010 | Social Work | EN+HI |  | catalogue-banner |
| 11 | 011 | Defence and Strategic Studies | EN+HI |  | catalogue-banner |
| 12 | 012 | Home Science | EN+HI |  | catalogue-banner |
| 14 | 014 | Public Administration | EN+HI |  | catalogue-banner |
| 15 | 015 | Population Studies | EN+HI | F | catalogue-banner |
| 16 | 016 | Music | EN+HI |  | catalogue-banner |
| 17 | 017 | Management (including Business Admn. Mgt./Marketing / Marketing Mgt./ Industrial Relations and Personnel Mgt./ Personnel Mgt./Financial Mgt. /Co- operative Management) | EN+HI |  | catalogue-banner |
| 18 | 018 | Maithili | 1 file | L | catalogue-banner |
| 19 | 019 | Bengali | 1 file | L | catalogue-banner |
| 20 | 020 | Hindi | HI only | L | catalogue-banner |
| 21 | 021 | Kannada | 1 file | L | catalogue-banner |
| 22 | 022 | Malayalam | 1 file | L | catalogue-banner |
| 23 | 023 | Oriya | 1 file | L | catalogue-banner |
| 24 | 024 | Punjabi | 1 file | L | catalogue-banner |
| 25 | 025 | Sanskrit | EN+HI | L | catalogue-banner |
| 26 | 026 | Tamil | 1 file | L | catalogue-banner |
| 27 | 027 | Telugu | 1 file | L | catalogue-banner |
| 28 | 028 | Urdu | 1 file | L | catalogue-banner |
| 29 | 029 | Arabic | 1 file | L | catalogue-banner |
| 30 | 030 | English | 1 file | L | catalogue-banner |
| 31 | 031 | Linguistics | EN+HI |  | catalogue-banner |
| 32 | 032 | Chinese | 1 file | L | catalogue-banner |
| 33 | 033 | Dogri | 1 file | L | catalogue-banner |
| 34 | 034 | Nepali | 1 file | L | catalogue-banner |
| 35 | 035 | Manipuri | 1 file | L | catalogue-banner |
| 36 | 036 | Assamese | 1 file | L | catalogue-banner |
| 37 | 037 | Gujarati | 1 file | L | catalogue-banner |
| 38 | 038 | Marathi | 1 file | L | catalogue-banner |
| 39 | 039 | French (French Version) | EN+HI | L | catalogue-banner |
| 40 | 040 | Spanish | 1 file | L | catalogue-banner |
| 41 | 041 | Russian | EN+HI | L | catalogue-banner |
| 42 | 042 | Persian | 1 file | L | catalogue-banner |
| 43 | 043 | Rajasthani | 1 file | L | catalogue-banner |
| 44 | 044 | German | 1 file | L | catalogue-banner |
| 45 | 045 | Japanese | 1 file | L | catalogue-banner |
| 46 | 046 | Adult Education/ Continuing Education/ Andragogy/ Non-Formal Education | EN+HI |  | catalogue-banner |
| 47 | 047 | Physical Education | EN+HI |  | catalogue-banner |
| 49 | 049 | Arab Culture and Islamic Studies | EN+HI |  | catalogue-banner |
| 50 | 050 | Indian Culture | EN+HI |  | catalogue-banner |
| 55 | 055 | Labour Welfare / Personnel Management / Industrial Relations/ Labour and Social Welfare / Human Resource Management | EN+HI |  | catalogue-banner |
| 58 | 058 | Law | EN+HI |  | catalogue-banner |
| 59 | 059 | Library and Information Science | EN+HI |  | catalogue-banner |
| 60 | 060 | Buddhist, Jaina, Gandhian and Peace Studies | EN+HI |  | catalogue-banner |
| 62 | 062 | Comparative Study of Religions | EN+HI |  | catalogue-banner |
| 63 | 063 | Mass Communication and Journalism | EN+HI |  | catalogue-banner |
| 65 | 065 | Performing Art - Dance/Drama/Theatre | EN+HI |  | catalogue-banner |
| 66 | 066 | Museology & Conservation | EN+HI |  | catalogue-banner |
| 67 | 067 | Archaeology | EN+HI |  | catalogue-banner |
| 68 | 068 | Criminology | EN+HI |  | catalogue-banner |
| 70 | 070 | Tribal and Regional Language/Literature | EN+HI |  | catalogue-banner |
| 71 | 071 | Folk Literature | EN+HI |  | catalogue-banner |
| 72 | 072 | Comparative Literature | EN+HI |  | catalogue-banner |
| 73 | 073 | Sanskrit traditional subjects (including Jyotisha/Sidhanta Jyotish/ Navya Vyakarna/ Vyakarna/ Mimansa/ Navya Nyaya/ Sankhya Yoga/ Tulanatmaka Darsan/ Shukla Yajurveda/ Madhav Vedant/ Dharmasasta/ Sahitya/ Puranotihasa /Agama) | HI only |  | catalogue-banner |
| 74 | 074 | Women Studies | EN+HI | F | catalogue-banner |
| 79 | 079 | Visual Art (including Drawing & Painting/Sculpture Graphics/Applied Art/History of Art) | EN+HI |  | catalogue-banner |
| 80 | 080 | Geography | EN+HI |  | catalogue-banner |
| 81 | 081 | Social Medicine & Community Health | EN+HI |  | catalogue-banner |
| 82 | 082 | Forensic Science | EN+HI |  | catalogue-banner |
| 83 | 083 | Pali | EN+HI |  | catalogue-banner |
| 84 | 084 | Kashmiri | 1 file | L | catalogue-banner |
| 85 | 085 | Konkani | 1 file | L | catalogue-banner |
| 87 | 087 | Computer Science and Applications | 1 file |  | catalogue-banner |
| 88 | 088 | Electronic Science | EN only |  | catalogue-banner |
| 89 | 089 | Environmental Sciences | EN only |  | catalogue-banner |
| 90 | 090 | Politics including International Relations/International Studies including Defence / Strategic Studies, West Asian Studies, Southeast Asian Studies, African Studies, South Asian Studies, Soviet Studies, American Studies | EN+HI |  | catalogue-banner |
| 91 | 091 | Prakrit | EN+HI |  | catalogue-banner |
| 92 | 092 | Human Rights and Duties | EN+HI |  | catalogue-banner |
| 93 | 093 | Tourism Administration and Management | EN+HI |  | catalogue-banner |
| 94 | 094 | Bodo | HI only |  | catalogue-banner |
| 95 | 095 | Santali | HI only |  | catalogue-banner |
| 100 | 100 | Yoga | EN+HI |  | catalogue-banner |
| 101 | 101 | Sindhi | EN+HI |  | catalogue-banner |
| 102 | 102 | Hindu Studies | EN+HI | ? | catalogue-banner |
| 103 | 103 | Indian Knowledge System | EN+HI | ? | catalogue-banner |
| 104 | 104 | Disaster Management | EN+HI | ? | catalogue-banner |
| 105 | 105 | Ayurveda Biology | EN+HI | ? | catalogue-banner |
| 106 | 106 | Forestry | EN+HI | A | undated-added-2026 |
| 107 | 107 | Statistics | EN+HI | A | undated-added-2026 |

Layout totals (agree with the register): two files **56**, one file in both columns **26**, Hindi only **4** (20, 73, 94, 95), English only **2** (88, 89). Total 88 rows and 144 document records.

### 5.2 File-name observations (kept as found; none edited)

| Code | Observation |
|---|---|
| 20 | Hindi file only; English cell blank. |
| 23 | File on the catalogue is named Odia while the subject is printed Oriya. |
| 38 | File name contains a leading space after the underscore ('Marathi_ Marathi'). |
| 39 | Hindi-column file is named French_French.pdf (not a Hindi-looking name). |
| 41 | Hindi-column file is named Russian_Russain.pdf (spelling). |
| 43 | The single file is named Rajasthani_Hindi.pdf. |
| 60 | Hindi-column file name contains the typo 'Peaces Stusies'; English file name ends 'eNGLISH'. |
| 63 | English file name contains a double space ('journalism'). |
| 73 | Hindi file only (name ends Hindi_Only). |
| 87 | Same file in both columns; file name says 'English Only'. |
| 88 | English file only; file name says 'English Only'. |
| 89 | English file only; file name says 'English Only'. |
| 94 | Hindi file only (name ends Hindi_Only). |
| 95 | Hindi file only (name ends Hindi_Only). |
| 101 | English-column file is named Sindhi_Arabic.pdf. |
| 102 | English-column file name contains the typo 'Engish'. |
| 106 | File names begin 'Final Edited UGC- NET Forestry Syllabus'. |

### 5.3 Statistics (107) — the only subject with any content observed

The ten unit titles below are the reading tool's English rendering of a Hindi document. **They are not the official English wording, the order is not checked, and they are not import-eligible.** The official English file exists (`doc-107-en`) and has not been read.

| Unit | Title (tool translation from Hindi) | Provenance | importEligible |
|---|---|---|---|
| 1 | Probability and Distributions | TRANSLATION_UNVERIFIED, from hi | false |
| 2 | Real Analysis and Matrix Algebra | TRANSLATION_UNVERIFIED, from hi | false |
| 3 | Sampling Methods and Design of Experiments | TRANSLATION_UNVERIFIED, from hi | false |
| 4 | Theory of Estimation | TRANSLATION_UNVERIFIED, from hi | false |
| 5 | Testing of Hypotheses | TRANSLATION_UNVERIFIED, from hi | false |
| 6 | Linear Estimation, Regression Analysis and Econometrics | TRANSLATION_UNVERIFIED, from hi | false |
| 7 | Time Series | TRANSLATION_UNVERIFIED, from hi | false |
| 8 | Multivariate Analysis | TRANSLATION_UNVERIFIED, from hi | false |
| 9 | Stochastic Processes | TRANSLATION_UNVERIFIED, from hi | false |
| 10 | Indian Official Statistics System and Research Methodology | TRANSLATION_UNVERIFIED, from hi | false |

## 6. Part C — source verification findings

### 6.1 Did the syllabus change after June 2019? What was and was not established

| Source | What it showed |
|---|---|
| S3 | No statement of syllabus revision or effective date (section 3.3). |
| S13 | Section 2.3 only points to the UGC website; no revision statement. Appendix-II has 85 subjects. |
| S14 | Subject list of 30.04.2026 adds Forestry (106) and Statistics (107) relative to S13. A subject-list change, not a statement about syllabus text. |
| S11 | Section 4.3 only points to the UGC website; no revision statement. |
| S15 | Q35 points to the catalogue; no revision statement. |
| S16 | Page 1 of 2: no title mentions syllabus, scheme, amendment or revised. |
| S17 | Archive titles April 2022 - September 2026: no syllabus revision notice; only the June 2026 subject list. |
| S18 | No syllabus mention. |
| S19 | No syllabus mention. |
| S10 | UGC page holds no syllabus text; points to ugcnetonline.in. |
| S1 | Home page (re-read 5 Nov 2026): no syllabus link; no notice title mentions the syllabus. |
| S2 | Bulletin listing: titles only (Updated Bulletin as on 16.10.2026, 08.10.2026, June 2026, earlier); no syllabus notice. |
| S4 | Banner 'Applicable from June 2019 UGC-NET Onwards'; no per-row dates. |

**Not readable, so unresolved:**

| Source | Why |
|---|---|
| S6 | Corrigendum of 16 Oct 2026 blocked; contents unknown. |
| S5 | subjects.php blocked. |
| S12 | June 2025 bulletin robots_disallowed. |
| S3b | 08.10.2026 bulletin not opened. |
| S7 | Other notices: titles only. |
| S8 | No syllabus PDF could be read, so no PDF front-matter dates (issue date, revision date) are known. |

**Conclusion (`ABSENCE_OF_EVIDENCE_ONLY`):** No official notice announcing a revised syllabus was found in the pages that could be read. This is absence of evidence only, not proof that no revision exists: the corrigendum (S6) and every syllabus PDF are unread, and no per-document date could be seen.

I did not assume the June 2019 syllabus is unchanged, and I did not assume it was replaced. Coaching and news pages that claim "new syllabus" were not used (the list of unused leads is recorded in the JSON).

### 6.2 Subject-count reconciliation (closes register item D9)

| Source | Count | Note |
|---|---|---|
| June 2026 bulletin, Appendix-II (S13) | 85 | Codes 01–105. No Statistics. |
| NTA "List of Subjects", 30.04.2026 (S14) | 87 | Codes 001–107 in three-digit form; includes 106 Forestry and 107 Statistics. |
| December 2026 bulletin, Annexure II (S3) | 87 | Same code set. |
| Syllabus catalogue (S4) | 87 + Paper I | Same code set; mechanical comparison with S14: **identical**. |

So 87 − 2 = 85: **Forestry (106) and Statistics (107) entered the subject list between the June 2026 bulletin and the NTA list of 30 Apr 2026.** That is an inference from counts (V1), not a quote from a notice saying "subjects added". It means the "June 2019 onwards" banner cannot describe these two syllabi, and it shows the earlier news lead ("85 to 86") was incomplete. It is the reason these two subjects use a separate syllabus-version record, `sv-undated-added-2026`.

### 6.3 New discrepancies found in this task (continuing the register's D1–D12)

| # | Item | Detail | Needs |
|---|---|---|---|
| D13 | Column names do not match file names | Code 39: the Hindi-column file is `French_French.pdf`. Code 41: `Russian_Russain.pdf`. Code 101: the English-column file is `Sindhi_Arabic.pdf`. Code 43: the single file is `Rajasthani_Hindi.pdf`. | Open the files at M9.0-B and record the real language of each. |
| D14 | Catalogue name differs from Annexure II | Code 01 only: the catalogue ends "…Applied Economics/Development Eco./Business Economics"; Annexure II (as read) prints "Development Economics". | Keep both; Annexure II is primary. Check against the PDF. |
| D15 | Three code spellings | NTA 30.04.2026 prints `001`; the bulletin table and catalogue print `01`; bulletin footnotes print `015` and `074`. | Codes are strings; `code` follows the catalogue, `codeCanonical3` follows NTA, `printedCodeInFootnote` keeps the footnote form. Normalise on import. |
| D16 | Source summaries abbreviate long names | The 30.04.2026 list was summarised with shortened umbrella titles (for example code 001), so **only its code set** was used. | Compare names against the PDF text. |

## 7. Part E — quality validation

Run on 5 Nov 2026 with Python 3.13.18 and `jsonschema` 4.26.0: `python3 -I M9_OFFICIAL_CURRICULUM_VALIDATOR.py --self-test`.

### 7.1 Result per check

| # | Brief asked for | Result | Errors | Gaps | Warnings | What it means |
|---|---|---|---|---|---|---|
| C01 | JSON schema validity | **PASS** | 0 | 0 | 0 | Schema is a valid draft-2020-12 schema; the dataset conforms to it. This proves **shape**, not truth. |
| C02 | Missing subject codes | **PASS** | 0 | 0 | 0 | 88 rows, every code present, well-formed and consistent with its numeric and three-digit forms; Paper II has 87 subjects, equal to Annexure II; the catalogue code set equals the NTA 30.04.2026 code set. All three lists are V1, so "consistent" is not "checked against the PDFs". |
| C03 | Duplicate subject entries | **PASS** | 0 | 0 | 0 | No duplicate code, id or normalised name; no duplicate document or source id; no document URL used twice. |
| C04 | Missing units | **PASS WITH GAPS** | 0 | 88 | 0 | **This is where the real gap shows.** 87 rows have no unit records (Paper I and 86 Paper II subjects), and Paper I has 0 of its 10 expected. Every one is a *declared* gap, none is hidden. Statistics has 10 of 10 expected, but they are not import-eligible. |
| C05 | Duplicate topics | **PASS** | 0 | 0 | 0 | Only 10 unit records exist and no topics, so there is almost nothing to compare. The check logic is proven by the seeded tests below; the real test comes at M9.0-B. |
| C06 | English/Hindi mapping | **PASS WITH GAPS** | 0 | 10 | 0 | Document layout matches the document records for all 88 rows. Every translated title is marked with translatedFrom, translatedBy and a source document. The 10 gaps are the Statistics titles, which have English only (tool-translated) while a Hindi document exists. Mapping of statements, topics and sub-topics is untested because none exist. |
| C07 | Missing source references | **PASS** | 0 | 0 | 0 | Every paper, subject, document, unit and source reference resolves; all 19 sources are cited by something; every document has a URL and every Part C field. |
| C08 | Unverified or ambiguous entries | **PASS WITH GAPS** | 0 | 2 | 6 | Tallies by level (nothing above V1); the dataset header counts equal recomputed counts; release status is consistent with the data. The warnings are the honest list of ambiguity (section 7.2). |

### 7.2 Unverified or ambiguous entries — the list

| Item | Count | Detail |
|---|---|---|
| Records above V1 | 0 | Nothing is V2 or V3. |
| Documents with no SHA-256, title, dates or page data | 144 of 144 | GAP-04, GAP-06. |
| Subjects with no verified effective date | 88 of 88 | Catalogue banner only (GAP-05). |
| Language-subject flag set by my inference | 29 | Not official (GAP-08). Codes: 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 84, 85. |
| Catalogue name differs from Annexure II | 1 | Code 01 (D14). |
| Code printed differently in a footnote | 2 | Codes 15 and 74 (D15). |
| Unit records with an ambiguity note | 10 | Statistics 107 units 1–10: tool translation, order unchecked, document identity unproven. |
| Document with partial content | 1 | `doc-107-hi` (identity unproven, GAP-11). |

### 7.3 Self-test: can the validator actually fail?

A validator that always says PASS proves nothing. The script seeds known defects into a copy of the dataset and checks that the matching check reports an error. It also feeds a fully populated synthetic V2 unit (marked TEST-ONLY, in memory only, never written) to prove the schema accepts real data.

| Seeded defect | Must be caught by | Caught? |
|---|---|---|
| blank subject code | C02 | Yes |
| code not matching codeNumeric | C02 | Yes |
| duplicate subject entry | C03 | Yes |
| unresolvable sourceRef | C07 | Yes |
| empty sourceRefs | C07 | Yes |
| duplicate topic title in one unit | C05 | Yes |
| duplicate unit title | C05 | Yes |
| translation without translatedFrom | C01 | Yes |
| OFFICIAL_VERBATIM on a V1 unit | C06 | Yes |
| layout does not match documents | C06 | Yes |
| claims complete units while empty | C04 | Yes |
| gapRef to a missing gap | C04 | Yes |
| importEligible on a V1 unit | C01 | Yes |
| coverage count wrong | C08 | Yes |
| VERIFIED status while V1 remains | C08 | Yes |
| English and Hindi statement counts differ | C06 | Yes |
| document with wrong subject code | C06 | Yes |
| (positive control) synthetic V2 unit with official text, topic and subtopic is accepted | none | Yes |
| (baseline, unmodified file) | none | Yes |

### 7.4 What this validation cannot tell you

It cannot tell you that a code or name is *true*. It tells you the file is well-formed, internally consistent, free of duplicates, honest about gaps, and that every claim points to a source. Truth comes from V2/V3 (a person comparing with a hashed PDF).

### 7.5 Full validator output

```text
== Per-check result ==
C01 JSON schema validity                   PASS                 errors=0 gaps=0 warnings=0
C02 Subject codes                          PASS                 errors=0 gaps=0 warnings=0
C03 Duplicate subjects                     PASS                 errors=0 gaps=0 warnings=0
C04 Missing units                          PASS_WITH_GAPS       errors=0 gaps=88 warnings=0
C05 Duplicate units/topics                 PASS                 errors=0 gaps=0 warnings=0
C06 English/Hindi mapping                  PASS_WITH_GAPS       errors=0 gaps=10 warnings=0
C07 Source references                      PASS                 errors=0 gaps=0 warnings=0
C08 Unverified/ambiguous + consistency     PASS_WITH_GAPS       errors=0 gaps=2 warnings=6

== Findings (ERROR, WARN and INFO; GAP lines are summarised per check) ==
[C02][INFO] 88 rows, all codes present and well-formed; Paper II count equals Annexure II count (87).
[C03][INFO] No duplicate subject code, id or name; no duplicate document or source id.
[C04][INFO] 87 of 88 subject rows have no unit records (all declared as gaps).
[C05][INFO] 10 unit record(s), 0 topic and 0 subtopic records to compare; no duplicates among them.
[C06][INFO] Document layouts: en_only=2, hi_only=4, separate_en_hi=56, single_file_both_columns=26
[C06][INFO] Layout matches document records for every subject; every translated title is marked with translatedFrom, translatedBy and source document.
[C07][INFO] Every paper, subject, document, unit, topic and subtopic has resolvable sourceRefs; 19 sources, 144 documents.
[C08][INFO] document records at V1: 144
[C08][INFO] source records at V0: 6
[C08][INFO] source records at V1: 13
[C08][INFO] subject records at V1: 88
[C08][INFO] unit records at V1: 10
[C08][WARN] Document doc-107-hi has contentRead=PARTIAL_TOOL_RENDERED_IDENTITY_UNPROVEN; content is not verified  (document doc-107-hi)
[C08][WARN] 29 subjects are flagged as language subjects by author inference only (not official).
[C08][WARN] 1 subjects have a catalogue spelling that differs from Annexure II after normalising punctuation: 01
[C08][WARN] 10 unit record(s) carry an ambiguity note and are not import-eligible: unit-107-01, unit-107-02, unit-107-03, unit-107-04, unit-107-05, unit-107-06, unit-107-07, unit-107-08, unit-107-09, unit-107-10
[C08][WARN] 88 of 88 subjects have no verified effective date (catalogue banner only).
[C08][WARN] Code printed differently in a bulletin footnote for: 15, 74

== GAP lines per check == {'C04': 88, 'C06': 10, 'C08': 2}

== Self-test (each seeded defect must be caught) ==
OK   blank subject code  -> C02
OK   code not matching codeNumeric  -> C02
OK   duplicate subject entry  -> C03
OK   unresolvable sourceRef  -> C07
OK   empty sourceRefs  -> C07
OK   duplicate topic title in one unit  -> C05
OK   duplicate unit title  -> C05
OK   translation without translatedFrom  -> C01
OK   OFFICIAL_VERBATIM on a V1 unit  -> C06
OK   layout does not match documents  -> C06
OK   claims complete units while empty  -> C04
OK   gapRef to a missing gap  -> C04
OK   importEligible on a V1 unit  -> C01
OK   coverage count wrong  -> C08
OK   VERIFIED status while V1 remains  -> C08
OK   English and Hindi statement counts differ  -> C06
OK   document with wrong subject code  -> C06
OK   (positive control) synthetic V2 unit with official text, topic and subtopic is accepted  -> none
OK   (baseline, unmodified file)  -> none

TOTAL ERRORS: 0
```

## 8. Declared gaps and owner decisions

| ID | Gap | Severity | Resolution |
|---|---|---|---|
| GAP-01 | **Paper I syllabus text not read.** The 10 units, every topic and statement, in English and Hindi, were not read from any official document. The catalogue link (S4) redirects to an expiring pre-signed storage URL and the reading tool rejected it as too long. The unit count of 10 comes from the owner's brief, not from a source. | BLOCKER | M9.0 capture of Paper-I_English.pdf and Paper-I_Hindi.pdf on a normal machine with SHA-256, then two-person transcription (V3). See handoff in the validation report. |
| GAP-02 | **Paper II syllabus text not read for any subject.** 86 of 87 Paper II subjects were never opened. Subject 107 was partly observed (ten unit titles, tool-rendered, document identity doubtful, see GAP-11). No topic or statement text exists for any subject. | BLOCKER | Capture and transcribe subject by subject as each is scheduled (M9.5 in the roadmap). |
| GAP-03 | **Corrigendum to the December 2026 bulletin unread.** S6 is blocked. It might change the subject list, the exam pattern or syllabus pointers. | HIGH | Owner or Antigravity captures S6 and S3 with hashes (register owner action O-3). |
| GAP-04 | **Per-document dates and titles unknown.** No syllabus PDF was opened, so document title, issue date, revision date, page count and page numbers are all unknown. Document titles are null except one search-result title for Paper-I English, which is a lead only. | HIGH | Read the first page and metadata of each captured PDF. |
| GAP-05 | **Applicable exam period is a catalogue banner, not a per-subject fact.** Only the page-wide banner 'June 2019 onwards' exists. Subjects 106 and 107 cannot have applied from June 2019; 102-105 are unestablished. | HIGH | Per-subject effective dates from UGC notices or document front-matter. |
| GAP-06 | **No SHA-256 for any source.** No file was downloaded, so no hash, size or page count exists. Provenance for a syllabus cannot rest on a URL because the links redirect to expiring URLs. | HIGH | M9.0 manifest (content-sources/MANIFEST). |
| GAP-07 | **Hindi text fidelity.** The one Hindi document seen came back with corrupted Devanagari (legacy-font PDF). Hindi syllabus text must be typed or visually checked, never taken from a text layer. No Hindi title or statement is stored in this dataset. | HIGH | Human transcription with visual check. |
| GAP-08 | **Language-subject flag is the author's inference.** 29 rows are marked as language subjects from their names only. The bulletin has no per-subject medium table. | MEDIUM | Owner or UGC clarification of paper medium per subject. |
| GAP-09 | **subjects.php unread; the three subject lists are V1 only.** The three subject lists agree on the code set (S3, S4, S14) but all three were read through a summarising tool. | MEDIUM | A person compares codes and names against the PDF text. |
| GAP-10 | **Code printing differs between sources.** S14 prints three digits (001), S3 and S4 print two where the number is below 100 (01), and S3 footnotes print 015 and 074. Codes are stored as strings with the NTA three-digit form as canonical. | LOW | Normalise on import; keep printed variants. |
| GAP-11 | **Identity of the document behind the Statistics observation.** The ten Statistics unit titles came from a document the tool returned for a different showPdf link (register D8). The text identified it as the Statistics Hindi syllabus but the file's identity is unproven. The English titles are the tool's own rendering of Hindi. | MEDIUM | Re-read from the captured Statistics English and Hindi PDFs. |
| GAP-12 | **Two later-added subjects and a 'June 2019' banner.** See GAP-05. 106 and 107 are assigned to version sv-undated-added-2026. | MEDIUM | Find the notice that added them. |

### 8.1 Decisions I need from you

| # | Decision | My recommendation |
|---|---|---|
| O-A1 | **Who captures the PDFs?** Antigravity on your machine (normal browser, section 9), or I do it through your linked computer. | Antigravity. It is the implementer, keeps the manifest in the repository, and needs no extra access grant. If you prefer me, I need your explicit yes naming the files, and a folder outside the repository to save into. |
| O-A2 | Send or have captured the corrigendum S6 and the updated bulletin S3 (register O-3). | Do this first. S6 is the only unread official document that could change the subject list, pattern or syllabus pointers. |
| O-A3 | Accept this V1 file as the *draft seed* for the 88-row subject list (status `listed`), as the roadmap already allows, with no syllabus content. | Yes, after the validator is re-run on the copy in the repository. |
| O-A4 | Who are the two people for the Paper I transcription (V3)? | Name them now; this is the long pole (register O-2). |
| O-A5 | Where do evidence copies of the PDFs live? | A private folder (`content-sources/`, git-ignored) plus the manifest committed. They are public government files, but the copy is evidence, not something the app serves. |

## 9. Handoff for Antigravity — validate now, capture next, import later

Three separate steps with three separate authorisations. **Only step 1 and step 2 are covered by this document.** Step 3 needs a new written approval from you.

### 9.1 Step 1 — place and validate (local, no network, no cloud)

1. New branch from the accepted baseline, for example `m9/curriculum-data`.
2. Copy the four files into `docs/`. Do **not** put them under `src/`, `functions/` or `packages/`. Do not wire them into any build.
3. Install nothing except, if missing, `pip install jsonschema` in a throwaway virtual environment.
4. Run `python3 -I docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py --self-test` and compare with section 7.5. **Expected:** exit code 0; C01–C03, C05, C07 PASS; C04 88 gaps; C06 10 gaps; C08 2 gaps and 6 warnings; 19 self-test lines all `OK`; `TOTAL ERRORS: 0`.
5. Compare the SHA-256 of each copied file with section 1. A different hash means the file changed in transit; stop and report.
6. Optional hardening (no new dependency needed if `ajv` is already present): add a vitest test that loads the dataset and schema and asserts the same results, so CI protects the file. Keep it under a test folder; do not change application code.

### 9.2 Step 2 — M9.0-B capture, hashing and transcription (needs your O-A1 to O-A5)

Only on a normal machine with a normal browser. **Order of work:**

1. **S3, S6, S3b** (the three bulletins/corrigendum) → hash → compare the exam-pattern facts in the register (section 3) with the PDFs; tell me the differences.
2. **Paper I English and Hindi** (`doc-00-en`, `doc-00-hi`).
3. **Statistics English and Hindi** (`doc-107-en`, `doc-107-hi`) as the pilot, because we already have a (doubtful) reading to compare with.
4. All other subjects **one by one, when each is scheduled** (roadmap M9.5). Not all 144 at once.

For **each** file:

1. Download with the browser from the catalogue (`catalogueUrl`). The link redirects to an expiring address, so do not store that address; store the catalogue link and the date.
2. Open page 1 and check the document is the one you meant (the earlier tooling returned the wrong file three times, register D8). Record the title exactly as printed.
3. Compute SHA-256, byte size and page count. Record the retrieval date.
4. Save to `content-sources/<code>/<file name>` (private). Add an entry to `content-sources/MANIFEST.json`.
5. Update the matching `documents[]` record: `file.sha256`, `file.sizeBytes`, `file.pageCount`, `file.retrievedOn`, `file.status = CAPTURED`, `documentTitle`, `publication`, `pageOrSection`, and `contentRead`. **Leave `verification` at V1** until a person has compared content.
6. Re-run the validator. A `CAPTURED` file must have all four file fields (the schema enforces it).

For **transcription** (Paper I first):

1. For each unit: `unitNumber`, title, and every printed line as one `officialText` item (`no`, `page`, `sourceDocId`) with `provenance: OFFICIAL_VERBATIM`, `sourceDocRef` and `page`.
2. English from the English PDF; Hindi from the Hindi PDF, **typed or visually checked, never pasted from the text layer**. Do not machine-translate to fill a missing language; if one language is missing, leave it `null` and keep the gap.
3. A second person repeats the transcription independently; differences go to a discrepancy list, not silently resolved. Then set the unit to `V2` (first checker) and `V3` (both agree) and `importEligible: true` only at V2 or above.
4. Topics and sub-topics come last, and only if needed. Each one with `origin: editorial` must carry `officialRefs [{unitNo, statementNos[]}]`. If the official PDF already has headings, a topic can be `origin: official`.
5. Update `coverage.*` (the validator recomputes and rejects wrong counts), add a `syllabusVersions` entry for the verified subject, move `dataset.releaseStatus` to `PARTIAL_VERIFIED`, and bump `datasetVersion`.

**Boundaries for steps 1 and 2:** no Firebase login or call; no deploy; no Firestore read or write; no rules, index, IAM, billing or secret change; no change to `src`, `functions`, tests of the CBT engine or maintenance mode; no question generation; no production or trial project; Razorpay untouched. If something here seems to need a cloud call, stop and ask.

**Done when:** hashes recorded for S3, S6, Paper I EN and HI; Paper I units at V3 in both languages with page numbers; validator exit 0 with C04 no longer reporting Paper I; every D-item in register section 7 and section 6.3 above closed or accepted by you; a report to me with the manifest, the discrepancy list and the validator output.

### 9.3 Step 3 — import (a later milestone, needs your written approval naming `ugc-mock-test-staging`)

Design lives in `M9_CONTENT_INGESTION_SPEC.md`; these are the dataset-specific rules.

| Rule | Detail |
|---|---|
| Eligibility filter | Import a record only if `importEligible: true` **and** `verification ∈ {V2, V3}`. The one exception allowed by the roadmap is the 88 subject rows as status `listed` (code, official name, layout), with no unit content. |
| Level mapping | V0/V1 → `listed` (subject rows only). V2 → `verified`. V3 → `dual_verified`. `fully_verified` content labels still follow the data dictionary rules. |
| Collections | `documents[]` and `sources[]` → `sourceDocuments/{docId}`; each verified subject's version → `syllabusVersions/{subjectId}_{n}`; `units[]` with `officialText[]` → units; `topics[]`/`subtopics[]` → topics with `origin` and `officialRefs`. Field names already match the data dictionary. |
| Names | `name.official` is stored once as the immutable official name; a separate display name is editable. Never overwrite the official one. |
| Codes | Store as strings. Use `code` for lookups and keep `codeCanonical3` and `printedCodeInFootnote`. Normalise before comparing. |
| IDs and idempotency | Use the dataset's IDs (`subj-107`, `unit-107-01`, `doc-107-hi`). Upsert, never blind add. Store a content hash on each record; an unchanged hash means no write. |
| Dry run first | Produce a plan file (create/update/skip counts and a diff) and run it against the **Firebase emulator**. Show the plan to me and to you before any staging write. |
| Batches | Batches well under the Firestore 500-write limit; each batch tagged with an `importRunId` so a run can be found and reversed. |
| What never changes | Firestore rules, indexes, IAM, billing, secrets, the exam engine, the maintenance page, Razorpay. |
| Gate | The validator must exit 0 on the exact file being imported, and the SHA-256 of that file goes into the import log. |

### 9.4 Copy-ready prompt for Antigravity (step 1 only)

```text
TASK: M9.0-A step 1 — place and validate the official curriculum dataset. LOCAL ONLY.

Context: Claude produced four files from research on 5 Nov 2026: docs/M9_OFFICIAL_CURRICULUM_DATA.json,
docs/M9_OFFICIAL_CURRICULUM_DATA.schema.json, docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py and
docs/M9_OFFICIAL_CURRICULUM_VALIDATION.md. The dataset is a V1 skeleton: subject identity only, NO syllabus
content. It must not be imported anywhere and must not be treated as official syllabus text.

DO:
1. Create branch m9/curriculum-data from the accepted baseline.
2. Copy the four files into docs/ exactly as provided. Compute SHA-256 of each and compare with section 1 of the
   validation report. If any hash differs, STOP and report.
3. In a throwaway virtualenv: pip install jsonschema. Run:
   python3 -I docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py --self-test
4. Report the full output. Expected: exit 0, TOTAL ERRORS: 0, C04 88 gaps, C06 10 gaps, C08 2 gaps + 6 warnings,
   all 19 self-test lines OK.
5. Do NOT edit the JSON. If you think a value is wrong, list it with evidence instead.

DO NOT: log in to Firebase or Google Cloud; deploy; read or write Firestore; change rules, indexes, IAM,
billing or secrets; touch src/, functions/, the exam engine, the maintenance page or Razorpay; generate
questions; download syllabus PDFs (that is step 2 and needs separate owner approval).

ACCEPTANCE: branch contains only the four docs files; validator output pasted in the report; hashes match;
git status shows no other change. Then STOP and wait for the owner.
```

## 10. What this report does not claim

- It does not claim any syllabus unit, topic or sub-topic is correct, complete or current. None was read from an official document.
- It does not claim the syllabus is unchanged since June 2019, or that it changed. It says no revision notice was found in the pages that could be read.
- It does not claim the subject codes or names are checked against the PDFs. Three V1 lists agree.
- It does not claim UrEducator is an official NTA or UGC product.
- It does not claim the Statistics unit titles are correct; they are a tool translation of a document whose identity is unproven.
- It does not claim the files were deployed, imported or tested in any environment beyond the local validator run.

## Appendix — re-run commands

```text
python3 -I docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py                 # checks only
python3 -I docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py --self-test     # checks + seeded-defect tests
python3 -I docs/M9_OFFICIAL_CURRICULUM_VALIDATOR.py --json-out result.json
```

