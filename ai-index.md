# AI Index - Control File

This file defines the strict rules and standards for AI models interacting with this repository.

## 1. Coding Standards
- **Vanilla JavaScript ONLY**: Do not introduce any JS libraries (React, Vue, jQuery, etc.) unless explicitly instructed by the user.
- **Tauri Integration**: Be mindful of the `window.__TAURI__` global and its associated APIs for file management. Always check for their availability and handle errors gracefully.
- **State Management**: Keep all application data inside the `state` object. Do not create global variables outside of the `state` object or constants (like `DEFAULT_PROBLEM_CODES`).
- **Canvas Hierarchy**: Always respect the 3-layer canvas system (`main`, `overlay`, `interact`). Modification of one layer must not inadvertently clear or overwrite another.

## 2. Update Rules
- **Non-Destructive Edits**: When modifying `index.html`, do not delete existing large blocks of CSS or constants like `DEFAULT_PROBLEM_CODES` unless specifically asked.
- **Documentation Sync**: Any change to the core grouping or captioning logic **MUST** be reflected in `flow.md` and `business-logic.md`.
- **Changelog**: Every single code change must be appended to `changes.md` with the date and impact analysis.

## 3. Constraints
- **Preserve Logic**: The "Card" system (Group Card -> Photos -> Code Card) is the heart of this application. Any refactoring must maintain this logic and its associated edge-case handling.
- **UI Aesthetics**: The application uses a yellow-and-black theme for captions. Do not change this without user consent.
- **Undo Integrity**: Any new user action that modifies the photos or cards should be pushed to `state.undoStack`.

## 4. Documentation Requirements
- AI must always read the latest versions of these 5 documentation files (`skills.md`, `flow.md`, `ai-index.md`, `changes.md`, `business-logic.md`) before proposing any significant code changes.
