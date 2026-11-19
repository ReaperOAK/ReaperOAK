"""Deterministic Codebase and Git History Miner (Zero LLM Tokens)."""
import json
import re
import base64
import subprocess
from typing import Dict, List, Any, Optional
from .config import GITHUB_OWNER, DOCS_DIR, SENSITIVE_PATTERNS


def run_gh(args: List[str]) -> Any:
    """Helper to execute gh CLI."""
    cmd = ["gh"] + args
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        return None
    try:
        return json.loads(res.stdout)
    except Exception:
        return res.stdout


def sanitize_text(text: str) -> str:
    """Remove potential sensitive credentials or tokens."""
    sanitized = text
    for pattern in SENSITIVE_PATTERNS:
        sanitized = re.sub(pattern, "[REDACTED_CREDENTIAL]", sanitized)
    return sanitized


def fetch_file_content(repo: str, branch: str, path: str) -> Optional[str]:
    """Fetch raw file content from GitHub repository."""
    data = run_gh(["api", f"repos/{GITHUB_OWNER}/{repo}/contents/{path}?ref={branch}"])
    if not data or not isinstance(data, dict) or "content" not in data:
        return None
    try:
        raw = base64.b64decode(data["content"]).decode("utf-8", errors="ignore")
        return sanitize_text(raw)
    except Exception:
        return None


def fetch_repo_tree(repo: str, branch: str) -> List[str]:
    """Fetch all file paths in repo, filtering out boilerplate and noise."""
    data = run_gh(["api", f"repos/{GITHUB_OWNER}/{repo}/git/trees/{branch}?recursive=1"])
    if not data or not isinstance(data, dict) or "tree" not in data:
        return []

    ignored_prefixes = (
        "node_modules/",
        ".git/",
        "dist/",
        "build/",
        "out/",
        ".next/",
        "__pycache__/",
        "coverage/",
        ".cache/",
        "target/",
    )
    ignored_exts = (".png", ".jpg", ".jpeg", ".webp", ".ico", ".svg", ".lock", ".wasm")

    valid_paths = []
    for item in data["tree"]:
        p = item.get("path", "")
        if item.get("type") == "blob":
            if not p.startswith(ignored_prefixes) and not p.endswith(ignored_exts):
                valid_paths.append(p)
    return valid_paths


def parse_manifests(repo: str, branch: str, tree: List[str]) -> Dict[str, Any]:
    """Extract dependencies, scripts, and configurations from project manifests."""
    manifests: Dict[str, Any] = {
        "stack": set(),
        "scripts": {},
        "ci_workflows": [],
        "schemas": [],
        "specs": [],
    }

    # Package.json
    for p in [p for p in tree if p.endswith("package.json")]:
        content = fetch_file_content(repo, branch, p)
        if content:
            try:
                pkg = json.loads(content)
                deps = list(pkg.get("dependencies", {}).keys()) + list(pkg.get("devDependencies", {}).keys())
                manifests["stack"].update(deps)
                if pkg.get("scripts"):
                    manifests["scripts"][p] = pkg["scripts"]
            except Exception:
                pass

    # Cargo.toml
    for p in [p for p in tree if p.endswith("Cargo.toml")]:
        content = fetch_file_content(repo, branch, p)
        if content:
            manifests["stack"].add("Rust")
            # Grab dependency names
            for line in content.splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    k = line.split("=")[0].strip()
                    if k and not k.startswith("["):
                        manifests["stack"].add(k)

    # Python (requirements / pyproject)
    for p in [p for p in tree if p.endswith("requirements.txt") or p.endswith("pyproject.toml")]:
        content = fetch_file_content(repo, branch, p)
        if content:
            manifests["stack"].add("Python")
            for line in content.splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    pkg_name = re.split(r"[><=~;]", line)[0].strip()
                    if pkg_name:
                        manifests["stack"].add(pkg_name)

    # CI Workflows
    for p in [p for p in tree if p.startswith(".github/workflows/") and (p.endswith(".yml") or p.endswith(".yaml"))]:
        manifests["ci_workflows"].append(p)

    # Schemas & Specs
    for p in tree:
        if any(p.endswith(ext) for ext in [".prisma", ".sql", "firestore.rules", "schema.ts"]):
            manifests["schemas"].append(p)
        if p.startswith("docs/superpowers/specs/") or p.startswith("docs/specs/"):
            manifests["specs"].append(p)

    manifests["stack"] = sorted(list(manifests["stack"]))
    return manifests


def mine_commits(repo: str) -> List[Dict[str, Any]]:
    """Mine and filter Git commit history for inflection points, refactors, and fixes."""
    commits_data = run_gh(["api", f"repos/{GITHUB_OWNER}/{repo}/commits?per_page=100"])
    if not isinstance(commits_data, list):
        return []

    high_signal_commits = []
    war_story_candidates = []

    inflection_regex = re.compile(
        r"(?i)\b(refactor|perf|performance|fix|migrate|architecture|scale|benchmark|queue|cache|security|crdt|dag)\b"
    )

    for item in commits_data:
        msg = item.get("commit", {}).get("message", "")
        sha = item.get("sha", "")[:7]
        author_date = item.get("commit", {}).get("author", {}).get("date", "")

        # Skip merge commits
        if msg.startswith("Merge branch") or msg.startswith("Merge pull request"):
            continue

        first_line = msg.splitlines()[0]
        has_signal = bool(inflection_regex.search(msg))

        entry = {
            "sha": sha,
            "date": author_date,
            "summary": first_line,
            "body": "\n".join(msg.splitlines()[1:]).strip() if len(msg.splitlines()) > 1 else "",
            "is_inflection": has_signal,
        }

        if has_signal:
            high_signal_commits.append(entry)

        # Detect candidate war stories (commits that explain a non-trivial fix or diagnosis)
        if first_line.lower().startswith("fix") and (len(msg.splitlines()) > 2 or "because" in msg.lower() or "root" in msg.lower()):
            war_story_candidates.append(entry)

    return {
        "total_mined": len(commits_data),
        "inflection_points": high_signal_commits[:25],
        "war_stories": war_story_candidates[:5],
    }


def mine_repo(repo: str) -> Dict[str, Any]:
    """Full extraction for a specific repository."""
    print(f"Mining repository: {repo}...")

    # 1. Fetch repo metadata
    meta = run_gh(["repo", "view", f"{GITHUB_OWNER}/{repo}", "--json", "name,description,url,defaultBranchRef,stargazerCount"])
    if not meta:
        raise ValueError(f"Could not fetch metadata for {repo}")

    branch = (meta.get("defaultBranchRef") or {}).get("name", "main")
    print(f"  Branch: {branch}")

    # 2. Fetch README
    readme_data = run_gh(["api", f"repos/{GITHUB_OWNER}/{repo}/readme"])
    readme_text = ""
    if readme_data and isinstance(readme_data, dict) and "content" in readme_data:
        try:
            readme_text = base64.b64decode(readme_data["content"]).decode("utf-8", errors="ignore")
        except Exception:
            pass

    # 3. Fetch tree & parse manifests
    tree = fetch_repo_tree(repo, branch)
    print(f"  Scanned {len(tree)} clean files in tree.")
    manifests = parse_manifests(repo, branch, tree)

    # 4. Mine commit history
    git_intel = mine_commits(repo)
    print(f"  Mined {git_intel['total_mined']} commits, found {len(git_intel['inflection_points'])} inflection points.")

    intel = {
        "repo": repo,
        "url": meta.get("url"),
        "description": meta.get("description", ""),
        "stars": meta.get("stargazerCount", 0),
        "branch": branch,
        "file_count": len(tree),
        "tree_sample": tree[:40],
        "manifests": manifests,
        "git_intel": git_intel,
        "readme_length": len(readme_text.split()),
        "raw_readme": readme_text,
    }

    out_path = DOCS_DIR / f"{repo}_facts.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(intel, f, indent=2)

    print(f"  Facts persisted to: {out_path}")
    return intel
