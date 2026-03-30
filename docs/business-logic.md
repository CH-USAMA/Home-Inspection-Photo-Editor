# Business Logic - Home Inspection Photo Editor

This document explains the core engine of the "Card-to-Caption" system and its associated logic.

## 1. The "Card" Abstraction

A "Card" is a non-photo item in the filmstrip that acts as a logical marker.

### A. Group Card (`cardMode: 'group'`)
- **Purpose**: Defines the beginning of a group and its base subject.
- **Data**: A text label (e.g., "Roofing", "Garage").
- **Impact**: Sets the "context" for all photos that follow.

### B. Code Card (`cardMode: 'code'`)
- **Purpose**: Defines the end of a group and the specific defect/finding to be applied to all photos in that group.
- **Logic**:
    - `##000`: Special code that signifies "No Defect". The photos will only receive the "Group Card" text as their caption.
    - `##[Number]`: A code (e.g., `##405`) that is looked up in the `DEFAULT_PROBLEM_CODES` library.
    - `##[Number]##[Number]`: Multiple codes are concatenated with a " - " separator.

## 2. Automated Captioning Engine

When the user clicks "Process", the engine performs the following:

1. **Iterability**: Iterate through `state.filmItems`.
2. **Buffering**: Collect all `photoIndex` values found after a Group Card.
3. **Trigger**: When a Code Card is encountered, stop buffering and apply the following to every photo in the buffer:
    - **Base Caption**: The library's `caption` string for the code(s) on the Code Card.
    - **Safety Decorator**: If any code in the group is marked `safety: true`:
        - Prefix the caption with: `Safety Issue - `.
        - Set the font color to **Red**.
    - **Default Decorator**: If no safety codes are found, the font color is **Black**.
4. **Resets**: Clear the photo buffer and wait for the next Group Card.

## 3. Library Management (`DEFAULT_PROBLEM_CODES`)

- **Short**: A brief description for display in the UI's code library.
- **Caption**: The full, professional text injected onto the rendered image.
- **Safety**: A boolean indicating if the issue is a safety hazard.

## 4. Render Hierarchy (Canvas Layers)

- **Layer 1 (Main)**: The original inspection photo (scaled to fit).
- **Layer 2 (Overlay)**: Permanent UI elements like text captions (Yellow background, Black/Red text).
- **Layer 3 (Interact)**: Temporary UI elements like selection boxes, drag handles, and user-drawn shapes (Arrows/Boxes).

## 5. Persistence Rules

- **Auto-Save**: The application uses `localStorage` for UI preferences (like font size) but does not auto-save photo edits.
- **Manual Export**: The user must explicitly "Save All" to commit all captions and drawings to disk as new image files.
