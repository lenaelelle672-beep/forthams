# Design System Specification: The Fluid Architect

## 1. Overview & Creative North Star
Asset management and workflow configuration often suffer from "Grid Fatigue"—a rigid, claustrophobic density that makes complex decision-making feel like a chore. This design system breaks that mold. 

**Creative North Star: The Digital Curator.**
This system treats workflow nodes and asset data not as rows in a database, but as curated elements in an expansive, high-end gallery. We replace the traditional "boxed-in" enterprise feel with **intentional asymmetry and tonal depth**. By leveraging a light, airy palette and prioritized breathing room (using our extended spacing scale), we guide the user’s eye through complex logic with ease. The visual language is authoritative yet ethereal, ensuring that even the most complex configuration feels light and manageable.

---

## 2. Colors
Our palette is rooted in a professional "Atmospheric Blue" foundation, accented by "Clinical Greens" for process integrity.

### The "No-Line" Rule
**Traditional 1px solid borders are strictly prohibited for sectioning.** To define high-level boundaries, use background color shifts. A `surface-container-low` (#eff4ff) section should sit on a `surface` (#f8f9ff) background. This creates a sophisticated, "editorial" look where the structure is felt rather than seen.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical, stacked layers.
- **Level 0 (Base):** `surface` (#f8f9ff)
- **Level 1 (Sections/Sidebars):** `surface-container-low` (#eff4ff)
- **Level 2 (Cards/Nodes):** `surface-container-lowest` (#ffffff)
- **Level 3 (Floating Overlays):** `surface-bright` (#f8f9ff)

### The Glass & Gradient Rule
To move beyond a "generic" SaaS look:
- **Glassmorphism:** For floating menus or contextual tooltips, use `surface` with 80% opacity and a 12px backdrop-blur. 
- **Signature Gradients:** Main Action CTAs should use a subtle linear gradient from `primary` (#4338da) to `primary_container` (#5d55f3). This provides a "jewel-like" depth that flat colors lack.

---

## 3. Typography
We utilize a dual-typeface system to balance high-end editorial aesthetics with functional precision.

*   **Display & Headlines (Manrope):** Chosen for its geometric modernism. Large-scale titles (`display-lg` to `headline-sm`) use tighter letter-spacing to feel like a premium publication.
*   **Body & Labels (Inter):** The workhorse for configuration. Inter provides maximum legibility at small sizes (`label-sm` at 0.6875rem) for complex node attributes.

**Editorial Hierarchy:** Always maintain a high contrast between headings and body text. A `headline-md` title should be paired with generous whitespace (Spacing 12+) before the `body-md` content begins, creating a clear "entry point" for the user's eye.

---

## 4. Elevation & Depth
In this system, depth is a function of light and shadow, not lines.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) node onto a `surface-container-low` (#eff4ff) canvas. The delta in luminance creates a natural "lift" without a single pixel of shadow.
*   **Ambient Shadows:** For interactive nodes (like a selected workflow step), use a "Soft-Focus" shadow: 
    *   *Color:* `on_surface` (#0b1c30) at 6% opacity.
    *   *Blur:* 24px.
    *   *Spread:* -4px.
*   **The Ghost Border:** If a boundary is required for accessibility (e.g., in a high-density table), use `outline_variant` (#c3c6d7) at **15% opacity**. It should be a suggestion of a border, not a fence.

---

## 5. Components

### Workflow Nodes (Cards)
- **Styling:** `surface-container-lowest` background, `xl` (0.75rem) roundedness.
- **Accent:** Use a 4px vertical "Indicator Bar" on the left edge using `secondary` (#006a61) for completed states or `primary` (#4338da) for active states.
- **Content:** Forbid dividers. Use `Spacing 4` (0.9rem) to separate the title from the metadata.

### Buttons
- **Primary:** Gradient (`primary` to `primary_container`), `on_primary` text, `md` roundedness. 
- **Tertiary:** No background or border. Use `primary` text with an underline that appears only on hover to maintain a clean "editorial" feel.

### Input Fields
- **Background:** `surface_container_high` (#dce9ff).
- **Border:** None (Ghost Border on focus only).
- **Label:** `label-md` in `on_surface_variant` (#434655).

### Chips (Status Indicators)
- **Success:** `secondary_container` (#86f2e4) background with `on_secondary_container` (#006f66) text.
- **Action:** `tertiary_fixed` (#cce5ff) with `on_tertiary_fixed` (#001d31) text.
- **Shape:** `full` (9999px) roundedness for a friendly, modern feel.

---

## 6. Do's and Don'ts

### Do
- **DO** use white space as a structural element. If in doubt, increase the spacing between sections by one step on the scale (e.g., from `10` to `12`).
- **DO** use the `secondary` (#006a61) green for "System Health" or "Process Complete" to provide a calming, professional reassurance.
- **DO** use `surface_dim` (#cbdbf5) for inactive or background canvas areas to make the active configuration nodes "pop."

### Don't
- **DON'T** use 1px solid black or dark grey borders. They "shatter" the fluid glass aesthetic.
- **DON'T** use standard drop shadows. Always use tinted, diffused ambient shadows.
- **DON'T** crowd the configuration panel. If a workflow node has more than 5 attributes, use a "Drawer" pattern using `surface_container_lowest` with a `backdrop-blur`.
- **DON'T** use pure black (#000000) for text. Always use `on_surface` (#0b1c30) for a softer, premium contrast.