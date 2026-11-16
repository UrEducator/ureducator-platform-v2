# UrEducator 2.0 — Raw PYQ Text Ingestion Instructions

This guide explains how to prepare and paste text extracted from official NTA UGC NET Paper 1 Question Paper & Final Answer Key PDFs into raw text files in this folder (`content-sources/raw/`).

The raw text parser (`scripts/parse-raw-pyq.mjs`) reads these files, extracts the question stems, options, answers, explanations, and DI tables, and compiles them into schema-compliant JSON documents under `content-sources/shifts/`.

---

## 1. Quick Start

1. Create a text file in `content-sources/raw/` named after the shift, for example:
   - `content-sources/raw/jun14-shift1.txt`
   - `content-sources/raw/jun19-shift1.txt`
   - `content-sources/raw/dec07-shift1.txt`
   - `content-sources/raw/dec11-shift1.txt`
   - `content-sources/raw/dec14-shift1.txt`

2. Paste your extracted questions following the conventions below.

3. Run the parser:
   ```bash
   node scripts/parse-raw-pyq.mjs content-sources/raw/jun14-shift1.txt --target mt-pyq-2023-jun14-s1
   ```

4. The parser will validate all 50 questions, map them to the 10 canonical syllabus units (`U1`–`U10`), and output:
   - `content-sources/shifts/mt-pyq-2023-jun14-s1.json`

---

## 2. Formatting Conventions

### A. Question Separators
Separate each question with a horizontal rule line `---` on its own line:
```text
---
Q1. Which of the following is an example of formative assessment?
A. End-of-year board examination
B. Short classroom quiz followed by immediate feedback
C. Final semester examination
D. University entrance test
Answer: B
Unit: U1
Explanation: Formative assessment occurs during instruction to provide constructive feedback.
---
```

*(Note: If `---` is omitted, the parser will also automatically detect question numbers like `Q.1`, `Question 1:`, or `1.`)*

---

### B. Options Format
Any standard option labeling format is accepted:
- **Letters:**
  ```text
  A. Option text
  B. Option text
  C. Option text
  D. Option text
  ```
  *(Parenthesized like `(A)`, `(B)` or `A)`, `B)` are also supported)*

- **Numbers (NTA Standard):**
  ```text
  (1) Option text
  (2) Option text
  (3) Option text
  (4) Option text
  ```
  *(Numbers `1, 2, 3, 4` are automatically normalized to `a, b, c, d` in the schema)*

---

### C. Answer & Key Format
Indicate the correct answer using any of these tags:
- `Answer: B` or `Answer: (2)` or `Ans: 2`
- `Correct: C` or `Key: 4`
- `Correct Answer: B`

For cancelled/drop questions where marks are awarded to all candidates:
- `Answer: Marks to all` or `Answer: ALL`

---

### D. Syllabus Unit Tagging (Optional but Recommended)
Tag the question with its canonical unit (`U1` to `U10`) or unit name:
- `Unit: U1` or `Unit: Teaching Aptitude`
- `Unit: U2` or `Unit: Research Aptitude`
- `Unit: U3` or `Unit: Comprehension`
- `Unit: U4` or `Unit: Communication`
- `Unit: U5` or `Unit: Mathematical Reasoning and Aptitude`
- `Unit: U6` or `Unit: Logical Reasoning`
- `Unit: U7` or `Unit: Data Interpretation`
- `Unit: U8` or `Unit: ICT`
- `Unit: U9` or `Unit: People, Development and Environment`
- `Unit: U10` or `Unit: Higher Education System`

> **Fallback:** If you omit `Unit:`, the parser runs an automated NLP keyword matcher across the syllabus vocabulary. If still ambiguous, it maps questions using the standard 5-question sequential block structure (e.g. Q1–5 = U1, Q6–10 = U2, ..., Q46–50 = U10).

---

### E. Data Interpretation (DI) Tabular Data
You can paste tabular data directly as copied from PDF with tab characters or spaces. The parser automatically detects tabbed or aligned tabular blocks and converts them into standard GitHub-Flavored Markdown tables.

**Raw input:**
```text
---
The following table shows the percentage of marks obtained by 5 students:
Student	Math	Science	English
A	80	75	90
B	85	70	65
C	90	85	80

Q.31 What is the average marks in Math?
(1) 85
(2) 80
(3) 75
(4) 70
Answer: 1
Unit: U7
---
```

**Parser converts the table into:**
```markdown
| Student | Math | Science | English |
|---|---|---|---|
| A | 80 | 75 | 90 |
| B | 85 | 70 | 65 |
| C | 90 | 85 | 80 |
```

---

### F. Reading Comprehension (RC) Passages
For reading comprehension questions, you can attach a shared passage using `Passage:` or `[PASSAGE]`:
```text
[PASSAGE START]
Sustainable development aims to meet the needs of the present without compromising the ability of future generations to meet their own needs...
[PASSAGE END]

---
Q.11 According to the passage, the primary focus of sustainable development is:
(1) Industrial acceleration
(2) Inter-generational equity
(3) Exploitation of reserves
(4) Short-term yield
Answer: 2
Unit: U3
---
```
*(All subsequent questions until the next passage or section will automatically inherit this passage context, or you can place `Passage: <text>` inside individual questions)*

---

### G. Statement-Based & Match the Following
These common UGC NET question types are detected automatically:

**Statement-Based:**
```text
---
Q.4 Given below are two statements:
Statement I: Formative evaluation is conducted during the instructional process.
Statement II: Summative evaluation is used for grading and certification.
In light of the above statements, choose the correct answer:
(1) Both Statement I and Statement II are true
(2) Both Statement I and Statement II are false
(3) Statement I is true but Statement II is false
(4) Statement I is false but Statement II is true
Answer: 1
Unit: U1
---
```

**Match the Following:**
```text
---
Q.7 Match List I with List II:
List I (Sampling Method)    List II (Characteristic)
A. Stratified Sampling     I. Known non-zero selection chance
B. Quota Sampling          II. Non-probability counterpart of stratified
C. Snowball Sampling       III. Referral-based chain sampling
D. Cluster Sampling        IV. Intact group sampling

Choose the correct answer from the options given below:
(1) A-I, B-II, C-III, D-IV
(2) A-II, B-I, C-IV, D-III
(3) A-III, B-IV, C-I, D-II
(4) A-IV, B-III, C-II, D-I
Answer: 1
Unit: U2
---
```

---

## 3. Review & Ingestion Workflow

1. Once parsed, inspect the generated JSON file at:
   `content-sources/shifts/<target>.json`
2. Check the summary printed by the parser (question count, unit distribution, missing fields).
3. When ready, the verified shift JSON can be consumed by `scripts/ingest-premium-pyqs.mjs` for staging/production database seeding.
