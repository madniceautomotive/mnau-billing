// ====================================================
// auth.js: SECURE LOGIN ONLY (ADMIN-CREATED ACCOUNTS)
// ====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 🚀 DEINE FIREBASE CONFIG (Unverändert lassen)
const firebaseConfig = {
    apiKey: "AIzaSyD8OZrn6RFNtljaAtWoBi0VEHMiSaAholo",
    authDomain: "mnau-billing.firebaseapp.com",
    projectId: "mnau-billing",
    storageBucket: "mnau-billing.firebasestorage.app",
    messagingSenderId: "553632016933",
    appId: "1:553632016933:web:934c54f85335c0567fedcc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elemente
const authOverlay = document.getElementById('auth-overlay');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');

// Login durchführen
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    btnAuthSubmit.disabled = true;
    btnAuthSubmit.textContent = "Anmeldung läuft...";

    try {
        await signInWithEmailAndPassword(auth, authEmail.value, authPassword.value);
    } catch (error) {
        authError.style.display = 'block';
        let errorMsg = "Anmeldung fehlgeschlagen.";
        if (error.code === 'auth/invalid-credential') errorMsg = "E-Mail oder Passwort falsch.";
        if (error.code === 'auth/too-many-requests') errorMsg = "Zu viele Versuche. Bitte kurz warten.";

        authError.textContent = errorMsg;
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = "Anmelden";
    }
});

// Logout Button oben rechts
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth);
    });
}

// 🔐 Der Wächter: Prüft permanent den Login-Status
onAuthStateChanged(auth, (user) => {
    if (user) {
        authOverlay.classList.add('hidden');
        if (typeof window.initMNAUApp === "function") {
            window.initMNAUApp();
        }
    } else {
        authOverlay.classList.remove('hidden');
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = "Anmelden";

        if (window.DOM && window.DOM.orderList) {
            window.DOM.orderList.innerHTML = '';
            window.DOM.archiveList.innerHTML = '';
        }
    }
});