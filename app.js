// ==================================================== 
// app.js: USER ACTIONS & CONTROLLER HUB
// ==================================================== 

document.addEventListener('DOMContentLoaded', () => {

    // Setup-Events binden
    if (DOM.btnNewOrder) {
        DOM.btnNewOrder.addEventListener('click', () => {
            document.getElementById('supplier-container').innerHTML = '';
            UI.addSupplierRow();
            UI.calculateTotalFremdkosten();
            DOM.modal.classList.remove('hidden');
        });
    }

    if (DOM.btnCancel) {
        DOM.btnCancel.addEventListener('click', () => {
            DOM.modal.classList.add('hidden');
            DOM.formNewOrder.reset();
        });
    }

    // Modal Lieferanten-Verwaltung anbinden
    if (DOM.btnManageSuppliers) {
        DOM.btnManageSuppliers.addEventListener('click', () => {
            UI.renderSuppliersManager();
            DOM.modalSuppliers.classList.remove('hidden');
        });
    }
    if (DOM.btnCloseSuppliers) {
        DOM.btnCloseSuppliers.addEventListener('click', () => DOM.modalSuppliers.classList.add('hidden'));
    }

    if (DOM.formNewOrder) {
        DOM.formNewOrder.addEventListener('submit', async (e) => {
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
                const alreadyExists = window.globalSuppliers.some(g => g.name.toLowerCase() === s.name.toLowerCase());
                if (s.name !== "Unbekannt" && s.name.trim() !== "" && !alreadyExists) {
                    newSuppliersToSave.push({ fields: { "Name": s.name } });
                }
            });

            // 2. Lieferanten in Airtable abspeichern (Mit ID-Caching!)
            if (newSuppliersToSave.length > 0) {
                try {
                    const resData = await API.saveSuppliers(newSuppliersToSave);
                    if (resData && resData.records) {
                        resData.records.forEach(r => {
                            window.globalSuppliers.push({ id: r.id, name: r.fields.Name });
                        });
                    }
                } catch (err) {
                    alert("Netzwerkfehler: Lieferanten konnten nicht dauerhaft gespeichert werden.");
                    return;
                }
            }

            const totalFremdkosten = UI.calculateTotalFremdkosten();
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
                await API.saveOrder(payload);
                DOM.modal.classList.add('hidden');
                DOM.formNewOrder.reset();
                fetchOrders();
            } catch (error) {
                alert("Fehler beim Erstellen des Auftrags.");
            }
        });
    }

    const btnAddSupplier = document.getElementById('btn-add-supplier');
    if (btnAddSupplier) btnAddSupplier.addEventListener('click', () => UI.addSupplierRow());

    // Live-Suche
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            DOM.searchClearBtn.style.display = query.length > 0 ? 'flex' : 'none';

            const filtered = window.loadedRecords.filter(record => {
                const orderName = (record.fields.Auftrag || "").toLowerCase();
                const detailsStr = (record.fields.Fremdkosten_Details || "").toLowerCase();
                return orderName.includes(query) || detailsStr.includes(query);
            });
            UI.renderOrders(filtered);
        });
    }

    if (DOM.searchClearBtn) {
        DOM.searchClearBtn.addEventListener('click', () => {
            DOM.searchInput.value = '';
            DOM.searchClearBtn.style.display = 'none';
            UI.renderOrders(window.loadedRecords);
            DOM.searchInput.focus();
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

    fetchOrders();
});

async function fetchOrders() {
    if (!window.AIRTABLE_TOKEN || !window.BASE_ID) {
        UI.showSetupRequired();
        return;
    }

    if (window.loadedRecords.length === 0) {
        DOM.loading.classList.remove('hidden');
        DOM.orderList.innerHTML = '';
    }

    try {
        const dataOrders = await API.fetchOrders();
        window.loadedRecords = dataOrders.records || [];

        try {
            const dataSuppliers = await API.fetchSuppliers();
            if (dataSuppliers.records) {
                window.globalSuppliers = dataSuppliers.records.map(r => ({ id: r.id, name: r.fields.Name })).filter(s => s.name);
            }
        } catch (e) {
            console.warn("Lieferanten-Tabelle konnte im Hintergrund nicht geladen werden.");
        }

        UI.updateSupplierDatalist();
        UI.renderOrders(window.loadedRecords);
    } catch (error) {
        DOM.orderList.innerHTML = `<p style="color:#e74c3c; padding: 20px;">Verbindungsfehler zu Airtable. Schlüssel korrekt?</p>`;
    } finally {
        DOM.loading.classList.add('hidden');
    }
}

// --- OPTIMISTIC UI: Status flexibel anpassen & zurücksetzen ---
window.changeOrderStatus = async function(recordId, newStatus) {
    const record = window.loadedRecords.find(r => r.id === recordId);
    if (record) {
        record.fields.Status = newStatus;
        UI.renderOrders(window.loadedRecords); // Sofortige lokale Aktualisierung
    }

    try {
        await API.updateOrderStatus(recordId, newStatus);
        // Hintergrund-Sync zur Verifizierung
        const data = await API.fetchOrders();
        window.loadedRecords = data.records || [];
        UI.renderOrders(window.loadedRecords);
    } catch (error) {
        alert("Fehler beim Status-Update.");
        fetchOrders(); // Rollback
    }
};

// --- OPTIMISTIC UI: Lieferant löschen ---
window.deleteSupplier = async function(supplierId, supplierName) {
    if (!confirm(`Möchtest du "${supplierName}" dauerhaft aus der Lieferanten-Datenbank löschen?`)) return;

    try {
        await API.deleteSupplierFromAirtable(supplierId);
        window.globalSuppliers = window.globalSuppliers.filter(s => s.id !== supplierId);
        UI.renderSuppliersManager();
        UI.updateSupplierDatalist();
        UI.renderOrders(window.loadedRecords); // Berechnet die Supplier-Summen neu
    } catch (error) {
        alert("Lieferant konnte nicht gelöscht werden.");
    }
};

// --- OPTIMISTIC UI: Zeile sofort herausschrumpfen ---
window.deleteOrder = async function(recordId) {
    if (!confirm("Auftrag wirklich dauerhaft löschen?")) return;

    const row = DOM.orderList.querySelector(`.billing-row[data-id="${recordId}"]`);
    if (row) row.classList.add('row-exit-active');

    try {
        await API.deleteOrder(recordId);
        window.loadedRecords = window.loadedRecords.filter(r => r.id !== recordId);
        UI.renderOrders(window.loadedRecords);
    } catch (error) {
        alert("Fehler beim Löschen.");
        fetchOrders();
    }
};

window.triggerSetup = function() {
    const tokenInput = prompt("Einrichtung: Airtable Token (pat...):");
    const baseIdInput = prompt("Einrichtung: Airtable Base-ID (app...):");
    if (tokenInput && baseIdInput) {
        localStorage.setItem('MNAU_AIRTABLE_TOKEN', tokenInput.trim());
        localStorage.setItem('MNAU_BASE_ID', baseIdInput.trim());
        location.reload();
    }
};