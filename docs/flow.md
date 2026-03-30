# Application Flow

This document details the step-by-step workflow for organizing inspection photos and applying captions using the "Card" system.

## 1. Data Ingestion
- **Import Photos**: The user selects a folder of JPEG/PNG images via the "Import Photos" button.
- **Add Photos**: The user can append more photos without clearing existing ones.
- **State Initialization**: Each image is converted into a photo object in `state.photos` with a unique ID and original path.

## 2. Organization (Sort Mode)
- **Grid Layout**: Photos are displayed in a large grid for rapid categorization.
- **Bucket Assignment**: Users drag photos into category "buckets" (Roofing, Exterior, Plumbing, etc.).
- **Group Creation**: Each bucket represents a potential group in the final filmstrip.

## 3. Card-based Grouping
- **Group Cards**: A "Group Card" is inserted at the beginning of a related set of photos. This card defines the primary subject (e.g., "Water Heater").
- **Code Cards**: A "Code Card" is placed at the end of the group.
    - **Label-only (`##000`)**: Closes the group. All photos in the group get the "Group Card" text as their caption.
    - **Defect-code (`##605`)**: Closes the group. All photos in the group get the specific defect text from the library (e.g., "TPR pipe not directed to floor").
- **Multiple Codes**: Combining codes (e.g., `##601##604`) joins the captions with " - ".

## 4. Processing & Application
- **Process Button**: Clicking "Process" runs the grouping logic.
- **Caption Generation**:
    1. Scan the filmstrip for a Group Card.
    2. Collect all subsequent photos until a Code Card is found.
    3. Look up the code in the `DEFAULT_PROBLEM_CODES` library.
    4. Apply the mapped caption to each photo in that group.
    5. Handle safety flags: If any code in the group is `safety: true`, the caption is prefixed with "Safety Issue - " and the font color is set to **Red**.

## 5. Review & Manual Edit
- **Canvas View**: Photos are viewed one by one on the main canvas.
- **Manual Overrides**: Users can manually rewrite captions, change colors, or draw arrows/boxes on the photo.
- **Save & Next**: Progressing through the filmstrip to ensure each photo is correctly captioned.

## 6. Export
- **Save All**: The application iterates through all captioned/edited photos and renders them to final image files in a user-selected output directory.

---

### Edge Cases & Assumptions
- **Missing Group Card**: Photos before the first Group Card are treated as standalone with no automated caption.
- **Missing Code Card**: A group is assumed to end if a new Group Card starts or the filmstrip ends.
- **Duplicate Codes**: Duplicate codes in a single Code Card are ignored/deduplicated.
- **Invalid Codes**: If a code is not in the library, it is treated as a literal label.
