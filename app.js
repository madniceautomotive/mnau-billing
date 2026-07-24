// ==================================================== 
// app.js: USER ACTIONS & CONTROLLER HUB (OPTIMIZED)
// ====================================================

// Globales Tab-Switching
window.switchTab = function(tabName) {
    document.getElementById('view-billing').classList.add('hidden');
    document.getElementById('view-calculator').classList.add('hidden');
    document.getElementById('tab-btn-billing').classList.remove('active');
    document.getElementById('tab-btn-calculator').classList.remove('active');

    const searchRow = document.getElementById('billing-search-row');
    const newOrderBtn = document.getElementById('btn-new-order');
    const manageSuppliersBtn = document.getElementById('btn-manage-suppliers');

    if (tabName === 'billing') {
        document.getElementById('view-billing').classList.remove('hidden');
        document.getElementById('tab-btn-billing').classList.add('active');
        if (searchRow) searchRow.style.display = 'flex';
        if (newOrderBtn) newOrderBtn.style.display = 'flex';
        if (manageSuppliersBtn) manageSuppliersBtn.style.display = 'flex';
    } else if (tabName === 'calculator') {
        document.getElementById('view-calculator').classList.remove('hidden');
        document.getElementById('tab-btn-calculator').classList.add('active');
        if (searchRow) searchRow.style.display = 'none';
        if (newOrderBtn) newOrderBtn.style.display = 'none';
        if (manageSuppliersBtn) manageSuppliersBtn.style.display = 'none';
    }
};

// FIRMEN WECHSELN VIA DROPDOWN
window.switchCompany = function(newCompany) {
    if (!newCompany) return;
    window.currentUserCompany = newCompany.toUpperCase();

    // 1. Auftrags-Log für die neu gewählte Firma rendern
    if (window.loadedRecords && window.UI && window.UI.renderOrders) {
        window.UI.renderOrders(window.loadedRecords);
    }

    // 2. Kalkulator Metriken & Buttons neu berechnen
    if (typeof window.calculate === 'function') {
        window.calculate();
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // Neues Projekt anlegen Modal öffnen
    if (window.DOM.btnNewOrder) {
        window.DOM.btnNewOrder.addEventListener('click', () => {
            document.getElementById('edit-record-id').value = '';
            document.getElementById('modal-main-title').textContent = "Neuen Auftrag erfassen";
            document.getElementById('supplier-container').innerHTML = '';
            document.getElementById('change-reason-group').style.display = 'none';
            document.getElementById('input-change-reason').value = '';

            window.DOM.formNewOrder.reset();
            window.UI.addSupplierRow();
            window.UI.calculateTotalFremdkosten();
            window.DOM.modal.classList.remove('hidden');
        });
    }

    // Modal abbrechen
    if (window.DOM.btnCancel) {
        window.DOM.btnCancel.addEventListener('click', () => {
            window.DOM.modal.classList.add('hidden');
            window.DOM.formNewOrder.reset();
        });
    }

    // Modal Changelog schließen
    const btnCloseChangelog = document.getElementById('btn-close-changelog');
    if (btnCloseChangelog) {
        btnCloseChangelog.addEventListener('click', () => {
            document.getElementById('modal-changelog-overlay').classList.add('hidden');
        });
    }

    // Lieferanten-Verwaltung Modal
    if (window.DOM.btnManageSuppliers) {
        window.DOM.btnManageSuppliers.addEventListener('click', () => {
            window.UI.renderSuppliersManager();
            window.DOM.modalSuppliers.classList.remove('hidden');
        });
    }
    if (window.DOM.btnCloseSuppliers) {
        window.DOM.btnCloseSuppliers.addEventListener('click', () => {
            window.DOM.modalSuppliers.classList.add('hidden');
        });
    }

    // Formular: Neuen oder bearbeiteten Auftrag an Airtable senden
    if (window.DOM.formNewOrder) {
        window.DOM.formNewOrder.addEventListener('submit', async (e) => {
            e.preventDefault();

            const editId = document.getElementById('edit-record-id').value;
            const name = document.getElementById('input-name').value;
            const betrag = parseFloat(document.getElementById('input-betrag').value || 0);
            const changeReason = document.getElementById('input-change-reason').value.trim();

            if (editId && !changeReason) {
                alert("Bitte gib einen kurzen Grund / Kommentar für die Änderung an.");
                document.getElementById('input-change-reason').focus();
                return;
            }

            let existingRecord = null;
            let existingDetails = [];
            let existingGroupMeta = null;
            let existingChangelog = [];

            if (editId) {
                existingRecord = window.loadedRecords.find(r => r.id === editId);
                if (existingRecord) {
                    if (existingRecord.fields.Fremdkosten_Details) {
                        try {
                            const parsed = JSON.parse(existingRecord.fields.Fremdkosten_Details);
                            if (Array.isArray(parsed)) {
                                existingDetails = parsed;
                            } else if (parsed && typeof parsed === 'object') {
                                existingDetails = parsed.suppliers || [];
                                existingGroupMeta = parsed.groupMeta || null;
                            }
                        } catch(e) {}
                    }
                    if (existingRecord.fields.Changelog) {
                        try { existingChangelog = JSON.parse(existingRecord.fields.Changelog); } catch(e) {}
                    }
                }
            }

            const suppliers = [];
            const rows = document.querySelectorAll('.supplier-row');
            rows.forEach(row => {
                const suppName = row.querySelector('.supplier-name').value.trim();
                const suppAmount = parseFloat(row.querySelector('.supplier-amount').value) || 0;
                if (suppName !== '' || suppAmount > 0) {
                    const existing = existingDetails.find(d => d.name.toLowerCase() === suppName.toLowerCase());
                    const isPaid = existing ? existing.paid : false;
                    suppliers.push({ name: suppName || "Unbekannt", amount: suppAmount, paid: isPaid });
                }
            });

            // 1. Unbekannte Lieferanten in Datenbank speichern
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
                        resData.records.forEach(r => window.globalSuppliers.push({ id: r.id, name: r.fields.Name }));
                    }
                } catch (err) {}
            }

            // 2. Auftragsobjekt vorbereiten
            const totalFremdkosten = window.UI.calculateTotalFremdkosten();
            const myCompany = window.currentUserCompany || "MNAU";

            const suppliersPayload = existingGroupMeta ? { suppliers: suppliers, groupMeta: existingGroupMeta } : suppliers;
            const suppliersJSON = JSON.stringify(suppliersPayload);

            if (editId) {
                // -> UPDATE MODUS
                const changes = [];
                if (existingRecord.fields.Auftrag !== name) changes.push(`Name: "${existingRecord.fields.Auftrag}" ➔ "${name}"`);
                if (parseFloat(existingRecord.fields.Betrag_Automotive || 0) !== betrag) changes.push(`Betrag: € ${existingRecord.fields.Betrag_Automotive || 0} ➔ € ${betrag}`);
                if (parseFloat(existingRecord.fields.Fremdkosten || 0) !== totalFremdkosten) changes.push(`Fremdkosten: € ${existingRecord.fields.Fremdkosten || 0} ➔ € ${totalFremdkosten}`);

                const newLogEntry = {
                    user: window.currentUserEmail,
                    timestamp: new Date().toISOString(),
                    action: "Auftrag bearbeitet",
                    comment: changeReason,
                    details: changes.length > 0 ? changes : ["Lieferanten-Details angepasst"]
                };

                existingChangelog.unshift(newLogEntry);

                const updatePayload = {
                    fields: {
                        "Auftrag": name,
                        "Betrag_Automotive": betrag,
                        "Fremdkosten": totalFremdkosten,
                        "Fremdkosten_Details": suppliersJSON,
                        "Flagged": true,
                        "Changelog": JSON.stringify(existingChangelog)
                    }
                };

                try {
                    await window.API.updateOrder(editId, updatePayload);
                    const idx = window.loadedRecords.findIndex(r => r.id === editId);
                    if (idx > -1) {
                        const currentStatus = window.loadedRecords[idx].fields.Status;
                        window.loadedRecords[idx].fields = { ...window.loadedRecords[idx].fields, ...updatePayload.fields, Status: currentStatus };
                    }
                    window.UI.updateSupplierDatalist();
                    window.UI.renderOrders(window.loadedRecords);

                    window.DOM.modal.classList.add('hidden');
                    window.DOM.formNewOrder.reset();
                    document.getElementById('edit-record-id').value = '';
                } catch (error) { alert("Fehler beim Aktualisieren."); }

            } else {
                // -> NEU ERSTELLEN MODUS
                const initialChangelog = [{
                    user: window.currentUserEmail,
                    timestamp: new Date().toISOString(),
                    action: "Auftrag erstellt",
                    comment: "Erstansetzung des Auftrags",
                    details: [`Auftrag "${name}" für € ${betrag.toFixed(2)} angelegt`]
                }];

                const payload = {
                    records: [{
                        fields: {
                            "Auftrag": name,
                            "Betrag_Automotive": betrag,
                            "Fremdkosten": totalFremdkosten,
                            "Fremdkosten_Details": suppliersJSON,
                            "Status": "Zu verrechnen",
                            "Firma": myCompany,
                            "Flagged": false,
                            "Changelog": JSON.stringify(initialChangelog)
                        }
                    }]
                };
                try {
                    const createdData = await window.API.saveOrder(payload);
                    if (createdData && createdData.records && createdData.records.length > 0) {
                        window.loadedRecords.unshift(createdData.records[0]);
                        window.UI.updateSupplierDatalist();
                        window.UI.renderOrders(window.loadedRecords);
                    }
                    window.DOM.modal.classList.add('hidden');
                    window.DOM.formNewOrder.reset();
                } catch (error) { alert("Fehler beim Erstellen."); }
            }
        });
    }

    // Neuer Lieferanten-Reihe hinzufügen (im Modal)
    const btnAddSupplier = document.getElementById('btn-add-supplier');
    if (btnAddSupplier) {
        btnAddSupplier.addEventListener('click', () => window.UI.addSupplierRow());
    }

    // Live-Suche
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

    // Suche löschen
    if (window.DOM.searchClearBtn) {
        window.DOM.searchClearBtn.addEventListener('click', () => {
            window.DOM.searchInput.value = '';
            window.DOM.searchClearBtn.style.display = 'none';
            window.UI.renderOrders(window.loadedRecords);
            window.DOM.searchInput.focus();
        });
    }
});

// Haupt-Laderoutine: Zieht sich alle Daten aus Airtable
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
    } finally {
        window.DOM.loading.classList.add('hidden');
    }
}

// Modal öffnen und mit bestehenden Daten befüllen
window.openEditModal = function(recordId) {
    const record = window.loadedRecords.find(r => r.id === recordId);
    if (!record) return;

    document.getElementById('edit-record-id').value = recordId;
    document.getElementById('modal-main-title').textContent = "Auftrag bearbeiten";
    document.getElementById('change-reason-group').style.display = 'block';
    document.getElementById('input-change-reason').value = '';

    document.getElementById('input-name').value = record.fields.Auftrag || "";
    document.getElementById('input-betrag').value = record.fields.Betrag_Automotive || "";

    const supplierContainer = document.getElementById('supplier-container');
    supplierContainer.innerHTML = '';

    if (record.fields.Fremdkosten_Details) {
        try {
            const parsed = JSON.parse(record.fields.Fremdkosten_Details);
            const details = Array.isArray(parsed) ? parsed : (parsed.suppliers || []);
            details.forEach(d => {
                window.UI.addSupplierRow(d.name, d.amount);
            });
        } catch(e) {}
    }

    if (supplierContainer.children.length === 0) window.UI.addSupplierRow();

    window.UI.calculateTotalFremdkosten();
    window.DOM.modal.classList.remove('hidden');
};

// Modal öffnen für Changelog-Verlauf
window.openChangelogModal = function(recordId) {
    const record = window.loadedRecords.find(r => r.id === recordId);
    if (!record) return;

    document.getElementById('changelog-order-title').textContent = record.fields.Auftrag || "Changelog";
    const timelineContainer = document.getElementById('changelog-timeline-list');
    timelineContainer.innerHTML = '';

    let logs = [];
    if (record.fields.Changelog) {
        try { logs = JSON.parse(record.fields.Changelog); } catch(e) {}
    }

    if (logs.length === 0) {
        timelineContainer.innerHTML = '<p style="color:#666; font-size:0.8rem; text-align:center; padding:16px;">Keine Historieneinträge vorhanden.</p>';
    } else {
        logs.forEach(log => {
            const dateStr = new Date(log.timestamp).toLocaleString('de-DE');
            let detailsHtml = '';
            if (log.details && log.details.length > 0) {
                detailsHtml = '<ul class="changelog-details-list">';
                log.details.forEach(d => { detailsHtml += `<li>${d}</li>`; });
                detailsHtml += '</ul>';
            }

            const logCard = document.createElement('div');
            logCard.className = 'changelog-card';
            logCard.innerHTML = `
                <div class="changelog-header">
                    <span class="changelog-user">👤 ${log.user}</span>
                    <span class="changelog-date">${dateStr}</span>
                </div>
                ${log.comment ? `<div class="changelog-comment">💬 "${log.comment}"</div>` : ''}
                ${detailsHtml}
            `;
            timelineContainer.appendChild(logCard);
        });
    }

    document.getElementById('modal-changelog-overlay').classList.remove('hidden');
};

// Status-Update
window.changeOrderStatus = async function(recordId, newStatus) {
    const record = window.loadedRecords.find(r => r.id === recordId);
    if (record) {
        record.fields.Status = newStatus;
        window.UI.renderOrders(window.loadedRecords);
    }

    try {
        await window.API.updateOrderStatus(recordId, newStatus);
    } catch (error) {
        alert("Fehler beim Status-Update.");
        fetchOrders();
    }
};

// Checkbox-Toggle (mit Changelog-Eintrag & Flagging)
window.toggleSupplierPaid = async function(orderId, supplierIndex) {
    const record = window.loadedRecords.find(r => r.id === orderId);
    if (!record || !record.fields.Fremdkosten_Details) return;

    try {
        const parsed = JSON.parse(record.fields.Fremdkosten_Details);
        const isObjectFormat = !Array.isArray(parsed) && parsed.suppliers;
        const details = isObjectFormat ? parsed.suppliers : parsed;

        const newState = !details[supplierIndex].paid;
        details[supplierIndex].paid = newState;

        let changelog = [];
        if (record.fields.Changelog) {
            try { changelog = JSON.parse(record.fields.Changelog); } catch(e) {}
        }

        changelog.unshift({
            user: window.currentUserEmail,
            timestamp: new Date().toISOString(),
            action: "Lieferantenstatus geändert",
            comment: `Lieferant "${details[supplierIndex].name}" auf ${newState ? 'BEZAHLT ✓' : 'OFFEN ◯'} gesetzt`,
            details: [`Betrag: € ${details[supplierIndex].amount.toFixed(2)}`]
        });

        const updatedDetailsPayload = isObjectFormat
            ? JSON.stringify({ ...parsed, suppliers: details })
            : JSON.stringify(details);

        record.fields.Fremdkosten_Details = updatedDetailsPayload;
        record.fields.Flagged = true;
        record.fields.Changelog = JSON.stringify(changelog);

        window.UI.renderOrders(window.loadedRecords);

        await fetch(`${window.API_URL_ORDERS}/${orderId}`, {
            method: 'PATCH',
            headers: window.HEADERS,
            body: JSON.stringify({
                fields: {
                    "Fremdkosten_Details": record.fields.Fremdkosten_Details,
                    "Flagged": true,
                    "Changelog": record.fields.Changelog
                }
            })
        });
    } catch (error) {
        alert("Fehler beim Aktualisieren des Lieferanten-Zahlungsstatus.");
        fetchOrders();
    }
};

// Massen-Abgeltung
window.bulkPaySupplier = async function(supplierName) {
    if (!confirm(`Möchtest du wirklich alle offenen Rechnungen für "${supplierName}" auf einmal als erledigt markieren?`)) return;

    const updates = [];

    window.loadedRecords.forEach(record => {
        if (record.fields.Fremdkosten_Details) {
            try {
                const parsed = JSON.parse(record.fields.Fremdkosten_Details);
                const isObjectFormat = !Array.isArray(parsed) && parsed.suppliers;
                const details = isObjectFormat ? parsed.suppliers : parsed;

                let mutated = false;

                details.forEach(d => {
                    if (d.name.trim().toLowerCase() === supplierName.toLowerCase().trim() && !d.paid) {
                        d.paid = true;
                        mutated = true;
                    }
                });

                if (mutated) {
                    let changelog = [];
                    if (record.fields.Changelog) { try { changelog = JSON.parse(record.fields.Changelog); } catch(e) {} }
                    changelog.unshift({
                        user: window.currentUserEmail,
                        timestamp: new Date().toISOString(),
                        action: "Massen-Abgeltung",
                        comment: `Alle Rechnungen für Lieferant "${supplierName}" als Bezahlt markiert.`,
                        details: []
                    });

                    const jsonStr = isObjectFormat ? JSON.stringify({ ...parsed, suppliers: details }) : JSON.stringify(details);
                    const logStr = JSON.stringify(changelog);
                    updates.push({ id: record.id, fields: { "Fremdkosten_Details": jsonStr, "Flagged": true, "Changelog": logStr } });

                    record.fields.Fremdkosten_Details = jsonStr;
                    record.fields.Flagged = true;
                    record.fields.Changelog = logStr;
                }
            } catch (e) {}
        }
    });

    window.UI.renderOrders(window.loadedRecords);

    try {
        for (let i = 0; i < updates.length; i += 10) {
            const batch = updates.slice(i, i + 10);
            await window.API.batchUpdateOrders(batch);
        }
    } catch (error) {
        alert("Massen-Update fehlgeschlagen.");
        fetchOrders();
    }
};

// Lieferant dauerhaft löschen
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

// Auftrag dauerhaft löschen
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

// FIREBASE TRIGGER
window.initMNAUApp = function() {
    fetchOrders();
};