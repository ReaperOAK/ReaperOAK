"""Unified CLI for the Portfolio Intelligence & Sync Engine."""
import sys
import argparse
import json
from .config import TIER_1_FLAGSHIPS, DOCS_DIR
from .recon import run_recon
from .miner import mine_repo
from .synthesizer import synthesize_project
from .readme_generator import generate_readme_for_repo


def main():
    parser = argparse.ArgumentParser(
        description="Portfolio Intelligence & Sync Engine (ReaperOAK)"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # recon
    subparsers.add_parser("recon", help="Scan and audit all GitHub repositories")

    # mine
    mine_parser = subparsers.add_parser("mine", help="Extract facts and git history for a repository")
    mine_parser.add_argument("repo", help="Repository name (e.g. ForgeOS)")

    # synthesize
    synth_parser = subparsers.add_parser("synthesize", help="Synthesize MDX case study for a repository")
    synth_parser.add_argument("repo", help="Repository name")

    # readme
    readme_parser = subparsers.add_parser("readme", help="Generate production README for a repository")
    readme_parser.add_argument("repo", help="Repository name")

    # sync-flagships
    subparsers.add_parser("sync-flagships", help="Mine and synthesize all Tier 1 Flagships")

    args = parser.parse_args()

    if args.command == "recon":
        run_recon()

    elif args.command == "mine":
        mine_repo(args.repo)

    elif args.command == "synthesize":
        facts_file = DOCS_DIR / f"{args.repo}_facts.json"
        if not facts_file.exists():
            print(f"Facts not found for {args.repo}. Mining first...")
            facts = mine_repo(args.repo)
        else:
            with open(facts_file, "r", encoding="utf-8") as f:
                facts = json.load(f)
        synthesize_project(args.repo, facts)

    elif args.command == "readme":
        facts_file = DOCS_DIR / f"{args.repo}_facts.json"
        if not facts_file.exists():
            facts = mine_repo(args.repo)
        else:
            with open(facts_file, "r", encoding="utf-8") as f:
                facts = json.load(f)
        generate_readme_for_repo(args.repo, facts)

    elif args.command == "sync-flagships":
        print("=== Syncing All Tier 1 Flagship Repositories ===")
        for repo in TIER_1_FLAGSHIPS:
            print(f"\n---> Processing {repo}...")
            try:
                facts = mine_repo(repo)
                synthesize_project(repo, facts)
                if repo.lower() == "id-card-maker":
                    generate_readme_for_repo(repo, facts)
            except Exception as e:
                print(f"Error processing {repo}: {e}")
        print("\nAll Tier 1 Flagships synchronized!")


if __name__ == "__main__":
    main()
