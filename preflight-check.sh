#!/bin/bash

# Pre-flight Production Build Checklist
# Run this script before building for production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${BLUE}Screenshot Maker - Production Build Pre-flight Checklist${NC}"
echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Keep track of checks
passed=0
failed=0
warnings=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((passed++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((failed++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((warnings++))
}

# 1. System Requirements
echo "${BLUE}1. System Requirements${NC}"
if [[ $(uname) == "Darwin" ]]; then
    check_pass "macOS detected"

    # Check macOS version
    MACOS_VERSION=$(sw_vers -productVersion | cut -d. -f1,2)
    if (( $(echo "$MACOS_VERSION >= 11.0" | bc -l) )); then
        check_pass "macOS version ${MACOS_VERSION} is compatible (11.0+)"
    else
        check_fail "macOS version ${MACOS_VERSION} is too old (need 11.0+)"
    fi
else
    check_fail "Not running on macOS"
fi
echo ""

# 2. Xcode Tools
echo "${BLUE}2. Development Tools${NC}"
if command -v xcode-select &> /dev/null; then
    check_pass "Xcode Command Line Tools installed"
else
    check_fail "Xcode Command Line Tools not found - install with: xcode-select --install"
fi

if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    check_pass "Rust installed ($RUST_VERSION)"
else
    check_fail "Rust not found - install from: https://www.rust-lang.org/tools/install"
fi

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_pass "Node.js installed ($NODE_VERSION)"
else
    check_fail "Node.js not found - install with: brew install node"
fi

if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    check_pass "pnpm installed (v$PNPM_VERSION)"
else
    check_fail "pnpm not found - install with: npm install -g pnpm"
fi
echo ""

# 3. Project Structure
echo "${BLUE}3. Project Structure${NC}"
if [[ -f "package.json" ]]; then
    check_pass "package.json found"
else
    check_fail "package.json not found"
fi

if [[ -f "src-tauri/Cargo.toml" ]]; then
    check_pass "Cargo.toml found"
else
    check_fail "Cargo.toml not found"
fi

if [[ -f "src-tauri/tauri.conf.json" ]]; then
    check_pass "tauri.conf.json found"
else
    check_fail "tauri.conf.json not found"
fi

if [[ -d "src-tauri/icons" ]]; then
    if [[ -f "src-tauri/icons/32x32.png" ]]; then
        check_pass "Tray icon exists (32x32.png)"
    else
        check_warn "Missing 32x32.png (tray icon)"
    fi

    if [[ -f "src-tauri/icons/icon.icns" ]]; then
        check_pass "macOS app icon exists (icon.icns)"
    else
        check_warn "Missing icon.icns (macOS icon)"
    fi
else
    check_fail "Icons directory not found"
fi
echo ""

# 4. Configuration Validation
echo "${BLUE}4. Configuration Validation${NC}"

# Check package.json syntax
if python3 -m json.tool package.json > /dev/null 2>&1; then
    check_pass "package.json is valid JSON"
else
    check_fail "package.json has invalid JSON"
fi

# Check tauri.conf.json syntax
if python3 -m json.tool src-tauri/tauri.conf.json > /dev/null 2>&1; then
    check_pass "tauri.conf.json is valid JSON"
else
    check_fail "tauri.conf.json has invalid JSON"
fi

# Check versions match
PKG_VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4)
CARGO_VERSION=$(grep '^version' src-tauri/Cargo.toml | cut -d'"' -f2)
CONF_VERSION=$(grep '"version"' src-tauri/tauri.conf.json | cut -d'"' -f4)

if [[ "$PKG_VERSION" == "$CARGO_VERSION" ]] && [[ "$CARGO_VERSION" == "$CONF_VERSION" ]]; then
    check_pass "Version numbers match: $PKG_VERSION"
else
    check_fail "Version mismatch - package: $PKG_VERSION, cargo: $CARGO_VERSION, conf: $CONF_VERSION"
fi
echo ""

# 5. Code Quality
echo "${BLUE}5. Code Quality${NC}"

# Check for compilation errors
if cd src-tauri && cargo check --lib 2>/dev/null; then
    check_pass "Rust code compiles without errors"
    cd ..
else
    check_fail "Rust code has compilation errors"
    cd ..
fi

# Check TypeScript
if command -v tsc &> /dev/null; then
    if tsc --noEmit 2>/dev/null; then
        check_pass "TypeScript compiles without errors"
    else
        check_warn "TypeScript has type errors (may not prevent build)"
    fi
fi
echo ""

# 6. Dependencies
echo "${BLUE}6. Dependencies${NC}"

if [[ -d "node_modules" ]]; then
    check_pass "npm dependencies installed"
else
    check_warn "npm dependencies not installed - run: pnpm install"
fi

if [[ -d "src-tauri/target" ]]; then
    check_pass "Rust dependencies cached"
else
    check_warn "Rust dependencies not cached - first build will take longer"
fi
echo ""

# 7. Git Status
echo "${BLUE}7. Version Control${NC}"

if [[ -d ".git" ]]; then
    if git rev-parse --git-dir > /dev/null 2>&1; then
        check_pass "Git repository found"

        # Check for uncommitted changes
        if [[ -z $(git status -s) ]]; then
            check_pass "No uncommitted changes"
        else
            check_warn "Uncommitted changes detected - commit before release"
            git status -s | head -5
        fi
    fi
else
    check_warn "Not a git repository"
fi
echo ""

# 8. Production Files
echo "${BLUE}8. Production Files${NC}"

if [[ -f "PRODUCTION_BUILD.md" ]]; then
    check_pass "Production build guide exists"
else
    check_warn "PRODUCTION_BUILD.md not found"
fi

if [[ -f "DEPLOYMENT.md" ]]; then
    check_pass "Deployment guide exists"
else
    check_warn "DEPLOYMENT.md not found"
fi

if [[ -f "PRODUCTION_README.md" ]]; then
    check_pass "Production README exists"
else
    check_warn "PRODUCTION_README.md not found"
fi

if [[ -f "build-macos-production.sh" ]]; then
    check_pass "Build script exists"
else
    check_warn "build-macos-production.sh not found"
fi
echo ""

# 9. Security
echo "${BLUE}9. Security${NC}"

if grep -q "signingIdentity" src-tauri/tauri.conf.json; then
    check_pass "Code signing configured"
else
    check_warn "Code signing not configured (needed for distribution)"
fi

if [[ ! -f ".env" ]]; then
    check_pass "No .env file committed (good)"
else
    check_warn ".env file exists - ensure it's in .gitignore"
fi

if grep -q ".env" .gitignore 2>/dev/null; then
    check_pass ".env is in .gitignore"
else
    check_warn "Add .env to .gitignore for security"
fi
echo ""

# Summary
echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${BLUE}Summary${NC}"
echo "${GREEN}Passed:${NC}   $passed"
echo "${YELLOW}Warnings:${NC} $warnings"
echo "${RED}Failed:${NC}   $failed"
echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [[ $failed -eq 0 ]]; then
    echo "${GREEN}✅ All checks passed! Ready to build for production.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. ./build-macos-production.sh"
    echo "  2. Test the app: open src-tauri/target/release/bundle/macos/Screenshot\\ Maker.app"
    echo "  3. If satisfied, sign and notarize for distribution"
    echo ""
    exit 0
else
    echo "${RED}❌ Fix the failures above before building for production.${NC}"
    echo ""
    exit 1
fi

