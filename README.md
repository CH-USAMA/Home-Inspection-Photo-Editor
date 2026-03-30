# Home Inspection Photo Editor

A modular, high-performance Tauri desktop application designed for rapid home inspection photo annotation and automated captioning.

## 🚀 About the Project
This tool converts a series of inspection photos into an organized set of annotated "defect" reports using a systematic **Card-to-Caption Engine**. It balances local, rule-based logic with optional AI-assisted analysis to minimize costs and maximize consistency.

## 📂 Project Structure
The project is organized into a modular architecture for high token efficiency:
```text
/ Jeff Laravel
├── assets/
│   ├── css/ style.css       (Modern Responsive Design)
│   └── js/  app.js, codes.js (Core Logic & Defect Library)
├── docs/                     (Developer & AI Documentation)
│   ├── ai-index.md           (AI Coding Standards)
│   ├── business-logic.md     (Card Engine Rules)
│   ├── flow.md               (User Workflow)
│   └── prompt-guide.md       (Token Efficiency Guide)
├── index.html                (Main Entry Point)
└── setup.md                  (Build & API Instructions)
```

## 🛠 Quick Start
1.  **Dependencies**: Install Node.js, Rust, and Tauri.
2.  **API Key**: Insert your Anthropic API Key in `assets/js/app.js` at Line 5.
3.  **Build**: Run `npx tauri build` from the root directory.
4.  **Develop**: Run `npm run tauri dev` for live-reloading.

## ✅ DOs
- **Keep Cards Grouped**: Ensure every group of photos starts with a "Group" card and ends with a "Code" card for the best automated result.
- **Use the Prompt Guide**: When asking an AI assistant for changes, refer to `docs/prompt-guide.md` to save 80% on token costs.
- **Backup codes.js**: Regularly backup your `assets/js/codes.js` if you add many custom defect codes.
- **Update the Changelog**: Record all major logic changes in `docs/changes.md`.

## ❌ DON'Ts
- **X Don't Commit API Keys**: Never push your actual Anthropic API key to a public repository.
- **X Don't Edit index.html Directly**: Avoid adding logic or styles back into the entry file. Keep it modular in `assets/`.
- **X Don't Bypass the Card Engine**: Avoid manually typing captions if a code exists—the card system ensures consistency across reports.

## 🧠 Core Features
- **System-First Engine**: Offline-ready captioning based on pre-defined defect codes.
- **Red Summary**: Automatic isolation of safety issues for quick review.
- **Sort Mode**: Drag-and-drop categorization of huge photo batches before processing.
- **AI Fallback**: Modular AI analysis for complex "sticker" reading and edge-case review.

---
> [!NOTE]
> This project is designed for AI-assisted development. For instructions on how to use AI most efficiently with this codebase, see **[docs/prompt-guide.md](file:///d:/Jeff%20Laravel/docs/prompt-guide.md)**.
