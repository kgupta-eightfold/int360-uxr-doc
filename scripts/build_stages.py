#!/usr/bin/env python3
"""
Build js/stages.js (candidate journey-stage data) from the raw research tables.

Sources (Raw data - 1706):
  Candidate onboarding.html       -> Pre interview
  Candidate interview.html        -> During interview
  Candidate post interview.html   -> Post interview
  Recommendations.html (Table 2)  -> candidate recommendations, bucketed by Issue area

Rows tagged "Don't show / no show" in the Show column are excluded.
All text is taken verbatim from the tables.

    python3 scripts/build_stages.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "360CUX" / "Raw data - 1706" / "UXR AII May 2026"
OUT = ROOT / "js" / "stages.js"


def rows(path):
    src = (SRC / path).read_text(encoding="utf-8")
    out = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", src, re.S):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", td))).strip()
                 for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        out.append(cells)
    return out


def norm(s):
    return re.sub(r"\s+", " ", s or "").strip().lower()


def first_nonempty(r):
    return next((c for c in r if c), "")


def hidden(show):
    return bool(re.search(r"don'?t\s*show|no\s*show", show or "", re.I))


def parse_candidate(filename):
    issues, works = [], []
    section, hmap = None, None
    for r in rows(filename):
        head_txt = norm(first_nonempty(r))
        if head_txt.startswith("issues") and "worked" not in head_txt:
            section, hmap = "issues", None
            continue
        if first_nonempty(r).startswith("✓") or "what worked" in head_txt:
            section, hmap = "works", None
            continue
        cells_low = [norm(c) for c in r]
        if section and hmap is None and ("#" in cells_low or "severity" in cells_low or "positive finding" in cells_low):
            hmap = {}
            for i, c in enumerate(cells_low):
                if c == "#":
                    hmap["id"] = i
                elif "severity" in c:
                    hmap["severity"] = i
                elif "positive finding" in c:
                    hmap["pos"] = i
                elif c == "heading" or c.startswith("heading"):
                    hmap.setdefault("heading", i)
                elif "recommendation" in c:
                    hmap["recommendation"] = i
                elif "show" in c:
                    hmap["show"] = i
                elif "participant" in c:
                    hmap["participants"] = i
                elif "owner" in c:
                    hmap["owner"] = i
                elif "known" in c:
                    hmap["known"] = i
                elif c == "type":
                    hmap["type"] = i
                elif "source" in c:
                    hmap["source"] = i
                elif "evidence" in c:
                    hmap["evidence"] = i
            continue
        if not section or hmap is None:
            continue

        def g(k):
            i = hmap.get(k)
            return r[i].strip() if (i is not None and i < len(r)) else ""

        if hidden(g("show")):
            continue
        if section == "issues":
            sev, heading = g("severity"), g("heading")
            if not (sev or heading):
                continue
            issues.append({"id": g("id"), "severity": sev, "heading": heading,
                           "recommendation": g("recommendation"), "participants": g("participants"),
                           "owner": g("owner"), "known": g("known"), "source": g("source"),
                           "evidence": g("evidence")})
        else:
            heading = g("pos") or g("heading")
            if not heading:
                continue
            works.append({"id": g("id"), "heading": heading, "participants": g("participants"),
                          "owner": g("owner"), "type": g("type"), "source": g("source"),
                          "evidence": g("evidence")})
    return issues, works


def parse_recommendation_tables():
    tables, cur, hmap = [], None, None
    for r in rows("Recommendations.html"):
        cells_low = [norm(c) for c in r]
        if "#" in cells_low and any("recommendation" in c for c in cells_low) and any("issue area" in c for c in cells_low):
            hmap = {}
            for i, c in enumerate(cells_low):
                if c == "#":
                    hmap["num"] = i
                elif c == "summary":
                    hmap["summary"] = i
                elif "recommendation" in c:
                    hmap["recommendation"] = i
                elif "product area" in c:
                    hmap["area"] = i
                elif "severity" in c:
                    hmap["severity"] = i
                elif "issue area" in c:
                    hmap["issueArea"] = i
                elif "pain point" in c:
                    hmap["pain"] = i
                elif "evidence" in c:
                    hmap["evidence"] = i
            cur = []
            tables.append(cur)
            continue
        if hmap is None or cur is None:
            continue

        def g(k):
            i = hmap.get(k)
            return r[i].strip() if (i is not None and i < len(r)) else ""

        issue_area, rec = g("issueArea"), g("recommendation")
        if not (issue_area or rec):
            continue
        cur.append({"num": g("num"), "summary": g("summary"), "recommendation": rec,
                    "area": g("area"), "severity": g("severity"), "issueArea": issue_area,
                    "pain": g("pain"), "evidence": g("evidence")})
    return tables


# Issue area -> stage key ("all" means show in every stage of that track)
def cand_rec_stage(issue_area):
    a = norm(issue_area)
    if "onboarding" in a:
        return "pre"
    if "post" in a:
        return "post"
    if "candidate interview" in a:
        return "during"
    if "all flows" in a:
        return "all"
    return None


def rec_rec_stage(issue_area):
    a = norm(issue_area)
    if "scheduling" in a:
        return "scheduling"
    if "all flows" in a:
        return "all"
    return "feedback"  # Feedback form, Analytics, FAQ/support → output/feedback side


def build_track(files, rec_table, rec_stage_fn, all_keys):
    stages = {}
    for key, fn in files.items():
        issues, works = parse_candidate(fn)
        stages[key] = {"issues": issues, "works": works, "recs": []}
    for rec in rec_table:
        st = rec_stage_fn(rec["issueArea"])
        targets = all_keys if st == "all" else ([st] if st in stages else [])
        for k in targets:
            stages[k]["recs"].append(rec)
    return stages


def main():
    tables = parse_recommendation_tables()
    recruiter_recs = tables[0] if len(tables) > 0 else []
    candidate_recs = tables[1] if len(tables) > 1 else []

    candidate = build_track(
        {"pre": "Candidate onboarding.html", "during": "Candidate interview.html", "post": "Candidate post interview.html"},
        candidate_recs, cand_rec_stage, ("pre", "during", "post"))
    recruiter = build_track(
        {"scheduling": "Scheduling.html", "feedback": "Feedback form.html"},
        recruiter_recs, rec_rec_stage, ("scheduling", "feedback"))

    stages = {"candidate": candidate, "recruiter": recruiter}
    js = ("// GENERATED — do not edit by hand. Built by scripts/build_stages.py\n"
          "// Journey-stage findings (candidate + recruiter), verbatim from the raw research tables.\n"
          "export const STAGES = " + json.dumps(stages, ensure_ascii=False, indent=2) + ";\n")
    OUT.write_text(js, encoding="utf-8")

    print(f"Wrote {OUT}")
    for track, data in stages.items():
        for k, s in data.items():
            print(f"  {track}/{k}: {len(s['issues'])} issues, {len(s['works'])} works, {len(s['recs'])} recs")


if __name__ == "__main__":
    main()
