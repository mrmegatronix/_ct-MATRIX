/**
 * MATRIX FIREBASE BRIDGE
 * Synchronizes local BroadcastChannel events with Firebase Realtime Database
 */

import { db, ref, onValue, set, update } from './firebase-config.js';

if (window.self === window.top) {
    const bc = new BroadcastChannel('ct_matrix_sync');
    const STATE_PATH = 'matrix_state';
    const COMMAND_PATH = 'matrix_command';
    const pageLoadTime = Date.now();

    // Expose Tab ID helper globally
    window.getMatrixTabId = getTabId;

    // 1. LISTEN TO FIREBASE (FOR BILLBOARD & OTHER SCREENS)
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

    // Listen for one-time commands (JUMP, NEXT, PREV, etc.)
    onValue(ref(db, COMMAND_PATH), (snapshot) => {
        const cmd = snapshot.val();
        if (cmd && cmd.timestamp > pageLoadTime && cmd.timestamp > (window.lastCommandTime || 0) && cmd.source !== getClientId()) {
            window.lastCommandTime = cmd.timestamp;
            console.log('[FIREBASE] Remote Command:', cmd);
            bc.postMessage({ ...cmd, isFirebaseBridge: true });
        }
    });

    // 2. LISTEN TO LOCAL BC (FOR ADMIN)
    // When an admin action happens, push it to Firebase
    bc.onmessage = (e) => {
        const type = e.data.type;
        
        // We only bridge commands that originated locally in this specific tab
        if (e.data.isFirebaseBridge) return;
        if (e.data.senderTabId !== getTabId()) return;

        if (['NEXT', 'PREV', 'JUMP', 'PROJECT', 'TOGGLE', 'MODULE_FILTER', 'LIVE_SLIDE', 'CONFETTI', 'REFRESH'].includes(type)) {
            console.log('[FIREBASE] Bridging Local Command to Cloud:', type);
            
            const timestamp = e.data.timestamp || Date.now();
            const commandId = e.data.commandId || ('cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
            const payload = { 
                ...e.data, 
                source: getClientId(), 
                timestamp: timestamp,
                commandId: commandId,
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

    console.log('[FIREBASE] Bridge initialized as:', getClientId());
}

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

