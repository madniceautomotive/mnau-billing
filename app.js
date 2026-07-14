let AIRTABLE_TOKEN = localStorage.getItem('MNAU_AIRTABLE_TOKEN');
let BASE_ID = localStorage.getItem('MNAU_BASE_ID');

let API_URL_ORDERS = "";
let API_URL_SUPPLIERS = "";
let HEADERS = {};

if (AIRTABLE_TOKEN && BASE_ID) {
    API_URL_ORDERS = `https://api.airtable.com/v0/${BASE_ID}/Auftraege`;
    API_URL_SUPPLIERS = `https://api.airtable.com/v0/${BASE_ID}/Lieferanten`;
    HEADERS = {
        "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
    };
}

let loadedRecords = [];
let globalSuppliers = []; // Unzerstörbares Lieferanten-Gedächtnis

const orderList = document.getElementById('order-list');
const loading = document.getElementById('loading');
const modal = document.getElementById('modal-overlay');
const btnNewOrder = document.getElementById('btn-new-order');
const btnCancel = document.getElementById('btn-cancel');
const formNewOrder = document.getElementById('form-new-order');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');

document.addEventListener('DOMContentLoaded', () => {

    if (btnNewOrder) {
        btnNewOrder.addEventListener('click', () => {
            document.getElementById('supplier-container').innerHTML = '';
            addSupplierRow();
            calculateTotalFremdkosten();
            modal.classList.remove('hidden');
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
            formNewOrder.reset();
        });
    }

    const btnResetKeys = document.getElementById('btn-reset-keys');
    if (btnResetKeys) {
        btnResetKeys.addEventListener('click', () => {
            if (confirm("Möchtest du die Airtable-Schlüssel zurücksetzen?")) {
                localStorage.removeItem('MNAU_AIRTABLE_TOKEN');
                localStorage.removeItem('MNAU_BASE_ID');
                location.reload();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            searchClearBtn.style.display = query.length > 0 ? 'flex' : 'none';

            const filtered = loadedRecords.filter(record => {
                const orderName = (record.fields.Auftrag || "").toLowerCase();
                const detailsStr = (record.fields.Fremdkosten_Details || "").toLowerCase();
                return orderName.includes(query) || detailsStr.includes(query);
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

    if (formNewOrder) {
        formNewOrder.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('input-name').value;
            const betrag = parseFloat(document.getElementById('input-betrag').value || 0);

            const suppliers = [];
            const rows = document.querySelectorAll('.supplier-row');
            rows.forEach(row => {
                const suppName = row.querySelector('.supplier-name').value.trim();
                const suppAmount = parseFloat(row.querySelector('.supplier-amount').value) || 0;
                if (suppName !== '' || suppAmount > 0) {
                    suppliers.push({ name: suppName || "Unbekannt", amount: suppAmount });
                }
            });

            // 1. Unbekannte Lieferanten filtern
            const newSuppliersToSave = [];
            suppliers.forEach(s => {
                const alreadyExists = globalSuppliers.some(g => g.toLowerCase() === s.name.toLowerCase());
                if (s.name !== "Unbekannt" && s.name.trim() !== "" && !alreadyExists) {
                    newSuppliersToSave.push({ fields: { "Name": s.name } });
                }
            });

            // 2. Lieferanten in Airtable abspeichern (Wartet synchron)
            if (newSuppliersToSave.length > 0) {
                try {
                    const resSupp = await fetch(API_URL_SUPPLIERS, {
                        method: 'POST',
                        headers: HEADERS,
                        body: JSON.stringify({ records: newSuppliersToSave })
                    });

                    if (!resSupp.ok) {
                        const errData = await resSupp.json();
                        alert(`Airtable lehnt das Speichern der Lieferanten ab!\n\nFehlermeldung: "${errData.error?.message}"`);
                        return;
                    } else {
                        newSuppliersToSave.forEach(s => globalSuppliers.push(s.fields.Name));
                    }
                } catch (err) {
                    alert("Netzwerkfehler: Lieferanten konnten nicht dauerhaft gespeichert werden.");
                    return;
                }
            }

            const totalFremdkosten = calculateTotalFremdkosten();
            const suppliersJSON = JSON.stringify(suppliers);

            const payload = {
                records: [{
                    fields: {
                        "Auftrag": name,
                        "Betrag_Automotive": betrag,
                        "Fremdkosten": totalFremdkosten,
                        "Fremdkosten_Details": suppliersJSON,
                        "Status": "Zu verrechnen"
                    }
                }]
            };

            try {
                const resOrder = await fetch(API_URL_ORDERS, { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
                if (!resOrder.ok) {
                    const errData = await resOrder.json();
                    alert(`Fehler beim Speichern des Auftrags:\n${errData.error?.message}`);
                    return;
                }
                modal.classList.add('hidden');
                formNewOrder.reset();
                fetchOrders(); // Silent Sync lädt den neuen Auftrag sanft ein
            } catch (error) {
                alert("Verbindungsfehler beim Erstellen des Auftrags.");
            }
        });
    }

    const btnAddSupplier = document.getElementById('btn-add-supplier');
    if (btnAddSupplier) {
        btnAddSupplier.addEventListener('click', () => addSupplierRow());
    }

    fetchOrders();
});

async function fetchOrders() {
    if (!AIRTABLE_TOKEN || !BASE_ID) {
        showSetupRequired();
        return;
    }

    // SILENT REFRESH: Spinner nur zeigen, wenn die Liste noch komplett leer ist!
    if (loadedRecords.length === 0) {
        loading.classList.remove('hidden');
        orderList.innerHTML = '';
    }

    try {
        const responseOrders = await fetch(`${API_URL_ORDERS}?sort[0][field]=Created%20Time&sort[0][direction]=desc`, { headers: HEADERS });
        const dataOrders = await responseOrders.json();
        loadedRecords = dataOrders.records || [];

        try {
            const responseSuppliers = await fetch(API_URL_SUPPLIERS, { headers: HEADERS });
            if (responseSuppliers.ok) {
                const dataSuppliers = await responseSuppliers.json();
                if (dataSuppliers.records) {
                    globalSuppliers = dataSuppliers.records.map(r => r.fields.Name).filter(n => n);
                }
            }
        } catch (e) {
            console.warn("Lieferanten-Tabelle konnte im Hintergrund nicht geladen werden.");
        }

        updateSupplierDatalist();
        renderOrders(loadedRecords);
    } catch (error) {
        orderList.innerHTML = `<p style="color:#e74c3c; padding: 20px;">Verbindungsfehler zu Airtable. Schlüssel korrekt?</p>`;
    } finally {
        loading.classList.add('hidden');
    }
}

function updateSupplierDatalist() {
    const datalist = document.getElementById('supplier-list');
    if (!datalist) return;
    datalist.innerHTML = '';

    const uniqueSuppliers = new Set(globalSuppliers);
    loadedRecords.forEach(record => {
        if (record.fields.Fremdkosten_Details) {
            try {
                const details = JSON.parse(record.fields.Fremdkosten_Details);
                details.forEach(d => {
                    if (d.name && d.name.trim() !== '') uniqueSuppliers.add(d.name.trim());
                });
            } catch (e) {}
        }
    });

    Array.from(uniqueSuppliers).sort().forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier;
        datalist.appendChild(option);
    });
}

function addSupplierRow() {
    const container = document.getElementById('supplier-container');
    const row = document.createElement('div');
    row.className = 'supplier-row';

    row.innerHTML = `
        <input type="text" class="search-input supplier-name" list="supplier-list" placeholder="Lieferant...">
        <input type="number" step="0.01" class="search-input supplier-amount" placeholder="0.00">
        <button type="button" class="btn-remove-supplier" title="Entfernen">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
    `;

    row.querySelector('.btn-remove-supplier').addEventListener('click', () => {
        row.remove();
        calculateTotalFremdkosten();
    });
    row.querySelector('.supplier-amount').addEventListener('input', calculateTotalFremdkosten);
    container.appendChild(row);
}

function calculateTotalFremdkosten() {
    let total = 0;
    document.querySelectorAll('.supplier-amount').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    document.getElementById('display-total-fremdkosten').textContent = total.toFixed(2);
    return total;
}

function showSetupRequired() {
    loading.classList.add('hidden');
    orderList.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #a0aec0;">
            <h3 style="color: white; margin-bottom: 12px; text-transform: uppercase;">Konfiguration fehlt</h3>
            <button class="btn-primary" style="margin: 0 auto;" onclick="triggerSetup()">➔ Setup starten</button>
        </div>
    `;
}
window.triggerSetup = function() {
    const tokenInput = prompt("Einrichtung: Airtable Token (pat...):");
    const baseIdInput = prompt("Einrichtung: Airtable Base-ID (app...):");
    if (tokenInput && baseIdInput) {
        localStorage.setItem('MNAU_AIRTABLE_TOKEN', tokenInput.trim());
        localStorage.setItem('MNAU_BASE_ID', baseIdInput.trim());
        location.reload();
    }
}

function updateSummary(records) {
    let sumZuVerrechnen = 0;
    let sumAnGroup = 0;
    let sumFremdkosten = 0;
    let sumAutomotiveGesamt = 0;

    records.forEach(record => {
        const fields = record.fields;
        const status = fields.Status || "Zu verrechnen";
        const betrag = parseFloat(fields.Betrag_Automotive) || 0;
        const fremd = parseFloat(fields.Fremdkosten) || 0;

        sumAutomotiveGesamt += betrag;
        sumFremdkosten += fremd;

        if (status === "Zu verrechnen") sumZuVerrechnen += betrag;
        if (status === "An Group verrechnet") sumAnGroup += betrag;
    });

    const summaryContainer = document.getElementById('dashboard-summary');
    if(!summaryContainer) return;

    summaryContainer.innerHTML = `
        <div class="summary-card green">
            <span class="summary-label">MNAU Umsatz Gesamt</span>
            <span class="summary-value">€ ${sumAutomotiveGesamt.toFixed(2)}</span>
        </div>
        <div class="summary-card red">
            <span class="summary-label">Zu verrechnen</span>
            <span class="summary-value">€ ${sumZuVerrechnen.toFixed(2)}</span>
        </div>
        <div class="summary-card yellow">
            <span class="summary-label">Wartet auf Zahlung Group</span>
            <span class="summary-value">€ ${sumAnGroup.toFixed(2)}</span>
        </div>
        <div class="summary-card orange">
            <span class="summary-label">Fremdkosten Gesamt</span>
            <span class="summary-value">€ ${sumFremdkosten.toFixed(2)}</span>
        </div>
    `;
}

function updateSupplierBreakdown(records) {
    const supplierContainer = document.getElementById('supplier-summary-details');
    if (!supplierContainer) return;

    const openSuppliers = {};

    records.forEach(record => {
        const fields = record.fields;
        const status = fields.Status || "Zu verrechnen";
        const orderName = fields.Auftrag || "Unbenanntes Projekt";

        if (status !== "Bezahlt" && fields.Fremdkosten_Details) {
            try {
                const details = JSON.parse(fields.Fremdkosten_Details);
                details.forEach(d => {
                    const name = (d.name || "Unbekannt").trim();
                    const amount = parseFloat(d.amount) || 0;

                    if (amount > 0) {
                        if (!openSuppliers[name]) {
                            openSuppliers[name] = { total: 0, items: [] };
                        }
                        openSuppliers[name].total += amount;
                        openSuppliers[name].items.push({ order: orderName, amount: amount });
                    }
                });
            } catch (e) {
                console.error("Fehler beim Parsen der Fremdkosten-Details:", e);
            }
        }
    });

    const supplierNames = Object.keys(openSuppliers);

    if (supplierNames.length === 0) {
        supplierContainer.innerHTML = `
            <div style="grid-column: 1/-1; padding: 16px; color: #666; font-size: 0.8rem; text-align: center; border: 1px dashed rgba(255,255,255,0.05); border-radius: 8px; letter-spacing: 0.5px;">
                NO_ACTIVE_SUPPLIER_DEBTS
            </div>
        `;
        return;
    }

    let html = '';
    supplierNames.forEach(name => {
        const data = openSuppliers[name];
        html += `
            <div class="supplier-stat-card" data-supplier="${name}">
                <div class="supplier-stat-header">
                    <span class="supplier-stat-name">${name}</span>
                    <span class="supplier-stat-total">€ ${data.total.toFixed(2)}</span>
                </div>
        `;
        data.items.forEach(item => {
            html += `
                <div class="supplier-stat-item">
                    <span>↳ ${item.order}</span>
                    <span>€ ${item.amount.toFixed(2)}</span>
                </div>
            `;
        });
        html += `</div>`;
    });

    supplierContainer.innerHTML = html;
}

// --- SYSTEM-INTELLIGENTES DOM-DIFFING RE-RENDERING (NEW) ---
function renderOrders(records) {
    updateSummary(records);
    updateSupplierBreakdown(records);

    if(!records || records.length === 0) {
        orderList.innerHTML = '<p style="color:#a0aec0; padding: 20px;">Keine passenden Aufträge vorhanden.</p>';
        return;
    }

    // Statischen Fehlertext entfernen, falls nötig
    if (orderList.querySelector('p')) {
        orderList.innerHTML = '';
    }

    const incomingIds = new Set(records.map(r => r.id));

    // 1. Gelöschte Zeilen butterweich herausschrumpfen lassen
    const currentRows = Array.from(orderList.querySelectorAll('.billing-row'));
    currentRows.forEach(row => {
        const rowId = row.getAttribute('data-id');
        if (!incomingIds.has(rowId)) {
            row.classList.add('row-exit-active');
            setTimeout(() => row.remove(), 400); // Exakt nach der CSS-Animation löschen
        }
    });

    // 2. Bestehende Zeilen aktualisieren (ohne Löschen!) oder neue einfliegen lassen
    records.forEach((record, index) => {
        const fields = record.fields;
        const id = record.id;
        const status = fields.Status || "Zu verrechnen";
        const betrag = fields.Betrag_Automotive ? fields.Betrag_Automotive.toFixed(2) : "0.00";
        const fremdkosten = fields.Fremdkosten ? fields.Fremdkosten.toFixed(2) : "0.00";

        let breakdownHTML = '';
        if (fields.Fremdkosten_Details) {
            try {
                const details = JSON.parse(fields.Fremdkosten_Details);
                if (details.length > 0) {
                    breakdownHTML = `<div class="breakdown-container">`;
                    details.forEach(d => {
                        breakdownHTML += `
                            <div class="breakdown-row">
                                <span>↳ ${d.name}</span>
                                <span>€ ${d.amount.toFixed(2)}</span>
                            </div>
                        `;
                    });
                    breakdownHTML += `</div>`;
                }
            } catch(e) {}
        }

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

        let actionHTML = '';
        if(status !== "Bezahlt") {
            actionHTML = `<button class="btn-primary" onclick="updateStatus('${id}', '${nextStatus}')">➔ ${btnText}</button>`;
        }

        const innerHTML = `
            <div class="billing-info-block">
                <div class="billing-row-title">${fields.Auftrag || "Unbenannt"}</div>
                <div class="billing-row-meta">Erstellt: ${new Date(record.createdTime).toLocaleDateString('de-DE')}</div>
            </div>
            
            <div class="billing-financials">
                <div class="amount-main">€ ${betrag}</div>
                <div class="amount-fremdkosten">Gesamt Fremdkosten: € ${fremdkosten}</div>
                ${breakdownHTML}
            </div>
            
            <div class="action-group">
                <span class="alloc-row-badge ${badgeClass}">${status}</span>
                ${actionHTML}
                <button class="delete-btn" onclick="deleteOrder('${id}')" title="Auftrag löschen">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;

        let existingRow = orderList.querySelector(`.billing-row[data-id="${id}"]`);

        if (existingRow) {
            // Verhindert Flackern: Nur austauschen, wenn sich inhaltlich etwas geändert hat!
            const cleanExisting = existingRow.innerHTML.replace(/\s+/g, ' ').trim();
            const cleanIncoming = innerHTML.replace(/\s+/g, ' ').trim();

            if (cleanExisting !== cleanIncoming) {
                existingRow.innerHTML = innerHTML;
            }

            // Weicher Farbübergang für den linken Rand wird ausgelöst:
            existingRow.className = `billing-row ${cardStatusClass}`;
        } else {
            // Neue Zeile erstellen & einfliegen lassen
            const newRow = document.createElement('div');
            newRow.className = `billing-row ${cardStatusClass} row-enter-active`;
            newRow.setAttribute('data-id', id);
            newRow.innerHTML = innerHTML;

            const referenceNode = orderList.children[index];
            if (referenceNode) {
                orderList.insertBefore(newRow, referenceNode);
            } else {
                orderList.appendChild(newRow);
            }
        }
    });
}

// --- OPTIMISTIC UI: Status sofort anpassen ---
window.updateStatus = async function(recordId, newStatus) {
    const record = loadedRecords.find(r => r.id === recordId);
    if (record) {
        record.fields.Status = newStatus;
        renderOrders(loadedRecords); // Sofortige lokale Aktualisierung!
    }

    try {
        await fetch(`${API_URL_ORDERS}/${recordId}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ fields: { "Status": newStatus } })
        });
        fetchOrders(); // Silent Refresh im Hintergrund zur Datenvalidierung
    } catch (error) {
        alert("Fehler beim Status-Update.");
        fetchOrders(); // Rollback bei Netzwerkfehler
    }
}

// --- OPTIMISTIC UI: Zeile sofort ausblenden ---
window.deleteOrder = async function(recordId) {
    if (!confirm("Auftrag wirklich dauerhaft löschen?")) return;

    // Sofort lokal ausblenden:
    const row = orderList.querySelector(`.billing-row[data-id="${recordId}"]`);
    if (row) {
        row.classList.add('row-exit-active');
    }

    try {
        const response = await fetch(`${API_URL_ORDERS}/${recordId}`, { method: 'DELETE', headers: HEADERS });
        if (response.ok) {
            loadedRecords = loadedRecords.filter(r => r.id !== recordId);
            renderOrders(loadedRecords); // Ansicht endgültig aktualisieren
        } else {
            alert("Fehler beim Löschen.");
            fetchOrders();
        }
    } catch (error) {
        alert("Verbindungsfehler beim Löschen.");
        fetchOrders();
    }
}