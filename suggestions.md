# NZ Pothole Radar & Reporting App — Feature Suggestions

* **Reaction-Time Lookback Backtracking:** Automatically offset logged GPS coordinates backward along the travel vector by 1.5–2.0 seconds of current speed so potholes tapped after passing them are pinned at the exact point of impact.
* **RAMM Linear Referencing (RS/RP):** Convert WGS84 coordinates into New Zealand's standard Road Assessment and Maintenance Management (RAMM) Route Station and Route Position (`RS/RP`) displacement values used by Fulton Hogan, Downer, and Higgins road crews.
* **Still-There / Fixed One-Tap Pass-By Verification:** Display an oversized `STILL THERE` / `FIXED` confirmation prompt on the radar HUD for 4 seconds immediately after passing a known pothole to crowdsource road repair verification.
* **Auto-Mute / Speed-Sensitive Volume Scaling:** Suppress radar proximity tones below 15 km/h (intersections, driveways, heavy traffic) and dynamically scale alert lead-time from 300m in 50 km/h urban zones to 800m on 100–110 km/h State Highways.
* **Pothole Cluster / "Swiss Cheese" Corridor Mode:** Merge 3 or more potholes within a 50-meter stretch into a single "Degraded Surface Zone" alert to prevent continuous audio fatigue on badly damaged rural roads.
* **Heavy Rain & Flood-Risk Multiplier:** Flag potholes logged during wet conditions or located in low-lying gullies as high-priority "Water-Filled / Invisible Hazard" alerts.
* **Vehicle Profile Calibration:** Switch between `Car`, `4WD/Ute`, `Motorcycle/EV`, and `Heavy Truck/Campervan` profiles to adjust accelerometer G-force bump sensitivity and prioritize wheel-track warnings.
* **Dashcam Clip Timestamp Bookmarking:** Generate a synchronized `.SRT` subtitle file or timestamp log (`HH:MM:SS`) per trip so drivers can easily extract matching dashcam video frames for council damage claims.
* **Tyre & Rim Damage Claim Dossier Generator:** Export a formal NZTA / Council Public Liability claim package containing historical logs proving when the pothole was first recorded versus when vehicle damage occurred.
* **Bluetooth Media Button / Voice Trigger:** Support logging potholes via steering-wheel media skip buttons (`MediaSession API`) or offline wake-words (`"Log Pothole"`, `"Big Pothole"`) for completely hands-free operation.
* **Peer-to-Peer Offline Sync (QR / Local File Drop):** Allow drivers in remote areas (e.g., East Cape, West Coast, Fiordland) to share newly logged potholes device-to-device via animated QR codes or Web Share `.pothole` bundles without cell reception.
* **Waka Kotahi TREIS Live Overlay (When Online):** Sync with the NZTA Traffic and Road Event Information System (TREIS) API when connectivity returns to cross-reference active roadworks, temporary speed limits (`30 km/h` gravel/reseal zones), and slips.
* **Council SLA Countdown & Escalation Tracker:** Track the number of days since a pothole was exported to a specific council and highlight overdue hazards that exceed standard NZ road maintenance response targets (typically 48 hours for high-severity State Highway defects).
* **Night-Vision Red / Amber HUD Dimmer:** Automatically switch the radar display to a low-glare deep red or classic Valentine-One / Escort amber monochrome palette based on sunset times or ambient light to preserve driver night vision.
* **Gravel / Unsealed Road Auto-Suppression:** Detect unsealed metal/gravel roads from road surface metadata or continuous high-frequency vibration to automatically pause false-positive bump detection.

---

## Batch 2

### Safety & Driving
* **Lock-Out While Moving:** Block menus, typing and the review screens above 10 km/h, so only the big tap-to-log button and the alerts work while driving.
* **Passenger Co-Pilot Mode:** A passenger can unlock the full logging screen (photo, severity, lane position) while the car is moving.
* **Grace Period After a Logged Pothole:** Don't sound the alert for a pothole you logged in the last 5 minutes, so you aren't warned about one you just reported.
* **Haptic-Only Mode:** Vibration-only alerts for motorcyclists, or for drivers playing music or podcasts through the car.
* **Audio Ducking:** Briefly lower the music volume when an alert plays, instead of mixing the beep over the top.
* **Ignore the Other Side of a Divided Road:** Don't sound alerts for potholes on the opposite carriageway of a divided road, such as the Auckland and Wellington motorways and expressways.

### Data Quality
* **Merge Duplicates:** Combine repeated logs within about 8 m on the same heading into one record, and keep a count of how many times it was confirmed.
* **Confidence Score:** Rate each pothole from how many times it was confirmed, GPS accuracy at the time of logging, whether a bump was detected, and how old the report is.
* **Expire Old Records:** Automatically remove unconfirmed potholes after 90 days so the alert database doesn't fill with stale hazards.
* **GPS Accuracy Filter:** Reject or flag logs where GPS accuracy is worse than 20 m, for example in tunnels, gorges or under thick bush.
* **Size Estimate From Photo:** Estimate pothole size from a photo using a known reference object such as a shoe, coin or road marking.

### NZ-Specific
* **Te Reo Māori Interface:** Bilingual English / Te Reo labels and voice prompts.
* **Road Type Tagging:** Tag each pothole as State Highway, local sealed road, unsealed road, bridge deck, one-lane bridge or cattle stop, since each has different repair priority.
* **Cycleway & Shoulder Hazards:** Separate category for potholes on road shoulders and cycleways, such as Te Ara Ahi or the Remutaka Cycle Trail.
* **Slip & Washout Category:** Let users log slips, washouts and dropouts using the same radar workflow.
* **Holiday Road Toll Mode:** A heightened-sensitivity preset for long-weekend and Christmas holiday travel on busy routes such as SH1, SH2 and SH6.

### Export & Advocacy
* **Council League Table:** Rank councils by how many reports are open and how fast they fix them, then share it as an image or PDF.
* **Official Information Act (OIA) Request Template:** Pre-fill an OIA request asking a council for its pothole repair records in a given area.
* **Ward Councillor Lookup:** Find which ward a pothole is in, so a report can be copied to the local elected member.
* **Before/After Photo Comparison:** Show a side-by-side photo once a pothole is marked fixed, as proof of the repair.
* **Monthly Summary Report:** An automatic monthly summary: potholes logged, how many exported, how many fixed, and average repair time per council.

### Technical & Usability
* **Battery Saver Mode:** Check GPS less often and dim the screen on long rural stretches with no logged potholes nearby.
* **Auto-Start From Car Bluetooth or CarPlay:** Launch driving mode automatically when the phone connects to the car's Bluetooth or CarPlay / Android Auto.
* **Encrypted Backup & Restore:** Export and import the whole database as an encrypted file so a phone change doesn't lose data.
* **Driver Stats:** Kilometres scanned, potholes logged and repairs confirmed, for motivation.
* **Optional Driving Dashboard:** Show compass heading, altitude, current speed and the road's speed limit alongside the radar display.
* **Accessibility:** Large-text mode, colour-blind-safe alert colours (no red/green-only distinctions) and full screen-reader support in review mode.
