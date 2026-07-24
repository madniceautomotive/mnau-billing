// ====================================================
// ui.js: DOM RENDERING & STATS COMPILING (MULTI-TENANT & DYNAMIC SHARE DISPLAY)
// ====================================================

window.UI = {
    renderOrders(records) {
        const myCompany = (window.currentUserCompany || "MNAU").toUpperCase();

        const companyRecords = records.filter(r => {
            const recordCompany = (r.fields.Firma || "MNAU").toUpperCase();
            return recordCompany === myCompany;
        });

        UI.updateSummary(companyRecords);
        UI.updateSupplierBreakdown(companyRecords);

        const activeRecords = companyRecords.filter(r => (r.fields.Status || "Zu verrechnen") !== "Bezahlt");
        const archivedRecords = companyRecords.filter(r => r.fields.Status === "Bezahlt");

        const renderContainer = (containerEl, listRecords, emptyMessage) => {
            if(!listRecords || listRecords.length === 0) {
                containerEl.innerHTML = `<p style="color:#444; padding: 16px; font-size:0.8rem; text-align:center; border: 1px dashed rgba(255,255,255,0.02); border-radius:8px; letter-spacing:0.5px;">${emptyMessage}</p>`;
                return;
            }
            if (containerEl.querySelector('p')) {
                containerEl.innerHTML = '';
            }

            const incomingIds = new Set(listRecords.map(r => r.id));

            const currentRows = Array.from(containerEl.querySelectorAll('.billing-row'));
            currentRows.forEach(row => {
                const rowId = row.getAttribute('data-id');
                if (!incomingIds.has(rowId)) {
                    row.classList.add('row-exit-active');
                    setTimeout(() => row.remove(), 350);
                }
            });

            listRecords.forEach((record, index) => {
                const fields = record.fields;
                const id = record.id;
                const status = fields.Status || "Zu verrechnen";
                const betragVal = parseFloat(fields.Betrag_Automotive) || 0;
                const fremdkostenVal = parseFloat(fields.Fremdkosten) || 0;
                const deckungsbeitragVal = betragVal - fremdkostenVal;

                const betrag = betragVal.toFixed(2);
                const fremdkosten = fremdkostenVal.toFixed(2);
                const deckungsbeitrag = deckungsbeitragVal.toFixed(2);

                // Flagged Badge
                const isFlagged = fields.Flagged === true;
                const flagBadgeHTML = isFlagged ? `<span class="flag-badge">🚩 Geändert</span>` : '';

                let suppliers = [];
                let groupMeta = null;

                if (fields.Fremdkosten_Details) {
                    try {
                        const parsed = JSON.parse(fields.Fremdkosten_Details);
                        if (Array.isArray(parsed)) {
                            suppliers = parsed;
                        } else if (parsed && typeof parsed === 'object') {
                            suppliers = parsed.suppliers || [];
                            groupMeta = parsed.groupMeta || null;
                        }
                    } catch(e) {}
                }

                const isReadOnlyShare = groupMeta && groupMeta.isReadOnlyShare === true;

                // Ersteller-Firma ermitteln (Zeigt immer die ERSTELLER-FIRMA an)
                const creatorCompany = (groupMeta && groupMeta.originCompany) ? groupMeta.originCompany.toUpperCase() : (fields.Firma || "MNAU").toUpperCase();

                // Echte Fremdkosten Breakdown
                let breakdownHTML = '';
                if (suppliers.length > 0) {
                    breakdownHTML = `<div class="breakdown-container">`;
                    suppliers.forEach((d, dIdx) => {
                        const isPaid = d.paid === true;
                        breakdownHTML += `
                            <div class="breakdown-row ${isPaid ? 'supplier-paid' : ''}" 
                                 onclick="${isReadOnlyShare ? '' : `window.toggleSupplierPaid('${id}', ${dIdx})`}" 
                                 title="${isReadOnlyShare ? 'Schreibgeschützter Erlösanteil' : 'Klicken zum Umschalten (Bezahlt / Offen)'}">
                                <span>↳ ${d.name} ${isPaid ? '✓' : '◯'}</span>
                                <span>€ ${(parseFloat(d.amount)||0).toFixed(2)}</span>
                            </div>
                        `;
                    });
                    breakdownHTML += `</div>`;
                }

                // Group Erlös-Info Box (ZEIGT DYNAMISCH DIE ANTEILE DER ANDERN FIRMEN AN)
                let groupMetaHTML = '';
                if (groupMeta) {
                    const kp = (parseFloat(groupMeta.kundenpreis)||0).toFixed(2);
                    const mngr = (parseFloat(groupMeta.mngrAbgabe)||0).toFixed(2);

                    let sistersHTML = '';
                    const sharesDict = groupMeta.allSharesDetail || groupMeta.sisterSharesDetail || {};

                    if (sharesDict && Object.keys(sharesDict).length > 0) {
                        Object.entries(sharesDict).forEach(([comp, amt]) => {
                            // Filtert die eigene Firma aus der Unter-Aufschlüsselung heraus!
                            if (comp.toUpperCase() !== myCompany) {
                                sistersHTML += `<div class="group-info-row"><span>• Anteil ${comp}:</span><span>€ ${(parseFloat(amt)||0).toFixed(2)}</span></div>`;
                            }
                        });
                    }

                    const pdfBtn = groupMeta.snapshot ? `
                        <button class="btn-secondary btn-small" onclick="window.downloadKalkulatorPDFFromLog('${id}')" style="margin-top:8px; display:inline-flex; align-items:center; gap:6px; font-size:0.7rem; padding:4px 10px; border-color:rgba(0,255,115,0.4); color:#00ff73; background:rgba(0,255,115,0.08);" title="Group Kalkulator PDF herunterladen">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Kalkulator PDF Export
                        </button>
                    ` : '';

                    groupMetaHTML = `
                        <div class="group-info-box">
                            <div class="group-info-header">🌐 Group Erlösverteilung</div>
                            <div class="group-info-row"><span>Gesamt Projektvolumen:</span><strong>€ ${kp}</strong></div>
                            <div class="group-info-row"><span>Group-Abgabe (MNGR):</span><span>€ ${mngr}</span></div>
                            ${sistersHTML}
                            ${pdfBtn}
                        </div>
                    `;
                }

                // Read-Only Hinweis Banner für passive Erlösanteile
                const readOnlyBanner = isReadOnlyShare ? `
                    <div class="read-only-banner">
                        🔒 Erlösanteil aus Projekt "${groupMeta.originProject || 'Kalkulator'}" (Hauptauftrag von ${creatorCompany})
                    </div>
                ` : '';

                let cardStatusClass = "status-zu-verrechnen";
                if(status === "In Bearbeitung") { cardStatusClass = "status-in-bearbeitung"; }
                else if(status === "An Group verrechnet") { cardStatusClass = "status-an-group-verrechnet"; }
                else if(status === "Bezahlt") { cardStatusClass = "status-bezahlt"; }

                const actionControlsHTML = isReadOnlyShare ? `
                    <span class="read-only-badge">🔒 Schreibgeschützt</span>
                    <button class="changelog-btn" onclick="window.openChangelogModal('${id}')" title="Änderungshistorie anzeigen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8z"/></svg>
                    </button>
                ` : `
                    <select class="status-select" onchange="changeOrderStatus('${id}', this.value)">
                        <option value="Zu verrechnen" ${status === "Zu verrechnen" ? "selected" : ""}>Zu verrechnen</option>
                        <option value="In Bearbeitung" ${status === "In Bearbeitung" ? "selected" : ""}>In Bearbeitung</option>
                        <option value="An Group verrechnet" ${status === "An Group verrechnet" ? "selected" : ""}>An Group verrechnet</option>
                        <option value="Bezahlt" ${status === "Bezahlt" ? "selected" : ""}>Bezahlt</option>
                    </select>
                    <button class="changelog-btn" onclick="window.openChangelogModal('${id}')" title="Änderungshistorie anzeigen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8z"/></svg>
                    </button>
                    <button class="edit-btn" onclick="window.openEditModal('${id}')" title="Auftrag bearbeiten">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="delete-btn" onclick="deleteOrder('${id}')" title="Auftrag löschen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                `;

                const innerHTML = `
                    <div class="billing-info-block">
                        <div class="billing-row-title">${fields.Auftrag || "Unbenannt"} ${flagBadgeHTML}</div>
                        <div class="billing-row-meta">Erstellt: ${new Date(record.createdTime).toLocaleDateString('de-DE')} • Erstellt von: ${creatorCompany}</div>
                        ${readOnlyBanner}
                        ${groupMetaHTML}
                    </div>
                    
                    <div class="billing-financials">
                        <div class="amount-main" title="${myCompany} Umsatz (Abrechnung an Group)">
                            <span class="amount-title-label">${myCompany} Umsatz:</span> € ${betrag}
                        </div>
                        <div class="amount-deckungsbeitrag" title="Netto-Ertrag nach echten Fremdkosten">
                            <span class="amount-title-label">Deckungsbeitrag:</span> € ${deckungsbeitrag}
                        </div>
                        ${fremdkostenVal > 0 ? `<div class="amount-fremdkosten">${myCompany} Fremdkosten: € ${fremdkosten}</div>` : ''}
                        ${breakdownHTML}
                    </div>
                    
                    <div class="action-group">
                        ${actionControlsHTML}
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

        renderContainer(window.DOM.orderList, activeRecords, "Keine aktiven Aufträge im Log.");
        renderContainer(window.DOM.archiveList, archivedRecords, "Archiv-Log leer.");
    },

    updateSummary(records) {
        const myCompany = window.currentUserCompany || "MNAU";
        let sumZuVerrechnen = 0, sumInBearbeitung = 0, sumAnGroup = 0, sumFremdkosten = 0, sumCompanyGesamt = 0;

        records.forEach(record => {
            const fields = record.fields;
            const status = fields.Status || "Zu verrechnen";
            const betrag = parseFloat(fields.Betrag_Automotive) || 0;
            const fremd = parseFloat(fields.Fremdkosten) || 0;

            sumCompanyGesamt += betrag;
            sumFremdkosten += fremd;

            if (status === "Zu verrechnen") sumZuVerrechnen += betrag;
            if (status === "In Bearbeitung") sumInBearbeitung += betrag;
            if (status === "An Group verrechnet") sumAnGroup += betrag;
        });

        const sumDeckungsbeitrag = sumCompanyGesamt - sumFremdkosten;

        const summaryContainer = document.getElementById('dashboard-summary');
        if(!summaryContainer) return;

        summaryContainer.innerHTML = `
            <div class="summary-card green">
                <span class="summary-label">${myCompany} Umsatz Gesamt</span>
                <span class="summary-value">€ ${sumCompanyGesamt.toFixed(2)}</span>
            </div>
            <div class="summary-card blue">
                <span class="summary-label">${myCompany} Deckungsbeitrag</span>
                <span class="summary-value">€ ${sumDeckungsbeitrag.toFixed(2)}</span>
            </div>
            <div class="summary-card cyan">
                <span class="summary-label">In Bearbeitung</span>
                <span class="summary-value">€ ${sumInBearbeitung.toFixed(2)}</span>
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
                <span class="summary-label">Echte Fremdkosten</span>
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
                    const parsed = JSON.parse(record.fields.Fremdkosten_Details);
                    const details = Array.isArray(parsed) ? parsed : (parsed.suppliers || []);

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
                    const parsed = JSON.parse(record.fields.Fremdkosten_Details);
                    const details = Array.isArray(parsed) ? parsed : (parsed.suppliers || []);
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

    addSupplierRow(defaultName = '', defaultAmount = '') {
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
        row.querySelector('.supplier-name').value = defaultName;
        if (defaultAmount !== '') row.querySelector('.supplier-amount').value = defaultAmount;

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