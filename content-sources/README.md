# UrEducator 2.0 — Official Content Sources Register & Capture Guide

This directory is the local repository and evidence registry for official UGC NET curriculum documents, information bulletins, corrigenda, public notices, and official answer keys.

> [!IMPORTANT]
> Official source documents stored here serve as legal and academic evidence. They are **never** served directly to students or uploaded to public web hosting. The application serves only structured, verified Firestore records.

---

## 1. Document Capture Procedure (Human Workflow)

Official documents must be captured manually through a standard web browser directly from official government portals:
- National Testing Agency (NTA): `https://nta.ac.in` and `https://ugcnet.nta.nic.in`
- University Grants Commission (UGC): `https://ugcnetonline.in`

### Step-by-Step Instructions:
1. **Download the Original File:** Use a standard browser to download the official PDF directly from the portal without modification.
2. **Compute File Hash & Size:** Run the local hashing script:
   ```powershell
   node scripts/hash-source.mjs content-sources/<filename>.pdf
   ```
3. **Count Document Pages:** Open the PDF in a viewer and record the exact physical page count.
4. **Record Metadata in `content-sources/MANIFEST.json`:** Append a source entry to the manifest containing:
   - `fileName`: The local filename (e.g. `UGC_NET_Dec_2026_Information_Bulletin.pdf`)
   - `sourcePageUrl`: Exact canonical URL of the official page from which it was retrieved
   - `retrievedOn`: Date of retrieval in ISO 8601 format (`YYYY-MM-DD`)
   - `sizeBytes`: Exact file size in bytes
   - `pageCount`: Total page count
   - `sha256`: 64-character lowercase hexadecimal SHA-256 hash
   - `capturedBy`: Identity/name of the person who captured the source file

---

## 2. Dual-Person Verification Protocol

Under M9 content governance (see `docs/M9_OFFICIAL_SOURCE_REGISTER.md`):
1. **Capturer:** Downloads the file, computes the hash, verifies download source, and records the initial entry in `MANIFEST.json`.
2. **Independent Verifier:** A second person independently inspects the file, recalculates the SHA-256 hash from their copy, confirms page count and title against the official announcement, and signs off.
3. No document is promoted to `verified` (Level V2/V3) without independent dual verification.

---

## 3. Tooling Reference
- Local SHA-256 hashing: `node scripts/hash-source.mjs <file-path>`
- Curriculum validation: `node scripts/check-curriculum.mjs <syllabus-path>`
