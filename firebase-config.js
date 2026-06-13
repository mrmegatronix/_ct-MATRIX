/**
 * FIREBASE CONFIGURATION
 * Real-time cloud sync for ct-Matrix
 * 
 * Exports: db, ref, onValue, set, update, push
 */

// Read from localStorage to allow user to easily override the database
const userDbUrl = localStorage.getItem('matrix_firebase_url');

const firebaseConfig = {
    apiKey: "AIzaSyAIFTmnDzP39w0gbJQU_jIXKNxUc1-gI5Q",
    authDomain: "ct-matrix-system.firebaseapp.com",
    databaseURL: userDbUrl || "https://ct-mmr-default-rtdb.firebaseio.com",
    projectId: "ct-matrix-system",
    storageBucket: "ct-matrix-system.firebasestorage.app",
    messagingSenderId: "46848619225",
    appId: "1:46848619225:web:164d9b170edf386d7744c8"
};

// Initialize Firebase via CDN (Modular SDK)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, push } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

let app, db;

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log('[FIREBASE CONFIG] ✅ Firebase initialized successfully. DB URL:', firebaseConfig.databaseURL);
} catch (err) {
    console.error('[FIREBASE CONFIG] ❌ Firebase initialization FAILED:', err);
    // Create a dummy db that will cause clear errors downstream
    db = null;
}

// Connection state monitoring — attach to .info/connected
if (db) {
    try {
        const connectedRef = ref(db, '.info/connected');
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                console.log('[FIREBASE CONFIG] 🟢 Connected to Firebase RTDB');
                window._firebaseConnected = true;
            } else {
                console.log('[FIREBASE CONFIG] 🔴 Disconnected from Firebase RTDB');
                window._firebaseConnected = false;
            }
        });
    } catch (e) {
        console.warn('[FIREBASE CONFIG] Could not attach connection listener:', e);
    }
}

export { db, ref, onValue, set, update, push };
