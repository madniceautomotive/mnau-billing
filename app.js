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
        alert("Fehlende Anmeldedaten. Die App kann ohne diese Keys nicht geladen werden. Bitte lade die Seite neu.");
    }
}

const API_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;
const HEADERS = {
    "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
};

// UI Elemente
const orderList = document.getElementById('order-list');
const loading = document.getElementById('loading');
const modal = document.getElementById('modal-overlay');
const btnNewOrder = document.getElementById('btn-new-order');
const btnCancel = document.getElementById('btn-cancel');
const formNewOrder = document.getElementById('form-new-order');

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
        renderOrders(data.records);
    } catch (error) {
        console.error("Fehler beim Laden:", error);
        orderList.innerHTML = `<p style="color:#fc8181">Verbindungsfehler zu Airtable. Schlüssel korrekt?</p>`;
    } finally {
        loading.classList.add('hidden');
    }
}

// --- UI: Aufträge zeichnen ---
function renderOrders(records) {
    if(!records || records.length === 0) {
        orderList.innerHTML = '<p>Keine Aufträge vorhanden.</p>';
        return;
    }

    records.forEach(record => {
        const fields = record.fields;
        const id = record.id;
        const status = fields.Status || "Zu verrechnen";
        const betrag = fields.Betrag_Automotive ? fields.Betrag_Automotive.toFixed(2) : "0.00";
        const fremdkosten = fields.Fremdkosten ? fields.Fremdkosten.toFixed(2) : "0.00";

        let cardClass = "status-zu-verrechnen";
        let badgeClass = "bg-red";
        let nextStatus = "An Group verrechnet";
        let btnText = "Markieren als: An Group verrechnet";

        if(status === "An Group verrechnet") {
            cardClass = "status-verrechnet";
            badgeClass = "bg-yellow";
            nextStatus = "Bezahlt";
            btnText = "Markieren als: Bezahlt durch Group";
        } else if(status === "Bezahlt") {
            cardClass = "status-bezahlt";
            badgeClass = "bg-green";
        }

        const card = document.createElement('div');
        card.className = `order-card ${cardClass}`;

        let html = `
            <span class="status-badge ${badgeClass}">${status}</span>
            <h3>${fields.Auftrag || "Unbenannt"}</h3>
            <p>Erstellt am: ${new Date(record.createdTime).toLocaleDateString('de-DE')}</p>
            <div class="amount">Automotive-Anteil: € ${betrag}</div>
            <div class="fremdkosten">Davon Fremdkosten: € ${fremdkosten}</div>
        `;

        if(status !== "Bezahlt") {
            html += `<button class="btn-status-change" onclick="updateStatus('${id}', '${nextStatus}')">${btnText}</button>`;
        }

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
        alert("Fehler beim Update des Status.");
    }
}

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
        alert("Fehler beim Speichern.");
    }
});