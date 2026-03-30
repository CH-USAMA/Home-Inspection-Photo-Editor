# Prompting Guide for Token Efficiency

Since we have modularized the Home Inspection Photo Editor, you can now get faster, cheaper, and more accurate results by following these prompting strategies.

## 1. Target Specific Modules
Avoid broad requests like "Update the app." Instead, tell the AI exactly which file to look at.
*   **UI/Design Changes**: "Modify `assets/css/style.css` to [Your Request]."
*   **Core Logic/Bugs**: "Look at `assets/js/app.js` to fix [Bug Description]."
*   **Defect Codes**: "Update `assets/js/codes.js` to add a new category for [Category Name]."

## 2. Leverge Documentation
Always point the AI to the `docs/` folder first. This allows the AI to understand the *intent* without reading every line of code.
*   **Example**: "Read `docs/business-logic.md` to understand the card system, then implement [New Rule] in `assets/js/app.js`."

## 3. Use the AI Governance File
Remind the AI of its "Instructions" to ensure it doesn't break your existing setup.
*   **Example**: "Check `docs/ai-index.md` for our coding standards before making any changes."

## 4. The "Zero-Token" Approach
If you just want an explanation or a plan, tell the AI **not** to read the files yet.
*   **Example**: "Based on your memory and `docs/flow.md`, how would we add a 'Review' flag? Create a plan first, don't read the JS files yet."

## 5. Incremental Progress
Small, specific tasks are 10X more efficient than large, multi-file overhauls. 
*   **Bad**: "Make the whole app look modern."
*   **Good**: "Update the 'Save & Next' button in `assets/css/style.css` to be larger and more vibrant."

---
> [!TIP]
> By keeping your requests focused on specific files in the `assets/` folder, you reduce the AI's "context window" usage by up to **80%**, saving you credits and getting faster responses.
