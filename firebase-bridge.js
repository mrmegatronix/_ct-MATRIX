/**
 * MATRIX FIREBASE BRIDGE
 * Synchronizes local BroadcastChannel events with Firebase Realtime Database
 * 
 * Architecture:
 *   masteradmin.html (Device A) --[BC]--> firebase-bridge --[Firebase RTDB]--> firebase-bridge (Device B) --[BC]--> matrix-core.js
 */

import { db, ref, onValue, set, update } from './firebase-config.js';

// Only run in top-level frames (not iframes like the preview in masteradmin)
if (window.self === window.top) {
    const bc = new BroadcastChannel('ct_matrix_sync');
    const STATE_PATH = 'matrix_state';
    const COMMAND_PATH = 'matrix_command';
    const pageLoadTime = Date.now();

    // Expose Tab ID helper globally so inline scripts can share the same ID
    window.getMatrixTabId = getTabId;

    // Track Firebase connection state
    let firebaseConnected = false;
    let lastFirebaseError = null;

    // Log bridge init
    console.log('[FIREBASE BRIDGE] Initializing...', {
        clientId: getClientId(),
        tabId: getTabId(),
        pageLoadTime: new Date(pageLoadTime).toISOString(),
        url: window.location.href
    });

    // ─────────────────────────────────────────────────────────
    // 1. LISTEN TO FIREBASE — receive remote commands
    // ─────────────────────────────────────────────────────────

    // Listen for persistent state changes (MODULE_FILTER, LIVE_SLIDE, SETTINGS_UPDATE)
    try {
        onValue(ref(db, STATE_PATH), (snapshot) => {
            firebaseConnected = true;
            const data = snapshot.val();
            if (!data) {
                console.log('[FIREBASE BRIDGE] State node is empty');
                return;
            }

            // Update UI Status if on Admin
            updateCloudDot('connected');

            // Loop prevention: don't re-process our own state updates
            if (data._last_updated_by === getClientId()) {
                console.log('[FIREBASE BRIDGE] Ignoring own state update');
                return;
            }

            console.log('[FIREBASE BRIDGE] Remote State Received:', data);
            bc.postMessage({ type: 'SYNC_STATE', state: data, isFirebaseBridge: true });
        }, (error) => {
            console.error('[FIREBASE BRIDGE] State listener error:', error);
            lastFirebaseError = error.message;
            updateCloudDot('error');
        });
    } catch (err) {
        console.error('[FIREBASE BRIDGE] Failed to attach state listener:', err);
    }

    // Listen for one-time action commands (NEXT, PREV, JUMP, TOGGLE, etc.)
    let isInitialCommandLoad = true;
    try {
        onValue(ref(db, COMMAND_PATH), (snapshot) => {
            firebaseConnected = true;
            const cmd = snapshot.val();
            if (!cmd) {
                console.log('[FIREBASE BRIDGE] Command node is empty');
                return;
            }

            // Skip the command that's already in Firebase when the page first loads
            if (isInitialCommandLoad) {
                isInitialCommandLoad = false;
                window.lastCommandId = cmd.commandId;
                console.log('[FIREBASE BRIDGE] Skipping initial historical command on load');
                return;
            }

            // Guards: only process commands that are:
            // 1. New (different commandId from last processed)
            // 2. Not from this device (prevents echo)
            const isNew = cmd.commandId !== window.lastCommandId;
            const isFromOtherDevice = cmd.source !== getClientId() || (cmd.senderTabId && cmd.senderTabId !== getTabId());

            console.log('[FIREBASE BRIDGE] Command received from Firebase:', {
                type: cmd.type,
                commandId: cmd.commandId,
                source: cmd.source,
                isNew,
                isFromOtherDevice,
                myClientId: getClientId()
            });

            if (isNew && isFromOtherDevice) {
                window.lastCommandId = cmd.commandId;
                console.log('[FIREBASE BRIDGE] ✅ Executing remote command:', cmd.type);
                
                // Post to local BroadcastChannel so matrix-core.js picks it up
                bc.postMessage({ ...cmd, isFirebaseBridge: true });
                
                // Pulse the cloud dot to show activity
                updateCloudDot('syncing');
                setTimeout(() => updateCloudDot('connected'), 500);
            } else {
                console.log('[FIREBASE BRIDGE] ⏭ Skipping command (filtered out)');
            }
        }, (error) => {
            console.error('[FIREBASE BRIDGE] Command listener error:', error);
            lastFirebaseError = error.message;
            updateCloudDot('error');
        });
    } catch (err) {
        console.error('[FIREBASE BRIDGE] Failed to attach command listener:', err);
    }

    // ─────────────────────────────────────────────────────────
    // 2. LISTEN TO LOCAL BC — bridge local commands to Firebase
    // ─────────────────────────────────────────────────────────

    bc.onmessage = (e) => {
        const type = e.data.type;

        // Don't re-bridge messages that came FROM Firebase (prevents infinite loops)
        if (e.data.isFirebaseBridge) return;

        // Only bridge commands that originated from THIS tab
        // (prevents forwarding messages from other tabs/iframes which would cause duplicates)
        if (e.data.senderTabId && e.data.senderTabId !== getTabId()) return;

        // List of command types we bridge to Firebase
        const BRIDGED_COMMANDS = [
            'NEXT', 'PREV', 'JUMP', 'PROJECT', 'TOGGLE',
            'MODULE_FILTER', 'LIVE_SLIDE', 'SETTINGS_UPDATE',
            'CONFETTI', 'REFRESH', 'SYNC_JUMP', 'SCHEDULE_UPDATE'
        ];

        if (BRIDGED_COMMANDS.includes(type)) {
            console.log('[FIREBASE BRIDGE] ☁️ Bridging command to Firebase:', type);

            const timestamp = e.data.timestamp || Date.now();
            const commandId = e.data.commandId || ('cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
            // Strip undefined values which cause Firebase to crash and reject the sync
            const safePayload = JSON.parse(JSON.stringify({
                ...e.data,
                source: getClientId(),
                timestamp: timestamp,
                commandId: commandId,
                isFirebaseBridge: true
            }));

            // Write the command to Firebase
            set(ref(db, COMMAND_PATH), safePayload)
                .then(() => {
                    console.log('[FIREBASE BRIDGE] ✅ Command written to Firebase:', type);
                    updateCloudDot('syncing');
                    setTimeout(() => updateCloudDot('connected'), 500);
                })
                .catch((err) => {
                    console.error('[FIREBASE BRIDGE] ❌ Failed to write command to Firebase:', err);
                    lastFirebaseError = err.message;
                    updateCloudDot('error');
                });

            // If it's a persistent state change, also update the state node
            const PERSISTENT_TYPES = ['MODULE_FILTER', 'LIVE_SLIDE', 'SETTINGS_UPDATE'];
            if (PERSISTENT_TYPES.includes(type)) {
                // Include meta at root of state for loop prevention
                update(ref(db, STATE_PATH), { _last_updated_by: getClientId() })
                    .catch(err => console.error('[FIREBASE BRIDGE] State meta update failed:', err));
                // Update specific sub-node
                update(ref(db, STATE_PATH + '/' + type), safePayload)
                    .catch(err => console.error('[FIREBASE BRIDGE] State sub-node update failed:', err));
            }
        }
    };

    // ─────────────────────────────────────────────────────────
    // 3. UI HELPERS
    // ─────────────────────────────────────────────────────────

    function updateCloudDot(status) {
        const dot = document.getElementById('cloud-dot');
        const label = dot ? dot.nextElementSibling || dot.parentElement?.querySelector('span:last-child') : null;

        if (dot) {
            dot.classList.remove('pulse');
            void dot.offsetWidth; // Trigger reflow for re-animation

            if (status === 'connected') {
                dot.style.background = '#10b981'; // Green
                dot.classList.add('active');
                dot.classList.remove('syncing');
                if (label) label.textContent = 'FIREBASE LIVE';
            } else if (status === 'syncing') {
                dot.style.background = '#06b6d4'; // Cyan
                dot.classList.add('pulse', 'syncing');
                if (label) label.textContent = 'SYNCING...';
            } else if (status === 'error') {
                dot.style.background = '#ef4444'; // Red
                dot.classList.remove('active', 'syncing');
                if (label) label.textContent = 'FIREBASE ERROR';
            }
        }
    }

    // Also expose a diagnostic function for console debugging
    window.firebaseBridgeDiag = function() {
        console.table({
            clientId: getClientId(),
            tabId: getTabId(),
            connected: firebaseConnected,
            lastError: lastFirebaseError,
            lastCommandTime: window.lastCommandTime ? new Date(window.lastCommandTime).toISOString() : 'none',
            pageLoadTime: new Date(pageLoadTime).toISOString()
        });
    };

    console.log('[FIREBASE BRIDGE] ✅ Bridge fully initialized. Client:', getClientId(), 'Tab:', getTabId());
    console.log('[FIREBASE BRIDGE] 💡 Run firebaseBridgeDiag() in console for diagnostics.');
}

// ─────────────────────────────────────────────────────────
// IDENTITY HELPERS (outside the if-block so they're always available)
// ─────────────────────────────────────────────────────────

function getClientId() {
    let id = localStorage.getItem('matrix_client_id');
    if (!id) {
        id = 'client_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('matrix_client_id', id);
    }
    return id;
}

function getTabId() {
    if (!window.matrixTabId) {
        window.matrixTabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return window.matrixTabId;
}
