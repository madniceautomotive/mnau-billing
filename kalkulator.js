// ====================================================
// kalkulator.js: FULL LOGGING & UNLIMITED VERSIONS
// ====================================================

const ENTITIES = ['MNAG','MNMH','MNWB','MNAT','MNAU','MNGR'];
const COSTS = [
    {key:'backoffice', label:'Backoffice', def:5},
    {key:'pm', label:'Projektmanagement', def:5},
    {key:'overhead', label:'Overhead + Marketing', def:5},
    {key:'fulfillment', label:'Fulfillment', def:70},
];
const ROLES = [
    {id:'seller', label:'Verkäufer'},
    {id:'setter', label:'Setter'},
    {id:'closer1', label:'Closer 1'},
    {id:'closer2', label:'Closer 2'},
];
let MODE = 'td';

function fmt(n){ return '€ '+Number(Math.round(n*100)/100).toLocaleString('de-AT',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function getNum(id){ const el=document.getElementById(id); return el?(parseFloat(el.value)||0):0; }
function getVal(id){ const el=document.getElementById(id); return el?el.value.trim():''; }
function esc(s){ return String(s || '').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

window.setMode = function(m){
    MODE=m;
    document.getElementById('btn-td').classList.toggle('active', m==='td');
    document.getElementById('btn-bu').classList.toggle('active', m==='bu');
    const flow=document.getElementById('flow');
    flow.className='flow '+m;
    if(m==='td'){
        flow.innerHTML='<span class="flow-step base">Volumen</span><span class="op">−</span><span class="flow-step">Fremdk. &amp; Spesen</span><span class="op">=</span><span class="flow-step">Provisionsbasis</span><span class="op">−</span><span class="flow-step">Kosten &amp; Sales</span><span class="op">=</span><span class="flow-step result">Netto · Fulfillment</span>';
        document.getElementById('base-title').textContent='Volumen / Verkaufspreis je Entität';
        document.getElementById('base-hint').textContent='Bruttopreis, den der Kunde zahlt. Fremdkosten & Spesen sind Durchläufer (werden NICHT provisioniert). Vom Rest (Provisionsbasis) gehen Kosten & Sales als %-Anteile ab — übrig bleibt der Fulfillment-Anteil als Netto.';
        document.getElementById('cost-tag').textContent='% von der Provisionsbasis';
        document.getElementById('prov-tag').textContent='% von der Provisionsbasis';
    } else {
        flow.innerHTML='<span class="flow-step base">Wunschbetrag · Fulfillment</span><span class="op">÷ Ful%</span><span class="flow-step">Endpreis</span><span class="op">+</span><span class="flow-step">Fremdk. &amp; Spesen</span><span class="op">=</span><span class="flow-step result">Kundenpreis</span>';
        document.getElementById('base-title').textContent='Wunschbetrag je Entität (= Fulfillment-Anteil)';
        document.getElementById('base-hint').textContent='Netto-Betrag für die Leistung (Fulfillment). Wird über den Fulfillment-% auf den Endpreis hochgerechnet; Kosten & Sales sind Anteile am Endpreis. Fremdkosten & Spesen kommen als Durchläufer obendrauf (NICHT provisioniert).';
        document.getElementById('cost-tag').textContent='% vom Endpreis';
        document.getElementById('prov-tag').textContent='% vom Endpreis';
    }
    relabelBase();
    window.calculate();
};

function relabelBase(){
    ENTITIES.forEach(e=>{
        const lbl=document.getElementById('base-label-'+e);
        if(lbl) lbl.textContent = (MODE==='td'?'Volumen (€)':'Wunschbetrag (€)');
    });
}

function buildBaseCards(){
    document.getElementById('base-cards').innerHTML = ENTITIES.map(e=>`
    <div class="entity-card">
      <div class="entity-name col-${e}">${e}</div>
      <div class="field"><label id="base-label-${e}">Volumen (€)</label><input type="number" id="base-${e}" class="mnau-input" placeholder="0" min="0" step="100" oninput="syncCostsToVolume()"></div>
      
      <div class="field kalk-supplier-group">
        <label>Lieferanten &amp; Fremdkosten</label>
        <div id="suppliers-list-${e}" class="kalk-suppliers-list"></div>
        <button type="button" class="btn-secondary btn-small kalk-add-supp-btn" onclick="addKalkSupplierRow('${e}')">+ Lieferant</button>
        <input type="hidden" id="fk-${e}" value="0">
      </div>

      ${e==='MNGR'?`<div class="field"><label>Fremdkosten MNGR (€)</label><input type="number" id="fkmngr" class="mnau-input" placeholder="0" min="0" step="10"></div>`:''}
      
      <div class="field-row">
          <div class="field" style="flex:1;"><label>Spesen (€)</label><input type="number" id="sp-${e}" class="mnau-input" placeholder="0" min="0" step="10"></div>
          <div class="field" style="flex:1;"><label>Stundenpreis (€)</label><input type="number" id="hp-${e}" class="mnau-input" value="150" min="0" step="5"></div>
      </div>
      
      <div class="field note-field note-sep"><label>✎ Notiz ${e}</label><textarea id="note-${e}" class="mnau-input" rows="3" placeholder="Anmerkung zu ${e} …"></textarea></div>
    </div>`).join('');

    ENTITIES.forEach(e => {
        window.addKalkSupplierRow(e);
    });
}

window.addKalkSupplierRow = function(entity, name = '', amount = '') {
    const container = document.getElementById(`suppliers-list-${entity}`);
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'kalk-supplier-row';
    row.innerHTML = `
    <input type="text" class="mnau-input kalk-supp-name" list="supplier-list" placeholder="Lieferant..." value="${name}" oninput="updateEntityFremdkosten('${entity}')">
    <input type="number" step="0.01" class="mnau-input kalk-supp-amount" placeholder="0.00" value="${amount}" oninput="updateEntityFremdkosten('${entity}')">
    <button type="button" class="btn-remove-supplier kalk-supp-remove" title="Entfernen" onclick="this.parentElement.remove(); updateEntityFremdkosten('${entity}');">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
  `;
    container.appendChild(row);
    updateEntityFremdkosten(entity);
};

window.updateEntityFremdkosten = function(entity) {
    const container = document.getElementById(`suppliers-list-${entity}`);
    if (!container) return;
    let total = 0;
    container.querySelectorAll('.kalk-supp-amount').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    const fkInput = document.getElementById(`fk-${entity}`);
    if (fkInput) fkInput.value = total;
    window.syncCostsToVolume();
};

function buildCostCards(){
    document.getElementById('cost-cards').innerHTML = ENTITIES.map(e=>`
    <div class="entity-card">
      <div class="entity-name col-${e}">${e}</div>
      ${COSTS.map(c=> c.key==='fulfillment'
        ? `<div class="field"><label>${c.label} % <span class="auto-tag">auto</span></label><input type="number" id="cost-${e}-${c.key}" value="${c.def}" readonly tabindex="-1" class="mnau-input auto-field"></div>`
        : `<div class="field"><label>${c.label} %</label><input type="number" id="cost-${e}-${c.key}" class="mnau-input" value="${c.def}" min="0" step="1" oninput="updateFulfillment()"></div>`
    ).join('')}
    </div>`).join('');
}

window.updateFulfillment = function(){
    const sumSales = ROLES.reduce((s,r)=>s+getNum('role-'+r.id+'-pct'),0);
    ENTITIES.forEach(e=>{
        const base = getNum('base-'+e);
        const others = ['backoffice','pm','overhead'].reduce((s,k)=>s+getNum('cost-'+e+'-'+k),0);
        const f = base<=0 ? 0 : Math.round((100 - others - sumSales)*100)/100;
        const el = document.getElementById('cost-'+e+'-fulfillment');
        if(el){ el.value = f; el.classList.toggle('neg', f<0); }
    });
    if (typeof window.calculate === 'function') window.calculate();
};

window.syncCostsToVolume = function(){
    ENTITIES.forEach(e=>{
        const inactive = getNum('base-'+e) <= 0;
        ['backoffice','pm','overhead'].forEach(k=>{
            const el=document.getElementById('cost-'+e+'-'+k);
            if(!el) return;
            if(inactive){
                if(!el.disabled){ el.dataset.prev = el.value; el.value = 0; el.disabled = true; }
            } else if(el.disabled){
                el.disabled = false;
                el.value = (el.dataset.prev!==undefined && el.dataset.prev!=='') ? el.dataset.prev : String(COSTS.find(c=>c.key===k).def);
            }
        });
        const fel=document.getElementById('cost-'+e+'-fulfillment');
        if(fel) fel.classList.toggle('inactive', inactive);
    });
    window.updateFulfillment();
};

function getRoles(){
    return ROLES.map(r=>({
        label:r.label,
        entity:document.getElementById('role-'+r.id+'-entity').value,
        pct:getNum('role-'+r.id+'-pct')
    }));
}

const FUL_KEY='fulfillment';

function computeKalkulationFromInputs(inputs) {
    const calcMode = inputs.mode || 'td';
    const roles = inputs.roles || getRoles();
    const OTHER = COSTS.filter(c => c.key !== FUL_KEY);
    const COLS = ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT','MNGR','OVERHEAD'];

    const D={}, FK={}, SP={}, FUL={}, FULp={}, COST={}, SALES={};
    let gBase=0, gRef=0, gFul=0, gFK=0, gSP=0, kundenpreis=0;

    ENTITIES.forEach(e => {
        const baseInput = (inputs.base && parseFloat(inputs.base[e])) || 0;
        let fk = 0;
        if (inputs.suppliers && inputs.suppliers[e]) {
            inputs.suppliers[e].forEach(s => { fk += parseFloat(s.amount) || 0; });
        }
        const sp = (inputs.sp && parseFloat(inputs.sp[e])) || 0;

        let fulPct = 70;
        if (inputs.costs && inputs.costs[e] && inputs.costs[e][FUL_KEY] !== undefined) {
            fulPct = parseFloat(inputs.costs[e][FUL_KEY]);
        } else {
            const sumSales = roles.reduce((s,r) => s + (parseFloat(r.pct) || 0), 0);
            const others = ['backoffice','pm','overhead'].reduce((s,k) => s + (inputs.costs && inputs.costs[e] ? (parseFloat(inputs.costs[e][k])||0) : 5), 0);
            fulPct = baseInput <= 0 ? 0 : Math.round((100 - others - sumSales) * 100) / 100;
        }

        const d = calcMode === 'bu' ? (fulPct > 0 ? baseInput / (fulPct / 100) : baseInput) : (baseInput - fk - sp);
        D[e]=d; FK[e]=fk; SP[e]=sp; FULp[e]=fulPct; FUL[e]=d*fulPct/100;

        COST[e] = OTHER.map(c => {
            const pct = (inputs.costs && inputs.costs[e] && inputs.costs[e][c.key] !== undefined) ? parseFloat(inputs.costs[e][c.key]) : c.def;
            return { pct, amt: d * pct / 100 };
        });

        SALES[e] = roles.map(r => ({ rec: r.entity, pct: parseFloat(r.pct) || 0, amt: d * (parseFloat(r.pct) || 0) / 100 }));
        gBase += baseInput; gRef += d; gFul += FUL[e]; gFK += fk; gSP += sp; kundenpreis += d + fk + sp;
    });

    const fkMNGR = parseFloat(inputs.fkmngr) || 0;
    kundenpreis += fkMNGR;

    const salesPool = roles.map((r,ri) => ({ rec: r.entity, pct: parseFloat(r.pct)||0, pool: ENTITIES.reduce((s,e) => s + SALES[e][ri].amt, 0) }));
    const costPool  = OTHER.map((c,ci) => ({ pool: ENTITIES.reduce((s,e) => s + COST[e][ci].amt, 0) }));
    const salesByRec = {};
    salesPool.forEach(p => salesByRec[p.rec] = (salesByRec[p.rec] || 0) + p.pool);
    const totalCostPool = costPool.reduce((s,p) => s + p.pool, 0);

    const summe = {};
    COLS.forEach(c => {
        if(c==='OVERHEAD') summe[c] = totalCostPool;
        else if(ENTITIES.includes(c)) summe[c] = FUL[c] + (salesByRec[c] || 0) + FK[c] + SP[c];
        else summe[c] = salesByRec[c] || 0;
    });
    summe['MNGR'] += fkMNGR;

    const totalGroupAnteil = (summe['MNGR'] || 0) + totalCostPool;

    const groupBreakdown = {
        backoffice: Math.round((costPool[0] ? costPool[0].pool : 0) * 100) / 100,
        pm: Math.round((costPool[1] ? costPool[1].pool : 0) * 100) / 100,
        overhead: Math.round((costPool[2] ? costPool[2].pool : 0) * 100) / 100,
        provisionen: Math.round((salesByRec['MNGR'] || 0) * 100) / 100,
        fulfillment: Math.round((FUL['MNGR'] || 0) * 100) / 100,
        fremdkosten: Math.round(((FK['MNGR'] || 0) + (SP['MNGR'] || 0) + fkMNGR) * 100) / 100
    };

    const vn = n => Number(Math.round((n || 0) * 100) / 100).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ps = p => (p % 1 === 0 ? p : (+p).toFixed(1)) + '%';

    const fc = (val, pct) => {
        const z = Math.abs(val) < 0.005;
        const cls = z ? 'val-zero' : (val > 0 ? 'val-pos' : 'val-neg');
        const pre = (pct != null && pct > 0) ? `<span class="pct-badge">${ps(pct)}</span>` : '';
        return `<td class="${cls}">${pre}<span class="num-val">${vn(val)}</span></td>`;
    };
    const nc = val => `<td class="val-neutral"><span class="num-val">${vn(val)}</span></td>`;

    let h = '<table class="results kalk-results-table">';
    h += '<colgroup><col class="cg-label">' + COLS.map(() => '<col class="cg-col">').join('') + '</colgroup>';
    h += '<thead><tr>';
    h += `<th class="kundenpreis-cell"><div class="kp-title">Kundenpreis</div><div class="kp-amount">${fmt(kundenpreis)}</div></th>`;
    COLS.forEach(c => h += `<th class="col-${c}">${c}</th>`);
    h += '</tr></thead><tbody>';

    h += `<tr class="rg-base"><td class="rowlabel">${calcMode === 'td' ? 'Zu verteilendes Netto-Volumen (€)' : 'Endpreis · zu verteilen (€)'}</td>` +
        COLS.map(c => fc(ENTITIES.includes(c) ? D[c] : 0)).join('') + `</tr>`;

    roles.forEach((r, ri) => {
        h += `<tr class="rg-sales"><td class="rowlabel">${r.label} (€)</td>` +
            COLS.map(c => {
                if(c === r.entity) return fc(salesPool[ri].pool, r.pct > 0 ? r.pct : null);
                if(ENTITIES.includes(c)) return fc(-SALES[c][ri].amt, (D[c] > 0 && r.pct > 0) ? r.pct : null);
                return fc(0);
            }).join('') + `</tr>`;
    });

    OTHER.forEach((co, ci) => {
        h += `<tr class="rg-cost"><td class="rowlabel">${co.label} (€)</td>` +
            COLS.map(c => {
                if(c === 'OVERHEAD') return fc(costPool[ci].pool);
                if(ENTITIES.includes(c)) return fc(-COST[c][ci].amt, (D[c] > 0 && COST[c][ci].pct > 0) ? COST[c][ci].pct : null);
                return fc(0);
            }).join('') + `</tr>`;
    });

    h += `<tr class="rg-fulfill"><td class="rowlabel">Fulfillment ohne Fremdkosten (€)</td>` +
        COLS.map(c => ENTITIES.includes(c) ? fc(FUL[c], FULp[c] > 0 ? FULp[c] : null) : fc(0)).join('') + `</tr>`;

    h += `<tr class="rg-sales"><td class="rowlabel">Provision (€)</td>` +
        COLS.map(c => fc(salesByRec[c] || 0)).join('') + `</tr>`;

    h += `<tr class="rg-cost"><td class="rowlabel">Support (€)</td>` +
        COLS.map(c => c === 'OVERHEAD' ? fc(totalCostPool) : fc(0)).join('') + `</tr>`;

    h += `<tr class="rg-pass"><td class="rowlabel">Fremdkosten (€)</td>` +
        COLS.map(c => ENTITIES.includes(c) ? nc(FK[c]) : nc(0)).join('') + `</tr>`;
    h += `<tr class="rg-pass"><td class="rowlabel">Fremdkosten MNGR (€)</td>` +
        COLS.map(c => c === 'MNGR' ? nc(fkMNGR) : nc(0)).join('') + `</tr>`;
    h += `<tr class="rg-pass"><td class="rowlabel">Spesen (€)</td>` +
        COLS.map(c => ENTITIES.includes(c) ? nc(SP[c]) : nc(0)).join('') + `</tr>`;

    h += `<tr class="rg-sum"><td class="rowlabel">Summe (€)</td>` +
        COLS.map(c => fc(summe[c])).join('') + `</tr>`;

    h += `<tr class="rg-stunden"><td class="rowlabel">Stunden</td>` +
        COLS.map(c => {
            if(!ENTITIES.includes(c)) return `<td class="val-zero"><span class="num-val">${vn(0)}</span></td>`;
            const rate = (inputs.hp && inputs.hp[c] !== undefined) ? parseFloat(inputs.hp[c]) : 150;
            const hrs = rate > 0 ? D[c] / rate : 0;
            const pre = rate > 0 ? `<span class="pct-badge">${vn(rate)} €</span>` : '';
            return `<td class="val-zero">${pre}<span class="num-val">${vn(hrs)}</span></td>`;
        }).join('') + `</tr>`;

    h += '</tbody></table>';

    return { tableHtml: h, kundenpreis, summe, FK, totalGroupAnteil, groupBreakdown };
}

window.calculate = function(){
    const inputs = exportKalkulatorInputs();
    const res = computeKalkulationFromInputs(inputs);

    document.getElementById('results-table-wrap').innerHTML = res.tableHtml;

    const myCompany = window.currentUserCompany || "MNAU";
    const userUmsatz = res.summe[myCompany] || 0;
    const userEchteFremdkosten = res.FK[myCompany] || 0;
    const userErtrag = userUmsatz - userEchteFremdkosten;

    let totalSisterShares = 0;
    ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT'].forEach(comp => {
        if (comp !== myCompany) totalSisterShares += (res.summe[comp] || 0);
    });

    const btnSave = document.getElementById('btn-save-to-log');
    if (btnSave) {
        const isEdit = !!(window.activeEditingGroupId || window.activeEditingRecordId);
        btnSave.innerHTML = `<span class="ti">➔</span> ${myCompany} Auftrag ${isEdit ? 'überarbeiten (Neue Version)' : 'im Log erfassen'}`;
    }

    document.getElementById('metrics').innerHTML=`
    <div class="metric highlight-main">
      <div class="ml">${myCompany} Umsatz (Zufluss)</div>
      <div class="mv">${fmt(userUmsatz)}</div>
      <div class="sub-info">Verrechnung an Group</div>
    </div>
    <div class="metric highlight-profit">
      <div class="ml">${myCompany} Deckungsbeitrag</div>
      <div class="mv">${fmt(userErtrag)}</div>
      <div class="sub-info">Netto-Ertrag vor ${myCompany}-Fixkosten</div>
    </div>
    <div class="metric">
      <div class="ml">${myCompany} Echte Fremdkosten</div>
      <div class="mv">${fmt(userEchteFremdkosten)}</div>
      <div class="sub-info">Nur externe Lieferanten</div>
    </div>
    <div class="metric">
      <div class="ml">Gesamt-Projektvolumen</div>
      <div class="mv">${fmt(res.kundenpreis)}</div>
      <div class="sub-info">Kundenpreis Brutto</div>
    </div>
    <div class="metric">
      <div class="ml">Group &amp; Schwesterfirmen</div>
      <div class="mv">${fmt(res.totalGroupAnteil + totalSisterShares)}</div>
      <div class="sub-info">Direkt abgewickelt v. Group</div>
    </div>
  `;

    document.getElementById('result-mode-tag').textContent = MODE==='td' ? 'Top-down' : 'Bottom-up';
    document.getElementById('results-section').style.display='block';
};

window.loadKalkulatorInputs = function(inputs) {
    if (!inputs) return;

    if (inputs.mode) setMode(inputs.mode);

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('proj-name', inputs.projName || inputs['proj-name']);
    setVal('proj-offer', inputs.projOffer || inputs['proj-offer']);
    setVal('proj-invoice', inputs.projInvoice || inputs['proj-invoice']);
    setVal('proj-notes', inputs.projNotes || inputs['proj-notes']);
    setVal('fkmngr', inputs.fkmngr || '');

    ENTITIES.forEach(e => {
        const baseEl = document.getElementById('base-' + e);
        if (baseEl) baseEl.value = (inputs.base && inputs.base[e]) ? inputs.base[e] : '';

        const spEl = document.getElementById('sp-' + e);
        if (spEl) spEl.value = (inputs.sp && inputs.sp[e]) ? inputs.sp[e] : '';

        const hpEl = document.getElementById('hp-' + e);
        if (hpEl) hpEl.value = (inputs.hp && inputs.hp[e] !== undefined) ? inputs.hp[e] : 150;

        const noteEl = document.getElementById('note-' + e);
        if (noteEl) noteEl.value = (inputs.notes && inputs.notes[e]) || '';

        const container = document.getElementById(`suppliers-list-${e}`);
        if (container) {
            container.innerHTML = '';
            const list = (inputs.suppliers && inputs.suppliers[e]) || [];
            if (list.length > 0) {
                list.forEach(s => window.addKalkSupplierRow(e, s.name, s.amount));
            } else {
                window.addKalkSupplierRow(e);
            }
        }

        COSTS.forEach(c => {
            const cEl = document.getElementById(`cost-${e}-${c.key}`);
            if (cEl && inputs.costs && inputs.costs[e] && inputs.costs[e][c.key] !== undefined) {
                cEl.value = inputs.costs[e][c.key];
            }
        });
    });

    if (inputs.roles && Array.isArray(inputs.roles)) {
        inputs.roles.forEach((r, idx) => {
            const roleDef = ROLES[idx];
            if (roleDef) {
                const entEl = document.getElementById(`role-${roleDef.id}-entity`);
                const pctEl = document.getElementById(`role-${roleDef.id}-pct`);
                if (entEl && r.entity) entEl.value = r.entity;
                if (pctEl && r.pct !== undefined) pctEl.value = r.pct;
            }
        });
    }

    window.syncCostsToVolume();
};

function exportKalkulatorInputs() {
    const inputs = {
        projName: getVal('proj-name'),
        projOffer: getVal('proj-offer'),
        projInvoice: getVal('proj-invoice'),
        projNotes: getVal('proj-notes'),
        fkmngr: getNum('fkmngr'),
        mode: MODE,
        base: {}, sp: {}, hp: {}, notes: {}, costs: {}, suppliers: {},
        roles: getRoles()
    };

    ENTITIES.forEach(e => {
        inputs.base[e] = getNum('base-' + e);
        inputs.sp[e] = getNum('sp-' + e);
        inputs.hp[e] = getNum('hp-' + e);
        inputs.notes[e] = getVal('note-' + e);

        inputs.costs[e] = {};
        COSTS.forEach(c => {
            inputs.costs[e][c.key] = getNum(`cost-${e}-${c.key}`);
        });

        inputs.suppliers[e] = [];
        const container = document.getElementById(`suppliers-list-${e}`);
        if (container) {
            container.querySelectorAll('.kalk-supplier-row').forEach(row => {
                const sName = (row.querySelector('.kalk-supp-name').value || '').trim();
                const sAmount = parseFloat(row.querySelector('.kalk-supp-amount').value) || 0;
                if (sName || sAmount > 0) {
                    inputs.suppliers[e].push({ name: sName, amount: sAmount });
                }
            });
        }
    });

    return inputs;
}

function buildPdfNotesSectionHtml(snap) {
    const kalkInputs = snap.kalkInputs;
    const generalNotes = snap.projNotes || (kalkInputs && kalkInputs.projNotes);

    let html = '';

    if (generalNotes && generalNotes.trim()) {
        html += `
      <div class="pdf-notes-box">
        <strong>Allgemeine Projektinformationen & Notizen:</strong><br>
        ${esc(generalNotes)}
      </div>`;
    }

    if (kalkInputs) {
        const spesenNotesList = [];
        ENTITIES.forEach(e => {
            const sp = (kalkInputs.sp && kalkInputs.sp[e]) || 0;
            const nt = (kalkInputs.notes && kalkInputs.notes[e]) || '';
            if (sp > 0 || (nt && nt.trim())) {
                let text = `<strong>${e}:</strong> `;
                if (sp > 0) text += `Spesen: € ${Number(sp).toFixed(2)}`;
                if (sp > 0 && nt.trim()) text += ` | Notiz: `;
                else if (nt.trim()) text += `Notiz: `;
                if (nt.trim()) text += `${esc(nt)}`;
                spesenNotesList.push(text);
            }
        });

        if (spesenNotesList.length > 0) {
            html += `
          <div class="pdf-notes-box" style="border-left-color: #eab308;">
            <strong>Spesen & Firmennotizen:</strong>
            <ul style="margin: 4px 0 0 0; padding-left: 18px;">`;
            spesenNotesList.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += `</ul></div>`;
        }
    }

    if (kalkInputs) {
        const detailsList = [];
        ENTITIES.forEach(e => {
            const supps = (kalkInputs.suppliers && kalkInputs.suppliers[e]) || [];
            const validSupps = supps.filter(s => (s.name && s.name.trim()) || s.amount > 0);

            if (validSupps.length > 0) {
                const items = [];
                validSupps.forEach(s => items.push(`${esc(s.name || 'Lieferant')}: € ${Number(s.amount).toFixed(2)}`));
                detailsList.push(`<strong>${e}:</strong> ${items.join(' • ')}`);
            }
        });

        if (detailsList.length > 0) {
            html += `
        <div class="pdf-notes-box" style="border-left-color: #ef4444;">
          <strong>Externe Lieferanten:</strong>
          <ul style="margin: 4px 0 0 0; padding-left: 18px;">`;
            detailsList.forEach(item => {
                html += `<li>${item}</li>`;
            });
            html += `</ul></div>`;
        }
    }

    if (html !== '') {
        return `<div class="pdf-notes-container">${html}</div>`;
    }
    return '';
}

async function executeBatchOrFallbackUpdates(updates) {
    if (!updates || updates.length === 0) return;

    try {
        for (let i = 0; i < updates.length; i += 10) {
            const batch = updates.slice(i, i + 10);
            if (window.API && typeof window.API.batchUpdateOrders === 'function') {
                await window.API.batchUpdateOrders(batch);
            } else {
                throw new Error("Batch API nicht verfügbar.");
            }
        }
        window.Logger.info(`Batch-Update für ${updates.length} Datensätze erfolgreich.`);
    } catch (batchErr) {
        window.Logger.warn("Batch-Update fehlgeschlagen, schalte auf Einzel-Updates um...", batchErr);
        for (const item of updates) {
            const res = await fetch(`${window.API_URL_ORDERS}/${item.id}`, {
                method: 'PATCH',
                headers: window.HEADERS,
                body: JSON.stringify({ fields: item.fields, typecast: true })
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Einzel-Update für ID ${item.id} fehlgeschlagen: HTTP ${res.status} - ${errText}`);
            }
        }
        window.Logger.info(`Einzel-Fallback-Updates für ${updates.length} Datensätze erfolgreich.`);
    }
}

// AUFTRAG SPEICHERN
window.saveMNAUOrderToLog = async function() {
    const myCompany = (window.currentUserCompany || "MNAU").trim().toUpperCase();
    const projNameRaw = getVal('proj-name');
    const projName = projNameRaw ? projNameRaw : "Unbenanntes Projekt";
    const orderTitle = `${projName} (${myCompany})`;

    const isEditing = !!(window.activeEditingGroupId || window.activeEditingRecordId);
    let calcGroupId = window.activeEditingGroupId;
    if (!calcGroupId) {
        calcGroupId = "grp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    }

    const kalkInputs = exportKalkulatorInputs();
    const currentCalc = computeKalkulationFromInputs(kalkInputs);

    const getSuppliersForCompany = (compName) => {
        const compSuppliers = [];
        const container = document.getElementById(`suppliers-list-${compName}`);
        if (container) {
            container.querySelectorAll('.kalk-supplier-row').forEach(row => {
                const nameInput = row.querySelector('.kalk-supp-name');
                const amountInput = row.querySelector('.kalk-supp-amount');
                const sName = (nameInput ? nameInput.value : '').trim();
                const sAmount = parseFloat(amountInput ? amountInput.value : 0) || 0;
                if (sName !== '' || sAmount > 0) {
                    compSuppliers.push({ name: sName || `Lieferant ${compName}`, amount: Math.round(sAmount * 100) / 100, paid: false });
                }
            });
        }
        return compSuppliers;
    };

    const safeAmt = (v) => isNaN(v) ? 0 : Math.round(v * 100) / 100;

    const userUmsatz = safeAmt(currentCalc.summe[myCompany]);
    if (userUmsatz <= 0) {
        await window.customAlert(`Der ${myCompany}-Umsatz beträgt 0.00 €. Es wurde kein Auftrag erfasst.`, "Hinweis");
        return;
    }

    const mainSuppliers = getSuppliersForCompany(myCompany);
    const totalFremdkosten = mainSuppliers.reduce((s, item) => s + item.amount, 0);

    const allSharesDetail = {};
    ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT'].forEach(comp => {
        const amt = currentCalc.summe[comp] || 0;
        if (amt > 0) allSharesDetail[comp] = safeAmt(amt);
    });

    const btn = document.getElementById('btn-save-to-log');

    try {
        if (isEditing) {
            let linkedRecords = [];
            if (window.activeEditingGroupId) {
                linkedRecords = window.loadedRecords.filter(r => {
                    try {
                        const p = JSON.parse(r.fields.Fremdkosten_Details);
                        return p && p.groupMeta && p.groupMeta.groupId === window.activeEditingGroupId;
                    } catch(e) { return false; }
                });
            }

            if (linkedRecords.length === 0 && window.activeEditingRecordId) {
                const targetRec = window.loadedRecords.find(r => r.id === window.activeEditingRecordId);
                if (targetRec) {
                    const targetName = targetRec.fields.Auftrag;
                    linkedRecords = window.loadedRecords.filter(r => r.fields.Auftrag === targetName || r.id === window.activeEditingRecordId);
                }
            }

            let existingSnapshots = [];
            for (const r of linkedRecords) {
                try {
                    const p = JSON.parse(r.fields.Fremdkosten_Details);
                    if (p && p.groupMeta) {
                        const sn = p.groupMeta.snapshots || (p.groupMeta.snapshot ? [p.groupMeta.snapshot] : []);
                        if (sn.length > existingSnapshots.length) {
                            existingSnapshots = sn;
                        }
                    }
                } catch(e) {}
            }

            const newVersionNum = existingSnapshots.length > 0 ? existingSnapshots[existingSnapshots.length - 1].version + 1 : 2;

            if (btn) { btn.disabled = true; btn.textContent = "Speichere Version v" + newVersionNum + "..."; }

            const newSnapshot = {
                version: newVersionNum,
                timestamp: new Date().toISOString(),
                user: window.currentUserEmail || "Unbekannt",
                kalkInputs: kalkInputs,
                projName: projName,
                projOffer: getVal('proj-offer'),
                projInvoice: getVal('proj-invoice'),
                projNotes: getVal('proj-notes')
            };

            const updatedSnapshots = [...existingSnapshots, newSnapshot];

            const updates = [];
            const recordsToDelete = [];
            const handledCompanies = new Set();

            for (const rec of linkedRecords) {
                const comp = (rec.fields.Firma || myCompany).trim().toUpperCase();
                handledCompanies.add(comp);
                const compSuppliers = getSuppliersForCompany(comp);
                const compFremdkosten = compSuppliers.reduce((s, item) => s + item.amount, 0);
                const compUmsatz = safeAmt(currentCalc.summe[comp]);

                if (compUmsatz <= 0 && comp !== myCompany) {
                    recordsToDelete.push(rec.id);
                    continue;
                }

                let existingChangelog = [];
                if (rec.fields.Changelog) {
                    try { existingChangelog = JSON.parse(rec.fields.Changelog); } catch(e) {}
                }

                const logEntry = {
                    user: window.currentUserEmail,
                    timestamp: new Date().toISOString(),
                    action: `Kalkulator Version v${newVersionNum} erstellt`,
                    comment: `Neukalkulation aus Group Kalkulator gespeichert`,
                    details: [
                        `Neue Version v${newVersionNum}:`,
                        `• ${comp} Umsatz: € ${compUmsatz.toFixed(2)}`,
                        `• Fremdkosten: € ${compFremdkosten.toFixed(2)}`
                    ]
                };

                const updatedChangelog = [logEntry, ...existingChangelog];

                const isMain = (comp === myCompany);
                const groupMeta = {
                    groupId: calcGroupId,
                    isReadOnlyShare: !isMain,
                    originCompany: myCompany,
                    originProject: projName,
                    projOffer: getVal('proj-offer'),
                    projInvoice: getVal('proj-invoice'),
                    projNotes: getVal('proj-notes'),
                    entityNote: (kalkInputs.notes && kalkInputs.notes[comp]) || '',
                    spesen: (kalkInputs.sp && parseFloat(kalkInputs.sp[comp])) || 0,
                    kundenpreis: safeAmt(currentCalc.kundenpreis),
                    groupAnteil: safeAmt(currentCalc.totalGroupAnteil),
                    mngrAbgabe: safeAmt(currentCalc.totalGroupAnteil),
                    groupBreakdown: currentCalc.groupBreakdown,
                    allSharesDetail: allSharesDetail,
                    snapshots: updatedSnapshots
                };

                const updatedDetails = JSON.stringify({ suppliers: compSuppliers, groupMeta: groupMeta });

                updates.push({
                    id: rec.id,
                    targetRecordRef: rec,
                    compUmsatz, compFremdkosten, updatedDetails, updatedChangelog, orderTitle,
                    fields: {
                        "Auftrag": orderTitle,
                        "Betrag_Automotive": compUmsatz,
                        "Fremdkosten": safeAmt(compFremdkosten),
                        "Fremdkosten_Details": updatedDetails,
                        "Flagged": true,
                        "Changelog": JSON.stringify(updatedChangelog)
                    }
                });
            }

            if (recordsToDelete.length > 0) {
                for (const idToDelete of recordsToDelete) {
                    await window.API.deleteOrder(idToDelete);
                }
                window.loadedRecords = window.loadedRecords.filter(r => !recordsToDelete.includes(r.id));
            }

            const newCompanyRecordsToCreate = [];
            Object.entries(allSharesDetail).forEach(([comp, amt]) => {
                if (!handledCompanies.has(comp) && amt > 0) {
                    const compSuppliers = getSuppliersForCompany(comp);
                    const compFremdkosten = compSuppliers.reduce((s, item) => s + item.amount, 0);
                    const groupMeta = {
                        groupId: calcGroupId, isReadOnlyShare: (comp !== myCompany), originCompany: myCompany, originProject: projName,
                        projOffer: getVal('proj-offer'), projInvoice: getVal('proj-invoice'), projNotes: getVal('proj-notes'),
                        entityNote: (kalkInputs.notes && kalkInputs.notes[comp]) || '', spesen: (kalkInputs.sp && parseFloat(kalkInputs.sp[comp])) || 0,
                        kundenpreis: safeAmt(currentCalc.kundenpreis), groupAnteil: safeAmt(currentCalc.totalGroupAnteil),
                        mngrAbgabe: safeAmt(currentCalc.totalGroupAnteil), groupBreakdown: currentCalc.groupBreakdown,
                        allSharesDetail: allSharesDetail, snapshots: updatedSnapshots
                    };
                    newCompanyRecordsToCreate.push({
                        fields: {
                            "Auftrag": orderTitle, "Betrag_Automotive": amt, "Fremdkosten": safeAmt(compFremdkosten),
                            "Fremdkosten_Details": JSON.stringify({ suppliers: compSuppliers, groupMeta: groupMeta }),
                            "Status": "In Bearbeitung", "Firma": comp, "Flagged": false,
                            "Changelog": JSON.stringify([{ user: window.currentUserEmail, timestamp: new Date().toISOString(), action: "Projektupdate", comment: "Neu hinzugekommen in v" + newVersionNum, details: [] }])
                        }
                    });
                }
            });

            await executeBatchOrFallbackUpdates(updates.map(u => ({ id: u.id, fields: u.fields })));

            updates.forEach(u => {
                u.targetRecordRef.fields.Auftrag = u.orderTitle;
                u.targetRecordRef.fields.Betrag_Automotive = u.compUmsatz;
                u.targetRecordRef.fields.Fremdkosten = safeAmt(u.compFremdkosten);
                u.targetRecordRef.fields.Fremdkosten_Details = u.updatedDetails;
                u.targetRecordRef.fields.Flagged = true;
                u.targetRecordRef.fields.Changelog = JSON.stringify(u.updatedChangelog);
            });

            if (newCompanyRecordsToCreate.length > 0) {
                const createdData = await window.API.saveOrder({ records: newCompanyRecordsToCreate });
                if (createdData && createdData.records && createdData.records.length > 0) {
                    createdData.records.forEach(r => window.loadedRecords.unshift(r));
                }
            }

            window.UI.updateSupplierDatalist();
            window.cancelKalkulatorEdit();
            if (typeof window.applyFilters === 'function') window.applyFilters();
            await window.customAlert(`Neue Version v${newVersionNum} für "${orderTitle}" wurde erfasst.`, "Erfolg");

        } else {
            if (btn) { btn.disabled = true; btn.textContent = "Speichere Version v1..."; }

            const newSnapshot = {
                version: 1,
                timestamp: new Date().toISOString(),
                user: window.currentUserEmail || "Unbekannt",
                kalkInputs: kalkInputs,
                projName: projName,
                projOffer: getVal('proj-offer'),
                projInvoice: getVal('proj-invoice'),
                projNotes: getVal('proj-notes')
            };

            const recordsToCreate = [];
            const INITIAL_STATUS = "In Bearbeitung";

            const groupMetaMain = {
                groupId: calcGroupId, originCompany: myCompany,
                projOffer: getVal('proj-offer'), projInvoice: getVal('proj-invoice'), projNotes: getVal('proj-notes'),
                entityNote: (kalkInputs.notes && kalkInputs.notes[myCompany]) || '', spesen: (kalkInputs.sp && parseFloat(kalkInputs.sp[myCompany])) || 0,
                kundenpreis: safeAmt(currentCalc.kundenpreis), groupAnteil: safeAmt(currentCalc.totalGroupAnteil),
                mngrAbgabe: safeAmt(currentCalc.totalGroupAnteil), groupBreakdown: currentCalc.groupBreakdown,
                allSharesDetail: allSharesDetail, snapshots: [newSnapshot]
            };

            const initialChangelog = [{
                user: window.currentUserEmail || "Unbekannt", timestamp: new Date().toISOString(), action: "Hauptauftrag aus Group Kalkulator erfasst", comment: `Ersterstellung (Version v1)`,
                details: [`Auftrag "${orderTitle}" angelegt:`, `• ${myCompany} Umsatz: € ${userUmsatz.toFixed(2)}`, `• ${myCompany} Fremdkosten: € ${totalFremdkosten.toFixed(2)}`, `• Gesamt-Projektvolumen: € ${currentCalc.kundenpreis.toFixed(2)}`]
            }];

            recordsToCreate.push({
                fields: { "Auftrag": orderTitle, "Betrag_Automotive": userUmsatz, "Fremdkosten": safeAmt(totalFremdkosten), "Fremdkosten_Details": JSON.stringify({ suppliers: mainSuppliers, groupMeta: groupMetaMain }), "Status": INITIAL_STATUS, "Firma": myCompany, "Flagged": false, "Changelog": JSON.stringify(initialChangelog) }
            });

            Object.entries(allSharesDetail).forEach(([comp, amt]) => {
                if (comp !== myCompany && amt > 0) {
                    const compSuppliers = getSuppliersForCompany(comp);
                    const compFremdkosten = compSuppliers.reduce((s, item) => s + item.amount, 0);
                    const shareGroupMeta = {
                        groupId: calcGroupId, isReadOnlyShare: true, originCompany: myCompany, originProject: projName,
                        projOffer: getVal('proj-offer'), projInvoice: getVal('proj-invoice'), projNotes: getVal('proj-notes'),
                        entityNote: (kalkInputs.notes && kalkInputs.notes[comp]) || '', spesen: (kalkInputs.sp && parseFloat(kalkInputs.sp[comp])) || 0,
                        kundenpreis: safeAmt(currentCalc.kundenpreis), groupAnteil: safeAmt(currentCalc.totalGroupAnteil),
                        mngrAbgabe: safeAmt(currentCalc.totalGroupAnteil), groupBreakdown: currentCalc.groupBreakdown,
                        allSharesDetail: allSharesDetail, snapshots: [newSnapshot]
                    };
                    const shareChangelog = [{
                        user: window.currentUserEmail || "Unbekannt", timestamp: new Date().toISOString(), action: "Erlösanteil aus Group Kalkulator erfasst", comment: `Automatisch von ${myCompany} für ${comp} angelegt`,
                        details: [`Erlösanteil für ${comp} aus Projekt "${projName}" (${myCompany}):`, `• Anteil ${comp}: € ${amt.toFixed(2)}`]
                    }];
                    recordsToCreate.push({
                        fields: { "Auftrag": orderTitle, "Betrag_Automotive": amt, "Fremdkosten": safeAmt(compFremdkosten), "Fremdkosten_Details": JSON.stringify({ suppliers: compSuppliers, groupMeta: shareGroupMeta }), "Status": INITIAL_STATUS, "Firma": comp, "Flagged": false, "Changelog": JSON.stringify(shareChangelog) }
                    });
                }
            });

            const createdData = await window.API.saveOrder({ records: recordsToCreate });
            if (createdData && createdData.records && createdData.records.length > 0) {
                createdData.records.forEach(r => window.loadedRecords.unshift(r));
                window.UI.updateSupplierDatalist();
                window.cancelKalkulatorEdit();
                if (typeof window.applyFilters === 'function') window.applyFilters();
                await window.customAlert(`${createdData.records.length} Auftrag/Aufträge (Version v1) im Log erfasst.`, "Erfolg");
            }
        }

    } catch (err) {
        // DRILL-DOWN ERROR LOGGING
        window.Logger.error("Fehler beim Erfassen des Auftrags im Log:", err);
        await window.customAlert("Fehler beim Erfassen des Auftrags im Log: " + (err.message || err), "Systemfehler");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = `<span class="ti">➔</span> ${myCompany} Auftrag im Log erfassen`; }
    }
};

// PDF VIEWER - TOOLBAR MIT LUPEN & OHNE SIDEBAR THUMBNAILS
window.downloadKalkulatorPDFFromLog = async function(recordId, snapshotIndex = null) {
    const record = (window.loadedRecords || []).find(r => r.id === recordId);
    if (!record || !record.fields.Fremdkosten_Details) {
        await window.customAlert("Kein Kalkulator-Datensatz gefunden.", "Hinweis");
        return;
    }

    let groupMeta = null;
    try {
        const parsed = JSON.parse(record.fields.Fremdkosten_Details);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) groupMeta = parsed.groupMeta;
    } catch(e) {}

    if (!groupMeta) {
        await window.customAlert("Kein Kalkulator-Snapshot gespeichert.", "Hinweis");
        return;
    }

    const snapshots = groupMeta.snapshots || (groupMeta.snapshot ? [groupMeta.snapshot] : []);
    if (snapshots.length === 0) {
        await window.customAlert("Keine PDF-Snapshots gefunden.", "Hinweis");
        return;
    }

    const targetIndex = (snapshotIndex !== null && snapshotIndex >= 0 && snapshotIndex < snapshots.length)
        ? snapshotIndex
        : (snapshots.length - 1);

    const snap = snapshots[targetIndex];
    const versionTag = snap.version ? `v${snap.version}` : `v${targetIndex + 1}`;

    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (typeof html2canvas === 'undefined' || !jsPDF) {
        await window.customAlert("PDF-Bibliotheken nicht geladen.", "Systemfehler");
        return;
    }

    const historicCalc = computeKalkulationFromInputs(snap.kalkInputs || {});

    const d = new Date(snap.timestamp || record.createdTime || Date.now()), p = n => String(n).padStart(2,'0');
    const ts = `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    const logo = `<span style="font-weight:900;font-size:24px;letter-spacing:-.03em;color:#1a1a1a;">MAD&nbsp;N/CE <span style="font-size:12px;letter-spacing:.12em;color:#00663a;">GROUP</span></span>`;
    const field = (lbl,val) => val ? `<div class="pdf-meta-item"><span class="lbl">${lbl}</span><span class="val">${esc(val)}</span></div>` : '';

    const notesSectionHtml = buildPdfNotesSectionHtml(snap);

    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:1200px;background:#ffffff;padding:40px;box-sizing:border-box;position:absolute;left:-9999px;top:0;z-index:-1;';

    sheet.innerHTML = `
    <style>
      .pdf-wrapper { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; }
      .pdf-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #00663a; padding-bottom: 20px; margin-bottom: 24px; }
      .pdf-header-left h2 { margin: 0 0 4px 0; font-size: 26px; color: #0f172a; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; }
      .pdf-header-left p { margin: 0; color: #64748b; font-size: 13px; font-weight: 500; }
      .pdf-meta { display: flex; gap: 15px; margin-bottom: 24px; }
      .pdf-meta-item { display: flex; flex-direction: column; background: #f8fafc; padding: 12px 18px; border-radius: 8px; border: 1px solid #e2e8f0; min-width: 180px; }
      .pdf-meta-item .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px; }
      .pdf-meta-item .val { font-size: 15px; font-weight: 700; color: #0f172a; }
      
      .pdf-notes-container { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
      .pdf-notes-box { background: #f8fafc; border-left: 4px solid #00663a; border: 1px solid #e2e8f0; border-left-width: 4px; border-left-color: #00663a; padding: 12px 16px; font-size: 12px; color: #0f172a; border-radius: 6px; line-height: 1.5; }
      
      .pdf-table-container { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
      table.kalk-results-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      table.kalk-results-table th { background: #f1f5f9; color: #334155; padding: 14px 10px; text-align: right; font-weight: 800; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 11px; }
      table.kalk-results-table th.kundenpreis-cell { background: #00663a; color: #ffffff; text-align: left; padding: 14px 20px; }
      table.kalk-results-table th.kundenpreis-cell .kp-title { font-size: 10px; color: #a7f3d0; margin-bottom: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      table.kalk-results-table th.kundenpreis-cell .kp-amount { font-size: 18px; font-weight: 800; color: #ffffff; }
      table.kalk-results-table td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155; }
      table.kalk-results-table td.rowlabel { text-align: left; font-weight: 700; color: #1e293b; background: #f8fafc; border-right: 1px solid #e2e8f0; padding-left: 20px; width: 240px; }
      table.kalk-results-table .pct-badge { display: inline-block; background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 10px; color: #475569; margin-right: 8px; font-weight: 700; }
      table.kalk-results-table .val-pos { color: #059669; font-weight: 800; }
      table.kalk-results-table .val-neg { color: #dc2626; font-weight: 800; }
      table.kalk-results-table .val-zero { color: #94a3b8; }
      table.kalk-results-table tr.rg-base td { background: #ffffff; }
      table.kalk-results-table tr.rg-sales td { background: #fff7ed; }
      table.kalk-results-table tr.rg-cost td { background: #f0f9ff; }
      table.kalk-results-table tr.rg-fulfill td { background: #dcfce7; font-weight: 800; color: #064e3b; }
      table.kalk-results-table tr.rg-sum td { background: #e6f4ea; border-top: 2px solid #10b981; border-bottom: 2px solid #10b981; font-weight: 800; font-size: 13px; color: #064e3b; }
    </style>
    <div class="pdf-wrapper">
        <div class="pdf-header">
            <div class="pdf-header-left">
                <h2>Group Kalkulation (${versionTag})</h2>
                <p>Versionierter Snapshot • Erstellt von ${esc(snap.user || 'Unbekannt')} am ${ts}</p>
            </div>
            <div>${logo}</div>
        </div>
        
        <div class="pdf-meta">
            ${field('Projekt', snap.projName || record.fields.Auftrag || 'Nicht angegeben')}
            ${field('Angebot', snap.projOffer)}
            ${field('Rechnung', snap.projInvoice)}
            ${field('Version', versionTag)}
        </div>
        
        ${notesSectionHtml}
        
        <div class="pdf-table-container">
            ${historicCalc.tableHtml}
        </div>
    </div>
  `;

    document.body.appendChild(sheet);

    const W = sheet.offsetWidth, H = sheet.offsetHeight + 40;
    const sx = window.scrollX, sy = window.scrollY;
    window.scrollTo(0,0);

    const cleanup = () => { sheet.remove(); window.scrollTo(sx, sy); };

    setTimeout(() => {
        html2canvas(sheet, { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, width: W, height: H, windowWidth: W, windowHeight: H })
            .then(canvas => {
                const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
                const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
                const m = 10, availW = pw - 2*m, availH = ph - 2*m;
                const r = canvas.width / canvas.height;
                let iw = availW, ih = iw / r;
                if (ih > availH) { ih = availH; iw = ih * r; }
                const x = (pw - iw) / 2, y = m;
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', x, y, iw, ih);

                const safeName = (snap.projName || record.fields.Auftrag || 'Group-Kalkulator').replace(/[^\wäöüÄÖÜ\- ]+/g,'').trim().replace(/\s+/g,'_');
                const filename = `Group-Kalkulator_${safeName}_${versionTag}.pdf`;

                // TOOLBAR=1 (ZOOM LEISTE AKTIV), NAVPANES=0 (KEINE SIDEBAR THUMBNAILS)
                const blobUrl = pdf.output('bloburl') + '#toolbar=1&navpanes=0&view=FitH';
                window.showPDFModal(blobUrl, filename);
                cleanup();

            }).catch(async err => { cleanup(); window.Logger.error("PDF-Renderfehler:", err); await window.customAlert('PDF-Fehler: ' + err.message, "Systemfehler"); });
    }, 300);
};

window.exportPDF = async function(){
    window.calculate();
    const name=(getVal('proj-name')||'Group-Kalkulator').replace(/[^\wäöüÄÖÜ\- ]+/g,'').trim().replace(/\s+/g,'_')||'Group-Kalkulator';
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if(typeof html2canvas==='undefined' || !jsPDF){
        await window.customAlert('PDF-Bibliothek nicht geladen.', "Systemfehler");
        return;
    }

    const kalkInputs = exportKalkulatorInputs();
    const snap = {
        projName: getVal('proj-name'),
        projOffer: getVal('proj-offer'),
        projInvoice: getVal('proj-invoice'),
        projNotes: getVal('proj-notes'),
        kalkInputs: kalkInputs
    };

    const currentCalc = computeKalkulationFromInputs(kalkInputs);

    const d = new Date(), p = n => String(n).padStart(2,'0');
    const ts = `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    const logo = `<span style="font-weight:900;font-size:24px;letter-spacing:-.03em;color:#1a1a1a;">MAD&nbsp;N/CE <span style="font-size:12px;letter-spacing:.12em;color:#00663a;">GROUP</span></span>`;
    const field = (lbl,val) => val ? `<div class="pdf-meta-item"><span class="lbl">${lbl}</span><span class="val">${esc(val)}</span></div>` : '';

    const notesSectionHtml = buildPdfNotesSectionHtml(snap);

    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:1200px;background:#ffffff;padding:40px;box-sizing:border-box;position:absolute;left:-9999px;top:0;z-index:-1;';
    sheet.innerHTML = `
    <style>
      .pdf-wrapper { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; }
      .pdf-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #00663a; padding-bottom: 20px; margin-bottom: 24px; }
      .pdf-header-left h2 { margin: 0 0 4px 0; font-size: 26px; color: #0f172a; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; }
      .pdf-header-left p { margin: 0; color: #64748b; font-size: 13px; font-weight: 500; }
      .pdf-meta { display: flex; gap: 15px; margin-bottom: 24px; }
      .pdf-meta-item { display: flex; flex-direction: column; background: #f8fafc; padding: 12px 18px; border-radius: 8px; border: 1px solid #e2e8f0; min-width: 180px; }
      .pdf-meta-item .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px; }
      .pdf-meta-item .val { font-size: 15px; font-weight: 700; color: #0f172a; }
      
      .pdf-notes-container { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
      .pdf-notes-box { background: #f8fafc; border-left: 4px solid #00663a; border: 1px solid #e2e8f0; border-left-width: 4px; border-left-color: #00663a; padding: 12px 16px; font-size: 12px; color: #0f172a; border-radius: 6px; line-height: 1.5; }

      .pdf-table-container { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
      table.kalk-results-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      table.kalk-results-table th { background: #f1f5f9; color: #334155; padding: 14px 10px; text-align: right; font-weight: 800; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 11px; }
      table.kalk-results-table th.kundenpreis-cell { background: #00663a; color: #ffffff; text-align: left; padding: 14px 20px; }
      table.kalk-results-table th.kundenpreis-cell .kp-title { font-size: 10px; color: #a7f3d0; margin-bottom: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      table.kalk-results-table th.kundenpreis-cell .kp-amount { font-size: 18px; font-weight: 800; color: #ffffff; }
      table.kalk-results-table td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155; }
      table.kalk-results-table td.rowlabel { text-align: left; font-weight: 700; color: #1e293b; background: #f8fafc; border-right: 1px solid #e2e8f0; padding-left: 20px; width: 240px; }
      table.kalk-results-table .pct-badge { display: inline-block; background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 10px; color: #475569; margin-right: 8px; font-weight: 700; }
      table.kalk-results-table .val-pos { color: #059669; font-weight: 800; }
      table.kalk-results-table .val-neg { color: #dc2626; font-weight: 800; }
      table.kalk-results-table .val-zero { color: #94a3b8; }
      table.kalk-results-table tr.rg-base td { background: #ffffff; }
      table.kalk-results-table tr.rg-sales td { background: #fff7ed; }
      table.kalk-results-table tr.rg-cost td { background: #f0f9ff; }
      table.kalk-results-table tr.rg-fulfill td { background: #dcfce7; font-weight: 800; color: #064e3b; }
      table.kalk-results-table tr.rg-sum td { background: #e6f4ea; border-top: 2px solid #10b981; border-bottom: 2px solid #10b981; font-weight: 800; font-size: 13px; color: #064e3b; }
      .metric-grid { display: none; }
    </style>
    <div class="pdf-wrapper">
        <div class="pdf-header">
            <div class="pdf-header-left">
                <h2>Group Kalkulation</h2>
                <p>Direktexport • Erstellt am ${ts}</p>
            </div>
            <div>${logo}</div>
        </div>
        <div class="pdf-meta">
            ${field('Projekt', snap.projName || 'Nicht angegeben')}
            ${field('Angebot', snap.projOffer)}
            ${field('Rechnung', snap.projInvoice)}
        </div>
        
        ${notesSectionHtml}

        <div class="pdf-table-container">
            ${currentCalc.tableHtml}
        </div>
    </div>
  `;

    document.body.appendChild(sheet);
    const W = sheet.offsetWidth, H = sheet.offsetHeight + 40;
    const sx = window.scrollX, sy = window.scrollY;
    window.scrollTo(0,0);

    const cleanup = () => { sheet.remove(); window.scrollTo(sx,sy); };

    setTimeout(() => {
        html2canvas(sheet, { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, width: W, height: H, windowWidth: W, windowHeight: H })
            .then(canvas => {
                const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
                const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
                const m = 10, availW = pw - 2*m, availH = ph - 2*m;
                const r = canvas.width / canvas.height;
                let iw = availW, ih = iw / r;
                if (ih > availH) { ih = availH; iw = ih * r; }
                const x = (pw - iw) / 2, y = m;
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', x, y, iw, ih);

                const filename = `Group-Kalkulator_${name}.pdf`;

                const blobUrl = pdf.output('bloburl') + '#toolbar=1&navpanes=0&view=FitH';
                window.showPDFModal(blobUrl, filename);
                cleanup();

            }).catch(async err => { cleanup(); window.Logger.error("PDF-Export Fehler:", err); await window.customAlert('PDF-Fehler: ' + err.message, "Systemfehler"); });
    }, 300);
};

window.resetAll = function(){
    ENTITIES.forEach(e=>{
        const baseEl = document.getElementById('base-' + e); if(baseEl) baseEl.value = '';
        const spEl = document.getElementById('sp-' + e); if(spEl) spEl.value = '';

        const container = document.getElementById(`suppliers-list-${e}`);
        if (container) { container.innerHTML = ''; window.addKalkSupplierRow(e); }
        const hp=document.getElementById('hp-'+e); if(hp) hp.value=150;
        const nt=document.getElementById('note-'+e); if(nt) nt.value='';
        COSTS.forEach(c=>{const el=document.getElementById('cost-'+e+'-'+c.key);if(el){el.value=c.def;el.disabled=false;delete el.dataset.prev;}});
    });
    [['seller',3],['setter',4],['closer1',4],['closer2',4]].forEach(([id,v])=>{const el=document.getElementById('role-'+id+'-pct'); if(el) el.value=v;});
    ['proj-name','proj-offer','proj-invoice','proj-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const fm=document.getElementById('fkmngr'); if(fm) fm.value='';

    const projNameInput = document.getElementById('proj-name');
    if (projNameInput) { projNameInput.disabled = false; }

    window.activeEditingGroupId = null;
    window.activeEditingRecordId = null;
    const banner = document.getElementById('kalk-edit-banner');
    if (banner) banner.classList.add('hidden');

    const btnSave = document.getElementById('btn-save-to-log');
    if (btnSave) {
        const myCompany = window.currentUserCompany || "MNAU";
        btnSave.innerHTML = `<span class="ti">➔</span> ${myCompany} Auftrag im Log erfassen`;
    }

    window.syncCostsToVolume();
    window.calculate();
};

window.addEventListener('beforeprint',()=>{
    if (document.getElementById('view-calculator').classList.contains('hidden')) return;
    window.calculate();
});

// INIT & LIVE RE-CALCULATION EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    buildBaseCards();
    buildCostCards();
    syncCostsToVolume();
    setMode('td');

    const calcContainer = document.getElementById('view-calculator');
    if (calcContainer) {
        calcContainer.addEventListener('input', () => window.calculate());
        calcContainer.addEventListener('change', () => window.calculate());
    }

    window.calculate();
});