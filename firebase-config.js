/**
 * FIREBASE CONFIGURATION
 * Real-time cloud sync for ct-Matrix
 */

const firebaseConfig = {
    apiKey: "AIzaSyAIFTmnDzP39w0gbJQU_jIXKNxUc1-gI5Q",
    authDomain: "ct-matrix-system.firebaseapp.com",
    databaseURL: "https://ct-matrix-system-default-rtdb.firebaseio.com",
    projectId: "ct-matrix-system",
    storageBucket: "ct-matrix-system.firebasestorage.app",
    messagingSenderId: "46848619225",
    appId: "1:46848619225:web:164d9b170edf386d7744c8"
};

// Initialize Firebase via CDN (Modular SDK)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, push } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set, update, push };
