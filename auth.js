// ====================================================
// auth.js: FIREBASE AUTHENTICATION & LOGIN LOGIC
// ====================================================

// 🚀 HIER DEINE SCHLÜSSEL AUS SCHRITT 1 EINFÜGEN:
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD8OZrn6RFNtljaAtWoBi0VEHMiSaAholo",
    authDomain: "mnau-billing.firebaseapp.com",
    projectId: "mnau-billing",
    storageBucket: "mnau-billing.firebasestorage.app",
    messagingSenderId: "553632016933",
    appId: "1:553632016933:web:934c54f85335c0567fedcc"
};

// Firebase initialisieren
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elemente
const authOverlay = document.getElementById('auth-overlay');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authTitle = document.getElementById('auth-title');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const btnAuthToggle = document.getElementById('btn-auth-toggle');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');

let isRegisterMode = false;

// Zwischen Login und Registrierung umschalten
btnAuthToggle.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    authTitle.textContent = isRegisterMode ? "MNAU Registrierung" : "MNAU Login";
    btnAuthSubmit.textContent = isRegisterMode ? "Account erstellen" : "Anmelden";
    btnAuthToggle.textContent = isRegisterMode ? "Bereits einen Account? Zum Login" : "Noch keinen Account? Registrieren";
    authError.style.display = 'none';
});

// Formular absenden (Login oder Registrierung an Firebase schicken)
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    btnAuthSubmit.disabled = true;
    btnAuthSubmit.textContent = "Authentifizierung...";

    const email = authEmail.value;
    const password = authPassword.value;

    try {
        if (isRegisterMode) {
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        authError.style.display = 'block';
        // Fehler-Meldungen sauber übersetzen
        let errorMsg = error.message;
        if(errorMsg.includes('auth/invalid-credential')) errorMsg = "Falsches Passwort oder E-Mail.";
        if(errorMsg.includes('auth/email-already-in-use')) errorMsg = "Diese E-Mail ist bereits registriert.";
        if(errorMsg.includes('auth/weak-password')) errorMsg = "Das Passwort muss mindestens 6 Zeichen lang sein.";

        authError.textContent = errorMsg;
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = isRegisterMode ? "Account erstellen" : "Anmelden";
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
        // ZUGANG GEWÄHRT: Overlay ausblenden & App starten
        authOverlay.classList.add('hidden');
        if (typeof window.initMNAUApp === "function") {
            window.initMNAUApp();
        }
    } else {
        // ZUGANG VERWEIGERT: Overlay anzeigen
        authOverlay.classList.remove('hidden');
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = isRegisterMode ? "Account erstellen" : "Anmelden";

        // App leeren, damit beim Ausloggen keine Daten stehen bleiben
        if(window.DOM && window.DOM.orderList) {
            window.DOM.orderList.innerHTML = '';
            window.DOM.archiveList.innerHTML = '';
        }
    }
});