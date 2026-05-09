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
**Schema**: 26 Columns (Mandatory)

### 📋 Copy-Paste Master Headers
`Date,Day,Event Type,Event Name,Details,Billboard Text,Start Time,Price,Location,Slide Footer,Slide Type,Hidden Notes,Accent Hex Colour,Countdown Finish,Feature QR,Footer QR,Footer Hyperlink,Slide Duration,Slide Background,Foreground Image,Bubble Text,Lock Slide,Lock Day,Lock Time,Transition,Zoom`

| Index | Letter | Column Name | Description |
|---|---|---|---|
| 0 | A | **Date** | Event date (YYYY-MM-DD or DD/MM/YYYY) |
| 1 | B | **Day** | Name of the day (e.g. Monday) |
| 2 | C | **Event Type** | Category (Rugby, Karaoke, Quiz, Special, etc.) |
| 3 | D | **Event Name** | Primary slide title |
| 4 | E | **Details** | Main TV Description (Supports Shift+Enter) |
| 5 | F | **Billboard Text** | **Short description for LED Billboard** |
| 6 | G | **Start Time** | Specific event start time (e.g. 7:00 PM) |
| 7 | H | **Price** | Cost or special pricing (e.g. $25 or FREE) |
| 8 | I | **Location** | Venue area (e.g. The Garden Bar) |
| 9 | J | **Slide Footer** | Custom text at the very bottom of the slide |
| 10 | K | **Slide Type** | System identifier (Event, Promo, MODULE) |
| 11 | L | **Hidden Notes** | Internal admin notes (never displayed) |
| 12 | M | **Accent Hex** | Custom theme color (e.g. #D4AF37) |
| 13 | N | **Countdown** | Target date/time for countdown logic |
| 14 | O | **Feature QR** | **Centered QR Code** (Main focal point) |
| 15 | P | **Footer QR** | **Small QR Code** (Beside Footer Text) |
| 16 | Q | **Hyperlink** | URL Source for QR codes |
| 17 | R | **Slide Duration** | Time in seconds (default 30) |
| 18 | S | **Background** | Image URL for Slide Background |
| 19 | T | **FG Image** | Foreground Overlay Image |
| 20 | U | **Bubble Text** | Text for a floating badge (e.g. SELLING FAST) |
| 21 | V | **Lock Slide** | If `TRUE`, this slide stays active (Failsafe) |
| 22 | W | **Lock Day** | Force slide to only appear on a specific day |
| 23 | X | **Lock Time** | Force slide to only appear at a specific time |
| 24 | Y | **Transition** | Animation style: `Fade`, `ScrollDown`, `PanDown` |
| 25 | Z | **Zoom** | Background zoom factor (e.g. 1.2) |
| 26 | - | **Spare** | Reserved for future logic |

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

## 📋 Premium A4 Menu Support
To show a portrait A4 menu with a professional scrolling effect:
1. **Column 9 (Slide Type)**: Enter **`MENU`**.
2. **Column 17 (Slide Background)**: Enter your menu image URL (e.g., `_menus/menu.jpg`).
3. **Automatic Logic**: Setting the type to `MENU` will automatically:
   - Apply the **PanDown** transition (top-to-bottom scroll).
   - Set the **Duration** to 45 seconds (plenty of time to read).
   - Hide the main center text so your menu isn't blocked.
   - Show a sleek sidebar on the left with a QR code for mobile viewing.

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
All `Description`, `Title`, and `Subtitle` fields support **Shift+Enter** from Google Sheets. The system automatically converts these into `<br>` tags for display. //

### 🔗 Google Sheets Integration
To use Google Sheets, publish your sheet as a CSV (`File > Share > Publish to web > CSV`) and paste the link into the Admin Panel "Sync" field. Ensure your sheet columns match the headers above EXACTLY.
