"""Configuration for Portfolio Intelligence & Sync Engine."""
from pathlib import Path

# Paths relative to repo root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PORTFOLIO_ROOT = REPO_ROOT / "portfolio"
WEB_CONTENT_DIR = PORTFOLIO_ROOT / "web" / "content" / "projects"
DOCS_DIR = REPO_ROOT / "docs" / "portfolio_intelligence"
README_OUT_DIR = REPO_ROOT / "docs" / "generated_readmes"

# Ensure output directories exist
DOCS_DIR.mkdir(parents=True, exist_ok=True)
README_OUT_DIR.mkdir(parents=True, exist_ok=True)
WEB_CONTENT_DIR.mkdir(parents=True, exist_ok=True)

# GitHub owner
GITHUB_OWNER = "ReaperOAK"

# Tier definitions for ranking engineering signal
TIER_1_FLAGSHIPS = [
    "ForgeOS",
    "survivorship-free-backtester",
    "todayeggrates",
    "KCAdashboard",
    "CodebaseRAG",
    "vibecoding",
    "id-card-maker",
]

TIER_2_UTILITIES = [
    "player-auction",
    "auction-player-assigner",
    "bulk-certificate-generator",
    "csefarewell2k25",
    "chesscodex",
    "linearecta",
    "eventure",
    "festify",
    "TicketVault",
    "accounts",
    "p2p-rental-marketplace",
]

# Unlisted from archive (toy/tutorial apps to prevent diluting senior pitch)
UNLISTED_REPOS = [
    "simple-responsive-navigation-bar",
    "Simple-Nav-Bar",
    "react-weather-app",
    "WeatherApp",
    "vanillajs-weather-app",
    "openweatherAPI",
    "spotify-ui-clone",
    "Spotify-Clone",
    "simon-says-game",
    "Simon-Says",
    "university-python-scripts-sem-3",
    "sem3",
    "portfolio-website",
    "QuoraApp",
    "whatsapp",
    "airbnb",
]

# Repositories to skip entirely (third-party forks unless contributed to, test stubs, etc.)
SKIP_REPOS = [
    "App",
    "cheating-daddy",
    "openclaw",
    "Code_compiler",
    "ReaperOAK",  # This profile meta repo
    "portfolio",  # The portfolio repo itself
    "owaiskhan-website",
    "ai-home",
]

# Sensitive patterns to block from ever leaking into generated MDX or docs
SENSITIVE_PATTERNS = [
    r"(?i)api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9_\-]{16,}['\"]",
    r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{20,}",
    r"ghp_[a-zA-Z0-9]{36}",
    r"gho_[a-zA-Z0-9]{36}",
    r"AKIA[0-9A-Z]{16}",
    r"(?i)password\s*[:=]\s*['\"][^'\"]{6,}['\"]",
    r"postgres://[^\s]+",
    r"mongodb(\+srv)?://[^\s]+",
]
