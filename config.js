// ====================================================
// config.js: SYSTEM INITIALIZATION & STATE
// ====================================================
window.AIRTABLE_TOKEN = localStorage.getItem('MNAU_AIRTABLE_TOKEN');
window.BASE_ID = localStorage.getItem('MNAU_BASE_ID');
window.TABLE_NAME_ORDERS = "Auftraege";
window.TABLE_NAME_SUPPLIERS = "Lieferanten";

window.API_URL_ORDERS = "";
window.API_URL_SUPPLIERS = "";
window.HEADERS = {};

if (window.AIRTABLE_TOKEN && window.BASE_ID) {
    window.API_URL_ORDERS = `https://api.airtable.com/v0/${window.BASE_ID}/${window.TABLE_NAME_ORDERS}`;
    window.API_URL_SUPPLIERS = `https://api.airtable.com/v0/${window.BASE_ID}/${window.TABLE_NAME_SUPPLIERS}`;
    window.HEADERS = {
        "Authorization": `Bearer ${window.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
    };
}

// Globaler App-State
window.loadedRecords = [];
window.globalSuppliers = []; // Speichert Lieferanten als Objekte: { id: "rec...", name: "Lieferant" }