// ==================================================== 
// app.js: USER ACTIONS & CONTROLLER HUB (OPTIMIZED)
// ====================================================

document.addEventListener('DOMContentLoaded', () => {

    if (window.DOM.btnNewOrder) {
        window.DOM.btnNewOrder.addEventListener('click', () => {
            document.getElementById('supplier-container').innerHTML = '';
            window.UI.addSupplierRow();
            window.UI.calculateTotalFremdkosten();
            window.DOM.modal.classList.remove('hidden');
        });
    }

    if (window.DOM.btnCancel) {
        window.DOM.btnCancel.addEventListener('click', () => {
            window.DOM.modal.classList.add('hidden');
            window.DOM.formNewOrder.reset();
        });
    }

    if (window.DOM.btnManageSuppliers) {
        window.DOM.btnManageSuppliers.addEventListener('click', () => {
            window.UI.renderSuppliersManager();
            window.DOM.modalSuppliers.classList.remove('hidden');
        });
    }
    if (window.DOM.btnCloseSuppliers) {
        window.DOM.btnCloseSuppliers.addEventListener('click', () => window.DOM.modalSuppliers.classList.add('hidden'));
    }

    if (window.DOM.formNewOrder) {
        window.DOM.formNewOrder.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('input-name').value;
            const betrag = parseFloat(document.getElementById('input-betrag').value || 0);

            const suppliers = [];
            const rows = document.querySelectorAll('.supplier-row');
            rows.forEach(row => {
                const suppName = row.querySelector('.supplier-name').value.trim();
                const suppAmount = parseFloat(row.querySelector('.supplier-amount').value) || 0;
                if (suppName !== '' || suppAmount > 0) {
                    suppliers.push({ name: suppName || "Unbekannt", amount: suppAmount, paid: false });
                }
            });

            const newSuppliersToSave = [];
            suppliers.forEach(s => {
                const alreadyExists = window.globalSuppliers.some(g => g.name.toLowerCase() === s.name.toLowerCase());
                if (s.name !== "Unbekannt" && s.name.trim() !== "" && !alreadyExists) {
                    newSuppliersToSave.push({ fields: { "Name": s.name } });
                }
            });

            if (newSuppliersToSave.length > 0) {
                try {
                    const resData = await window.API.saveSuppliers(newSuppliersToSave);
                    if (resData && resData.records) {
                        resData.records.forEach(r => {
                            window.globalSuppliers.push({ id: r.id, name: r.fields.Name });
                        });
                    }
                } catch (err) {
                    alert("Netzwerkfehler: Lieferanten konnten nicht gespeichert werden.");
                    return;
                }
            }

            const totalFremdkosten = window.UI.calculateTotalFremdkosten();
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
                // Senden & Antwort direkt lokal verwenden (KEIN neuer GET-Call!)
                const createdData = await window.API.saveOrder(payload);
                if (createdData && createdData.records && createdData.records.length > 0) {
                    window.loadedRecords.unshift(createdData.records[0]); // An den Anfang der Liste schieben
                    window.UI.updateSupplierDatalist();
                    window.UI.renderOrders(window.loadedRecords);
                }
                window.DOM.modal.classList.add('hidden');
                window.DOM.formNewOrder.reset();
            } catch (error) {
                alert("Fehler beim Erstellen des Auftrags.");
            }
        });
    }

    const btnAddSupplier = document.getElementById('btn-add-supplier');
    if (btnAddSupplier) btnAddSupplier.addEventListener('click', () => window.UI.addSupplierRow());

    if (window.DOM.searchInput) {
        window.DOM.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            window.DOM.searchClearBtn.style.display = query.length > 0 ? 'flex' : 'none';

            const filtered = window.loadedRecords.filter(record => {
                const orderName = (record.fields.Auftrag || "").toLowerCase();
                const detailsStr = (record.fields.Fremdkosten_Details || "").toLowerCase();
                return orderName.includes(query) || detailsStr.includes(query);
            });
            window.UI.renderOrders(filtered);
        });
    }

    if (window.DOM.searchClearBtn) {
        window.DOM.searchClearBtn.addEventListener('click', () => {
            window.DOM.searchInput.value = '';
            window.DOM.searchClearBtn.style.display = 'none';
            window.UI.renderOrders(window.loadedRecords);
            window.DOM.searchInput.focus();
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

// Nur beim allerersten Öffnen der App aufrufen!
async function fetchOrders() {
    if (!window.AIRTABLE_TOKEN || !window.BASE_ID) {
        window.UI.showSetupRequired();
        return;
    }

    if (window.loadedRecords.length === 0) {
        window.DOM.loading.classList.remove('hidden');
        window.DOM.orderList.innerHTML = '';
    }

    try {
        const dataOrders = await window.API.fetchOrders();
        window.loadedRecords = dataOrders.records || [];

        try {
            const dataSuppliers = await window.API.fetchSuppliers();
            if (dataSuppliers.records) {
                window.globalSuppliers = dataSuppliers.records.map(r => ({ id: r.id, name: r.fields.Name })).filter(s => s.name);
            }
        } catch (e) {
            console.warn("Lieferanten-Tabelle konnte nicht geladen werden.");
        }

        window.UI.updateSupplierDatalist();
        window.UI.renderOrders(window.loadedRecords);
    } catch (error) {
        console.error("Kritischer Terminal-Fehler:", error);
        window.DOM.orderList.innerHTML = `
            <div style="padding: 24px; background: rgba(231, 76, 60, 0.03); border: 1px dashed rgba(231, 76, 60, 0.3); border-radius: 12px;">
                <h3 style="color: #e74c3c; margin: 0 0 8px 0; font-size: 1rem; font-weight: 800; letter-spacing: 0.5px;">SYSTEM_CRASH // DIAGNOSTIC_ALERT</h3>
                <p style="color: #a0aec0; font-size: 0.82rem; margin: 0 0 16px 0; line-height: 1.4;">Der Abruf wurde blockiert. Das kann an fehlerhaften Keys liegen, oder an einem unhandled JavaScript-Fehler im Renderer:</p>
                <code style="display: block; background: #1c1c1c; border: 1px solid rgba(255,255,255,0.05); padding: 12px; color: #ef4444; font-size: 0.75rem; border-left: 3px solid #e74c3c; overflow-x: auto; white-space: pre-wrap; font-family: monospace;">${error.stack || error.message}</code>
            </div>
        `;
    } finally {
        window.DOM.loading.classList.add('hidden');
    }
}

// Sparsames Status-Update: Genau 1 PATCH Call, 0 GET Calls
window.changeOrderStatus = async function(recordId, newStatus) {
    const record = window.loadedRecords.find(r => r.id === recordId);
    if (record) {
        record.fields.Status = newStatus;
        window.UI.renderOrders(window.loadedRecords);
    }

    try {
        await window.API.updateOrderStatus(recordId, newStatus);
        // Kein Re-Fetch notwendig! Der lokale Speicher ist bereits korrekt.
    } catch (error) {
        alert("Fehler beim Status-Update.");
        fetchOrders(); // Nur im echten Fehlerfall als Fallback neu laden
    }
};

// Sparsamer Checkbox-Toggle: Genau 1 PATCH Call, 0 GET Calls
window.toggleSupplierPaid = async function(orderId, supplierIndex) {
    const record = window.loadedRecords.find(r => r.id === orderId);
    if (!record || !record.fields.Fremdkosten_Details) return;

    try {
        const details = JSON.parse(record.fields.Fremdkosten_Details);
        details[supplierIndex].paid = !details[supplierIndex].paid;

        record.fields.Fremdkosten_Details = JSON.stringify(details);
        window.UI.renderOrders(window.loadedRecords);

        await fetch(`${window.API_URL_ORDERS}/${orderId}`, {
            method: 'PATCH',
            headers: window.HEADERS,
            body: JSON.stringify({ fields: { "Fremdkosten_Details": record.fields.Fremdkosten_Details } })
        });
        // Kein Re-Fetch notwendig!
    } catch (error) {
        alert("Fehler beim Aktualisieren des Lieferanten-Zahlungsstatus.");
        fetchOrders();
    }
};

// Effiziente Massen-Abgeltung: Bündelt Updates in 1 Call pro 10 Einträge
window.bulkPaySupplier = async function(supplierName) {
    if (!confirm(`Möchtest du wirklich alle offenen Rechnungen für "${supplierName}" auf einmal als erledigt markieren?`)) return;

    const updates = [];

    window.loadedRecords.forEach(record => {
        if (record.fields.Fremdkosten_Details) {
            try {
                const details = JSON.parse(record.fields.Fremdkosten_Details);
                let mutated = false;

                details.forEach(d => {
                    if (d.name.trim().toLowerCase() === supplierName.toLowerCase().trim() && !d.paid) {
                        d.paid = true;
                        mutated = true;
                    }
                });

                if (mutated) {
                    const jsonStr = JSON.stringify(details);
                    updates.push({ id: record.id, fields: { "Fremdkosten_Details": jsonStr } });
                    record.fields.Fremdkosten_Details = jsonStr;
                }
            } catch (e) {}
        }
    });

    window.UI.renderOrders(window.loadedRecords);

    try {
        // Updates in 10er-Blöcke teilen und per Batch-PATCH schicken
        for (let i = 0; i < updates.length; i += 10) {
            const batch = updates.slice(i, i + 10);
            await window.API.batchUpdateOrders(batch);
        }
        // Kein Re-Fetch notwendig!
    } catch (error) {
        alert("Massen-Update fehlgeschlagen.");
        fetchOrders();
    }
};

window.deleteSupplier = async function(supplierId, supplierName) {
    if (!confirm(`Möchtest du "${supplierName}" dauerhaft aus der Lieferanten-Datenbank löschen?`)) return;

    try {
        await window.API.deleteSupplierFromAirtable(supplierId);
        window.globalSuppliers = window.globalSuppliers.filter(s => s.id !== supplierId);
        window.UI.renderSuppliersManager();
        window.UI.updateSupplierDatalist();
        window.UI.renderOrders(window.loadedRecords);
    } catch (error) {
        alert("Lieferant konnte nicht gelöscht werden.");
    }
};

window.deleteOrder = async function(recordId) {
    if (!confirm("Auftrag wirklich dauerhaft löschen?")) return;

    const row = window.DOM.orderList.querySelector(`.billing-row[data-id="${recordId}"]`);
    if (row) row.classList.add('row-exit-active');

    try {
        await window.API.deleteOrder(recordId);
        window.loadedRecords = window.loadedRecords.filter(r => r.id !== recordId);
        window.UI.renderOrders(window.loadedRecords);
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