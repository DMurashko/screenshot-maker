# Screenshot Maker

Professional screenshot tool for macOS with editing capabilities.

## Features

- 📸 **Screenshot capture** - Global hotkey (Ctrl+Alt+S) for instant screenshots
- 🎨 **Image editing** - Draw, annotate, add shapes and text
- 📋 **Clipboard integration** - One-click copy to clipboard
- 🔔 **System tray** - Menu bar app for quick access
- 🎯 **Preview window** - Floating preview of captured screenshots

## System Requirements

- macOS 11.0 or later
- 50 MB free disk space

## Installation

1. Download the latest DMG from [Releases](https://github.com/yourusername/screenshot-maker/releases)
2. Mount the DMG and drag Screenshot Maker to Applications
3. Grant accessibility permissions when prompted (System Preferences → Security & Privacy → Accessibility)

## Usage

- **Capture**: Press `Ctrl+Alt+S` to take a screenshot
- **Edit**: Use annotation tools in the editor window
- **Copy**: Click the clipboard button to copy to clipboard
- **Menu**: Click tray icon for menu options

## Development

### Prerequisites

- macOS 11+
- Xcode Command Line Tools: `xcode-select --install`
- Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Node.js 18+: `brew install node`
- pnpm: `npm install -g pnpm`

### Setup

```bash
pnpm install
pnpm run dev
```

### Build Production App

```bash
./build-macos-production.sh
```

Build output:
- DMG: `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Screenshot Maker_1.0.0_aarch64.dmg`
- App: `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Screenshot Maker.app`

### Build for Intel Macs

```bash
rustup target add x86_64-apple-darwin
pnpm run build:macos-x64
```

### Build Universal Binary (Intel + Apple Silicon)

```bash
rustup target add x86_64-apple-darwin
pnpm run build:macos
```

## Code Signing (Optional, for Distribution)

For official distribution, sign the app:

```bash
# 1. Get Developer ID from Apple Developer Program
security find-identity -v -p codesigning

# 2. Update src-tauri/tauri.conf.json:
# "signingIdentity": "Developer ID Application: Your Name (ID)"

# 3. Build (will auto-sign)
pnpm run build:macos-arm64
```

## Project Structure

```
screenshot-maker/
├── src/                    # React frontend (TypeScript)
│   ├── components/
│   │   ├── Editor.tsx     # Screenshot editor
│   │   └── Preview.tsx    # Preview window
│   └── App.tsx
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/lib.rs         # Commands and events
│   └── Cargo.toml
├── build-macos-production.sh  # Build script
└── preflight-check.sh         # Validation script
```

## Scripts

- `pnpm run dev` - Start development mode
- `pnpm run build` - Build frontend
- `pnpm run build:macos-arm64` - Build for Apple Silicon
- `pnpm run build:macos-x64` - Build for Intel
- `pnpm run build:macos` - Build universal binary
- `./preflight-check.sh` - Validate system and project
- `./build-macos-production.sh` - One-command production build

## Troubleshooting

### Shortcut doesn't work
- Grant accessibility permissions: System Preferences → Security & Privacy → Accessibility
- Add app to the list and restart the app

### Build fails
```bash
cargo clean
rm -rf src-tauri/target dist
pnpm install
./build-macos-production.sh
```

### Tray icon not showing
- Ensure `src-tauri/icons/32x32.png` exists
- Restart the app

## Performance

- Launch time: <500ms
- Memory usage: 50-80 MB
- App size: ~25 MB
- Screenshot capture: <100ms

## License

MIT

## Built With

- [Tauri](https://tauri.app/) - Desktop framework
- [React](https://react.dev/) - UI framework
- [Konva.js](https://konvajs.org/) - Canvas drawing
- [Vite](https://vitejs.dev/) - Build tool
- [Rust](https://www.rust-lang.org/) - Backend
