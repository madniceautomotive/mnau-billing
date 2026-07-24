// ====================================================
// auth.js: SECURE LOGIN ONLY & PASSWORD RESET
// ====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 🚀 DEINE FIREBASE CONFIG:
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

// Globale Variablen
window.currentUserEmail = "Unbekannt";
window.currentUserCompanies = ["MNAU"];
window.currentUserCompany = "MNAU";

// DOM Elemente
const authOverlay = document.getElementById('auth-overlay');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const btnAuthReset = document.getElementById('btn-auth-reset');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');

// Login durchführen
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    authError.style.color = '#e74c3c';
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

// Passwort-Reset E-Mail senden
if (btnAuthReset) {
    btnAuthReset.addEventListener('click', async () => {
        const email = authEmail.value.trim();

        if (!email) {
            authError.style.display = 'block';
            authError.style.color = '#e74c3c';
            authError.textContent = "Bitte gib zuerst deine E-Mail-Adresse oben ein.";
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            authError.style.display = 'block';
            authError.style.color = '#00ff73';
            authError.textContent = "E-Mail zum Setzen deines Passworts wurde versendet!";
        } catch (error) {
            authError.style.display = 'block';
            authError.style.color = '#e74c3c';
            authError.textContent = "Fehler: E-Mail-Adresse nicht gefunden.";
        }
    });
}

// Logout Button oben rechts
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth);
    });
}

// 🔐 Der Wächter: Prüft permanent den Login-Status
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUserEmail = user.email || "Unbekannt";

        // Fragt alle zugewiesenen Firmen des Users aus Airtable ab
        if (window.API && typeof window.API.fetchUserCompanies === "function") {
            window.currentUserCompanies = await window.API.fetchUserCompanies(user.email);
        } else {
            window.currentUserCompanies = ["MNAU"];
        }

        // Standardmäßig die erste Firma wählen
        window.currentUserCompany = window.currentUserCompanies[0] || "MNAU";

        // Befülle Firmen-Dropdown im Header
        const companySelect = document.getElementById('company-select');
        if (companySelect) {
            companySelect.innerHTML = '';
            window.currentUserCompanies.forEach(comp => {
                const opt = document.createElement('option');
                opt.value = comp;
                opt.textContent = `Firma: ${comp}`;
                companySelect.appendChild(opt);
            });
            companySelect.value = window.currentUserCompany;
            companySelect.style.display = window.currentUserCompanies.length > 0 ? 'inline-block' : 'none';
        }

        authOverlay.classList.add('hidden');
        if (typeof window.initMNAUApp === "function") {
            window.initMNAUApp();
        }
    } else {
        window.currentUserEmail = "Unbekannt";
        window.currentUserCompanies = ["MNAU"];
        window.currentUserCompany = "MNAU";
        authOverlay.classList.remove('hidden');
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = "Anmelden";

        if (window.DOM && window.DOM.orderList) {
            window.DOM.orderList.innerHTML = '';
            window.DOM.archiveList.innerHTML = '';
        }
    }
});