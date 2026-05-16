/**
 * MATRIX FIREBASE BRIDGE
 * Synchronizes local BroadcastChannel events with Firebase Realtime Database
 */

import { db, ref, onValue, set, update } from './firebase-config.js';

const bc = new BroadcastChannel('ct_matrix_sync');
const STATE_PATH = 'matrix_state';
const COMMAND_PATH = 'matrix_command';

// 1. LISTEN TO FIREBASE (FOR BILLBOARD)
// When the cloud state changes, notify the local system
onValue(ref(db, STATE_PATH), (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // Update UI Status if on Admin
    const dot = document.getElementById('cloud-dot');
    if (dot) dot.style.background = '#10b981'; // Green for active

    // Loop prevention: check the root meta or child meta
    if (data._last_updated_by === getClientId()) return;

    console.log('[FIREBASE] Remote State Sync:', data);
    bc.postMessage({ type: 'SYNC_STATE', state: data, isFirebaseBridge: true });
});

// Listen for one-time commands (JUMP, NEXT, PREV)
onValue(ref(db, COMMAND_PATH), (snapshot) => {
    const cmd = snapshot.val();
    if (cmd && cmd.timestamp > (window.lastCommandTime || 0) && cmd.source !== getClientId()) {
        window.lastCommandTime = cmd.timestamp;
        console.log('[FIREBASE] Remote Command:', cmd);
        bc.postMessage({ ...cmd, isFirebaseBridge: true });
    }
});

// 2. LISTEN TO LOCAL BC (FOR ADMIN)
// When an admin action happens, push it to Firebase
bc.onmessage = (e) => {
    const type = e.data.type;
    
    // We only bridge commands that originated locally
    if (e.data.isFirebaseBridge) return;

    if (['NEXT', 'PREV', 'JUMP', 'MODULE_FILTER', 'LIVE_SLIDE', 'CONFETTI', 'REFRESH'].includes(type)) {
        console.log('[FIREBASE] Bridging Local Command to Cloud:', type);
        
        const timestamp = Date.now();
        const payload = { 
            ...e.data, 
            source: getClientId(), 
            timestamp: timestamp,
            isFirebaseBridge: true 
        };

        // Update the global command node
        set(ref(db, COMMAND_PATH), payload);

        // If it's a persistent state change, update state node too
        if (['MODULE_FILTER', 'LIVE_SLIDE'].includes(type)) {
            // Include meta at root of state for loop prevention
            update(ref(db, STATE_PATH), { _last_updated_by: getClientId() });
            // Update specific sub-node
            update(ref(db, STATE_PATH + '/' + type), payload);
        }
    }
};

function getClientId() {
    if (!window.matrixClientId) {
        window.matrixClientId = 'client_' + Math.random().toString(36).substr(2, 9);
    }
    return window.matrixClientId;
}

console.log('[FIREBASE] Bridge initialized as:', getClientId());
