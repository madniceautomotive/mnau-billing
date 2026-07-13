// Wir laden die Keys sicher aus dem Speicher des Browsers
let AIRTABLE_TOKEN = localStorage.getItem('MNAU_AIRTABLE_TOKEN');
let BASE_ID = localStorage.getItem('MNAU_BASE_ID');
const TABLE_NAME = "Auftraege";

// Falls die Schlüssel im Browser noch fehlen, fragen wir sie einmalig ab
if (!AIRTABLE_TOKEN || !BASE_ID) {
    const tokenInput = prompt("Einrichtung: Bitte gib deinen Airtable Token (pat...) ein:");
    const baseIdInput = prompt("Einrichtung: Bitte gib deine Airtable Base-ID (app...) ein:");

    if (tokenInput && baseIdInput) {
        localStorage.setItem('MNAU_AIRTABLE_TOKEN', tokenInput.trim());
        localStorage.setItem('MNAU_BASE_ID', baseIdInput.trim());
        AIRTABLE_TOKEN = tokenInput.trim();
        BASE_ID = baseIdInput.trim();
        alert("Einrichtung erfolgreich! Die App lädt jetzt.");
    } else {
        alert("Fehlende Anmeldedaten. Bitte lade die Seite neu, um es erneut zu versuchen.");
    }
}

const API_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;
const HEADERS = {
    "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
};

// Globale Variable, um geladene Datensätze für die Live-Suche zwischenzuspeichern
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

// App Start
document.addEventListener('DOMContentLoaded', fetchOrders);

// --- API: Aufträge abrufen ---
async function fetchOrders() {
    if (!AIRTABLE_TOKEN || !BASE_ID) return;
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

// --- UI: Aufträge zeichnen ---
function renderOrders(records) {
    orderList.innerHTML = '';

    if(!records || records.length === 0) {
        orderList.innerHTML = '<p style="color:#a0aec0; padding: 20px;">Keine passenden Aufträge gefunden.</p>';
        return;
    }

    records.forEach(record => {
        const fields = record.fields;
        const id = record.id;
        const status = fields.Status || "Zu verrechnen";
        const betrag = fields.Betrag_Automotive ? fields.Betrag_Automotive.toFixed(2) : "0.00";
        const fremdkosten = fields.Fremdkosten ? fields.Fremdkosten.toFixed(2) : "0.00";

        // Status CSS-Klassen bestimmen
        let cardStatusClass = "status-zu-verrechnen";
        let badgeClass = "badge-zu-verrechnen";
        let nextStatus = "An Group verrechnet";
        let btnText = "An Group verrechnet";

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

        // Zeige den Action-Button nur, wenn der Status noch nicht "Bezahlt" ist
        if(status !== "Bezahlt") {
            html += `<button class="btn-primary" onclick="updateStatus('${id}', '${nextStatus}')">➔ ${btnText}</button>`;
        }

        html += `</div>`;
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
        fetchOrders(); // Neu laden
    } catch (error) {
        alert("Fehler beim Status-Update.");
    }
}

// --- Live-Suche Logik ---
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

// Suchfeld leeren
searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    renderOrders(loadedRecords);
    searchInput.focus();
});

// --- Modal Steuerung ---
btnNewOrder.addEventListener('click', () => modal.classList.remove('hidden'));
btnCancel.addEventListener('click', () => {
    modal.classList.add('hidden');
    formNewOrder.reset();
});

// --- API: Neuen Auftrag anlegen ---
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