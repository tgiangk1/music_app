# ==============================================================================
# Render Build Script — Antigravity Jukebox API
# ==============================================================================
# This script runs during Render's build phase.
# It handles monorepo-specific setup:
#   1. Install root dependencies (needed for npm workspaces)
#   2. Install API-specific native modules (better-sqlite3)
# ==============================================================================

#!/usr/bin/env bash
set -o errexit  # exit on error

echo "==> Installing dependencies..."
npm install

echo "==> Build complete!"
