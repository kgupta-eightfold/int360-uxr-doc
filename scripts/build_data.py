#!/usr/bin/env python3
"""
Build the central data module (js/data.js) for the UXR shareout site.

Source of truth: the Google-Sheet HTML exports in
  Temp/UXR AII May 2026/

Every string is extracted verbatim from the source files — this script only
parses table structure; it never rewrites, merges, or paraphrases content.
Re-run after replacing the source exports:

    python3 scripts/build_data.py
"""
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "Temp" / "UXR AII May 2026"
# Recommendations come from the updated export (restructured into two tables:
# first recruiter-side, then candidate-side — the sheet's own categorisation).
SRC_UPDATED = ROOT.parent / "Temp" / "UXR AII May 2026 [updated]"
OUT = ROOT / "js" / "data.js"


def parse_rows(path):
    """Return every <tr> as a list of cell strings (tags stripped, verbatim text)."""
    src = path.read_text(encoding="utf-8")
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", src, re.S):
        cells = []
        for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S):
            txt = re.sub(r"<[^>]+>", " ", td)
            txt = html.unescape(txt)
            txt = re.sub(r"\s+", " ", txt).strip()
            cells.append(txt)
        rows.append(cells)
    return rows


def cell(row, i):
    return row[i] if i < len(row) and row[i] else None


def is_marker(row, text):
    return bool(row) and bool(row[0]) and row[0].startswith(text)


# ---------------------------------------------------------------- issue logs
def parse_issue_log(filename, id_pattern):
    """Tech / Functional / HVH / Recruiter logs: title, issue rows, what-worked rows."""
    rows = parse_rows(SRC / filename)
    title = next(r[0] for r in rows if r and r[0])
    issues, what_worked = [], []
    section = "issues"
    for r in rows:
        if is_marker(r, "✓ What Worked Well"):
            section = "whatWorked"
            continue
        rid = cell(r, 0)
        if not rid:
            continue
        if section == "issues" and re.fullmatch(id_pattern, rid):
            issues.append({
                "id": rid,
                "type": cell(r, 1),
                "severity": cell(r, 2),
                "round": cell(r, 3),
                "finding": cell(r, 4),
                "recommendation": cell(r, 5),
                "participants": cell(r, 6),
                "owner": cell(r, 7),
            })
        elif section == "whatWorked" and rid.startswith("+"):
            # data rows compact merged cells: finding, then trailing meta columns
            what_worked.append({
                "id": rid,
                "finding": cell(r, 1),
                "participants": cell(r, 2),
                "owner": cell(r, 3),
                "type": cell(r, 4),
            })
    return {"source": filename, "title": title, "issues": issues, "whatWorked": what_worked}


# ----------------------------------------------------------------- Summary
def parse_summary():
    rows = parse_rows(SRC / "Summary.html")
    out = {
        "source": "Summary.html",
        "candidate": {"title": None, "subtitle": None, "findings": []},
        "recruiter": {"title": None, "subtitle": None, "findings": []},
        "whatWorked": {"title": "✓ What Worked Well", "items": []},
    }
    section = None
    for r in rows:
        first = cell(r, 0)
        if not first:
            continue
        if first.startswith("Candidate Findings"):
            section = "candidate"
            out["candidate"]["title"] = first
            continue
        if first.startswith("Recruiter Findings"):
            section = "recruiter"
            out["recruiter"]["title"] = first
            continue
        if first.startswith("✓ What Worked Well"):
            section = "whatWorked"
            continue
        if section in ("candidate", "recruiter") and out[section]["subtitle"] is None \
                and not re.fullmatch(r"[CR]\d+", first) and first != "#":
            out[section]["subtitle"] = first
            continue
        if section == "candidate" and re.fullmatch(r"C\d+", first):
            out["candidate"]["findings"].append({
                "id": first,
                "short": cell(r, 1),
                "finding": cell(r, 2),
                "severity": cell(r, 3),
                "tracks": cell(r, 4),
                "recommendation": cell(r, 5),
                "owner": cell(r, 6),
                "known": cell(r, 7),
            })
        elif section == "recruiter" and re.fullmatch(r"R\d+", first):
            out["recruiter"]["findings"].append({
                "id": first,
                "short": cell(r, 1),
                "finding": cell(r, 2),
                "severity": cell(r, 3),
                "source": cell(r, 4),
                "recommendation": cell(r, 5),
                "owner": cell(r, 6),
                "known": cell(r, 7),
            })
        elif section == "whatWorked" and first.startswith("+"):
            out["whatWorked"]["items"].append({
                "id": first,
                "finding": cell(r, 1),
                "owner": cell(r, 2),
                "participants": cell(r, 3),
                "known": cell(r, 4),
            })
    return out


# ----------------------------------------------------------- Recommendations
def parse_recommendations():
    """The updated sheet holds two tables, each opened by its own '#' header
    row: table 0 = recruiter-side fixes, table 1 = candidate-side fixes.
    The split is the sheet's categorisation — preserved verbatim."""
    rows = parse_rows(SRC_UPDATED / "Recommendations.html")
    out = {"source": "Recommendations.html (updated)", "title": None, "note": None,
           "tables": [], "summaryLine": None}
    current = None
    for r in rows:
        first = cell(r, 0)
        if not first:
            continue
        if out["title"] is None:
            out["title"] = first
            continue
        if out["note"] is None and not re.fullmatch(r"\d+", first) and first != "#":
            out["note"] = first
            continue
        if first == "#":
            current = {"items": []}
            out["tables"].append(current)
            continue
        if first.startswith("Summary:"):
            out["summaryLine"] = first
        elif re.fullmatch(r"\d+", first) and current is not None:
            current["items"].append({
                "num": first,
                "recommendation": cell(r, 1),
                "area": cell(r, 2),
                "severity": cell(r, 3),
                "issueArea": cell(r, 4),
                "painPoint": cell(r, 5),
            })
    return out


# ----------------------------------------------------- Unmoderated recruiter
def parse_unmoderated_log():
    rows = parse_rows(SRC / "Unmoderated Recruiter.html")
    out = {"source": "Unmoderated Recruiter.html", "title": None,
           "panelNotes": [], "scheduling": {"title": None, "issues": []},
           "feedback": {"title": None, "issues": []}, "whatWorked": []}
    section = None
    for r in rows:
        first = cell(r, 0)
        if not first:
            continue
        if out["title"] is None:
            out["title"] = first
            continue
        if first.startswith("✓ Opened") or first.startswith("✗ Did NOT"):
            out["panelNotes"].append(first)
            continue
        if first.startswith("Scheduling Flow Findings"):
            section = "scheduling"
            out["scheduling"]["title"] = first
            continue
        if first.startswith("Feedback / Output Review Findings"):
            section = "feedback"
            out["feedback"]["title"] = first
            continue
        if first.startswith("✓ What Worked Well"):
            section = "whatWorked"
            continue
        if section in ("scheduling", "feedback") and re.fullmatch(r"U\d+", first):
            out[section]["issues"].append({
                "id": first,
                "type": cell(r, 1),
                "severity": cell(r, 2),
                "round": cell(r, 3),
                "finding": cell(r, 4),
                "recommendation": cell(r, 5),
                "participants": cell(r, 6),
                "owner": cell(r, 7),
            })
        elif section == "whatWorked" and first.startswith("+"):
            out["whatWorked"].append({
                "id": first,
                "finding": cell(r, 1),
                "type": cell(r, 2),
                "owner": cell(r, 3),
                "participants": cell(r, 4),
            })
    return out


# -------------------------------------------------------- Unmoderated study
def parse_unmoderated_study():
    rows = parse_rows(SRC / "Unmoderated Study.html")
    out = {"source": "Unmoderated Study.html", "title": None, "subtitle": None,
           "groups": [], "keyFindings": {"title": None, "positives": [], "issues": []},
           "lowerConfidence": {"title": None, "items": []},
           "hireDecision": {"title": None, "rows": [], "note": None},
           "whatWorked": []}
    section = None
    current_group = None
    for r in rows:
        first = cell(r, 0)
        if not first:
            continue
        if out["title"] is None:
            out["title"] = first
            continue
        if out["subtitle"] is None and not first.startswith("✓"):
            out["subtitle"] = first
            continue
        if first.startswith("✓ Completed") or first.startswith("✗ Struggled"):
            current_group = {"label": first, "participants": []}
            out["groups"].append(current_group)
            section = "participants"
            continue
        if first.startswith("Key Findings"):
            out["keyFindings"]["title"] = first
            section = None
            continue
        if first == "Positives":
            section = "positives"
            continue
        if first == "Issues":
            section = "issues"
            continue
        if first.startswith("Findings from participants who struggled"):
            out["lowerConfidence"]["title"] = first
            section = "lowerConfidence"
            continue
        if first.startswith("Would you make a hiring decision"):
            out["hireDecision"]["title"] = first
            section = "hireDecision"
            continue
        if first.startswith("✓ What Worked Well"):
            section = "whatWorked"
            continue
        if first in ("Participant", "Finding", "Response", "#"):
            continue
        if section == "participants" and current_group is not None:
            current_group["participants"].append({
                "participant": first,
                "country": cell(r, 1),
                "taskResult": cell(r, 2),
                "schedRating": cell(r, 3),
                "clarityRating": cell(r, 4),
                "hireOnAI": cell(r, 5),
                "keyObservation": cell(r, 6),
            })
        elif section in ("positives", "issues"):
            out["keyFindings"][section].append(
                {"finding": first, "who": cell(r, 1), "count": cell(r, 2)})
        elif section == "lowerConfidence":
            out["lowerConfidence"]["items"].append(
                {"finding": first, "who": cell(r, 1), "count": cell(r, 2)})
        elif section == "hireDecision":
            if cell(r, 1) or cell(r, 2):
                out["hireDecision"]["rows"].append(
                    {"response": first, "participants": cell(r, 1), "proportion": cell(r, 2)})
            else:
                out["hireDecision"]["note"] = first
        elif section == "whatWorked" and first.startswith("+"):
            out["whatWorked"].append({
                "id": first,
                "finding": cell(r, 1),
                "type": cell(r, 2),
                "owner": cell(r, 3),
                "participants": cell(r, 4),
            })
    return out


# ------------------------------------------------------- UX improvements
def parse_ux_improvements():
    rows = parse_rows(SRC / "List of UX improvements.html")
    items = []
    for r in rows:
        first = cell(r, 0)
        if not first or first == "Improvement":
            continue
        items.append({"improvement": first, "area": cell(r, 1)})
    return {"source": "List of UX improvements.html", "items": items}


def main():
    data = {
        "meta": {
            "sourceFolder": "Temp/UXR AII May 2026",
            "recommendationsSource": "Temp/UXR AII May 2026 [updated]/Recommendations.html",
            "sources": sorted(p.name for p in SRC.glob("*.html")),
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "note": "All content extracted verbatim from the source sheet exports "
                    "(recommendations from the [updated] export). "
                    "Regenerate with: python3 scripts/build_data.py",
        },
        "summary": parse_summary(),
        "logs": {
            "tech": parse_issue_log("Tech Log.html", r"\d+"),
            "functional": parse_issue_log("Functional Log.html", r"F\d+"),
            "hvh": parse_issue_log("HVH Log.html", r"H\d+"),
            "recruiter": parse_issue_log("Recruiter Log.html", r"R\d+"),
        },
        "unmoderated": {
            "log": parse_unmoderated_log(),
            "study": parse_unmoderated_study(),
        },
        "recommendations": parse_recommendations(),
        "uxImprovements": parse_ux_improvements(),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    js = ("// GENERATED FILE — do not edit by hand.\n"
          "// Built from the sheet HTML exports by scripts/build_data.py\n"
          "export const UXR = "
          + json.dumps(data, ensure_ascii=False, indent=2)
          + ";\n")
    OUT.write_text(js, encoding="utf-8")

    s = data["summary"]
    print(f"Wrote {OUT}")
    print(f"  candidate findings: {len(s['candidate']['findings'])}")
    print(f"  recruiter findings: {len(s['recruiter']['findings'])}")
    print(f"  what worked (summary): {len(s['whatWorked']['items'])}")
    for k, log in data["logs"].items():
        print(f"  {k} log: {len(log['issues'])} issues, {len(log['whatWorked'])} positives")
    u = data["unmoderated"]
    print(f"  unmod log: {len(u['log']['scheduling']['issues'])} sched + "
          f"{len(u['log']['feedback']['issues'])} feedback issues")
    print(f"  unmod study groups: {[len(g['participants']) for g in u['study']['groups']]}")
    print(f"  recommendations: {[len(t['items']) for t in data['recommendations']['tables']]} (recruiter, candidate)")
    print(f"  ux improvements: {len(data['uxImprovements']['items'])}")


if __name__ == "__main__":
    main()
