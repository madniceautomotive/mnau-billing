// ====================================================
// ui.js: DOM RENDERING & STATS COMPILING
// ====================================================

window.UI = {
    renderOrders(records) {
        UI.updateSummary(records);
        UI.updateSupplierBreakdown(records);

        // Datensätze trennen in Aktiv und Bezahlt (Archiv)
        const activeRecords = records.filter(r => (r.fields.Status || "Zu verrechnen") !== "Bezahlt");
        const archivedRecords = records.filter(r => r.fields.Status === "Bezahlt");

        // Geteilte Sub-Rendering-Engine für duale Listen-Pflege
        const renderContainer = (containerEl, listRecords, emptyMessage) => {
            if(!listRecords || listRecords.length === 0) {
                containerEl.innerHTML = `<p style="color:#444; padding: 16px; font-size:0.8rem; text-align:center; border: 1px dashed rgba(255,255,255,0.02); border-radius:8px; letter-spacing:0.5px;">${emptyMessage}</p>`;
                return;
            }
            if (containerEl.querySelector('p')) {
                containerEl.innerHTML = '';
            }

            const incomingIds = new Set(listRecords.map(r => r.id));

            // 1. Ausgeblendete oder in eine andere Liste verschobene Zeilen herausschrumpfen lassen
            const currentRows = Array.from(containerEl.querySelectorAll('.billing-row'));
            currentRows.forEach(row => {
                const rowId = row.getAttribute('data-id');
                if (!incomingIds.has(rowId)) {
                    row.classList.add('row-exit-active');
                    setTimeout(() => row.remove(), 350);
                }
            });

            // 2. Zeilen abgleichen, neu bauen oder updaten
            listRecords.forEach((record, index) => {
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
                            details.forEach((d) => {
                                const isPaid = d.paid === true;
                                breakdownHTML += `
                                    <div class="breakdown-row ${isPaid ? 'supplier-paid' : ''}">
                                        <span>↳ ${d.name} ${isPaid ? '✓' : ''}</span>
                                        <span>€ ${d.amount.toFixed(2)}</span>
                                    </div>
                                `;
                            });
                            breakdownHTML += `</div>`;
                        }
                    } catch(e) {}
                }

                let cardStatusClass = "status-zu-verrechnen";
                if(status === "An Group verrechnet") { cardStatusClass = "status-an-group-verrechnet"; }
                else if(status === "Bezahlt") { cardStatusClass = "status-bezahlt"; }

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
                        <select class="status-select" onchange="changeOrderStatus('${id}', this.value)">
                            <option value="Zu verrechnen" ${status === "Zu verrechnen" ? "selected" : ""}>Zu verrechnen</option>
                            <option value="An Group verrechnet" ${status === "An Group verrechnet" ? "selected" : ""}>An Group verrechnet</option>
                            <option value="Bezahlt" ${status === "Bezahlt" ? "selected" : ""}>Bezahlt</option>
                        </select>
                        <button class="delete-btn" onclick="deleteOrder('${id}')" title="Auftrag löschen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                `;

                let existingRow = containerEl.querySelector(`.billing-row[data-id="${id}"]`);
                if (existingRow) {
                    const cleanExisting = existingRow.innerHTML.replace(/\s+/g, ' ').trim();
                    const cleanIncoming = innerHTML.replace(/\s+/g, ' ').trim();
                    if (cleanExisting !== cleanIncoming) { existingRow.innerHTML = innerHTML; }
                    existingRow.className = `billing-row ${cardStatusClass}`;
                } else {
                    const newRow = document.createElement('div');
                    newRow.className = `billing-row ${cardStatusClass} row-enter-active`;
                    newRow.setAttribute('data-id', id);
                    newRow.innerHTML = innerHTML;
                    const referenceNode = containerEl.children[index];
                    if (referenceNode) { containerEl.insertBefore(newRow, referenceNode); }
                    else { containerEl.appendChild(newRow); }
                }
            });
        };

        // Beide Container unabhängig voneinander synchron zeichnen
        renderContainer(window.DOM.orderList, activeRecords, "Keine aktiven Aufträge im Log.");
        renderContainer(window.DOM.archiveList, archivedRecords, "Archiv-Log leer.");
    },

    updateSummary(records) {
        let sumZuVerrechnen = 0, sumAnGroup = 0, sumFremdkosten = 0, sumAutomotiveGesamt = 0;
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
                <span class="summary-label">Zahlung Group offen</span>
                <span class="summary-value">€ ${sumAnGroup.toFixed(2)}</span>
            </div>
            <div class="summary-card orange">
                <span class="summary-label">Fremdkosten Gesamt</span>
                <span class="summary-value">€ ${sumFremdkosten.toFixed(2)}</span>
            </div>
        `;
    },

    updateSupplierBreakdown(records) {
        const supplierContainer = document.getElementById('supplier-summary-details');
        if (!supplierContainer) return;
        const openSuppliers = {};

        records.forEach(record => {
            const fields = record.fields;
            const orderName = fields.Auftrag || "Unbenanntes Projekt";
            if (fields.Fremdkosten_Details) {
                try {
                    const details = JSON.parse(fields.Fremdkosten_Details);
                    details.forEach((d, dIdx) => {
                        const name = (d.name || "Unbekannt").trim();
                        const amount = parseFloat(d.amount) || 0;
                        const isPaid = d.paid === true;

                        if (amount > 0 && !isPaid) {
                            if (!openSuppliers[name]) { openSuppliers[name] = { total: 0, items: [] }; }
                            openSuppliers[name].total += amount;
                            openSuppliers[name].items.push({ order: orderName, amount: amount, orderId: record.id, index: dIdx });
                        }
                    });
                } catch (e) {}
            }
        });

        const supplierNames = Object.keys(openSuppliers);

        // REPARIERT: Menschlicher, klar verständlicher Text ohne Unterstriche
        if (supplierNames.length === 0) {
            supplierContainer.innerHTML = `
                <div class="no-debts-panel">
                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    <div class="no-debts-text">
                        <h3>Keine offenen Posten</h3>
                        <p>Alle Lieferantenkosten wurden vollständig beglichen.</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = '';
        supplierNames.forEach(name => {
            const data = openSuppliers[name];
            const safeName = name.replace(/'/g, "\\'");
            html += `
                <div class="supplier-stat-card">
                    <div class="supplier-stat-header">
                        <span class="supplier-stat-name">${name}</span>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span class="supplier-stat-total">€ ${data.total.toFixed(2)}</span>
                            <button class="btn-primary btn-small" style="padding:4px 8px; font-size:0.65rem;" onclick="bulkPaySupplier('${safeName}')">✓ Alle abgelten</button>
                        </div>
                    </div>
            `;
            data.items.forEach(item => {
                html += `
                    <div class="supplier-stat-item">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin:0; text-transform:none; user-select:none; min-width:0; flex:1;">
                            <input type="checkbox" onchange="window.toggleSupplierPaid('${item.orderId}', ${item.index})" style="accent-color:#00ff73; cursor:pointer; width:14px; height:14px; flex-shrink:0;">
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">↳ ${item.order}</span>
                        </label>
                        <span style="color:#ef4444; font-weight:600; flex-shrink:0;">€ ${item.amount.toFixed(2)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        });
        supplierContainer.innerHTML = html;
    },

    updateSupplierDatalist() {
        const datalist = document.getElementById('supplier-list');
        if (!datalist) return;
        datalist.innerHTML = '';
        const uniqueSuppliers = new Set();
        window.globalSuppliers.forEach(s => uniqueSuppliers.add(s.name));
        window.loadedRecords.forEach(record => {
            if (record.fields.Fremdkosten_Details) {
                try {
                    const details = JSON.parse(record.fields.Fremdkosten_Details);
                    details.forEach(d => { if (d.name && d.name.trim() !== '') uniqueSuppliers.add(d.name.trim()); });
                } catch (e) {}
            }
        });
        Array.from(uniqueSuppliers).sort().forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier;
            datalist.appendChild(option);
        });
    },

    renderSuppliersManager() {
        const listContainer = document.getElementById('suppliers-manager-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        if (window.globalSuppliers.length === 0) {
            listContainer.innerHTML = '<p style="color:#666; font-size:0.8rem; text-align:center; padding:16px;">Datenbank leer.</p>';
            return;
        }
        window.globalSuppliers.forEach(supplier => {
            const row = document.createElement('div');
            row.className = 'supplier-manager-row';
            row.innerHTML = `
                <span class="supplier-manager-name">${supplier.name}</span>
                <button class="delete-btn" style="width:34px; height:34px; border-radius:6px;" onclick="deleteSupplier('${supplier.id}', '${supplier.name}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            `;
            listContainer.appendChild(row);
        });
    },

    addSupplierRow() {
        const container = document.getElementById('supplier-container');
        const row = document.createElement('div');
        row.className = 'supplier-row';
        row.innerHTML = `
            <input type="text" class="mnau-input supplier-name" list="supplier-list" placeholder="Lieferant..." style="margin-top:0;">
            <input type="number" step="0.01" class="mnau-input supplier-amount" placeholder="0.00" style="margin-top:0;">
            <button type="button" class="btn-remove-supplier" title="Entfernen">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        `;
        row.querySelector('.btn-remove-supplier').addEventListener('click', () => { row.remove(); UI.calculateTotalFremdkosten(); });
        row.querySelector('.supplier-amount').addEventListener('input', UI.calculateTotalFremdkosten);
        container.appendChild(row);
    },

    calculateTotalFremdkosten() {
        let total = 0;
        document.querySelectorAll('.supplier-amount').forEach(input => { total += parseFloat(input.value) || 0; });
        document.getElementById('display-total-fremdkosten').textContent = total.toFixed(2);
        return total;
    },

    showSetupRequired() {
        window.DOM.loading.classList.add('hidden');
        window.DOM.orderList.innerHTML = `
            <div style="padding: 60px 20px; text-align: center; color: #a0aec0;">
                <h3 style="color: white; margin-bottom: 12px; text-transform: uppercase;">Konfiguration fehlt</h3>
                <button class="btn-primary" style="margin: 0 auto;" onclick="triggerSetup()">➔ Setup starten</button>
            </div>
        `;
    }
};