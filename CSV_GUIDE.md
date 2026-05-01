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
| 1 | **Day** | Name of the day (e.g. Monday) |
| 2 | **Event Type** | Category (Rugby, Karaoke, Quiz, Special, etc.) |
| 3 | **Event Name** | Primary slide title (Supports Shift+Enter for new lines) |
| 4 | **Details** | Subtitle/Description (Supports Shift+Enter) |
| 5 | **Start Time** | Specific event start time (e.g. 7:00 PM) |
| 6 | **Price** | Cost or special pricing (e.g. $25 or FREE) |
| 7 | **Location** | Venue area (e.g. The Garden Bar) |
| 8 | **Slide Footer** | Custom text at the very bottom of the slide |
| 9 | **Slide Type** | System identifier (Event, Promo, MODULE) |
| 10 | **Hidden Notes** | Internal admin notes (never displayed on screen) |
| 11 | **Accent Hex Colour**| Custom theme color (e.g. #D4AF37) |
| 12 | **Countdown Finish**| Target date/time for countdown logic |
| 13 | **Feature QR** | Main QR code link (creates a white-backed QR card) |
| 14 | **Footer QR** | Smaller QR code specifically for the footer area |
| 15 | **Footer Hyperlink**| destination for footer clicks (interactive mode) |
| 16 | **Slide Duration** | Time in milliseconds (default 30000) |
| 17 | **Slide Background**| Path to custom BG image (e.g. ads/promo1.jpg) |
| 18 | **Foreground Image**| Path to transparent PNG overlay (e.g. logos/logo.png) |
| 19 | **Bubble Text** | Text for a floating badge (e.g. SELLING FAST) |
| 20 | **Lock Slide** | If `TRUE`, this slide stays active (Failsafe) |
| 21 | **Lock Day** | Force slide to only appear on a specific day |
| 22 | **Lock Time** | Force slide to only appear at a specific time |
| 23 | **Transition** | Animation style: `Fade`, `ScrollDown`, or `PanDown` |
| 24 | **Zoom** | Background zoom factor (e.g. 1.2) |

---

## 🖼️ Image & Asset Path Guidelines
For **Slide Background** (Col 17) and **Foreground Image** (Col 18), use the following formats:

| Format | Example | Description |
|---|---|---|
| **Local Path** | `_backgrounds/stadium.png` | Relative to the project root (Fastest load). |
| **Direct URL** | `https://i.imgur.com/xyz.jpg` | Full URL to a public image. |
| **Ad Folder** | `ads/promo_banner.jpg` | Organized assets in sub-folders. |

> [!WARNING]
> **DO NOT** put image URLs in the **Transition** column. This column only accepts `Fade` or `ScrollDown`.

---

## 📋 Scrolling Menu Recipe
To create a premium scrolling menu (panning from top to bottom):
1. **Column 17 (Slide Background)**: Enter your menu image URL (e.g., `ads/menu.jpg`).
2. **Column 23 (Transition)**: Enter **`PanDown`**.
3. **Column 24 (Zoom)**: Enter **`1.2`** or **`1.5`** to ensure the image fills the width while scrolling.
4. **Column 16 (Duration)**: Set to `45000` (45s) to allow enough time for a slow, readable scroll.

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
