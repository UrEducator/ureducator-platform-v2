#!/usr/bin/env python3
"""
Validator for M9_OFFICIAL_CURRICULUM_DATA.json  (research tool, not application code).

Usage:
  python3 -I M9_OFFICIAL_CURRICULUM_VALIDATOR.py [--data FILE] [--schema FILE] [--json-out FILE] [--self-test]

Needs: Python 3.9+ and the 'jsonschema' package (>= 4).
Exit code: 0 = no ERROR findings (GAP findings are expected while content is unread), 1 = at least one ERROR.
Checks follow Part E of the M9.0-A brief:
  C01 JSON schema validity            C05 duplicate units/topics/statements
  C02 missing or malformed subject codes   C06 English/Hindi mapping and translation marking
  C03 duplicate subject entries       C07 missing source references
  C04 missing units                   C08 unverified or ambiguous entries and internal consistency
Severity: ERROR = data is wrong/inconsistent; GAP = content honestly recorded as not yet read; WARN = review; INFO = tally.
"""
import argparse, copy, json, pathlib, re, sys
from collections import Counter, defaultdict

try:
    import jsonschema
except ImportError:  # pragma: no cover
    sys.exit("jsonschema is required: pip install jsonschema")

HERE = pathlib.Path(__file__).resolve().parent
ORDER = {"V0": 0, "V1": 1, "V2": 2, "V3": 3}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("&", "and"))


class Report:
    def __init__(self):
        self.items = []

    def add(self, check, sev, msg, path=""):
        self.items.append({"check": check, "severity": sev, "message": msg, "path": path})

    def count(self, check, sev):
        return sum(1 for i in self.items if i["check"] == check and i["severity"] == sev)


def iter_subjects(d):
    for p in d["ugcNet"]["papers"]:
        for s in p["subjects"]:
            yield p, s


def iter_titles(node):
    """yield (lang, localizedText) for a bilingualTitle-like dict"""
    for lang in ("en", "hi"):
        v = node.get(lang) if isinstance(node, dict) else None
        if v:
            yield lang, v


def run_checks(d, schema):
    R = Report()

    # ---------------- C01 schema
    try:
        jsonschema.Draft202012Validator.check_schema(schema)
    except jsonschema.SchemaError as e:
        R.add("C01", "ERROR", f"Schema itself is invalid: {e.message}")
        return R
    errs = sorted(jsonschema.Draft202012Validator(schema).iter_errors(d), key=lambda e: [str(x) for x in e.absolute_path])
    for e in errs:
        R.add("C01", "ERROR", e.message[:300], "/" + "/".join(str(x) for x in e.absolute_path))

    # If the shape is too broken to walk, stop here.
    try:
        subjects = [s for _, s in iter_subjects(d)]
        docs = {x["id"]: x for x in d["documents"]}
        src_ids = {s["id"] for s in d["sources"]}
        gap_ids = {g["id"] for g in d["gaps"]}
        ver_ids = {v["id"] for v in d["syllabusVersions"]}
    except (KeyError, TypeError) as e:
        R.add("C01", "ERROR", f"Structure too broken to continue checks: {e!r}")
        return R

    # ---------------- C02 subject codes
    codes = []
    for p, s in iter_subjects(d):
        path = f"subject {s.get('id')}"
        c = s.get("code")
        if not c or not isinstance(c, str) or not re.fullmatch(r"[0-9]{2,3}", c):
            R.add("C02", "ERROR", f"Missing or malformed code {c!r}", path)
            continue
        codes.append(c)
        if s.get("codeNumeric") != int(c):
            R.add("C02", "ERROR", f"codeNumeric {s.get('codeNumeric')} does not match code {c}", path)
        if c == "00":
            if s.get("codeCanonical3") is not None or s.get("codeIsOfficialSubjectCode"):
                R.add("C02", "ERROR", "Paper I row 00 must not carry an official subject code", path)
        else:
            if s.get("codeCanonical3") != f"{int(c):03d}":
                R.add("C02", "ERROR", f"codeCanonical3 {s.get('codeCanonical3')} does not match code {c}", path)
            if s.get("inJune2026SubjectList") is not True:
                R.add("C02", "ERROR", f"Code {c} not confirmed in the NTA 30.04.2026 subject list (S14)", path)
        if p["id"] == "paper-1" and c != "00":
            R.add("C02", "ERROR", "Paper I may only contain row 00", path)
        if p["id"] == "paper-2" and c == "00":
            R.add("C02", "ERROR", "Paper II must not contain row 00", path)
    p2 = [s for p, s in iter_subjects(d) if p["id"] == "paper-2"]
    want = d.get("subjectCountReconciliation", {}).get("december2026BulletinAnnexureII", {}).get("count")
    if want is not None and len(p2) != want:
        R.add("C02", "ERROR", f"Paper II has {len(p2)} subjects, bulletin Annexure II says {want}")
    if d.get("subjectCountReconciliation", {}).get("mechanicalCheck", {}).get("catalogueCodesEqualJune2026ListCodes") is not True:
        R.add("C02", "ERROR", "Catalogue code set differs from the NTA 30.04.2026 list")
    if not R.count("C02", "ERROR"):
        R.add("C02", "INFO", f"{len(codes)} rows, all codes present and well-formed; Paper II count equals Annexure II count ({len(p2)}).")

    # ---------------- C03 duplicates among subjects/documents
    for label, vals in (("code", codes), ("id", [s["id"] for s in subjects if "id" in s]),
                        ("name", [norm(s["name"]["official"]) for s in subjects if isinstance(s.get("name"), dict)])):
        for v, n in Counter(vals).items():
            if n > 1:
                R.add("C03", "ERROR", f"Duplicate subject {label}: {v!r} appears {n} times")
    ids = [x["id"] for x in d["documents"]]
    for v, n in Counter(ids).items():
        if n > 1:
            R.add("C03", "ERROR", f"Duplicate document id {v}")
    for v, n in Counter(x["sourceUrl"] for x in d["documents"]).items():
        if n > 1:
            R.add("C03", "WARN", f"Same document URL used by {n} document records: {v}")
    for v, n in Counter(s["id"] for s in d["sources"]).items():
        if n > 1:
            R.add("C03", "ERROR", f"Duplicate source id {v}")
    if not R.count("C03", "ERROR"):
        R.add("C03", "INFO", "No duplicate subject code, id or name; no duplicate document or source id.")

    # ---------------- C04 missing units
    n_gap = 0
    for p, s in iter_subjects(d):
        path = f"subject {s['id']}"
        cov = (s.get("coverage") or {}).get("units", "")
        claims_complete = cov.startswith("COMPLETE")
        if not s["units"]:
            if claims_complete:
                R.add("C04", "ERROR", "Coverage says units complete but the unit list is empty", path)
            elif not s.get("gapRefs"):
                R.add("C04", "ERROR", "No units and no declared gap", path)
            else:
                n_gap += 1
                R.add("C04", "GAP", f"No unit records ({cov}); declared gaps {','.join(s['gapRefs'])}", path)
        exp = s.get("unitsExpected")
        if exp and len(s["units"]) != exp["count"]:
            sev = "ERROR" if claims_complete else "GAP"
            R.add("C04", sev, f"{len(s['units'])} unit record(s) against {exp['count']} expected (basis {exp['basis']}, verified={exp['verified']})", path)
        if claims_complete:
            if any(ORDER[u["verification"]] < 2 for u in s["units"]):
                R.add("C04", "ERROR", "Coverage claims complete but a unit is below V2", path)
        nums = [u["unitNumber"] for u in s["units"]]
        if nums and sorted(nums) != list(range(1, len(nums) + 1)):
            R.add("C04", "ERROR", f"Unit numbers not contiguous from 1: {nums}", path)
        for gid in s.get("gapRefs", []):
            if gid not in gap_ids:
                R.add("C04", "ERROR", f"gapRef {gid} does not exist", path)
    R.add("C04", "INFO", f"{n_gap} of {len(subjects)} subject rows have no unit records (all declared as gaps).")

    # ---------------- C05 duplicate units/topics/statements
    for p, s in iter_subjects(d):
        path = f"subject {s['id']}"
        seen_unit_titles = defaultdict(list)
        seen_topic_titles = defaultdict(list)
        stmt_ids = Counter()
        unit_ids = Counter()
        for u in s["units"]:
            unit_ids[u["id"]] += 1
            for lang, t in iter_titles(u["title"]):
                seen_unit_titles[(lang, norm(t["text"]))].append(u["id"])
            ords = [t["ordinal"] for t in u["topics"]]
            if ords and sorted(ords) != list(range(1, len(ords) + 1)):
                R.add("C05", "ERROR", f"Topic ordinals not contiguous in {u['id']}: {ords}", path)
            for st in u["officialText"]:
                stmt_ids[st["id"]] += 1
            local = defaultdict(list)
            for t in u["topics"]:
                for lang, tt in iter_titles(t["title"]):
                    local[(lang, norm(tt["text"]))].append(t["id"])
                    seen_topic_titles[(lang, norm(tt["text"]))].append(t["id"])
                sub_seen = defaultdict(list)
                for sb in t["subtopics"]:
                    for lang, st in iter_titles(sb["title"]):
                        sub_seen[(lang, norm(st["text"]))].append(sb["id"])
                for k, v in sub_seen.items():
                    if len(v) > 1:
                        R.add("C05", "ERROR", f"Duplicate subtopic title {k[1]!r} ({k[0]}) in {t['id']}: {v}", path)
                for node in [t] + list(t["subtopics"]):
                    for ref in node.get("officialRefs", []):
                        tgt = next((uu for uu in s["units"] if uu["unitNumber"] == ref["unitNo"]), None)
                        nos = {x["no"] for x in tgt["officialText"]} if tgt else set()
                        for n in ref["statementNos"]:
                            if n not in nos:
                                R.add("C05", "ERROR", f"{node['id']} cites unit {ref['unitNo']} statement {n} that does not exist", path)
            for k, v in local.items():
                if len(v) > 1:
                    R.add("C05", "ERROR", f"Duplicate topic title {k[1]!r} ({k[0]}) in {u['id']}: {v}", path)
        for k, v in seen_unit_titles.items():
            if len(v) > 1:
                R.add("C05", "ERROR", f"Duplicate unit title {k[1]!r} ({k[0]}): {v}", path)
        for k, v in seen_topic_titles.items():
            if len(set(v)) > 1:
                R.add("C05", "WARN", f"Same topic title {k[1]!r} ({k[0]}) used in several topics of one subject: {v}", path)
        for k, n in list(stmt_ids.items()) + list(unit_ids.items()):
            if n > 1:
                R.add("C05", "ERROR", f"Duplicate id {k}", path)
    if not R.count("C05", "ERROR"):
        total = sum(len(s["units"]) for s in subjects)
        R.add("C05", "INFO", f"{total} unit record(s), 0 topic and 0 subtopic records to compare; no duplicates among them.")

    # ---------------- C06 English/Hindi mapping and translation marking
    layout_rules = {
        "separate_en_hi": lambda ds: sorted(x["language"]["value"] for x in ds) == ["en", "hi"] and all(len(x["catalogueColumns"]) == 1 for x in ds),
        "single_file_both_columns": lambda ds: len(ds) == 1 and ds[0]["catalogueColumns"] == ["English", "Hindi"] and ds[0]["language"]["value"] is None,
        "hi_only": lambda ds: len(ds) == 1 and ds[0]["language"]["value"] == "hi" and ds[0]["catalogueColumns"] == ["Hindi"],
        "en_only": lambda ds: len(ds) == 1 and ds[0]["language"]["value"] == "en" and ds[0]["catalogueColumns"] == ["English"],
    }
    layouts = Counter()
    for p, s in iter_subjects(d):
        path = f"subject {s['id']}"
        ds = []
        for r in s["documentRefs"]:
            if r in docs:
                ds.append(docs[r])
                if docs[r]["subjectCode"] != s["code"]:
                    R.add("C06", "ERROR", f"Document {r} belongs to subject code {docs[r]['subjectCode']}", path)
        layouts[s["documentLayout"]] += 1
        rule = layout_rules.get(s["documentLayout"])
        if ds and rule and not rule(ds):
            R.add("C06", "ERROR", f"documentLayout {s['documentLayout']} does not match its document records", path)
        folder_re = "NTA_All_R_Syllabus%2F(00-Paper-I|" + re.escape(s["code"]) + ")%2F"
        folder_ok = all(re.search(folder_re, x["sourceUrl"]) for x in ds)
        if not folder_ok:
            R.add("C06", "ERROR", "Document URL folder does not match the subject code", path)
        has_en = any(x["language"]["value"] == "en" for x in ds)
        has_hi = any(x["language"]["value"] == "hi" for x in ds)
        for u in s["units"]:
            upath = f"{path} {u['id']}"
            en, hi = u["title"].get("en"), u["title"].get("hi")
            if en and not hi and has_hi:
                R.add("C06", "GAP", "English title present, Hindi title not mapped (Hindi document exists)", upath)
            if hi and not en and has_en:
                R.add("C06", "GAP", "Hindi title present, English title not mapped (English document exists)", upath)
            for lang, t in iter_titles(u["title"]):
                prov = t["provenance"]
                if prov.startswith("TRANSLATION") and t.get("translatedFrom") == lang:
                    R.add("C06", "ERROR", "translatedFrom equals the language of the text itself", upath)
                if prov == "OFFICIAL_VERBATIM" and ORDER[u["verification"]] < 2:
                    R.add("C06", "ERROR", "OFFICIAL_VERBATIM claimed on a unit below V2", upath)
                if t.get("sourceDocRef") and t["sourceDocRef"] not in docs:
                    R.add("C06", "ERROR", f"sourceDocRef {t['sourceDocRef']} does not exist", upath)
            for st in u["officialText"]:
                sl = {k for k, v in st["text"].items() if v}
                if sl == {"en"} and has_hi or sl == {"hi"} and has_en:
                    R.add("C06", "GAP", f"Official-text item {st['id']} exists in one language only", upath)
                for lang, t in iter_titles(st["text"]):
                    if t["provenance"] == "OFFICIAL_VERBATIM" and ORDER[u["verification"]] < 2:
                        R.add("C06", "ERROR", f"Official-text item {st['id']} claimed verbatim on a unit below V2", upath)
            n_en = sum(1 for st in u["officialText"] if st["text"].get("en"))
            n_hi = sum(1 for st in u["officialText"] if st["text"].get("hi"))
            if n_en and n_hi and n_en != n_hi:
                R.add("C06", "ERROR", f"{n_en} English official-text items but {n_hi} Hindi official-text items", upath)
    R.add("C06", "INFO", "Document layouts: " + ", ".join(f"{k}={v}" for k, v in sorted(layouts.items())))
    if not R.count("C06", "ERROR"):
        R.add("C06", "INFO", "Layout matches document records for every subject; every translated title is marked with translatedFrom, translatedBy and source document.")

    # ---------------- C07 source references
    used = set()

    def check_refs(refs, path):
        if not refs:
            R.add("C07", "ERROR", "Empty sourceRefs", path)
        for r in refs or []:
            used.add(r)
            if r not in src_ids and r not in docs:
                R.add("C07", "ERROR", f"sourceRef {r} does not resolve", path)

    check_refs(d["ugcNet"].get("sourceRefs"), "ugcNet")
    for p in d["ugcNet"]["papers"]:
        check_refs(p.get("sourceRefs"), f"paper {p['id']}")
    for p, s in iter_subjects(d):
        path = f"subject {s['id']}"
        check_refs(s.get("sourceRefs"), path)
        if s["name"]["officialSource"] not in src_ids:
            R.add("C07", "ERROR", "name.officialSource does not resolve", path)
        if s.get("syllabusVersionRef") not in ver_ids:
            R.add("C07", "ERROR", f"syllabusVersionRef {s.get('syllabusVersionRef')} does not exist", path)
        for u in s["units"]:
            check_refs(u.get("sourceRefs"), f"{path} {u['id']}")
            for t in u["topics"]:
                check_refs(t.get("sourceRefs"), f"{path} {t['id']}")
                for sb in t["subtopics"]:
                    check_refs(sb.get("sourceRefs"), f"{path} {sb['id']}")
        for r in s["documentRefs"]:
            if r not in docs:
                R.add("C07", "ERROR", f"documentRef {r} does not exist", path)
    for x in d["documents"]:
        check_refs(x.get("sourceRefs"), f"document {x['id']}")
        if not x.get("sourceUrl"):
            R.add("C07", "ERROR", "Document without sourceUrl", f"document {x['id']}")
        for need in ("issuingAuthority", "documentTitle", "publication", "applicableExamPeriod", "pageOrSection", "language", "verification"):
            if need not in x:
                R.add("C07", "ERROR", f"Document missing Part C field {need}", f"document {x['id']}")
    for s in d["sources"]:
        if not s.get("url"):
            R.add("C07", "ERROR", "Source without URL", f"source {s['id']}")
    for sv in d["syllabusVersions"]:
        for r in sv["statedBy"]:
            used.add(r)
            if r not in src_ids:
                R.add("C07", "ERROR", f"syllabusVersion {sv['id']} cites missing source {r}")
    for k in ("checkedSources", "notReadable"):
        for it in d["amendmentCheck"][k]:
            used.add(it["source"])
            if it["source"] not in src_ids:
                R.add("C07", "ERROR", f"amendmentCheck cites missing source {it['source']}")
    for sid in sorted(src_ids - used):
        R.add("C07", "WARN", f"Source {sid} is never cited by any record", f"source {sid}")
    nrefs = sum(1 for _ in subjects)
    if not R.count("C07", "ERROR"):
        R.add("C07", "INFO", f"Every paper, subject, document, unit, topic and subtopic has resolvable sourceRefs; {len(src_ids)} sources, {len(docs)} documents.")

    # ---------------- C08 unverified / ambiguous / internal consistency
    levels = Counter()
    for s in subjects:
        levels[("subject", s["verification"])] += 1
        for u in s["units"]:
            levels[("unit", u["verification"])] += 1
            for t in u["topics"]:
                levels[("topic", t["verification"])] += 1
                for sb in t["subtopics"]:
                    levels[("subtopic", sb["verification"])] += 1
    for x in d["documents"]:
        levels[("document", x["verification"])] += 1
    for s in d["sources"]:
        levels[("source", s["verification"])] += 1
    for (lvl, v), n in sorted(levels.items()):
        R.add("C08", "INFO", f"{lvl} records at {v}: {n}")
    n_v2 = sum(n for (lvl, v), n in levels.items() if v in ("V2", "V3") and lvl != "source")
    cov = d["coverage"]
    recomputed = {
        "subjectRows": len(subjects), "paper2Subjects": len(p2), "documents": len(d["documents"]),
        "subjectsWithAnyUnitRecord": sum(1 for s in subjects if s["units"]),
        "unitRecords": sum(len(s["units"]) for s in subjects),
        "unitRecordsImportEligible": sum(1 for s in subjects for u in s["units"] if u["importEligible"]),
        "topicRecords": sum(len(u["topics"]) for s in subjects for u in s["units"]),
        "subtopicRecords": sum(len(t["subtopics"]) for s in subjects for u in s["units"] for t in u["topics"]),
        "officialTextRecords": sum(len(u["officialText"]) for s in subjects for u in s["units"]),
        "recordsAtV2OrAbove": n_v2,
        "documentsCaptured": sum(1 for x in d["documents"] if x["file"]["status"] == "CAPTURED"),
    }
    for k, v in recomputed.items():
        if cov.get(k) != v:
            R.add("C08", "ERROR", f"coverage.{k} is {cov.get(k)!r} but recomputed value is {v!r}")
    rel = d["dataset"]["releaseStatus"]
    if rel != "VERIFIED" and d["dataset"]["importPolicy"]["importAsOfficialContent"]:
        R.add("C08", "ERROR", "importAsOfficialContent is true while releaseStatus is not VERIFIED")
    if rel == "VERIFIED" and (n_v2 == 0 or any(s["verification"] == "V1" for s in subjects)):
        R.add("C08", "ERROR", "releaseStatus VERIFIED while V1 or unverified records remain")
    if rel == "SKELETON_UNVERIFIED" and n_v2:
        R.add("C08", "WARN", "releaseStatus is SKELETON_UNVERIFIED but V2/V3 records exist; update the status")
    for x in d["documents"]:
        if x["contentRead"] != "NONE":
            R.add("C08", "WARN", f"Document {x['id']} has contentRead={x['contentRead']}; content is not verified", f"document {x['id']}")
    n_nohash = sum(1 for x in d["documents"] if not x["file"]["sha256"])
    R.add("C08", "GAP", f"{n_nohash} of {len(d['documents'])} documents have no SHA-256 (no file was captured).")
    n_title = sum(1 for x in d["documents"] if not x["documentTitle"]["text"])
    R.add("C08", "GAP", f"{n_title} of {len(d['documents'])} documents have no document title; publication/revision dates and page numbers unknown for all {len(d['documents'])}.")
    n_lang = sum(1 for s in subjects if s["languageSubject"]["value"])
    R.add("C08", "WARN", f"{n_lang} subjects are flagged as language subjects by author inference only (not official).")
    nv = [s["code"] for s in subjects if s["name"]["catalogueVariant"]]
    R.add("C08", "WARN", f"{len(nv)} subjects have a catalogue spelling that differs from Annexure II after normalising punctuation: {', '.join(nv)}")
    amb = [u["id"] for s in subjects for u in s["units"] if u.get("ambiguity")]
    R.add("C08", "WARN", f"{len(amb)} unit record(s) carry an ambiguity note and are not import-eligible: {', '.join(amb) if amb else 'none'}")
    nef = [s["code"] for s in subjects if s["effectiveFrom"]["status"] != "VERIFIED"]
    R.add("C08", "WARN", f"{len(nef)} of {len(subjects)} subjects have no verified effective date (catalogue banner only).")
    fn = [s["code"] for s in subjects if s.get("printedCodeInFootnote")]
    R.add("C08", "WARN", f"Code printed differently in a bulletin footnote for: {', '.join(fn) if fn else 'none'}")
    return R


def summarise(R):
    out = {}
    for c in ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]:
        e, g, w = R.count(c, "ERROR"), R.count(c, "GAP"), R.count(c, "WARN")
        out[c] = {"error": e, "gap": g, "warn": w, "result": "FAIL" if e else ("PASS_WITH_GAPS" if g else ("PASS_WITH_WARNINGS" if w else "PASS"))}
    return out


def self_test(d, schema):
    """Each mutation must be caught by the named check. Proves the validator can fail."""
    def mut(fn):
        x = copy.deepcopy(d)
        fn(x)
        return x
    subj = lambda x, code: next(s for _, s in iter_subjects(x) if s["code"] == code)
    cases = []
    cases.append(("blank subject code", "C02", lambda x: subj(x, "12").__setitem__("code", "")))
    cases.append(("code not matching codeNumeric", "C02", lambda x: subj(x, "12").__setitem__("codeNumeric", 13)))
    def dup_subject(x):
        p2 = x["ugcNet"]["papers"][1]["subjects"]
        c = copy.deepcopy(p2[3]); p2.append(c)
    cases.append(("duplicate subject entry", "C03", dup_subject))
    cases.append(("unresolvable sourceRef", "C07", lambda x: subj(x, "12").__setitem__("sourceRefs", ["S99"])))
    cases.append(("empty sourceRefs", "C07", lambda x: subj(x, "12").__setitem__("sourceRefs", [])))
    def dup_topic(x):
        u = subj(x, "107")["units"][0]
        t = {"id": "top-107-01-01", "ordinal": 1, "title": {"en": {"text": "Normal distribution", "provenance": "TRANSLATION_UNVERIFIED", "translatedFrom": "hi", "translatedBy": "test", "sourceDocRef": "doc-107-hi"}, "hi": None},
             "origin": "official", "officialRefs": [], "subtopics": [], "verification": "V1", "importEligible": False, "sourceRefs": ["doc-107-hi"]}
        t2 = copy.deepcopy(t); t2["id"] = "top-107-01-02"; t2["ordinal"] = 2
        u["topics"] = [t, t2]
    cases.append(("duplicate topic title in one unit", "C05", dup_topic))
    def dup_unit_title(x):
        us = subj(x, "107")["units"]
        us[1]["title"]["en"]["text"] = us[0]["title"]["en"]["text"]
    cases.append(("duplicate unit title", "C05", dup_unit_title))
    def trans_missing(x):
        del subj(x, "107")["units"][0]["title"]["en"]["translatedFrom"]
    cases.append(("translation without translatedFrom", "C01", trans_missing))
    def verbatim_v1(x):
        t = subj(x, "107")["units"][0]["title"]["en"]
        t["provenance"] = "OFFICIAL_VERBATIM"; t["page"] = 1
    cases.append(("OFFICIAL_VERBATIM on a V1 unit", "C06", verbatim_v1))
    cases.append(("layout does not match documents", "C06", lambda x: subj(x, "12").__setitem__("documentLayout", "single_file_both_columns")))
    def empty_claim(x):
        s = subj(x, "12"); s["coverage"]["units"] = "COMPLETE_V2"
    cases.append(("claims complete units while empty", "C04", empty_claim))
    def no_gap(x):
        s = subj(x, "12"); s["gapRefs"] = ["GAP-99"]
    cases.append(("gapRef to a missing gap", "C04", no_gap))
    def import_v1(x):
        subj(x, "107")["units"][0]["importEligible"] = True
    cases.append(("importEligible on a V1 unit", "C01", import_v1))
    def bad_cov(x):
        x["coverage"]["unitRecords"] = 99
    cases.append(("coverage count wrong", "C08", bad_cov))
    def verified_claim(x):
        x["dataset"]["releaseStatus"] = "VERIFIED"
    cases.append(("VERIFIED status while V1 remains", "C08", verified_claim))
    def en_hi_count(x):
        u = subj(x, "107")["units"][0]
        mk = lambda i, l: {"id": f"stmt-107-01-{i:03d}", "no": i, "text": {"en": None, "hi": None}, "page": 1, "sourceDocId": "doc-107-hi"}
        a = mk(1, "en"); a["text"]["en"] = {"text": "x", "provenance": "TRANSLATION_UNVERIFIED", "translatedFrom": "hi", "translatedBy": "t", "sourceDocRef": "doc-107-hi"}
        b = mk(2, "hi"); b["text"]["hi"] = {"text": "y", "provenance": "TRANSLATION_UNVERIFIED", "translatedFrom": "en", "translatedBy": "t", "sourceDocRef": "doc-107-en"}
        c = mk(3, "hi"); c["text"]["hi"] = {"text": "z", "provenance": "TRANSLATION_UNVERIFIED", "translatedFrom": "en", "translatedBy": "t", "sourceDocRef": "doc-107-en"}
        u["officialText"] = [a, b, c]
    cases.append(("English and Hindi statement counts differ", "C06", en_hi_count))
    cases.append(("document with wrong subject code", "C06", lambda x: next(v for v in x["documents"] if v["id"] == "doc-12-en").__setitem__("subjectCode", "14")))
    results = []
    for name, check, fn in cases:
        x = mut(fn)
        R = run_checks(x, schema)
        caught = R.count(check, "ERROR") > 0
        results.append({"mutation": name, "expectedCheck": check, "caught": caught})
    # positive control: a fully populated V2 unit (synthetic, in memory only, never written to the dataset)
    # must validate cleanly, otherwise the schema would reject real data.
    x = copy.deepcopy(d)
    s = next(s for _, s in iter_subjects(x) if s["code"] == "00")
    D = "doc-00-en"
    ot = lambda n, txt: {"id": f"stmt-00-01-{n:03d}", "no": n, "text": {"en": {"text": txt, "provenance": "OFFICIAL_VERBATIM", "sourceDocRef": D, "page": 1}, "hi": None}, "page": 1, "sourceDocId": D}
    s["units"] = [{
        "id": "unit-00-01", "unitNumber": 1,
        "title": {"en": {"text": "TEST-ONLY unit title", "provenance": "OFFICIAL_VERBATIM", "sourceDocRef": D, "page": 1}, "hi": None},
        "officialText": [ot(1, "TEST-ONLY statement one"), ot(2, "TEST-ONLY statement two")],
        "topics": [{"id": "top-00-01-01", "ordinal": 1, "title": {"en": {"text": "TEST-ONLY editorial topic", "provenance": "TRANSLATION_REVIEWED", "translatedFrom": "hi", "translatedBy": "tester", "sourceDocRef": "doc-00-hi"}, "hi": None},
                    "origin": "editorial", "officialRefs": [{"unitNo": 1, "statementNos": [1, 2]}], "verification": "V2", "importEligible": True, "sourceRefs": [D],
                    "subtopics": [{"id": "sub-00-01-01-01", "ordinal": 1, "title": {"en": {"text": "TEST-ONLY subtopic", "provenance": "TRANSLATION_REVIEWED", "translatedFrom": "hi", "translatedBy": "tester", "sourceDocRef": "doc-00-hi"}, "hi": None},
                                   "origin": "editorial", "officialRefs": [{"unitNo": 1, "statementNos": [1]}], "verification": "V2", "importEligible": True, "sourceRefs": [D]}]}],
        "verification": "V2", "importEligible": True, "sourceRefs": [D], "pageOrSection": {"value": "p.1", "status": "READ"}}]
    s["coverage"]["units"] = "PARTIAL_TEST"
    pc = run_checks(x, schema)
    # coverage counts will differ (expected: the synthetic data is not in the dataset header), so only structural checks are judged
    pc_errors = [i for i in pc.items if i["severity"] == "ERROR" and i["check"] != "C08"]
    results.append({"mutation": "(positive control) synthetic V2 unit with official text, topic and subtopic is accepted", "expectedCheck": "none", "caught": not pc_errors,
                    "detail": [i["message"] for i in pc_errors][:5]})
    base = run_checks(d, schema)
    results.append({"mutation": "(baseline, unmodified file)", "expectedCheck": "none", "caught": base.count("C01", "ERROR") + sum(base.count(c, "ERROR") for c in ["C02", "C03", "C04", "C05", "C06", "C07", "C08"]) == 0})
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(HERE / "M9_OFFICIAL_CURRICULUM_DATA.json"))
    ap.add_argument("--schema", default=str(HERE / "M9_OFFICIAL_CURRICULUM_DATA.schema.json"))
    ap.add_argument("--json-out")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    d = json.load(open(a.data, encoding="utf-8"))
    schema = json.load(open(a.schema, encoding="utf-8"))
    R = run_checks(d, schema)
    summ = summarise(R)
    print("== Per-check result ==")
    names = {"C01": "JSON schema validity", "C02": "Subject codes", "C03": "Duplicate subjects", "C04": "Missing units",
             "C05": "Duplicate units/topics", "C06": "English/Hindi mapping", "C07": "Source references", "C08": "Unverified/ambiguous + consistency"}
    for c, v in summ.items():
        print(f"{c} {names[c]:38s} {v['result']:20s} errors={v['error']} gaps={v['gap']} warnings={v['warn']}")
    print("\n== Findings (ERROR, WARN and INFO; GAP lines are summarised per check) ==")
    for it in R.items:
        if it["severity"] in ("ERROR", "WARN", "INFO"):
            print(f"[{it['check']}][{it['severity']}] {it['message']}" + (f"  ({it['path']})" if it["path"] else ""))
    gaps_by_check = Counter(i["check"] for i in R.items if i["severity"] == "GAP")
    print("\n== GAP lines per check ==", dict(gaps_by_check))
    res = {"summary": summ, "findings": R.items}
    if a.self_test:
        st = self_test(d, schema)
        res["selfTest"] = st
        print("\n== Self-test (each seeded defect must be caught) ==")
        for r in st:
            print(f"{'OK  ' if r['caught'] else 'MISS'} {r['mutation']}  -> {r['expectedCheck']}")
        if not all(r["caught"] for r in st):
            print("SELF-TEST FAILED")
            if a.json_out:
                json.dump(res, open(a.json_out, "w"), indent=1)
            sys.exit(2)
    if a.json_out:
        json.dump(res, open(a.json_out, "w"), indent=1, ensure_ascii=False)
    n_err = sum(v["error"] for v in summ.values())
    print(f"\nTOTAL ERRORS: {n_err}")
    sys.exit(1 if n_err else 0)


if __name__ == "__main__":
    main()
