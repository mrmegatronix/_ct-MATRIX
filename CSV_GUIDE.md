# Matrix Ecosystem CSV Reference Guide

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
**Headers**: `Title,Subtitle,Type,Duration,BackgroundImg,OverlayImg,BubbleText,WinnerPhotos`

- **Type**: `normal`, `countdown`, `avatar`, `winners`.
- **Duration**: Milliseconds (e.g., `30000`).
- **BubbleText**: The text that appears in the speech bubble on 'avatar' slides.
- **WinnerPhotos**: Comma-separated list of image URLs.

---

## 3. CT-MOM (Mother's Day)
**File Path**: `D:\__GITHUB\_ct-MOM\local-backup.csv`
**Headers**: `Title,Subtitle,Type,Duration,BackgroundImg,OverlayImg,BubbleText`

- **Type**: `normal`, `countdown`, `qr`.
- **BackgroundImg**: URL or path to the background image.
- **OverlayImg**: URL or path to the overlay image.
- **BubbleText**: Contains the destination URL for the QR code when `Type` is `qr`.

---

### 💡 Pro-Tip: Multi-line Support
All `Description`, `Title`, and `Subtitle` fields support **Shift+Enter** from Google Sheets. The system automatically converts these into `<br>` tags for display.

### 🔗 Google Sheets Integration
To use Google Sheets, publish your sheet as a CSV (`File > Share > Publish to web > CSV`) and paste the link into the Admin Panel "Sync" field. Ensure your sheet columns match the headers above EXACTLY.
