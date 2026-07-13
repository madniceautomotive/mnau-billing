// Wir laden die Keys sicher aus dem Speicher des Browsers
let AIRTABLE_TOKEN = localStorage.getItem('MNAU_AIRTABLE_TOKEN');
let BASE_ID = localStorage.getItem('MNAU_BASE_ID');
const TABLE_NAME = "Auftraege";

// API Endpunkte nur generieren, wenn Daten vorhanden sind
let API_URL = "";
let HEADERS = {};

if (AIRTABLE_TOKEN && BASE_ID) {
    API_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;
    HEADERS = {
        "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
    };
}

// Globale Variable für die Live-Suche
let loadedRecords = [];

// UI Elemente
const orderList = document.getElementById('order-list');
const loading = document.getElementById('loading');
const modal = document.getElementById('modal-overlay');
const btnNewOrder = document.getElementById('btn-new-order');
const btnCancel = document.getElementById('btn-cancel');
const formNewOrder = document.getElementById('form-new-order');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');

// App-Start nach DOM-Bereitschaft
document.addEventListener('DOMContentLoaded', () => {

    // Setup-Events binden
    if (btnNewOrder) btnNewOrder.addEventListener('click', () => modal.classList.remove('hidden'));

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
            formNewOrder.reset();
        });
    }

    // Event-Listener für den neuen Schlüssel-Reset-Button (🔑) im Header
    const btnResetKeys = document.getElementById('btn-reset-keys');
    if (btnResetKeys) {
        btnResetKeys.addEventListener('click', () => {
            if (confirm("Möchtest du die Airtable-Schlüssel wirklich zurücksetzen und neu eingeben?")) {
                localStorage.removeItem('MNAU_AIRTABLE_TOKEN');
                localStorage.removeItem('MNAU_BASE_ID');
                location.reload();
            }
        });
    }

    // Live-Suche Listener
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();

            if (query.length > 0) {
                searchClearBtn.style.display = 'flex';
            } else {
                searchClearBtn.style.display = 'none';
            }

            const filtered = loadedRecords.filter(record => {
                const orderName = (record.fields.Auftrag || "").toLowerCase();
                const betragText = (record.fields.Betrag_Automotive || "").toString();
                return orderName.includes(query) || betragText.includes(query);
            });

            renderOrders(filtered);
        });
    }

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchClearBtn.style.display = 'none';
            renderOrders(loadedRecords);
            searchInput.focus();
        });
    }

    // Formular-Absendung
    if (formNewOrder) {
        formNewOrder.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('input-name').value;
            const betrag = parseFloat(document.getElementById('input-betrag').value || 0);
            const fremdkosten = parseFloat(document.getElementById('input-fremdkosten').value || 0);

            const payload = {
                records: [{
                    fields: {
                        "Auftrag": name,
                        "Betrag_Automotive": betrag,
                        "Fremdkosten": fremdkosten,
                        "Status": "Zu verrechnen"
                    }
                }]
            };

            try {
                await fetch(API_URL, {
                    method: 'POST',
                    headers: HEADERS,
                    body: JSON.stringify(payload)
                });

                modal.classList.add('hidden');
                formNewOrder.reset();
                fetchOrders();
            } catch (error) {
                alert("Fehler beim Erstellen des Auftrags.");
            }
        });
    }

    // Ladevorgang starten
    fetchOrders();
});

// --- API: Aufträge abrufen ---
async function fetchOrders() {
    // Falls Keys fehlen: Ladekreis sofort verstecken und Konfigurations-Aufforderung im Interface anzeigen
    if (!AIRTABLE_TOKEN || !BASE_ID) {
        showSetupRequired();
        return;
    }

    loading.classList.remove('hidden');
    orderList.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}?sort[0][field]=Created%20Time&sort[0][direction]=desc`, { headers: HEADERS });
        const data = await response.json();

        loadedRecords = data.records || [];
        renderOrders(loadedRecords);
    } catch (error) {
        console.error("Fehler beim Laden:", error);
        orderList.innerHTML = `<p style="color:#e74c3c; padding: 20px;">Verbindungsfehler zu Airtable. Schlüssel korrekt?</p>`;
    } finally {
        loading.classList.add('hidden');
    }
}

// --- UI: Setup-Aufforderung zeichnen ---
function showSetupRequired() {
    loading.classList.add('hidden');
    orderList.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #a0aec0;">
            <h3 style="color: white; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">CONFIGURATION_REQUIRED</h3>
            <p style="font-size: 0.9rem; margin-bottom: 24px; max-width: 340px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                Es wurden keine gültigen Airtable-Zugangsdaten auf diesem Gerät gefunden.
            </p>
            <button class="btn-primary" style="margin: 0 auto;" onclick="triggerSetup()">➔ Setup starten</button>
        </div>
    `;
}

// --- Interaktive Einrichtung ---
window.triggerSetup = function() {
    const tokenInput = prompt("Einrichtung: Bitte gib deinen Airtable Token (pat...) ein:");
    const baseIdInput = prompt("Einrichtung: Bitte gib deine Airtable Base-ID (app...) ein:");

    if (tokenInput && baseIdInput) {
        localStorage.setItem('MNAU_AIRTABLE_TOKEN', tokenInput.trim());
        localStorage.setItem('MNAU_BASE_ID', baseIdInput.trim());
        location.reload();
    } else {
        alert("Einrichtung abgebrochen.");
    }
}

// --- UI: Aufträge zeichnen ---
function renderOrders(records) {
    orderList.innerHTML = '';

    if(!records || records.length === 0) {
        orderList.innerHTML = '<p style="color:#a0aec0; padding: 20px;">Keine passenden Aufträge vorhanden.</p>';
        return;
    }

    records.forEach(record => {
        const fields = record.fields;
        const id = record.id;
        const status = fields.Status || "Zu verrechnen";
        const betrag = fields.Betrag_Automotive ? fields.Betrag_Automotive.toFixed(2) : "0.00";
        const fremdkosten = fields.Fremdkosten ? fields.Fremdkosten.toFixed(2) : "0.00";

        let cardStatusClass = "status-zu-verrechnen";
        let badgeClass = "badge-zu-verrechnen";
        let nextStatus = "An Group verrechnet";
        let btnText = "Verrechnet";

        if(status === "An Group verrechnet") {
            cardStatusClass = "status-an-group-verrechnet";
            badgeClass = "badge-verrechnet";
            nextStatus = "Bezahlt";
            btnText = "Bezahlt";
        } else if(status === "Bezahlt") {
            cardStatusClass = "status-bezahlt";
            badgeClass = "badge-bezahlt";
        }

        const card = document.createElement('div');
        card.className = `billing-row ${cardStatusClass}`;

        let html = `
            <div class="billing-info-block">
                <div class="billing-row-title">
                    ${fields.Auftrag || "Unbenannt"}
                </div>
                <div class="billing-row-meta">
                    Erstellt: ${new Date(record.createdTime).toLocaleDateString('de-DE')}
                </div>
            </div>
            
            <div class="billing-financials">
                <div class="amount-main">€ ${betrag}</div>
                <div class="amount-fremdkosten">Fremdkosten: € ${fremdkosten}</div>
            </div>
            
            <div class="action-group">
                <span class="alloc-row-badge ${badgeClass}">${status}</span>
        `;

        if(status !== "Bezahlt") {
            html += `<button class="btn-primary" onclick="updateStatus('${id}', '${nextStatus}')">➔ ${btnText}</button>`;
        }

        // Der originale SSD-Scanner Lösch-Button am rechten Rand
        html += `
                <button class="delete-btn" onclick="deleteOrder('${id}')" title="Auftrag löschen">
                    <svg viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        `;

        card.innerHTML = html;
        orderList.appendChild(card);
    });
}

// --- API: Status updaten ---
window.updateStatus = async function(recordId, newStatus) {
    try {
        await fetch(`${API_URL}/${recordId}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({
                fields: { "Status": newStatus }
            })
        });
        fetchOrders();
    } catch (error) {
        alert("Fehler beim Status-Update.");
    }
}

// --- API: Eintrag löschen ---
window.deleteOrder = async function(recordId) {
    if (!confirm("Möchtest du diesen Auftrag wirklich dauerhaft löschen?")) return;

    try {
        const response = await fetch(`${API_URL}/${recordId}`, {
            method: 'DELETE',
            headers: HEADERS
        });

        if (response.ok) {
            fetchOrders(); // Liste neu laden
        } else {
            alert("Fehler beim Löschen des Auftrags in Airtable.");
        }
    } catch (error) {
        alert("Verbindungsfehler beim Löschen.");
    }
}