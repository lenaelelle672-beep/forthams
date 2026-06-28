Repair the existing DESIGN screen to better match the uploaded IMAGE reference `审批规则方案4 IMAGE2 reference 2026-06-26`.

Preserve passing gates:
- Required Chinese text is complete.
- The 1823 x 863 viewport has no scroll.
- The page has the correct topbar/sidebar/main/hero/success/cards structure.

Fix only these visible mismatches:
1. Topbar brand and tabs are too small and too low. Make `UNIVIEW` much larger and closer to the reference at x about 46, y about 56. Move the top tab row up so active `流程平台` sits around x=630, y=42, with larger text and a taller active pill.
2. The cyan/dotted connector is too small. Make the hanging notched connector larger, about 52 px wide and 72 px tall, positioned around x=504 and y=105, with stronger cyan edge glow and clearly visible 3x3 dots.
3. Sidebar nav starts too high and too small. Keep sidebar width 532, but push the divider/menu down to match the reference: sidebar title at about x=46 y=216, divider near y=345, first active item near y=388. Increase item text/icon size slightly.
4. Main hero card is too high, too far left, and too short. Move it to x about 591, y about 208. Increase card height to about 377. Increase title and button sizes to match the reference.
5. Success banner should start around x=591, y=628, height about 94, not y=459. Move the lower cards down so only their top portions are visible near the bottom, matching the source.

Do not rename text, do not add extra data, do not introduce scroll, and keep output as a persistent exportable DESIGN/HTML screen.
