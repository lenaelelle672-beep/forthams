# Design System Specification: Enterprise Asset Management

## 1. Overview & Creative North Star

**Creative North Star: The Structural Architect**
This design system moves beyond typical enterprise "density" by embracing an editorial, structured layout that prioritizes cognitive ease and technical reliability. It treats data not as a list, but as a series of architectural layers. By utilizing intentional asymmetry—such as side-by-side split configurations and staggered workflow nodes—the system guides the eye through complex asset lifecycles with surgical precision.

The goal is a "Premium Utility" aesthetic: an interface that feels as robust as the assets it manages, yet as light and fluid as a modern digital workspace.

---

## 2. Colors

The palette is anchored in high-chroma professional blues and teals, balanced by a sophisticated range of "cool neutrals" that provide depth without visual noise.

### Palette Strategy
- **Core Tones:** `primary` (#380cd3) and `secondary` (#0055c8) drive the primary actions.
- **Semantic Accents:** `tertiary` (#004c4c) and its containers are reserved for "Success" or "Active" asset states, while `error` (#ba1a1a) manages critical alerts.
- **Neutral Foundation:** `surface` (#f9f9ff) provides a crisp, cool white canvas that feels more modern than standard #FFFFFF.

### Guidelines
*   **The "No-Line" Rule:** Prohibit the use of 1px solid borders for sectioning content. Visual boundaries must be defined through background shifts. For example, use `surface-container-low` for a sidebar against a `surface` main content area.
*   **Surface Hierarchy & Nesting:** Use the `surface-container` tiers to create logical depth. 
    *   *Level 1:* Main Background (`surface`)
    *   *Level 2:* Workspace Areas (`surface-container-low`)
    *   *Level 3:* Interactive Cards (`surface-container-lowest` / pure white)
*   **The "Glass & Gradient" Rule:** For primary global CTAs, use a subtle vertical gradient from `primary` (#380cd3) to `primary_container` (#5139e9). For floating modals or overlays, apply a `surface` fill at 85% opacity with a 20px backdrop-blur to maintain context.

---

## 3. Typography

The system utilizes **Inter** for its neutral, high-legibility letterforms which reinforce a "Technical and Reliable" tone.

| Role | Token | Size | Weight | Intent |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-sm` | 2.25rem | Bold | Hero dashboard metrics |
| **Headline** | `headline-sm` | 1.5rem | Semi-Bold | Section titles & Page headers |
| **Title** | `title-md` | 1.125rem | Medium | Card titles & Modal headers |
| **Body** | `body-md` | 0.875rem | Regular | General metadata & Descriptions |
| **Label** | `label-md` | 0.75rem | Medium | Form labels & Micro-copy |

**Editorial Hierarchy:** Always pair a `headline-sm` title with a `body-sm` description in `on_surface_variant` (#474556) to create a clear, authoritative information stack.

---

## 4. Elevation & Depth

We reject traditional heavy drop-shadows in favor of **Tonal Layering**.

*   **The Layering Principle:** Depth is achieved by "stacking" surface tokens. A card using `surface-container-lowest` (#ffffff) sitting on a background of `surface-container-low` (#f1f3ff) creates a natural lift.
*   **Ambient Shadows:** For floating elements (e.g., "plus" buttons in workflows), use an extra-diffused shadow: `0 8px 32px rgba(17, 28, 46, 0.06)`. This uses a tinted version of `on_surface` for a natural, atmospheric feel.
*   **The "Ghost Border":** When structural definition is required for accessibility, use `outline-variant` (#c8c4d9) at 20% opacity. Never use 100% opaque borders for decorative containment.

---

## 5. Components

### Buttons & Actions
*   **Primary:** Filled with the `primary` token. Use `md` (0.75rem) roundedness. 
*   **Secondary/Cancel:** Ghost style. No fill, `outline-variant` border at 20% opacity.
*   **Workflow Nodes:** Large cards with a thick 4px left-border accent using semantic colors (e.g., `primary` for active, `tertiary` for complete).

### Input Fields
*   **Structure:** No-border background fills. Use `surface-container-high` for the input track.
*   **State:** On focus, transition background to `surface-container-lowest` and apply a 1px `primary` ghost border.

### Workflow & Nodes
*   **Connectors:** Use 1px `outline-variant` lines to connect cards.
*   **Add Action:** Floating circular buttons using `surface-container-lowest`, a `px` ghost border, and a `primary` color icon.

### Cards & Lists
*   **The Vertical Rule:** Forbid divider lines. Separate list items using `spacing.4` (1rem) of vertical white space or alternating `surface` and `surface-container-low` backgrounds.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical split-screen layouts for configuration (e.g., List on left, Detail on right).
*   **Do** utilize `spacing.8` (2rem) and `spacing.10` (2.5rem) to allow complex data to "breathe."
*   **Do** use minimalist line icons with a consistent stroke weight that matches the `label-md` font weight.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#111c2e) for maximum readability and a premium feel.
*   **Don't** use high-contrast boxes-within-boxes. Use the Tonal Layering approach to define nested areas.
*   **Don't** use sharp 90-degree corners. Everything from buttons to large panels must follow the `md` (0.75rem) or `lg` (1rem) roundedness scale.

---

## 7. Spacing Scale Reference

| Token | Value | Use Case |
| :--- | :--- | :--- |
| **2** | 0.5rem | Icon to Text spacing |
| **4** | 1rem | Internal card padding |
| **6** | 1.5rem | Component grouping |
| **10** | 2.5rem | Section spacing |