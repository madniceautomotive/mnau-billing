// ====================================================
// app.js: USER ACTIONS & CONTROLLER HUB
// ====================================================

document.addEventListener('DOMContentLoaded', () => {

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
                    // Jedes Lieferanten-Objekt bekommt standardmäßig "paid: false" mitgegeben
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
                    const resData = await API.saveSuppliers(newSuppliersToSave);
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
            console.warn("Lieferanten-Tabelle konnte nicht geladen werden.");
        }

        UI.updateSupplierDatalist();
        UI.renderOrders(window.loadedRecords);
    } catch (error) {
        DOM.orderList.innerHTML = `<p style="color:#e74c3c; padding: 20px;">Verbindungsfehler zu Airtable. Schlüssel korrekt?</p>`;
    } finally {
        DOM.loading.classList.add('hidden');
    }
}

window.changeOrderStatus = async function(recordId, newStatus) {
    const record = window.loadedRecords.find(r => r.id === recordId);
    if (record) {
        record.fields.Status = newStatus;
        UI.renderOrders(window.loadedRecords);
    }

    try {
        await API.updateOrderStatus(recordId, newStatus);
        const data = await API.fetchOrders();
        window.loadedRecords = data.records || [];
        UI.renderOrders(window.loadedRecords);
    } catch (error) {
        alert("Fehler beim Status-Update.");
        fetchOrders();
    }
};

// --- NEU: Einzelnen Lieferanten-Posten per Checkbox umschalten (Optimistic UI) ---
window.toggleSupplierPaid = async function(orderId, supplierIndex) {
    const record = window.loadedRecords.find(r => r.id === orderId);
    if (!record || !record.fields.Fremdkosten_Details) return;

    try {
        const details = JSON.parse(record.fields.Fremdkosten_Details);
        // Toggle-Zustand umkehren
        details[supplierIndex].paid = !details[supplierIndex].paid;

        // Lokaler Vorab-Sync
        record.fields.Fremdkosten_Details = JSON.stringify(details);
        UI.renderOrders(window.loadedRecords);

        // Airtable synchronisieren
        await fetch(`${window.API_URL_ORDERS}/${orderId}`, {
            method: 'PATCH',
            headers: window.HEADERS,
            body: JSON.stringify({ fields: { "Fremdkosten_Details": record.fields.Fremdkosten_Details } })
        });
    } catch (error) {
        alert("Fehler beim Aktualisieren des Lieferanten-Zahlungsstatus.");
        fetchOrders();
    }
};

// --- NEU: Alle offenen Rechnungen eines Lieferanten auf einmal bezahlen (Bulk Action) ---
window.bulkPaySupplier = async function(supplierName) {
    if (!confirm(`Möchtest du wirklich alle offenen Rechnungen für "${supplierName}" auf einmal als erledigt markieren?`)) return;

    const updates = [];

    // Alle Datensätze nach unbezahlten Posten dieses Lieferanten durchkämmen
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
                    updates.push({ id: record.id, payload: jsonStr });
                    record.fields.Fremdkosten_Details = jsonStr; // Lokale Cache Mutation
                }
            } catch (e) {}
        }
    });

    // Ansicht blitzschnell neu berechnen (Optimistic UI)
    UI.renderOrders(window.loadedRecords);

    // Patch Requests gebündelt an Airtable feuern
    try {
        const queue = updates.map(up => {
            return fetch(`${window.API_URL_ORDERS}/${up.id}`, {
                method: 'PATCH',
                headers: window.HEADERS,
                body: JSON.stringify({ fields: { "Fremdkosten_Details": up.payload } })
            });
        });
        await Promise.all(queue);
        fetchOrders(); // Silent background validation
    } catch (error) {
        alert("Massen-Update fehlgeschlagen.");
        fetchOrders();
    }
};

window.deleteSupplier = async function(supplierId, supplierName) {
    if (!confirm(`Möchtest du "${supplierName}" dauerhaft aus der Lieferanten-Datenbank löschen?`)) return;

    try {
        await API.deleteSupplierFromAirtable(supplierId);
        window.globalSuppliers = window.globalSuppliers.filter(s => s.id !== supplierId);
        UI.renderSuppliersManager();
        UI.updateSupplierDatalist();
        UI.renderOrders(window.loadedRecords);
    } catch (error) {
        alert("Lieferant konnte nicht gelöscht werden.");
    }
};

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