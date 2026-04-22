# Matrix Ecosystem - Unified Task Log

## 🔴 High Priority & Critical Fixes
- [ ] **Typography Hierarchy Fix**: Ensure Title is ALWAYS significantly larger than Subtext across all slides. Test visibility from "10m distance" perspective.
- [ ] **Visual Consistency Audit**: Sync sizes, font-weights, and layout patterns between `ct-matrix` and all sub-modules (`ct-ace`, `ct-mom`, etc.).
- [ ] **Flame Lantern Logo Integration**: Replace the "Booting System" placeholder with the Flame Lantern logo slide during initialization and idle states.
- [ ] **Master Admin Navigation**: Restore missing modules (`ct-ace`, `ct-wea`, `ct-fir`, etc.) to the nav bar.
- [ ] **CSV System Overhaul**: 
    - [ ] Add explicit headers to `local-backup.csv`.
    - [ ] Add dedicated `QR_CODE` column (remove "bubble text" hack).
    - [ ] Update `CSV_GUIDE.md` to match the new structure.
    - [ ] Fix broken Google Sheet links in admin pages.
- [ ] **GitHub Pages & Sync**:
    - [ ] Fix looping issues on GitHub Pages deployment.
    - [ ] Ensure `Sync-Github.ps1` runs automatically after edits.
    - [ ] Verify each sub-project works standalone on GH Pages.

## 🟡 Visual & UI Refinement
- [ ] **Glow Effects**: Implement varied highlight/glow colors based on the day of the week or event type.
- [ ] **Progress Bar Visibility**: Standardize progress bar thickness and positioning for visibility across different TV sizes.
- [ ] **Full-Screen Filling**: Ensure slides utilize 100% of the viewport without clipping or unnecessary abbreviations.

## 🟢 Documentation & Maintenance
- [ ] **Auto-Documentation**: Update `README.md` and internal docs whenever architectural changes are made.
- [ ] **Persistent Tracking**: Maintain this `TASK_LOG.md` without recreating it; use strikethroughs for completed items.

---
*Last Updated: 2026-04-23 05:35*
