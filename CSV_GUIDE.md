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
**File Path**: `D:\__GITHUB\_ct-MATRIX\local-backup.csv`
**Headers**: `Date,Day,Time,Event Type,Title,Description,Price,QR Code URL`

- **Date**: Preferred format `YYYY-MM-DD` or `DD/MM/YYYY`.
- **Event Type**: Categorization (e.g., Dining, Raffle, Sport, Promo, Karaoke).
- **Description**: Supports multi-line input (Shift+Enter in GSheets).
- **Price**: Displayed in the pulse-glow badge.
- **QR Code URL**: If provided, a QR code will be automatically generated on the slide.

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
