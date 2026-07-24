// ====================================================
// config.js: BASE64 OBFUSCATED AIRTABLE CREDENTIALS
// ====================================================

const OBFUSCATED_TOKEN = "cGF0c290TGpINmdNdEpJMnAuYzZlMjVkOWNkZDZmYzU5MTJmOGNiZmJlOTlmYzczYjk4YTYzMWM3MmJmYzM0YWMzNWFiZTI5NzQ5YjU4MjBkNQ==";

window.AIRTABLE_TOKEN = atob(OBFUSCATED_TOKEN);
window.BASE_ID = "appCESBUunBy9OOo0";

window.TABLE_NAME_ORDERS = "Auftraege";
window.TABLE_NAME_SUPPLIERS = "Lieferanten";
window.TABLE_NAME_USERS = "Benutzer";

window.API_URL_ORDERS = `https://api.airtable.com/v0/${window.BASE_ID}/${window.TABLE_NAME_ORDERS}`;
window.API_URL_SUPPLIERS = `https://api.airtable.com/v0/${window.BASE_ID}/${window.TABLE_NAME_SUPPLIERS}`;
window.API_URL_USERS = `https://api.airtable.com/v0/${window.BASE_ID}/${window.TABLE_NAME_USERS}`;

window.HEADERS = {
    "Authorization": `Bearer ${window.AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
};

// Globaler App-State
window.loadedRecords = [];
window.globalSuppliers = [];
window.currentUserEmail = "Unbekannt";
window.currentUserCompanies = ["MNAU"];
window.currentUserCompany = "MNAU";

// Verfolgung des aktiven Projekts im Edit-Modus
window.activeEditingGroupId = null;
window.activeEditingRecordId = null;

// Globale DOM-Schnittstellen
window.DOM = {
    orderList: document.getElementById('order-list'),
    externalOrderList: document.getElementById('external-order-list'),
    archiveList: document.getElementById('archive-list'),
    loading: document.getElementById('loading'),
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    btnManageSuppliers: document.getElementById('btn-manage-suppliers'),
    modalSuppliers: document.getElementById('modal-suppliers-overlay'),
    btnCloseSuppliers: document.getElementById('btn-close-suppliers')
};