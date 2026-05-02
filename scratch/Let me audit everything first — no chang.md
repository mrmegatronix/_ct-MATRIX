Let me audit everything first — no changes, just gathering facts.

Listed directory _ct-MATRIX
Listed directory gsheet_backups
Viewed local-backup.csv
Viewed _ct-MATRIX%20-%20Sheet1.csv:1-3
Viewed matrix_backup.csv:1-3
Viewed mmr_backup.csv:1-8
Viewed mom_backup.csv:1-5
Viewed ace_backup.csv

Now let me check the JSON structure fully and how `matrix-core.js` parses the CSV vs JSON:

Viewed matrix-data.json:1-441

Now let me check how `matrix-core.js` parses both sources to understand the field mapping:

Searched for "fetchCloudCSV\|fetchLocalCSV\|parseCSV\|csv.*header\|Description\|notes\|event_type\|Event Type"
Searched for "fetchCloudCSV"
Searched for "CSV"
Searched for "csv"
Searched for "local-backup"
Searched for "backup"
Searched for "fetch"

That's strange — the reverts may have changed things. Let me look at the actual content:

Viewed matrix-core.js:270-340
Searched for "fetchCloudCSV"
Ran command: `Select-String -Path "D:\__GITHUB\_ct-MATRIX\matrix-core.js" -Pattern "fetchCloudCSV" -Encoding utf8`
Viewed matrix-core.js:340-400
Viewed matrix-core.js:396-430

Now I have the full picture. Let me also check the individual repo local-backup files:

Viewed local-backup.csv:1-7
Viewed local-backup.csv:1-8

Right, I've got the full picture. Here's the plan — **no changes made**:

---

## Audit Findings

### The Problem: 3 Different CSV Schemas

| Source | Headers | Used By |
|---|---|---|
| **ct-MATRIX `local-backup.csv`** | `Date,Day,Time,Event Type,Title,Description,Price,QR Code URL` | `matrix-core.js` → `parseCSVToEvents()` |
| **ct-MOM `local-backup.csv`** | `Title,Subtitle,Type,Duration,BackgroundImg,OverlayImg,BubbleText` | MOM module |
| **ct-MMR `local-backup.csv`** | `Title,Subtitle,Type,Duration,BackgroundImg,OverlayImg,BubbleText,WinnerPhotos` | MMR module |

The **MATRIX CSV** uses a completely different schema than MOM/MMR. And the **JSON fields** (`date`, `day`, `time`, `event_type`, `title`, `notes`) don't match the CSV headers exactly either — the CSV says `Description` but the parser maps column 5 to `notes`. The CSV says `Event Type` but the JSON uses `event_type`.

### The Duplicate Backup Files

In `gsheet_backups/` you have:
- **`_ct-MATRIX - Sheet1.csv`** — just test data (`,`, `TEST,`, `ABC,123`)
- **`matrix_backup.csv`** — identical test data
- **`mmr_backup.csv`** — real MMR data (matches live)
- **`mom_backup.csv`** — slightly older MOM data
- **`ace_backup.csv`** — just `1600`

---

## Proposed Plan

### Step 1: Standardise the MATRIX CSV headers to match the JSON
Change the CSV header from `Description` → `Notes` so it matches what the JSON actually calls it. The parser already maps column 5 to `notes`, not `description`. This means the CSV header should be:

```
Date,Day,Time,Event Type,Title,Notes,Price,QR Code URL
```

### Step 2: Export `matrix-data.json` → a new CSV file
Create a flat CSV file from all 19 weeks / 47 events in the JSON, using the standardised headers. You can then paste this directly into your live Google Sheet. The file would go to something like `matrix-export.csv`.

### Step 3: Clean up the `gsheet_backups/` folder
- **Delete** `_ct-MATRIX - Sheet1.csv` and `matrix_backup.csv` (both are just test junk)
- **Keep** `mmr_backup.csv` and `mom_backup.csv` (these contain real data)
- **Delete or fix** `ace_backup.csv` (just contains `1600` with no headers)

### Step 4: Update `CSV_GUIDE.md`
Fix the documented header from `Description` → `Notes` to match the new standard.

---

**Shall I go ahead with this plan, or do you want to change anything first?**