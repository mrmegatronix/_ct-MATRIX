# Unfinished Tasks Log - Matrix Ecosystem

This log tracks remaining actions and open issues following the modernization sweep.

## High Priority: Local & Git Stability

### 1. ct-FIR GitHub Pages Setup

- **Status**: [IN PROGRESS] Workflow verified. Waiting for repository creation on GitHub.
- **Blocker**: Repository `mrmegatronix/_ct-FIR` does not exist on GitHub.
- **Action**: Run `git push --set-upstream origin main` once repo is created.

### 2. ace-chase -> ct-ACE Finalization

- **Status**: [COMPLETED] Workspace paths updated. Remote set to `_ct-ACE.git` to avoid conflicts with legacy repo.
- **Action**: Pushing to new endpoint `_ct-ACE.git`.

### 3. Git Upstream Tracking

- **Status**: `_ct-FIR` has no upstream branch.
- **Action**: Run `git push --set-upstream origin main` once the repo exists.

## Feature Verification

### 4. Shift+Enter Multi-line Rendering

- **Status**: Implemented in `_ct-MATRIX`, `_ct-MMR`, `_ct-MOM`, and `_ct-ACE`.
- **Action**: Verify with real data in the browser (especially `_ct-MMR` as its rendering template was updated last).

### 5. Matrix Slideshow Length

- **Status**: Calculation pending.
- **Blocker**: `local-backup.csv` currently contains placeholder data (`TEST`, `ABC,123`).
- **Action**: Verify the cloud CSV content or check if `matrix-data.json` is the intended source.

## Infrastructure

### 6. Backup Automation

- **Status**: `sync_backups.ps1` created and executed.
- **Action**: Verify all `local-backup.csv` files actually contain the expected cloud data (some reported 404s in earlier attempts).

---

masteradmin.html:

add option to disable, edit, delete slides in line up, also reposition in lineup.
slides should be classified via a priority number system.
intergrate code where needed, also update csv headers and create a document listing all headers for all csv files in the root directory of ct-matrix for future refernce

embed the pip window to the top right of the masteradmin page. add functions and admin options in below the pip frame, for the pip module active keeping the slides list on the left.

ensure all modules are linked in the nav correctly.
all links leaving the masteradmin page should open up ina new page or nested iframe leaving the nav bar static for easier control and admin.
*Created: 2026-04-21 21:59*
