// ====================================================
// ui.js: DOM RENDERING & STATS COMPILING
// ====================================================
window.UI = {
    renderOrders(records) {
        UI.updateSummary(records);
        UI.updateSupplierBreakdown(records);

        if(!records || records.length === 0) {
            orderList.innerHTML = '<p style="color:#a0aec0; padding: 20px;">Keine passenden Aufträge vorhanden.</p>';
            return;
        }

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
                setTimeout(() => row.remove(), 350);
            }
        });

        // 2. Bestehende Zeilen aktualisieren oder neue einfliegen lassen
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

            if(status === "An Group verrechnet") {
                cardStatusClass = "status-an-group-verrechnet";
                badgeClass = "badge-verrechnet";
            } else if(status === "Bezahlt") {
                cardStatusClass = "status-bezahlt";
                badgeClass = "badge-bezahlt";
            }

            // NEU: Selektives, frei steuerbares Dropdown statt starrer Klick-Buttons
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
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            `;

            let existingRow = orderList.querySelector(`.billing-row[data-id="${id}"]`);

            if (existingRow) {
                const cleanExisting = existingRow.innerHTML.replace(/\s+/g, ' ').trim();
                const cleanIncoming = innerHTML.replace(/\s+/g, ' ').trim();

                if (cleanExisting !== cleanIncoming) {
                    existingRow.innerHTML = innerHTML;
                }
                existingRow.className = `billing-row ${cardStatusClass}`;
            } else {
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
                } catch (e) {}
            }
        });

        const supplierNames = Object.keys(openSuppliers);

        // KORREKTUR: Atemberaubend gestaltetes Diagnostic No-Debts Panel
        if (supplierNames.length === 0) {
            supplierContainer.innerHTML = `
                <div class="no-debts-panel">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <div class="no-debts-text">
                        <h3>SYSTEM_SECURE</h3>
                        <p>Sämtliche Lieferanten-Kosten sind ausgeglichen. Keine aktiven Posten ausstehend.</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = '';
        supplierNames.forEach(name => {
            const data = openSuppliers[name];
            html += `
                <div class="supplier-stat-card">
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
    },

    // NEU: Der dedizierte Lieferanten-Datenbank Renderer
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
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
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
            <input type="text" class="search-input supplier-name" list="supplier-list" placeholder="Lieferant...">
            <input type="number" step="0.01" class="search-input supplier-amount" placeholder="0.00">
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
        loading.classList.add('hidden');
        orderList.innerHTML = `
            <div style="padding: 60px 20px; text-align: center; color: #a0aec0;">
                <h3 style="color: white; margin-bottom: 12px; text-transform: uppercase;">Konfiguration fehlt</h3>
                <button class="btn-primary" style="margin: 0 auto;" onclick="triggerSetup()">➔ Setup starten</button>
            </div>
        `;
    }
};