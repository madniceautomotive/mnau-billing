// ==================================================== 
// app.js: USER ACTIONS & DYNAMIC COMPANY SWITCHER
// ====================================================

// Globales Tab-Switching
window.switchTab = function(tabName) {
    document.getElementById('view-billing').classList.add('hidden');
    document.getElementById('view-calculator').classList.add('hidden');
    document.getElementById('tab-btn-billing').classList.remove('active');
    document.getElementById('tab-btn-calculator').classList.remove('active');

    const searchRow = document.getElementById('billing-search-row');
    const manageSuppliersBtn = document.getElementById('btn-manage-suppliers');

    if (tabName === 'billing') {
        document.getElementById('view-billing').classList.remove('hidden');
        document.getElementById('tab-btn-billing').classList.add('active');
        if (searchRow) searchRow.style.display = 'flex';
        if (manageSuppliersBtn) manageSuppliersBtn.style.display = 'flex';
    } else if (tabName === 'calculator') {
        document.getElementById('view-calculator').classList.remove('hidden');
        document.getElementById('tab-btn-calculator').classList.add('active');
        if (searchRow) searchRow.style.display = 'none';
        if (manageSuppliersBtn) manageSuppliersBtn.style.display = 'none';
    }
};

// FIRMEN WECHSELN VIA DROPDOWN (DYNAMIC COLOR UPDATES)
window.switchCompany = function(newCompany) {
    if (!newCompany) return;
    const cleanComp = newCompany.toUpperCase();
    window.currentUserCompany = cleanComp;

    // Anpassen des globalen Data-Attributes für CSS Variables
    document.documentElement.setAttribute('data-company', cleanComp);

    // Styling des Firmen-Dropdowns auf die Markenfarbe anpassen
    const compSelect = document.getElementById('company-select');
    if (compSelect) {
        const colorMap = {
            'MNAG': '#ed694b',
            'MNMH': '#d42168',
            'MNWB': '#58bfc5',
            'MNAT': '#5079ac',
            'MNAU': '#00663a',
            'MNGR': '#a0aec0'
        };
        const brandColor = colorMap[cleanComp] || '#00ff73';
        compSelect.style.borderColor = brandColor;
        compSelect.style.color = brandColor;
    }

    if (typeof window.applyFilters === 'function') {
        window.applyFilters();
    } else if (window.loadedRecords && window.UI && window.UI.renderOrders) {
        window.UI.renderOrders(window.loadedRecords);
    }

    if (typeof window.calculate === 'function') {
        window.calculate();
    }
};

// ZENTRALE FILTER LOGIK (SUCHE + STATUS)
window.applyFilters = function() {
    if (!window.loadedRecords || !window.UI) return;

    const query = (window.DOM.searchInput ? window.DOM.searchInput.value : '').toLowerCase().trim();
    const statusFilterElement = document.getElementById('status-filter');
    const statusFilter = statusFilterElement ? statusFilterElement.value : 'Alle';

    if (window.DOM.searchClearBtn) {
        window.DOM.searchClearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    }

    const filtered = window.loadedRecords.filter(record => {
        const orderName = (record.fields.Auftrag || "").toLowerCase();
        const detailsStr = (record.fields.Fremdkosten_Details || "").toLowerCase();
        const matchesSearch = orderName.includes(query) || detailsStr.includes(query);

        const recordStatus = record.fields.Status || "Zu verrechnen";
        const matchesStatus = statusFilter === "Alle" || recordStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

    window.UI.renderOrders(filtered);
};

document.addEventListener('DOMContentLoaded', () => {

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

    // Live-Suche
    if (window.DOM.searchInput) {
        window.DOM.searchInput.addEventListener('input', window.applyFilters);
    }

    // Status Filter
    const statusFilterElement = document.getElementById('status-filter');
    if (statusFilterElement) {
        statusFilterElement.addEventListener('change', window.applyFilters);
    }

    // Suche löschen
    if (window.DOM.searchClearBtn) {
        window.DOM.searchClearBtn.addEventListener('click', () => {
            window.DOM.searchInput.value = '';
            window.applyFilters();
            window.DOM.searchInput.focus();
        });
    }
});

// Haupt-Laderoutine
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
        window.applyFilters();
    } catch (error) {
        console.error("Kritischer Terminal-Fehler:", error);
    } finally {
        window.DOM.loading.classList.add('hidden');
    }
}

// AUFTRAG IM KALKULATOR FÜR RE-KALKULATION LADEN
window.openInKalkulator = function(recordId) {
    const record = window.loadedRecords.find(r => r.id === recordId);
    if (!record) return;

    let groupMeta = null;
    if (record.fields.Fremdkosten_Details) {
        try {
            const parsed = JSON.parse(record.fields.Fremdkosten_Details);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                groupMeta = parsed.groupMeta;
            }
        } catch(e) {}
    }

    if (!groupMeta) {
        alert("Dieser Auftrag besitzt keine Kalkulator-Eingabedaten.");
        return;
    }

    const snapshots = groupMeta.snapshots || (groupMeta.snapshot ? [groupMeta.snapshot] : []);
    const latestSnap = snapshots[snapshots.length - 1];

    if (!latestSnap || !latestSnap.kalkInputs) {
        alert("Für diesen Auftrag ist keine gespeicherte Kalkulationsstruktur vorhanden.");
        return;
    }

    window.loadKalkulatorInputs(latestSnap.kalkInputs);

    window.activeEditingGroupId = groupMeta.groupId || null;
    window.activeEditingRecordId = recordId;

    const banner = document.getElementById('kalk-edit-banner');
    const titleEl = document.getElementById('kalk-edit-title');
    if (banner && titleEl) {
        titleEl.textContent = record.fields.Auftrag || "Unbenannt";
        banner.classList.remove('hidden');
    }

    window.switchTab('calculator');
    window.calculate();
};

// BEARBEITUNG ABBRECHEN
window.cancelKalkulatorEdit = function() {
    window.activeEditingGroupId = null;
    window.activeEditingRecordId = null;

    const banner = document.getElementById('kalk-edit-banner');
    if (banner) banner.classList.add('hidden');

    if (typeof window.resetAll === 'function') {
        window.resetAll();
    }

    window.switchTab('billing');
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

// STATUS UPDATE
window.changeOrderStatus = async function(recordId, newStatus) {
    const targetRecord = window.loadedRecords.find(r => r.id === recordId);
    if (!targetRecord) return;

    let linkedRecordIds = [recordId];
    let groupId = null;
    const auftragName = targetRecord.fields.Auftrag;

    if (targetRecord.fields.Fremdkosten_Details) {
        try {
            const parsed = JSON.parse(targetRecord.fields.Fremdkosten_Details);
            if (parsed && parsed.groupMeta && parsed.groupMeta.groupId) {
                groupId = parsed.groupMeta.groupId;
            }
        } catch(e) {}
    }

    if (groupId) {
        linkedRecordIds = window.loadedRecords.filter(r => {
            if (!r.fields.Fremdkosten_Details) return false;
            try {
                const p = JSON.parse(r.fields.Fremdkosten_Details);
                return p && p.groupMeta && p.groupMeta.groupId === groupId;
            } catch(e) { return false; }
        }).map(r => r.id);
    } else if (auftragName) {
        linkedRecordIds = window.loadedRecords.filter(r => r.fields.Auftrag === auftragName).map(r => r.id);
    }

    const updates = [];
    linkedRecordIds.forEach(id => {
        const r = window.loadedRecords.find(rec => rec.id === id);
        if (r) {
            r.fields.Status = newStatus;
            updates.push({ id: id, fields: { "Status": newStatus } });
        }
    });

    window.applyFilters();

    try {
        for (let i = 0; i < updates.length; i += 10) {
            const batch = updates.slice(i, i + 10);
            await window.API.batchUpdateOrders(batch);
        }
    } catch (error) {
        alert("Fehler beim Status-Update.");
        fetchOrders();
    }
};

// Checkbox-Toggle
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

        window.applyFilters();

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

    window.applyFilters();

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
        window.applyFilters();
    } catch (error) {
        alert("Lieferant konnte nicht gelöscht werden.");
    }
};

// AUFTRAG LÖSCHEN
window.deleteOrder = async function(recordId) {
    const targetRecord = window.loadedRecords.find(r => r.id === recordId);
    if (!targetRecord) return;

    let linkedRecordIds = [recordId];
    let groupId = null;
    const auftragName = targetRecord.fields.Auftrag;

    if (targetRecord.fields.Fremdkosten_Details) {
        try {
            const parsed = JSON.parse(targetRecord.fields.Fremdkosten_Details);
            if (parsed && parsed.groupMeta && parsed.groupMeta.groupId) {
                groupId = parsed.groupMeta.groupId;
            }
        } catch(e) {}
    }

    if (groupId) {
        linkedRecordIds = window.loadedRecords.filter(r => {
            if (!r.fields.Fremdkosten_Details) return false;
            try {
                const p = JSON.parse(r.fields.Fremdkosten_Details);
                return p && p.groupMeta && p.groupMeta.groupId === groupId;
            } catch(e) { return false; }
        }).map(r => r.id);
    } else if (auftragName) {
        linkedRecordIds = window.loadedRecords.filter(r => r.fields.Auftrag === auftragName).map(r => r.id);
    }

    const count = linkedRecordIds.length;
    const confirmMsg = count > 1
        ? `Achtung: Dieser Kalkulator-Auftrag ist auch bei ${count - 1} Schwesterfirma/Firmen hinterlegt. Möchtest du das GESAMTE Projekt inkl. aller Firmen-Einträge löschen?`
        : "Auftrag wirklich dauerhaft löschen?";

    if (!confirm(confirmMsg)) return;

    linkedRecordIds.forEach(id => {
        const row = document.querySelector(`.billing-row[data-id="${id}"]`);
        if (row) row.classList.add('row-exit-active');
    });

    try {
        for (const id of linkedRecordIds) {
            await window.API.deleteOrder(id);
        }

        window.loadedRecords = window.loadedRecords.filter(r => !linkedRecordIds.includes(r.id));
        window.applyFilters();
    } catch (error) {
        alert("Fehler beim Löschen des Auftrags/der Aufträge.");
        fetchOrders();
    }
};

// FIREBASE TRIGGER
window.initMNAUApp = function() {
    fetchOrders();
};