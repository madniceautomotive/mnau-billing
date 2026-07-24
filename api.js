// ====================================================
// api.js: AIRTABLE CRUD API INTERFACE (EFFICIENT)
// ====================================================
window.API = {
    async fetchOrders() {
        const response = await fetch(`${window.API_URL_ORDERS}?sort[0][field]=Created%20Time&sort[0][direction]=desc`, { headers: window.HEADERS });
        if (!response.ok) throw new Error("Fehler beim Abrufen der Aufträge.");
        return await response.json();
    },

    async fetchSuppliers() {
        const response = await fetch(window.API_URL_SUPPLIERS, { headers: window.HEADERS });
        if (!response.ok) throw new Error("Fehler beim Abrufen der Lieferanten.");
        return await response.json();
    },

    async saveSuppliers(newSuppliers) {
        const response = await fetch(window.API_URL_SUPPLIERS, {
            method: 'POST',
            headers: window.HEADERS,
            body: JSON.stringify({ records: newSuppliers })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "POST Lieferanten fehlgeschlagen.");
        }
        return await response.json();
    },

    async deleteSupplierFromAirtable(supplierId) {
        const response = await fetch(`${window.API_URL_SUPPLIERS}/${supplierId}`, {
            method: 'DELETE',
            headers: window.HEADERS
        });
        if (!response.ok) throw new Error("Löschen des Lieferanten fehlgeschlagen.");
        return response;
    },

    async saveOrder(orderPayload) {
        const response = await fetch(window.API_URL_ORDERS, {
            method: 'POST',
            headers: window.HEADERS,
            body: JSON.stringify(orderPayload)
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "POST Auftrag fehlgeschlagen.");
        }
        return await response.json();
    },

    async updateOrderStatus(recordId, newStatus) {
        const response = await fetch(`${window.API_URL_ORDERS}/${recordId}`, {
            method: 'PATCH',
            headers: window.HEADERS,
            body: JSON.stringify({ fields: { "Status": newStatus } })
        });
        if (!response.ok) throw new Error("Status-Update fehlgeschlagen.");
        return await response.json();
    },

    // NEU: Bündelt bis zu 10 Updates in 1 einzigen API-Call!
    async batchUpdateOrders(recordsPayload) {
        const response = await fetch(window.API_URL_ORDERS, {
            method: 'PATCH',
            headers: window.HEADERS,
            body: JSON.stringify({ records: recordsPayload })
        });
        if (!response.ok) throw new Error("Batch-Update fehlgeschlagen.");
        return await response.json();
    },

    async deleteOrder(recordId) {
        const response = await fetch(`${window.API_URL_ORDERS}/${recordId}`, {
            method: 'DELETE',
            headers: window.HEADERS
        });
        if (!response.ok) throw new Error("Auftrag löschen fehlgeschlagen.");
        return response;
    }
};