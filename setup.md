# Project Setup & Build Instructions

This document provides the necessary steps to configure and build the Home Inspection Photo Editor.

## 1. Environment Configuration

### Anthropic API Key
The application uses Claude (Anthropic) for AI-assisted photo analysis.
- **File**: `app.js` (previously `index.html`)
- **Variable**: `ANTHROPIC_API_KEY`
- **Action**: Replace `'YOUR_API_KEY_HERE'` with your actual API key.

> [!CAUTION]
> Never commit your actual API key to a public repository. Use environment variables if moving to a more robust backend in the future.

## 2. Build Process (Tauri)

The application is built using the **Tauri** framework.

### Prerequisites
- Node.js & npm
- Rust & Cargo (required for Tauri core)

### Build Commands
Run the following commands from the project root (e.g., `d:\Jeff Laravel`):

```powershell
# Install dependencies (if any new ones are added)
npm install

# Build the production application
npx tauri build
```

### Installation
After a successful build, the installer (MSI/EXE) will be located in:
`src-tauri/target/release/bundle/msi/`

1. Uninstall any previous version of the Home Inspection App.
2. Run the new installer to deploy your changes.

## 3. Development Workflow
- **Live Preview**: For rapid UI testing, you can open `index.html` directly in a browser, though Tauri-specific features (File System access) will be disabled.
- **Tauri Dev**: Run `npm run tauri dev` to start the application with live-reloading and full API access.
