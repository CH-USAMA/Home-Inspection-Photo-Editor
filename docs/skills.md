# Technical & Logical Skills

This project requires a blend of frontend development, complex state management, and specialized logic for photo processing.

## 1. Frontend Development
- **Vanilla HTML5/CSS3**: Deep understanding of semantic HTML and custom CSS styling (variables, flexbox, grid, and specific styling for dark modes).
- **Vanilla JavaScript (ES6+)**: proficiency in modern JS without external frameworks (React/Vue/etc.).
- **Canvas API**: Intensive use of multiple overlapping canvases (`main`, `overlay`, `interact`) for photo rendering, caption overlays, and manual drawing/annotations.
- **UI/UX Design**: Responsive layouts for toolbars, side panels, and "filmstrip" navigation.

## 2. Technical Integration
- **Tauri Framework**: Interaction with the desktop OS via the Tauri API for file system access (`readFile`, `writeFile`, `mkdir`), dialogs, and path manipulation.
- **Asynchronous Programming**: Handling file I/O and potential AI API calls (Claude/Anthropic) without blocking the UI.

## 3. Logic & State Handling
- **Centralized State Management**: Maintaining a complex `state` object that tracks photos, UI modes (Sort vs. Edit), selection sets, and undo/redo stacks.
- **Grouping Algorithms**: Logical partitioning of photo arrays based on "Card" delimiters.
- **Pattern Matching**: Parsing user input (e.g., `##605`, `##000`) and mapping them to a data library.
- **Undo/Redo System**: Implementation of a stack-based history for user actions.

## 4. Image Processing & Business Logic
- **Coordinate Mapping**: Translating mouse coordinates on an interactive canvas to image-space coordinates for drawing.
- **Caption Rendering**: Dynamic background/font color application on images, font scaling, and multi-line text wrapping on canvas.
- **Data-Driven Logic**: Managing a "Problem Code Reference" library that drives the automated captioning engine.
