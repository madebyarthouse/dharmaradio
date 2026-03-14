#!/bin/bash
# Script to clean .env from git history using git-filter-repo

set -e

echo "🧹 Cleaning .env from Git history..."
echo ""

# Check if git-filter-repo is installed
if ! command -v git-filter-repo &> /dev/null; then
    echo "📦 Installing git-filter-repo..."
    brew install git-filter-repo
fi

# Create backup branch
echo "💾 Creating backup branch..."
git branch backup-before-filter 2>/dev/null || echo "Backup branch already exists"

# Remove .env from history
echo "🗑️  Removing .env from all commits..."
git filter-repo --invert-paths --path .env --force

echo ""
echo "✅ Done! .env has been removed from Git history."
echo ""
echo "📤 Next steps:"
echo "   1. Force push to GitHub:"
echo "      git push origin --force --all"
echo ""
echo "   2. Verify .env is gone:"
echo "      git log --all --full-history -- .env"
echo ""
echo "   3. Update .gitignore if needed:"
echo "      echo '.env' >> .gitignore"
echo "      git add .gitignore"
echo "      git commit -m 'Add .env to gitignore'"



