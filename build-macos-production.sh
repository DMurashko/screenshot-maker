#!/bin/bash

# macOS Production Build Script
# This script builds a production-ready macOS app

set -e

echo "🚀 Starting production build for macOS..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "${BLUE}Checking prerequisites...${NC}"

if ! command -v rustc &> /dev/null; then
    echo "${YELLOW}Rust not found. Installing...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

if ! command -v pnpm &> /dev/null; then
    echo "${YELLOW}pnpm not found. Installing...${NC}"
    npm install -g pnpm
fi

echo "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Install dependencies
echo "${BLUE}Installing dependencies...${NC}"
pnpm install
echo "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Build frontend
echo "${BLUE}Building frontend...${NC}"
pnpm run build
echo "${GREEN}✓ Frontend built${NC}"
echo ""

# Build Rust backend
echo "${BLUE}Building Rust backend (release mode)...${NC}"
cd src-tauri
cargo build --release --target x86_64-apple-darwin
if [[ $(uname -m) == 'arm64' ]]; then
    cargo build --release --target aarch64-apple-darwin
fi
cd ..
echo "${GREEN}✓ Rust backend built${NC}"
echo ""

# Create app bundle
echo "${BLUE}Creating macOS app bundle...${NC}"
pnpm run tauri build
echo "${GREEN}✓ App bundle created${NC}"
echo ""

# List output files
echo "${BLUE}Build artifacts:${NC}"
ls -lh src-tauri/target/release/bundle/dmg/ 2>/dev/null || true
ls -lh src-tauri/target/release/bundle/macos/Screenshot\ Maker.app 2>/dev/null || true
echo ""

echo "${GREEN}✅ Production build complete!${NC}"
echo ""
echo "Output locations:"
echo "  DMG: src-tauri/target/release/bundle/dmg/"
echo "  APP: src-tauri/target/release/bundle/macos/Screenshot Maker.app"
echo ""
echo "Next steps:"
echo "1. Test the app: open src-tauri/target/release/bundle/macos/Screenshot\ Maker.app"
echo "2. For distribution, sign and notarize the DMG"
echo ""

