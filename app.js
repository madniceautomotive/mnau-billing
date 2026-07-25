// ==================================================== 
// app.js: USER ACTIONS, CONTROLLER HUB & PDF VIEWER
// ====================================================

const SUN_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const MOON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

// DYNAMISCHES SAFE DOM OBJECT
window.DOM = {
    get loading() { return document.getElementById('loading'); },
    get orderList() { return document.getElementById('order-list'); },
    get externalOrderList() { return document.getElementById('external-order-list'); },
    get archiveList() { return document.getElementById('archive-list'); },
    get searchInput() { return document.getElementById('search-input'); },
    get searchClearBtn() { return document.getElementById('search-clear-btn'); },
    get btnManageSuppliers() { return document.getElementById('btn-manage-suppliers'); },
    get btnCloseSuppliers() { return document.getElementById('btn-close-suppliers'); },
    get modalSuppliers() { return document.getElementById('modal-suppliers-overlay'); }
};

const DIALOG_ICONS = {
    info: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    success: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    confirm: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
};

// ====================================================
// ZENTRALES AUTOMATISCHES SYSTEM-LOGGER ENGINE
// ====================================================
window.Logger = {
    logs: [],
    init() {
        try {
            const saved = localStorage.getItem('mngr_debug_logs');
            if (saved) this.logs = JSON.parse(saved);
        } catch(e) {}

        window.addEventListener('error', (e) => {
            this.add('ERROR', `JavaScript Exception: ${e.message}`, `${e.filename}:${e.lineno}:${e.colno}`);
        });
        window.addEventListener('unhandledrejection', (e) => {
            this.add('ERROR', `Unhandled Promise Rejection`, e.reason ? (e.reason.stack || e.reason) : e);
        });
        this.info("MNAU/MNGR Hub initialisiert.");
    },
    add(type, message, details = '') {
        const entry = {
            timestamp: new Date().toISOString(),
            company: window.currentUserCompany || 'N/A',
            user: window.currentUserEmail || 'System',
            type: type,
            message: String(message),
            details: typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)
        };
        this.logs.unshift(entry);
        if (this.logs.length > 200) this.logs.pop();
        try {
            localStorage.setItem('mngr_debug_logs', JSON.stringify(this.logs));
        } catch(e) {}
    },
    error(msg, details) { this.add('ERROR', msg, details); },
    warn(msg, details) { this.add('WARN', msg, details); },
    info(msg, details) { this.add('INFO', msg, details); },
    clear() {
        this.logs = [];
        localStorage.removeItem('mngr_debug_logs');
    }
};

window.Logger.init();

window.renderLogsModal = function() {
    const container = document.getElementById('debug-log-terminal');
    if (!container) return;

    if (window.Logger.logs.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Keine Log-Einträge vorhanden.</div>';
        return;
    }

    container.innerHTML = window.Logger.logs.map(l => `
        <div class="log-entry log-${l.type}">
            <div class="log-time">[${new Date(l.timestamp).toLocaleTimeString('de-DE')}] [${l.type}] [${l.company}] (${l.user})</div>
            <strong>${l.message}</strong>
            ${l.details ? `<div style="margin-top:4px; white-space:pre-wrap; opacity:0.9;">${l.details}</div>` : ''}
        </div>
    `).join('');
};

window.openLogsModal = function() {
    window.renderLogsModal();
    window.showModal('modal-logs-overlay');
};

window.copyLogsToClipboard = async function() {
    const logText = window.Logger.logs.map(l => `[${l.timestamp}] [${l.type}] [${l.company}] ${l.message} | ${l.details}`).join('\n');
    try {
        await navigator.clipboard.writeText(logText);
        window.customAlert("System-Logs wurden erfolgreich in die Zwischenablage kopiert!", "Erfolg");
    } catch(e) {
        window.customAlert("Kopieren fehlgeschlagen.", "Fehler");
    }
};

window.downloadLogsFile = function() {
    const logText = window.Logger.logs.map(l => `[${l.timestamp}] [${l.type}] [${l.company}] [${l.user}]\nMessage: ${l.message}\nDetails: ${l.details}\n----------------------------------------`).join('\n\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MNGR_System_Logs_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

// ====================================================
// STATE-OF-THE-ART MODAL CONTROLLER
// ====================================================
window.showModal = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.classList.add('modal-visible');
};

window.hideModal = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('modal-visible');
    setTimeout(() => {
        el.classList.add('hidden');
    }, 280);
};

window.customAlert = function(message, title = "Hinweis") {
    return new Promise((resolve) => {
        const titleEl = document.getElementById('custom-dialog-title');
        const bodyEl = document.getElementById('custom-dialog-body');
        const btnOk = document.getElementById('custom-dialog-ok');
        const btnCancel = document.getElementById('custom-dialog-cancel');
        const iconWrap = document.getElementById('custom-dialog-icon-wrap');

        if (!titleEl || !bodyEl || !btnOk || !iconWrap) {
            alert(message);
            return resolve(true);
        }

        let type = "info";
        if (title.toLowerCase().includes("erfolg")) type = "success";
        if (title.toLowerCase().includes("fehler") || title.toLowerCase().includes("system")) type = "error";
        if (title.toLowerCase().includes("achtung")) type = "confirm";

        iconWrap.className = `dialog-icon-wrapper icon-${type}`;
        iconWrap.innerHTML = DIALOG_ICONS[type] || DIALOG_ICONS.info;

        titleEl.textContent = title;
        bodyEl.innerHTML = message;
        if (btnCancel) btnCancel.classList.add('hidden');

        window.showModal('custom-dialog-overlay');

        const handleOk = () => {
            window.hideModal('custom-dialog-overlay');
            btnOk.removeEventListener('click', handleOk);
            resolve(true);
        };

        btnOk.addEventListener('click', handleOk);
    });
};

window.customConfirm = function(message, title = "Bestätigung erforderlich") {
    return new Promise((resolve) => {
        const titleEl = document.getElementById('custom-dialog-title');
        const bodyEl = document.getElementById('custom-dialog-body');
        const btnOk = document.getElementById('custom-dialog-ok');
        const btnCancel = document.getElementById('custom-dialog-cancel');
        const iconWrap = document.getElementById('custom-dialog-icon-wrap');

        if (!titleEl || !bodyEl || !btnOk || !btnCancel || !iconWrap) {
            const res = confirm(message);
            return resolve(res);
        }

        iconWrap.className = `dialog-icon-wrapper icon-confirm`;
        iconWrap.innerHTML = DIALOG_ICONS.confirm;

        titleEl.textContent = title;
        bodyEl.innerHTML = message;
        btnCancel.classList.remove('hidden');

        window.showModal('custom-dialog-overlay');

        const cleanup = () => {
            window.hideModal('custom-dialog-overlay');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
        };

        const handleOk = () => { cleanup(); resolve(true); };
        const handleCancel = () => { cleanup(); resolve(false); };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
    });
};

// ====================================================
// PDF VIEWER MODAL CONTROLLER
// ====================================================
window.showPDFModal = function(blobUrl, filename) {
    const titleEl = document.getElementById('pdf-modal-title');
    const iframe = document.getElementById('pdf-viewer-iframe');
    const btnDownload = document.getElementById('btn-download-pdf');

    if (titleEl) titleEl.textContent = filename;
    if (iframe) iframe.src = blobUrl;

    if (btnDownload) {
        btnDownload.onclick = () => {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.click();
        };
    }

    window.showModal('modal-pdf-overlay');
};

// ====================================================
// LOG SUB-TAB SWITCHER (EIGENE / PASSIVE / ARCHIV)
// ====================================================
window.switchLogSubTab = function(subTabName) {
    const tabs = ['own', 'external', 'archive'];
    tabs.forEach(t => {
        const panel = document.getElementById(`log-panel-${t}`);
        const btn = document.getElementById(`subtab-btn-${t}`);
        if (panel) panel.classList.add('hidden');
        if (btn) btn.classList.remove('active');
    });

    const activePanel = document.getElementById(`log-panel-${subTabName}`);
    const activeBtn = document.getElementById(`subtab-btn-${subTabName}`);
    if (activePanel) activePanel.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('active');

    localStorage.setItem('mngr_log_subtab', subTabName);
};

window.toggleMobileFilters = function() {
    const row = document.getElementById('billing-search-row');
    if (row) {
        row.classList.toggle('show-on-mobile');
        if (row.classList.contains('show-on-mobile')) {
            const input = document.getElementById('search-input');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }
};

window.updateHeaderLogo = function() {
    const cleanComp = (window.currentUserCompany || 'MNAU').toLowerCase();
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const logoImg = document.getElementById('header-company-logo');
    const logoText = document.getElementById('header-logo-text');

    if (logoImg) {
        logoImg.style.display = 'block';
        if (logoText) logoText.style.display = 'none';
        const suffix = currentTheme === 'dark' ? '_light' : '';
        logoImg.src = `logos/${cleanComp}${suffix}.svg`;
    }
};

window.toggleTheme = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('mnau_theme', newTheme);
    window.updateThemeIcon(newTheme);
    window.updateHeaderLogo();
};

window.updateThemeIcon = function(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
        btn.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
    }
};

window.initTheme = function() {
    const savedTheme = localStorage.getItem('mnau_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    window.updateThemeIcon(savedTheme);
    window.updateHeaderLogo();
};

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
        if (searchRow) searchRow.style.display = '';
        if (manageSuppliersBtn) manageSuppliersBtn.style.display = '';
    } else if (tabName === 'calculator') {
        document.getElementById('view-calculator').classList.remove('hidden');
        document.getElementById('tab-btn-calculator').classList.add('active');
        if (searchRow) searchRow.style.display = 'none';
        if (manageSuppliersBtn) manageSuppliersBtn.style.display = 'none';
    }
};

window.switchCompany = function(newCompany) {
    if (!newCompany) return;
    const cleanComp = newCompany.toUpperCase();
    window.currentUserCompany = cleanComp;

    document.documentElement.setAttribute('data-company', cleanComp);

    window.updateHeaderLogo();

    const compNameText = document.getElementById('header-company-name');
    if (compNameText) {
        compNameText.textContent = cleanComp;
    }

    const compSelect = document.getElementById('company-select');
    if (compSelect) {
        const colorMap = {
            'MNAG': '#ed694b',
            'MNMH': '#d42168',
            'MNWB': '#3bb3b9',
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
    window.initTheme();

    const savedSubTab = localStorage.getItem('mngr_log_subtab') || 'own';
    window.switchLogSubTab(savedSubTab);

    if (window.DOM.btnManageSuppliers) {
        window.DOM.btnManageSuppliers.addEventListener('click', () => {
            window.UI.renderSuppliersManager();
            window.showModal('modal-suppliers-overlay');
        });
    }

    if (window.DOM.searchInput) {
        window.DOM.searchInput.addEventListener('input', window.applyFilters);
    }

    const statusFilterElement = document.getElementById('status-filter');
    if (statusFilterElement) {
        statusFilterElement.addEventListener('change', window.applyFilters);
    }

    if (window.DOM.searchClearBtn) {
        window.DOM.searchClearBtn.addEventListener('click', () => {
            window.DOM.searchInput.value = '';
            window.applyFilters();
            window.DOM.searchInput.focus();
        });
    }
});

async function fetchOrders() {
    if (!window.AIRTABLE_TOKEN || !window.BASE_ID) {
        window.UI.showSetupRequired();
        return;
    }

    if (!window.loadedRecords || window.loadedRecords.length === 0) {
        if (window.DOM.loading) window.DOM.loading.classList.remove('hidden');
        if (window.DOM.orderList) window.DOM.orderList.innerHTML = '';
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
            window.Logger.warn("Lieferanten-Tabelle konnte nicht geladen werden.", e);
        }

        window.UI.updateSupplierDatalist();
        window.applyFilters();
    } catch (error) {
        window.Logger.error("Kritischer Terminal-Fehler beim Laden:", error);
    } finally {
        if (window.DOM.loading) window.DOM.loading.classList.add('hidden');
    }
}

window.openInKalkulator = async function(recordId) {
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
        await window.customAlert("Dieser Auftrag besitzt keine gespeicherten Kalkulator-Eingabedaten.", "Hinweis");
        return;
    }

    const snapshots = groupMeta.snapshots || (groupMeta.snapshot ? [groupMeta.snapshot] : []);
    const latestSnap = snapshots[snapshots.length - 1];

    if (!latestSnap || !latestSnap.kalkInputs) {
        await window.customAlert("Für diesen Auftrag ist keine gespeicherte Kalkulationsstruktur vorhanden.", "Hinweis");
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

    const projNameInput = document.getElementById('proj-name');
    if (projNameInput) {
        projNameInput.disabled = true;
    }

    window.switchTab('calculator');
    window.calculate();
};

window.cancelKalkulatorEdit = function() {
    window.activeEditingGroupId = null;
    window.activeEditingRecordId = null;

    const banner = document.getElementById('kalk-edit-banner');
    if (banner) banner.classList.add('hidden');

    const projNameInput = document.getElementById('proj-name');
    if (projNameInput) {
        projNameInput.disabled = false;
    }

    if (typeof window.resetAll === 'function') {
        window.resetAll();
    }

    window.switchTab('billing');
};

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
        timelineContainer.innerHTML = '<p style="font-size:0.8rem; text-align:center; padding:16px;">Keine Historieneinträge vorhanden.</p>';
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

    window.showModal('modal-changelog-overlay');
};

window.changeOrderStatus = async function(recordId, newStatus) {
    const targetRecord = window.loadedRecords.find(r => r.id === recordId);
    if (!targetRecord) return;

    let linkedRecordIds = [recordId];

    let isReadOnlyShare = false;
    if (targetRecord.fields.Fremdkosten_Details) {
        try {
            const parsed = JSON.parse(targetRecord.fields.Fremdkosten_Details);
            isReadOnlyShare = parsed && parsed.groupMeta && parsed.groupMeta.isReadOnlyShare === true;
        } catch(e) {}
    }

    if (!isReadOnlyShare && newStatus !== "Bezahlt") {
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
            if (window.API && typeof window.API.batchUpdateOrders === 'function') {
                try {
                    await window.API.batchUpdateOrders(batch);
                } catch (bErr) {
                    window.Logger.warn("Batch-Update fehlgeschlagen, versuche Einzel-Updates...", bErr);
                    for (const item of batch) {
                        await fetch(`${window.API_URL_ORDERS}/${item.id}`, {
                            method: 'PATCH',
                            headers: window.HEADERS,
                            body: JSON.stringify({ fields: item.fields, typecast: true })
                        });
                    }
                }
            }
        }
        window.Logger.info(`Status-Update erfolgreich auf "${newStatus}" gesetzt.`);
    } catch (error) {
        window.Logger.error("Fehler beim Status-Update:", error);
        await window.customAlert("Fehler beim Status-Update. Details in den System-Logs.", "Systemfehler");
        fetchOrders();
    }
};

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
                },
                typecast: true
            })
        });
        window.Logger.info(`Lieferantenstatus für ID ${orderId} geändert.`);
    } catch (error) {
        window.Logger.error("Fehler beim Lieferantenstatus-Toggle:", error);
        await window.customAlert("Fehler beim Aktualisieren des Lieferanten-Zahlungsstatus.", "Systemfehler");
        fetchOrders();
    }
};

window.bulkPaySupplier = async function(supplierName) {
    const confirmed = await window.customConfirm(`Möchtest du wirklich alle offenen Rechnungen für "${supplierName}" auf einmal als erledigt markieren?`, "Massen-Abgeltung");
    if (!confirmed) return;

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
            if (window.API && typeof window.API.batchUpdateOrders === 'function') {
                try {
                    await window.API.batchUpdateOrders(batch);
                } catch(bErr) {
                    for (const item of batch) {
                        await fetch(`${window.API_URL_ORDERS}/${item.id}`, {
                            method: 'PATCH',
                            headers: window.HEADERS,
                            body: JSON.stringify({ fields: item.fields, typecast: true })
                        });
                    }
                }
            }
        }
        window.Logger.info(`Massenabgeltung für ${supplierName} durchgeführt.`);
    } catch (error) {
        window.Logger.error("Massen-Update Fehler:", error);
        await window.customAlert("Massen-Update fehlgeschlagen.", "Systemfehler");
        fetchOrders();
    }
};

window.deleteSupplier = async function(supplierId, supplierName) {
    const confirmed = await window.customConfirm(`Möchtest du "${supplierName}" dauerhaft aus der Lieferanten-Datenbank löschen?`, "Lieferant löschen");
    if (!confirmed) return;

    try {
        await window.API.deleteSupplierFromAirtable(supplierId);
        window.globalSuppliers = window.globalSuppliers.filter(s => s.id !== supplierId);
        window.UI.renderSuppliersManager();
        window.UI.updateSupplierDatalist();
        window.applyFilters();
        window.Logger.info(`Lieferant ${supplierName} gelöscht.`);
    } catch (error) {
        window.Logger.error("Fehler beim Löschen des Lieferanten:", error);
        await window.customAlert("Lieferant konnte nicht gelöscht werden.", "Systemfehler");
    }
};

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

    const confirmed = await window.customConfirm(confirmMsg, "Auftrag löschen");
    if (!confirmed) return;

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
        window.Logger.info(`Auftrag/Projekte gelöscht: ${linkedRecordIds.join(', ')}`);
    } catch (error) {
        window.Logger.error("Fehler beim Löschen des Auftrags:", error);
        await window.customAlert("Fehler beim Löschen des Auftrags/der Aufträge.", "Systemfehler");
        fetchOrders();
    }
};

window.initMNAUApp = function() {
    fetchOrders();
};