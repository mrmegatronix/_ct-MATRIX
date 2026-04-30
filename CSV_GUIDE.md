# Matrix Ecosystem CSV Reference Guide

> [!CAUTION]
> ### 🛑 CRITICAL AI OPERATIONAL RULES
> 1. **NO FAKE DATA:** This is a live, real-world advertising system. You MUST NEVER use hallucinated, placeholder, or "AI-generated" data (e.g., fake events like "Mother's Day" or "Meat Raffles"). Only data explicitly provided by the user is authorized. **False advertising is a serious legal/business risk.**
> 2. **BACKUP AUTHORIZATION REQUIRED:** You are prohibited from implementing, activating, or modifying local backup/fallback logic without explicit authorization from the user. Local backups may contain inconsistent data and must not be used as a primary source unless authorized.
> 3. **NO UNSANCTIONED EDITS:** Never wipe or "clean up" data files or logic paths unless specifically instructed to do so for a verified task.

---

This document lists the required CSV headers and data structures for all modules in the Matrix ecosystem. 

> [!IMPORTANT]
> **Headers are COMPULSORY**. The first row of every CSV file must contain the exact headers listed below.

---

## 1. CT-MATRIX (Main Events)
**Source of Truth**: Google Sheet (Published CSV URL)
**Schema**: 25 Columns (Mandatory)

### 📋 Copy-Paste Master Headers
`Date,Day,Event Type,Event Name,Details,Start Time,Price,Location,Slide Footer,Slide Type,Hidden Notes,Accent Hex Colour,Countdown Finish,Feature QR,Footer QR,Footer Hyperlink,Slide Duration,Slide Background,Foreground Image,Bubble Text,Lock Slide,Lock Day,Lock Time,Transition,Zoom`

| Index | Column Name | Description |
|---|---|---|
| 0 | **Date** | Event date (YYYY-MM-DD or DD/MM/YYYY) |
| 1 | **Day** | Name of the day |
| 2 | **Event Type** | Category (Rugby, Karaoke, Quiz, etc.) |
| 3 | **Event Name** | Primary slide title |
| 4 | **Details** | Multi-line description (Shift+Enter supported) |
| 5 | **Start Time** | Specific event start time |
| 6 | **Price** | Cost or special pricing |
| 7 | **Location** | Venue area or address |
| 8 | **Slide Footer** | Custom footer text for this slide |
| 9 | **Slide Type** | internal type (Event, Promo, etc.) |
| 10 | **Hidden Notes** | Admin notes (not displayed) |
| 11 | **Accent Hex Colour**| Custom theme color (e.g. #f59e0b) |
| 12 | **Countdown Finish**| Target date/time for countdown slides |
| 13 | **Feature QR** | Primary QR code URL |
| 14 | **Footer QR** | Secondary QR code for the footer |
| 15 | **Footer Hyperlink**| Link for the footer text |
| 16 | **Slide Duration** | Time in ms (default 30000) |
| 17 | **Slide Background**| Path to specific BG image (overrides auto) |
| 18 | **Foreground Image**| Path to overlay image (PNG) |
| 19 | **Bubble Text** | Floating badge text |
| 20 | **Lock Slide** | Prevent automatic cycling |
| 21 | **Lock Day** | Sync with specific day |
| 22 | **Lock Time** | Sync with specific time |
| 23 | **Transition** | Effect: `ScrollDown`, `Fade` (default) |
| 24 | **Zoom** | BG Image scale factor (e.g. `1.2`, `1.5`) |

---

## 🗓️ Scheduling & Visibility Rules
To ensure relevant content, the system applies the following logic based on the **Event Type** (Column 2):

- **Food Specials / Promos**: Only visible for the **Current Week** (7 days ahead).
- **Bands / Sport / Karaoke**: Visible up to **2 Weeks** in advance (14 days ahead).
- **Everything Else**: Defaults to the **Current Week** filter.
- **Past Events**: Automatically hidden.
- **TBC Events**: Any slide with "TBC" or "To Be Confirmed" in the Title or Subtitle is automatically skipped.

---

## 🎨 Automated Visual Logic
The system automatically assigns premium background assets based on the **Event Type** column if no specific "Slide Background" is provided:

- **Stadium Background** (`stadium.png`): Assigned to `Rugby`, `NRL`, `Warriors`, `Crusaders`.
- **Music Background** (`music.jpg`): Assigned to `Karaoke`, `Band`, or music emojis.
- **Quiz Background** (`quiz.png`): Assigned to `Quiz`.

---

## 2. CT-MMR (Monster Meat Raffle)
**File Path**: `D:\__GITHUB\_ct-MMR\local-backup.csv`
**Headers**: `Title,Subtitle,Type,Duration,BackgroundImage,OverlayImage,QR Code URL,WinnerPhotos`

- **Type**: `normal`, `countdown`, `avatar`, `winners`.
- **Duration**: Milliseconds (e.g., `30000`).
- **WinnerPhotos**: Comma-separated list of image URLs.

---

## 3. CT-MOM (Mother's Day)
**File Path**: `D:\__GITHUB\_ct-MOM\local-backup.csv`
**Headers**: `Title,Subtitle,Type,Duration,BackgroundImage,OverlayImage,QR Code URL`

- **Type**: `normal`, `countdown`, `qr`.
- **QR Code URL**: The destination URL for the QR code.

---

## 4. CT-WEA (Weather)
**File Path**: `D:\__GITHUB\_ct-WEA\local-backup.csv`
**Headers**: `Date,Day,Time,Event Type,Title,Description,Price,QR Code URL`

---

## 5. CT-ACE (Chase the Ace)
**File Path**: `D:\__GITHUB\_ct-ACE\local-backup.csv`
**Headers**: `Title,Subtitle,Type,Jackpot,CurrentCard,QR Code URL`

---

### 💡 Pro-Tip: Multi-line Support
All `Description`, `Title`, and `Subtitle` fields support **Shift+Enter** from Google Sheets. The system automatically converts these into `<br>` tags for display.

### 🔗 Google Sheets Integration
To use Google Sheets, publish your sheet as a CSV (`File > Share > Publish to web > CSV`) and paste the link into the Admin Panel "Sync" field. Ensure your sheet columns match the headers above EXACTLY.
