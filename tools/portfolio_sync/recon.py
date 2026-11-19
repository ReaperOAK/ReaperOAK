"""GitHub Reconnaissance and Repository Health Audit."""
import json
import subprocess
import base64
from typing import Dict, List, Any
from .config import (
    GITHUB_OWNER,
    TIER_1_FLAGSHIPS,
    TIER_2_UTILITIES,
    UNLISTED_REPOS,
    SKIP_REPOS,
    DOCS_DIR,
)


def run_gh_command(args: List[str]) -> Any:
    """Run a gh CLI command and return JSON parsed output."""
    cmd = ["gh"] + args
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        return None
    try:
        return json.loads(res.stdout)
    except Exception:
        return res.stdout


def fetch_all_repos() -> List[Dict[str, Any]]:
    """Fetch all repositories owned by ReaperOAK."""
    fields = "name,isPrivate,isFork,stargazerCount,updatedAt,description,defaultBranchRef,url"
    out = run_gh_command(["repo", "list", GITHUB_OWNER, "--limit", "100", "--json", fields])
    if not isinstance(out, list):
        return []
    return out


def audit_readme(repo_name: str) -> Dict[str, Any]:
    """Check README existence, size, and sections."""
    data = run_gh_command(["api", f"repos/{GITHUB_OWNER}/{repo_name}/readme"])
    if not data or not isinstance(data, dict) or "content" not in data:
        return {
            "status": "MISSING",
            "word_count": 0,
            "has_architecture": False,
            "has_setup": False,
            "has_benchmarks": False,
        }

    try:
        content = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
    except Exception:
        content = ""

    words = len(content.split())
    has_arch = any(h in content.lower() for h in ["architecture", "system design", "diagram", "mermaid"])
    has_setup = any(h in content.lower() for h in ["install", "setup", "getting started", "quick start"])
    has_benchmarks = any(h in content.lower() for h in ["benchmark", "performance", "metrics", "rps", "latency"])

    if words < 80:
        status = "STUB"
    elif words < 300:
        status = "ADEQUATE"
    else:
        status = "EXCELLENT"

    return {
        "status": status,
        "word_count": words,
        "has_architecture": has_arch,
        "has_setup": has_setup,
        "has_benchmarks": has_benchmarks,
        "path": data.get("path", "README.md"),
    }


def classify_repo(repo: Dict[str, Any]) -> str:
    """Determine the tier classification of a repository."""
    name = repo["name"]
    if repo.get("isFork") and name not in TIER_1_FLAGSHIPS and name not in TIER_2_UTILITIES:
        return "FORK_SKIP"
    if name in SKIP_REPOS:
        return "SKIPPED"
    if name in TIER_1_FLAGSHIPS:
        return "TIER_1_FLAGSHIP"
    if name in TIER_2_UTILITIES:
        return "TIER_2_UTILITY"
    if name in UNLISTED_REPOS:
        return "TIER_3_ARCHIVE"
    return "TIER_2_UTILITY" if (repo.get("stargazerCount", 0) > 0 or repo.get("description")) else "TIER_3_ARCHIVE"


def run_recon() -> Dict[str, Any]:
    """Execute full reconnaissance across all repositories."""
    repos = fetch_all_repos()
    print(f"Discovered {len(repos)} repositories under {GITHUB_OWNER}.")

    results = []
    summary = {
        "tier_1_flagships": [],
        "tier_2_utilities": [],
        "tier_3_archive": [],
        "skipped": [],
        "missing_readme": [],
        "stub_readme": [],
    }

    for idx, repo in enumerate(repos, 1):
        name = repo["name"]
        print(f"[{idx}/{len(repos)}] Auditing {name}...", end="\r")
        tier = classify_repo(repo)
        readme_info = audit_readme(name)

        item = {
            "name": name,
            "url": repo.get("url"),
            "is_private": repo.get("isPrivate", False),
            "is_fork": repo.get("isFork", False),
            "stars": repo.get("stargazerCount", 0),
            "description": repo.get("description", ""),
            "updated_at": repo.get("updatedAt", ""),
            "default_branch": (repo.get("defaultBranchRef") or {}).get("name", "main"),
            "tier": tier,
            "readme": readme_info,
        }
        results.append(item)

        # Categorize
        if tier == "TIER_1_FLAGSHIPS" or tier == "TIER_1_FLAGSHIP":
            summary["tier_1_flagships"].append(name)
        elif tier == "TIER_2_UTILITY":
            summary["tier_2_utilities"].append(name)
        elif tier == "TIER_3_ARCHIVE":
            summary["tier_3_archive"].append(name)
        else:
            summary["skipped"].append(name)

        if readme_info["status"] == "MISSING":
            summary["missing_readme"].append(name)
        elif readme_info["status"] == "STUB":
            summary["stub_readme"].append(name)

    print("\nAudit completed.")

    # Save reports
    report_file = DOCS_DIR / "recon_report.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "repositories": results}, f, indent=2)

    # Generate Markdown Summary
    md_file = DOCS_DIR / "README_AUDIT.md"
    with open(md_file, "w", encoding="utf-8") as f:
        f.write("# Repository Audit & Signal Analysis\n\n")
        f.write(f"Total Repositories Analyzed: **{len(repos)}**\n\n")
        f.write(f"- **Tier 1 Flagships ({len(summary['tier_1_flagships'])}):** {', '.join(summary['tier_1_flagships'])}\n")
        f.write(f"- **Tier 2 Utilities ({len(summary['tier_2_utilities'])}):** {len(summary['tier_2_utilities'])} repos\n")
        f.write(f"- **Tier 3 Archives ({len(summary['tier_3_archive'])}):** {len(summary['tier_3_archive'])} repos (to be unlisted)\n")
        f.write(f"- **Missing READMEs ({len(summary['missing_readme'])}):** {', '.join(summary['missing_readme']) or 'None'}\n")
        f.write(f"- **Stub READMEs (<80 words) ({len(summary['stub_readme'])}):** {', '.join(summary['stub_readme']) or 'None'}\n\n")

        f.write("## Detailed Matrix\n\n")
        f.write("| Repository | Tier | Stars | Default Branch | README Status | Words | Arch? | Benchmarks? |\n")
        f.write("|---|---|---|---|---|---|---|---|\n")
        for r in sorted(results, key=lambda x: (x["tier"], -x["stars"])):
            rm = r["readme"]
            f.write(
                f"| `{r['name']}` | {r['tier']} | {r['stars']} | `{r['default_branch']}` | "
                f"{rm['status']} | {rm['word_count']} | {'✅' if rm['has_architecture'] else '❌'} | "
                f"{'✅' if rm['has_benchmarks'] else '❌'} |\n"
            )

    print(f"Reports saved to:\n  - {report_file}\n  - {md_file}")
    return {"summary": summary, "repositories": results}
