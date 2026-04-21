# Matrix Ecosystem CSV Reference Guide

This document lists the required CSV headers and data structures for all modules in the Matrix ecosystem.

## 1. CT-MATRIX (Main Events)
**File Path**: `D:\__GITHUB\_ct-MATRIX\local-backup.csv`
**Headers**: `Date, Day, Time, Type, Title, Notes, Price`

- **Date**: Preferred format `DD/MM/YYYY`.
- **Type**: Categorization (e.g., Dining, Raffle, Promo).
- **Notes**: Supports multi-line input (Shift+Enter in GSheets).

---

## 2. CT-MMR (Monster Meat Raffle)
**File Path**: `D:\__GITHUB\_ct-MMR\local-backup.csv`
**Headers**: `Title, Subtitle, Type, Duration, BackgroundImage, OverlayImage, BubbleText, WinnerPhotos`

- **Type**: `normal`, `countdown`, `avatar`, `winners`.
- **Duration**: Milliseconds (e.g., `30000`).
- **WinnerPhotos**: Comma-separated list of image URLs.

---

## 3. CT-MOM (Mother's Day)
**File Path**: `D:\__GITHUB\_ct-MOM\local-backup.csv`
**Headers**: `Title, Subtitle, Type, Duration, BackgroundImage, OverlayImage, BubbleText`

- **Type**: `normal`, `countdown`, `qr`.
- **BubbleText**: Used as the destination URL for the QR code when type is `qr`.

---

## 4. CT-WEA (Weather)
**File Path**: `D:\__GITHUB\_ct-WEA\local-backup.csv`
**Headers**: `Date, Day, Time, Type, Title, Notes, Price` (Shared structure with MATRIX)

---

## 5. CT-ACE (Chase the Ace)
**Note**: Primarily managed via the Admin Panel local storage, but can import from a standard `Title, Subtitle, Type` format if needed.

---

### Pro-Tip: Multi-line Support
All `Notes`, `Title`, `Subtitle`, and `BubbleText` fields across all modules support **Shift+Enter** from Google Sheets. The system automatically converts these into `<br>` tags for display.
