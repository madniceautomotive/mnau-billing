// ====================================================
// kalkulator.js: VERSIONED GROUP KALKULATOR & LOG INTEGRATION
// ====================================================

const ENTITIES = ['MNAG','MNMH','MNWB','MNAT','MNAU','MNGR'];
const COSTS = [
    {key:'backoffice', label:'Backoffice', def:6},
    {key:'pm', label:'Projektmanagement', def:9},
    {key:'overhead', label:'Overhead + Marketing', def:5},
    {key:'fulfillment', label:'Fulfillment', def:65},
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
function esc(s){ return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

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
    document.getElementById('results-section').style.display='none';
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
      <div class="field"><label id="base-label-${e}">Volumen (€)</label><input type="number" id="base-${e}" class="mnau-input" value="0" min="0" step="100" oninput="syncCostsToVolume()"></div>
      
      <div class="field kalk-supplier-group">
        <label>Lieferanten &amp; Fremdkosten</label>
        <div id="suppliers-list-${e}" class="kalk-suppliers-list"></div>
        <button type="button" class="btn-secondary btn-small kalk-add-supp-btn" onclick="addKalkSupplierRow('${e}')">+ Lieferant</button>
        <input type="hidden" id="fk-${e}" value="0">
      </div>

      ${e==='MNGR'?`<div class="field"><label>Fremdkosten MNGR (€)</label><input type="number" id="fkmngr" class="mnau-input" value="0" min="0" step="10"></div>`:''}
      
      <div class="field-row">
          <div class="field" style="flex:1;"><label>Spesen (€)</label><input type="number" id="sp-${e}" class="mnau-input" value="0" min="0" step="10"></div>
          <div class="field" style="flex:1;"><label>Stundenpreis (€)</label><input type="number" id="hp-${e}" class="mnau-input" value="150" min="0" step="5"></div>
      </div>
      
      <div class="field note-field note-sep"><label>✎ Notiz ${e}</label><textarea id="note-${e}" class="mnau-input" rows="1" placeholder="Anmerkung zu ${e} …"></textarea></div>
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
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 13.41 12z"/></svg>
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

window.calculate = function(){
    const roles = getRoles();
    const OTHER = COSTS.filter(c => c.key !== FUL_KEY);
    const COLS = ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT','MNGR','OVERHEAD'];

    const D={}, FK={}, SP={}, FUL={}, FULp={}, COST={}, SALES={};
    let gBase=0, gRef=0, gFul=0, gFK=0, gSP=0, kundenpreis=0;
    ENTITIES.forEach(e=>{
        const baseInput=getNum('base-'+e), fk=getNum('fk-'+e), sp=getNum('sp-'+e);
        const fulPct=getNum('cost-'+e+'-'+FUL_KEY);
        const d = MODE==='bu' ? (fulPct>0?baseInput/(fulPct/100):baseInput) : (baseInput-fk-sp);
        D[e]=d; FK[e]=fk; SP[e]=sp; FULp[e]=fulPct; FUL[e]=d*fulPct/100;
        COST[e]=OTHER.map(c=>{const pct=getNum('cost-'+e+'-'+c.key);return {pct,amt:d*pct/100};});
        SALES[e]=roles.map(r=>({rec:r.entity,pct:r.pct,amt:d*r.pct/100}));
        gBase+=baseInput; gRef+=d; gFul+=FUL[e]; gFK+=fk; gSP+=sp; kundenpreis+=d+fk+sp;
    });
    const fkMNGR = getNum('fkmngr'); kundenpreis += fkMNGR;

    const salesPool = roles.map((r,ri)=>({rec:r.entity,pct:r.pct,pool:ENTITIES.reduce((s,e)=>s+SALES[e][ri].amt,0)}));
    const costPool  = OTHER.map((c,ci)=>({pool:ENTITIES.reduce((s,e)=>s+COST[e][ci].amt,0)}));
    const salesByRec={}; salesPool.forEach(p=>salesByRec[p.rec]=(salesByRec[p.rec]||0)+p.pool);
    const totalCostPool = costPool.reduce((s,p)=>s+p.pool,0);
    const recipientTotals = salesByRec;
    const summe={};
    COLS.forEach(c=>{
        if(c==='OVERHEAD') summe[c]=totalCostPool;
        else if(ENTITIES.includes(c)) summe[c]=FUL[c]+(salesByRec[c]||0)+FK[c]+SP[c];
        else summe[c]=salesByRec[c]||0;
    });
    summe['MNGR'] += fkMNGR;

    const vn = n => Number(Math.round(n*100)/100).toLocaleString('de-AT',{minimumFractionDigits:2,maximumFractionDigits:2});
    const ps = p => (p%1===0?p:(+p).toFixed(1))+'%';

    const fc = (val,pct)=>{
        const z = Math.abs(val) < 0.005;
        const cls = z ? 'val-zero' : (val > 0 ? 'val-pos' : 'val-neg');
        const pre = (pct != null && pct > 0) ? `<span class="pct-badge">${ps(pct)}</span>` : '';
        return `<td class="${cls}">${pre}<span class="num-val">${vn(val)}</span></td>`;
    };
    const nc = val => `<td class="val-neutral"><span class="num-val">${vn(val)}</span></td>`;

    let h='<table class="results flow">';
    h+='<colgroup><col class="cg-label">'+COLS.map(()=>'<col class="cg-col">').join('')+'</colgroup>';
    h+='<thead><tr>';
    h+=`<th class="kundenpreis-cell"><div class="kp-title">Kundenpreis</div><div class="kp-amount">${fmt(kundenpreis)}</div></th>`;
    COLS.forEach(c=>h+=`<th class="col-${c}">${c}</th>`);
    h+='</tr></thead><tbody>';

    h+=`<tr class="rg-base"><td class="rowlabel">${MODE==='td'?'Zu verteilendes Netto-Volumen (€)':'Endpreis · zu verteilen (€)'}</td>`+
        COLS.map(c=>fc(ENTITIES.includes(c)?D[c]:0)).join('')+`</tr>`;

    roles.forEach((r,ri)=>{
        h+=`<tr class="rg-sales"><td class="rowlabel">${r.label} (€)</td>`+
            COLS.map(c=>{
                if(c===r.entity) return fc(salesPool[ri].pool, r.pct>0?r.pct:null);
                if(ENTITIES.includes(c)) return fc(-SALES[c][ri].amt, (D[c]>0&&r.pct>0)?r.pct:null);
                return fc(0);
            }).join('')+`</tr>`;
    });

    OTHER.forEach((co,ci)=>{
        h+=`<tr class="rg-cost"><td class="rowlabel">${co.label} (€)</td>`+
            COLS.map(c=>{
                if(c==='OVERHEAD') return fc(costPool[ci].pool);
                if(ENTITIES.includes(c)) return fc(-COST[c][ci].amt, (D[c]>0&&COST[c][ci].pct>0)?COST[c][ci].pct:null);
                return fc(0);
            }).join('')+`</tr>`;
    });

    h+=`<tr class="rg-fulfill"><td class="rowlabel">Fulfillment ohne Fremdkosten (€)</td>`+
        COLS.map(c=>ENTITIES.includes(c)?fc(FUL[c], FULp[c]>0?FULp[c]:null):fc(0)).join('')+`</tr>`;

    h+=`<tr class="rg-sales"><td class="rowlabel">Provision (€)</td>`+
        COLS.map(c=>fc(salesByRec[c]||0)).join('')+`</tr>`;

    h+=`<tr class="rg-cost"><td class="rowlabel">Support (€)</td>`+
        COLS.map(c=>c==='OVERHEAD'?fc(totalCostPool):fc(0)).join('')+`</tr>`;

    h+=`<tr class="rg-pass"><td class="rowlabel">Fremdkosten (€)</td>`+
        COLS.map(c=>ENTITIES.includes(c)?nc(FK[c]):nc(0)).join('')+`</tr>`;
    h+=`<tr class="rg-pass"><td class="rowlabel">Fremdkosten MNGR (€)</td>`+
        COLS.map(c=>c==='MNGR'?nc(fkMNGR):nc(0)).join('')+`</tr>`;
    h+=`<tr class="rg-pass"><td class="rowlabel">Spesen (€)</td>`+
        COLS.map(c=>ENTITIES.includes(c)?nc(SP[c]):nc(0)).join('')+`</tr>`;

    h+=`<tr class="rg-sum"><td class="rowlabel">Summe (€)</td>`+
        COLS.map(c=>fc(summe[c])).join('')+`</tr>`;

    h+=`<tr class="rg-stunden"><td class="rowlabel">Stunden</td>`+
        COLS.map(c=>{
            if(!ENTITIES.includes(c)) return `<td class="val-zero"><span class="num-val">${vn(0)}</span></td>`;
            const rate=getNum('hp-'+c);
            const hrs=rate>0?D[c]/rate:0;
            const pre=rate>0?`<span class="pct-badge">${vn(rate)} €</span>`:'';
            return `<td class="val-zero">${pre}<span class="num-val">${vn(hrs)}</span></td>`;
        }).join('')+`</tr>`;

    h+='</tbody></table>';
    document.getElementById('results-table-wrap').innerHTML=h;

    const myCompany = window.currentUserCompany || "MNAU";
    const userUmsatz = summe[myCompany] || 0;
    const userEchteFremdkosten = (FK[myCompany] || 0) + (SP[myCompany] || 0);
    const userErtrag = userUmsatz - userEchteFremdkosten;
    const mngrAbgabe = summe['MNGR'] || 0;

    let totalSisterShares = 0;
    ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT'].forEach(comp => {
        if (comp !== myCompany) totalSisterShares += (summe[comp] || 0);
    });

    const btnSave = document.getElementById('btn-save-to-log');
    if (btnSave) {
        const isEdit = !!window.activeEditingGroupId;
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
      <div class="sub-info">Eigene Lieferanten &amp; Spesen</div>
    </div>
    <div class="metric">
      <div class="ml">Gesamt-Projektvolumen</div>
      <div class="mv">${fmt(kundenpreis)}</div>
      <div class="sub-info">Kundenpreis Brutto</div>
    </div>
    <div class="metric">
      <div class="ml">Group &amp; Schwesterfirmen</div>
      <div class="mv">${fmt(mngrAbgabe + totalSisterShares)}</div>
      <div class="sub-info">Direkt abgewickelt v. Group</div>
    </div>
  `;

    document.getElementById('result-mode-tag').textContent = MODE==='td' ? 'Top-down' : 'Bottom-up';
    document.getElementById('results-section').style.display='block';
    document.getElementById('results-section').scrollIntoView({behavior:'smooth',block:'nearest'});
};

// ====================================================
// ZUSTAND DES KALKULATORS ZURÜCKLADEN (FÜR EDIT-MODUS)
// ====================================================
window.loadKalkulatorInputs = function(inputs) {
    if (!inputs) return;

    if (inputs.mode) setMode(inputs.mode);

    ['proj-name','proj-offer','proj-invoice','proj-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = inputs[id] || '';
    });

    const fm = document.getElementById('fkmngr');
    if (fm) fm.value = inputs.fkmngr || 0;

    ENTITIES.forEach(e => {
        const baseEl = document.getElementById('base-' + e);
        if (baseEl) baseEl.value = (inputs.base && inputs.base[e]) || 0;

        const spEl = document.getElementById('sp-' + e);
        if (spEl) spEl.value = (inputs.sp && inputs.sp[e]) || 0;

        const hpEl = document.getElementById('hp-' + e);
        if (hpEl) hpEl.value = (inputs.hp && inputs.hp[e]) || 150;

        const noteEl = document.getElementById('note-' + e);
        if (noteEl) noteEl.value = (inputs.notes && inputs.notes[e]) || '';

        // Lieferanten wiederherstellen
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

        // Kostenanteile
        COSTS.forEach(c => {
            const cEl = document.getElementById(`cost-${e}-${c.key}`);
            if (cEl && inputs.costs && inputs.costs[e] && inputs.costs[e][c.key] !== undefined) {
                cEl.value = inputs.costs[e][c.key];
            }
        });
    });

    // Rollen & Provisionen
    if (inputs.roles && Array.isArray(inputs.roles)) {
        inputs.roles.forEach((r, idx) => {
            const roleDef = ROLES[idx];
            if (roleDef) {
                const entEl = document.getElementById(`role-${roleDef.id}-entity`);
                const pctEl = document.getElementById(`role-${roleDef.id}-pct`);
                if (entEl) entEl.value = r.entity;
                if (pctEl) pctEl.value = r.pct;
            }
        });
    }

    window.syncCostsToVolume();
};

// Extrahiert den kompletten aktuellen Kalkulator-Eingabezustand für die Speicherung im Snapshot
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

// ====================================================
// AUFTRAG IM LOG ERFASSEN / AKTUALISIEREN (MIT VERSIONIERUNG)
// ====================================================
window.saveMNAUOrderToLog = async function() {
    const myCompany = window.currentUserCompany || "MNAU";
    const projNameRaw = getVal('proj-name');
    const projName = projNameRaw ? projNameRaw : "Unbenanntes Projekt";
    const orderTitle = `${projName} (${myCompany})`;

    // Verwende bestehende groupId beim Bearbeiten oder erstelle neue ID
    const isEditing = !!window.activeEditingGroupId;
    const calcGroupId = isEditing
        ? window.activeEditingGroupId
        : ("grp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7));

    const roles = getRoles();
    const OTHER = COSTS.filter(c => c.key !== FUL_KEY);
    const COLS = ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT','MNGR','OVERHEAD'];

    const D={}, FK={}, SP={}, FUL={}, FULp={}, COST={}, SALES={};
    let gBase=0, gRef=0, gFul=0, gFK=0, gSP=0, kundenpreis=0;
    ENTITIES.forEach(e=>{
        const baseInput=getNum('base-'+e), fk=getNum('fk-'+e), sp=getNum('sp-'+e);
        const fulPct=getNum('cost-'+e+'-'+FUL_KEY);
        const d = MODE==='bu' ? (fulPct>0?baseInput/(fulPct/100):baseInput) : (baseInput-fk-sp);
        D[e]=d; FK[e]=fk; SP[e]=sp; FULp[e]=fulPct; FUL[e]=d*fulPct/100;
        COST[e]=OTHER.map(c=>{const pct=getNum('cost-'+e+'-'+c.key);return {pct,amt:d*pct/100};});
        SALES[e]=roles.map(r=>({rec:r.entity,pct:r.pct,amt:d*r.pct/100}));
        gBase+=baseInput; gRef+=d; gFul+=FUL[e]; gFK+=fk; gSP+=sp; kundenpreis+=d+fk+sp;
    });
    const fkMNGR = getNum('fkmngr'); kundenpreis += fkMNGR;

    const salesPool = roles.map((r,ri)=>({rec:r.entity,pct:r.pct,pool:ENTITIES.reduce((s,e)=>s+SALES[e][ri].amt,0)}));
    const costPool  = OTHER.map((c,ci)=>({pool:ENTITIES.reduce((s,e)=>s+COST[e][ci].amt,0)}));
    const salesByRec={}; salesPool.forEach(p=>salesByRec[p.rec]=(salesByRec[p.rec]||0)+p.pool);
    const totalCostPool = costPool.reduce((s,p)=>s+p.pool,0);

    const summe={};
    COLS.forEach(c=>{
        if(c==='OVERHEAD') summe[c]=totalCostPool;
        else if(ENTITIES.includes(c)) summe[c]=FUL[c]+(salesByRec[c]||0)+FK[c]+SP[c];
        else summe[c]=salesByRec[c]||0;
    });
    summe['MNGR'] += fkMNGR;

    const getSuppliersForCompany = (compName) => {
        const compSuppliers = [];
        const container = document.getElementById(`suppliers-list-${compName}`);
        if (container) {
            container.querySelectorAll('.kalk-supplier-row').forEach(row => {
                const sName = (row.querySelector('.kalk-supp-name').value || '').trim();
                const sAmount = parseFloat(row.querySelector('.kalk-supp-amount').value) || 0;
                if (sName !== '' || sAmount > 0) {
                    compSuppliers.push({ name: sName || `Fremdkosten ${compName}`, amount: Math.round(sAmount * 100) / 100, paid: false });
                    if (sName !== '' && window.globalSuppliers && window.API && window.API.saveSuppliers) {
                        const exists = window.globalSuppliers.some(g => g.name.toLowerCase() === sName.toLowerCase());
                        if (!exists) {
                            window.API.saveSuppliers([{ fields: { "Name": sName } }]).then(res => {
                                if (res && res.records) {
                                    res.records.forEach(r => window.globalSuppliers.push({ id: r.id, name: r.fields.Name }));
                                    if (window.UI && window.UI.updateSupplierDatalist) window.UI.updateSupplierDatalist();
                                }
                            }).catch(e => console.warn("Lieferant Fehler:", e));
                        }
                    }
                }
            });
        }
        const compSP = SP[compName] || 0;
        if (compSP > 0) compSuppliers.push({ name: `Spesen ${compName}`, amount: Math.round(compSP * 100) / 100, paid: false });
        return compSuppliers;
    };

    const userUmsatz = Math.round((summe[myCompany] || 0) * 100) / 100;
    if (userUmsatz <= 0) { alert(`Der ${myCompany}-Umsatz beträgt 0.00 €. Es wurde kein Auftrag erfasst.`); return; }

    const mainSuppliers = getSuppliersForCompany(myCompany);
    const totalFremdkosten = mainSuppliers.reduce((s, item) => s + item.amount, 0);

    const mngrAbgabe = summe['MNGR'] || 0;
    const allSharesDetail = {};
    ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT'].forEach(comp => {
        const amt = summe[comp] || 0;
        if (amt > 0) allSharesDetail[comp] = Math.round(amt * 100) / 100;
    });

    // Erzeuge Input-Snapshot für die spätere Re-Kalkulation
    const kalkInputs = exportKalkulatorInputs();

    // Bisherige Snapshots ermitteln (für Versionierung)
    let existingSnapshots = [];
    if (isEditing) {
        const existingRec = window.loadedRecords.find(r => {
            try {
                const p = JSON.parse(r.fields.Fremdkosten_Details);
                return p && p.groupMeta && p.groupMeta.groupId === calcGroupId;
            } catch(e) { return false; }
        });
        if (existingRec && existingRec.fields.Fremdkosten_Details) {
            try {
                const parsed = JSON.parse(existingRec.fields.Fremdkosten_Details);
                if (parsed.groupMeta) {
                    existingSnapshots = parsed.groupMeta.snapshots || (parsed.groupMeta.snapshot ? [parsed.groupMeta.snapshot] : []);
                }
            } catch(e) {}
        }
    }

    const newVersionNum = existingSnapshots.length + 1;
    const newSnapshot = {
        version: newVersionNum,
        timestamp: new Date().toISOString(),
        user: window.currentUserEmail || "Unbekannt",
        kalkInputs: kalkInputs,
        projName: getVal('proj-name'),
        projOffer: getVal('proj-offer'),
        projInvoice: getVal('proj-invoice'),
        projNotes: getVal('proj-notes'),
        resultsTableHtml: document.getElementById('results-table-wrap').innerHTML
    };

    const updatedSnapshots = [...existingSnapshots, newSnapshot];

    const btn = document.getElementById('btn-save-to-log');
    if (btn) { btn.disabled = true; btn.textContent = "Speichere Version v" + newVersionNum + "..."; }

    try {
        if (isEditing) {
            // ===== 1. UPDATE MODUS: AKTUALISIERE BESTEHENDE RECORDS IN AIRTABLE =====
            const linkedRecords = window.loadedRecords.filter(r => {
                try {
                    const p = JSON.parse(r.fields.Fremdkosten_Details);
                    return p && p.groupMeta && p.groupMeta.groupId === calcGroupId;
                } catch(e) { return false; }
            });

            const updates = [];

            // Update für die beteiligten Firmen durchführen
            const handledCompanies = new Set();

            for (const rec of linkedRecords) {
                const comp = rec.fields.Firma;
                handledCompanies.add(comp);
                const compSuppliers = getSuppliersForCompany(comp);
                const compFremdkosten = compSuppliers.reduce((s, item) => s + item.amount, 0);
                const compUmsatz = Math.round((summe[comp] || 0) * 100) / 100;

                let existingChangelog = [];
                if (rec.fields.Changelog) {
                    try { existingChangelog = JSON.parse(rec.fields.Changelog); } catch(e) {}
                }

                existingChangelog.unshift({
                    user: window.currentUserEmail,
                    timestamp: new Date().toISOString(),
                    action: `Kalkulator Version v${newVersionNum} erstellt`,
                    comment: `Neukalkulation aus Group Kalkulator gespeichert`,
                    details: [
                        `Neue Version v${newVersionNum}:`,
                        `• ${comp} Umsatz: € ${compUmsatz.toFixed(2)}`,
                        `• Fremdkosten: € ${compFremdkosten.toFixed(2)}`
                    ]
                });

                const isMain = comp === myCompany;
                const groupMeta = {
                    groupId: calcGroupId,
                    isReadOnlyShare: !isMain,
                    originCompany: myCompany,
                    originProject: projName,
                    kundenpreis: Math.round(kundenpreis * 100) / 100,
                    mngrAbgabe: Math.round(mngrAbgabe * 100) / 100,
                    allSharesDetail: allSharesDetail,
                    snapshots: updatedSnapshots
                };

                const updatedDetails = JSON.stringify({ suppliers: compSuppliers, groupMeta: groupMeta });

                updates.push({
                    id: rec.id,
                    fields: {
                        "Auftrag": orderTitle,
                        "Betrag_Automotive": compUmsatz,
                        "Fremdkosten": Math.round(compFremdkosten * 100) / 100,
                        "Fremdkosten_Details": updatedDetails,
                        "Flagged": true,
                        "Changelog": JSON.stringify(existingChangelog)
                    }
                });
            }

            // Falls eine Schwesterfirma durch die Neuberechnung neu hinzugekommen ist: POST
            const newCompanyRecordsToCreate = [];
            Object.entries(allSharesDetail).forEach(([comp, amt]) => {
                if (!handledCompanies.has(comp) && amt > 0) {
                    const compSuppliers = getSuppliersForCompany(comp);
                    const compFremdkosten = compSuppliers.reduce((s, item) => s + item.amount, 0);
                    const groupMeta = {
                        groupId: calcGroupId, isReadOnlyShare: (comp !== myCompany), originCompany: myCompany, originProject: projName,
                        kundenpreis: Math.round(kundenpreis * 100) / 100, mngrAbgabe: Math.round(mngrAbgabe * 100) / 100,
                        allSharesDetail: allSharesDetail, snapshots: updatedSnapshots
                    };
                    newCompanyRecordsToCreate.push({
                        fields: {
                            "Auftrag": orderTitle, "Betrag_Automotive": amt, "Fremdkosten": Math.round(compFremdkosten * 100) / 100,
                            "Fremdkosten_Details": JSON.stringify({ suppliers: compSuppliers, groupMeta: groupMeta }),
                            "Status": "In Bearbeitung", "Firma": comp, "Flagged": false,
                            "Changelog": JSON.stringify([{ user: window.currentUserEmail, timestamp: new Date().toISOString(), action: "Projektupdate", comment: "Neu hinzugekommen in v" + newVersionNum, details: [] }])
                        }
                    });
                }
            });

            // Updates absenden
            for (let i = 0; i < updates.length; i += 10) {
                const batch = updates.slice(i, i + 10);
                await window.API.batchUpdateOrders(batch);
            }

            if (newCompanyRecordsToCreate.length > 0) {
                await window.API.saveOrder({ records: newCompanyRecordsToCreate });
            }

            // Lokalen state nachladen und aufräumen
            window.cancelKalkulatorEdit();
            await fetchOrders(); // Lädt die frischen Daten komplett aus Airtable
            alert(`Erfolg! Neue Version v${newVersionNum} für "${orderTitle}" wurde im Log erfasst.`);

        } else {
            // ===== 2. ERSTSTELLUNG MODUS: NEUES PROJEKT ANLEGEN =====
            const recordsToCreate = [];
            const INITIAL_STATUS = "In Bearbeitung";

            const groupMetaMain = {
                groupId: calcGroupId, originCompany: myCompany, kundenpreis: Math.round(kundenpreis * 100) / 100,
                mngrAbgabe: Math.round(mngrAbgabe * 100) / 100, allSharesDetail: allSharesDetail, snapshots: updatedSnapshots
            };

            const initialChangelog = [{
                user: window.currentUserEmail || "Unbekannt", timestamp: new Date().toISOString(), action: "Hauptauftrag aus Group Kalkulator erfasst", comment: `Ersterstellung (Version v1)`,
                details: [`Auftrag "${orderTitle}" angelegt:`, `• ${myCompany} Umsatz: € ${userUmsatz.toFixed(2)}`, `• ${myCompany} Fremdkosten: € ${totalFremdkosten.toFixed(2)}`, `• Gesamt-Projektvolumen: € ${kundenpreis.toFixed(2)}`]
            }];

            recordsToCreate.push({
                fields: { "Auftrag": orderTitle, "Betrag_Automotive": userUmsatz, "Fremdkosten": Math.round(totalFremdkosten * 100) / 100, "Fremdkosten_Details": JSON.stringify({ suppliers: mainSuppliers, groupMeta: groupMetaMain }), "Status": INITIAL_STATUS, "Firma": myCompany, "Flagged": false, "Changelog": JSON.stringify(initialChangelog) }
            });

            Object.entries(allSharesDetail).forEach(([comp, amt]) => {
                if (comp !== myCompany && amt > 0) {
                    const compSuppliers = getSuppliersForCompany(comp);
                    const compFremdkosten = compSuppliers.reduce((s, item) => s + item.amount, 0);
                    const shareGroupMeta = { groupId: calcGroupId, isReadOnlyShare: true, originCompany: myCompany, originProject: projName, kundenpreis: Math.round(kundenpreis * 100) / 100, mngrAbgabe: Math.round(mngrAbgabe * 100) / 100, allSharesDetail: allSharesDetail, snapshots: updatedSnapshots };
                    const shareChangelog = [{
                        user: window.currentUserEmail || "Unbekannt", timestamp: new Date().toISOString(), action: "Erlösanteil aus Group Kalkulator erfasst", comment: `Automatisch von ${myCompany} für ${comp} angelegt`,
                        details: [`Erlösanteil für ${comp} aus Projekt "${projName}" (${myCompany}):`, `• Anteil ${comp}: € ${amt.toFixed(2)}`]
                    }];
                    recordsToCreate.push({
                        fields: { "Auftrag": orderTitle, "Betrag_Automotive": amt, "Fremdkosten": Math.round(compFremdkosten * 100) / 100, "Fremdkosten_Details": JSON.stringify({ suppliers: compSuppliers, groupMeta: shareGroupMeta }), "Status": INITIAL_STATUS, "Firma": comp, "Flagged": false, "Changelog": JSON.stringify(shareChangelog) }
                    });
                }
            });

            const createdData = await window.API.saveOrder({ records: recordsToCreate });
            if (createdData && createdData.records && createdData.records.length > 0) {
                createdData.records.forEach(r => window.loadedRecords.unshift(r));
                window.UI.updateSupplierDatalist();

                window.cancelKalkulatorEdit();
                if (typeof window.applyFilters === 'function') window.applyFilters();
                else window.UI.renderOrders(window.loadedRecords);

                alert(`Erfolg! ${createdData.records.length} Auftrag/Aufträge (Version v1) im Log erfasst.`);
            }
        }

    } catch (err) {
        alert("Fehler beim Erfassen des Auftrags im Log: " + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = `<span class="ti">➔</span> ${myCompany} Auftrag im Log erfassen`; }
    }
};

// ====================================================
// PDF DOWNLOAD DIREKT AUS DEM AUFTRAGS-LOG (VERSIONEN-AWARE)
// ====================================================
window.downloadKalkulatorPDFFromLog = function(recordId, snapshotIndex = null) {
    const record = (window.loadedRecords || []).find(r => r.id === recordId);
    if (!record || !record.fields.Fremdkosten_Details) { alert("Kein Kalkulator-Datensatz gefunden."); return; }

    let groupMeta = null;
    try {
        const parsed = JSON.parse(record.fields.Fremdkosten_Details);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) groupMeta = parsed.groupMeta;
    } catch(e) {}

    if (!groupMeta) { alert("Kein Kalkulator-Snapshot gespeichert."); return; }

    const snapshots = groupMeta.snapshots || (groupMeta.snapshot ? [groupMeta.snapshot] : []);
    if (snapshots.length === 0) { alert("Keine PDF-Snapshots gefunden."); return; }

    // Verwende angefragten Index oder standardmäßig die neueste Version
    const targetIndex = (snapshotIndex !== null && snapshotIndex >= 0 && snapshotIndex < snapshots.length)
        ? snapshotIndex
        : (snapshots.length - 1);

    const snap = snapshots[targetIndex];
    const versionTag = snap.version ? `v${snap.version}` : `v${targetIndex + 1}`;

    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (typeof html2canvas === 'undefined' || !jsPDF) { alert("PDF-Bibliotheken nicht geladen."); return; }

    const d = new Date(snap.timestamp || record.createdTime || Date.now()), p = n => String(n).padStart(2,'0');
    const ts = `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    const logo = `<span style="font-weight:900;font-size:24px;letter-spacing:-.03em;color:#1a1a1a;">MAD&nbsp;N/CE <span style="font-size:12px;letter-spacing:.12em;color:#00663a;">GROUP</span></span>`;
    const field = (lbl,val) => val ? `<div class="pdf-meta-item"><span class="lbl">${lbl}</span><span class="val">${esc(val)}</span></div>` : '';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:1200px;background:#ffffff;padding:40px;box-sizing:border-box;position:absolute;left:-9999px;top:0;';

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
      .pdf-notes { background: #f0fdf4; border-left: 4px solid #10b981; padding: 14px 18px; font-size: 13px; color: #064e3b; margin-bottom: 24px; border-radius: 4px; line-height: 1.5; }
      .pdf-table-container { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
      table.results { width: 100%; border-collapse: collapse; font-size: 12px; }
      table.results th { background: #f1f5f9; color: #334155; padding: 14px 10px; text-align: right; font-weight: 800; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 11px; }
      table.results th.kundenpreis-cell { background: #00663a; color: #ffffff; text-align: left; padding: 14px 20px; }
      table.results th.kundenpreis-cell .kp-title { font-size: 10px; color: #a7f3d0; margin-bottom: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      table.results th.kundenpreis-cell .kp-amount { font-size: 18px; font-weight: 800; color: #ffffff; }
      table.results td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155; }
      table.results td.rowlabel { text-align: left; font-weight: 700; color: #1e293b; background: #f8fafc; border-right: 1px solid #e2e8f0; padding-left: 20px; width: 240px; }
      table.results .pct-badge { display: inline-block; background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 10px; color: #475569; margin-right: 8px; font-weight: 700; }
      table.results .val-pos { color: #059669; font-weight: 800; }
      table.results .val-neg { color: #dc2626; font-weight: 800; }
      table.results .val-zero { color: #94a3b8; }
      table.results tr.rg-base td { background: #ffffff; }
      table.results tr.rg-sales td { background: #fff7ed; }
      table.results tr.rg-cost td { background: #f0f9ff; }
      table.results tr.rg-fulfill td { background: #f0fdf4; font-weight: 800; color: #064e3b; }
      table.results tr.rg-sum td { background: #e6f4ea; border-top: 2px solid #10b981; border-bottom: 2px solid #10b981; font-weight: 800; font-size: 13px; color: #064e3b; }
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
            ${field('Projekt', snap.projName || 'Nicht angegeben')}
            ${field('Angebot', snap.projOffer)}
            ${field('Rechnung', snap.projInvoice)}
            ${field('Version', versionTag)}
        </div>
        
        ${snap.projNotes ? `<div class="pdf-notes"><strong>Notizen (v${versionTag}):</strong><br>${esc(snap.projNotes)}</div>` : ''}
        
        <div class="pdf-table-container">
            ${snap.resultsTableHtml}
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
                pdf.save(`Group-Kalkulator_${safeName}_${versionTag}.pdf`);
                cleanup();
            }).catch(err => { cleanup(); alert('PDF-Fehler: ' + err.message); });
    }, 300);
};

window.resetAll = function(){
    ENTITIES.forEach(e=>{
        ['base','sp'].forEach(p=>{const el=document.getElementById(p+'-'+e);if(el)el.value=0;});
        const container = document.getElementById(`suppliers-list-${e}`);
        if (container) { container.innerHTML = ''; window.addKalkSupplierRow(e); }
        const hp=document.getElementById('hp-'+e); if(hp) hp.value=150;
        const nt=document.getElementById('note-'+e); if(nt) nt.value='';
        COSTS.forEach(c=>{const el=document.getElementById('cost-'+e+'-'+c.key);if(el){el.value=c.def;el.disabled=false;delete el.dataset.prev;}});
    });
    [['seller',3],['setter',4],['closer1',4],['closer2',4]].forEach(([id,v])=>{const el=document.getElementById('role-'+id+'-pct'); if(el) el.value=v;});
    ['proj-name','proj-offer','proj-invoice','proj-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const fm=document.getElementById('fkmngr'); if(fm) fm.value=0;
    window.syncCostsToVolume();
    const resultsSec = document.getElementById('results-section');
    if(resultsSec) resultsSec.style.display='none';

    // HARTES ZURÜCKSETZEN DES BEARBEITUNGS-MODUS AUCH BEIM "RESET"-KLICK
    window.activeEditingGroupId = null;
    const banner = document.getElementById('kalk-edit-banner');
    if (banner) banner.classList.add('hidden');

    // Button Status resetten falls abgebrochen
    const btnSave = document.getElementById('btn-save-to-log');
    if (btnSave) {
        const myCompany = window.currentUserCompany || "MNAU";
        btnSave.innerHTML = `<span class="ti">➔</span> ${myCompany} Auftrag im Log erfassen`;
    }
};

window.exportPDF = function(){
    window.calculate();
    const name=(getVal('proj-name')||'Group-Kalkulator').replace(/[^\wäöüÄÖÜ\- ]+/g,'').trim().replace(/\s+/g,'_')||'Group-Kalkulator';
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if(typeof html2canvas==='undefined' || !jsPDF){ alert('PDF-Bibliothek nicht geladen.'); return; }

    const snap = {
        projName: getVal('proj-name'),
        projOffer: getVal('proj-offer'),
        projInvoice: getVal('proj-invoice'),
        projNotes: getVal('proj-notes'),
        resultsTableHtml: document.getElementById('results-table-wrap').innerHTML
    };

    const d = new Date(), p = n => String(n).padStart(2,'0');
    const ts = `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    const logo = `<span style="font-weight:900;font-size:24px;letter-spacing:-.03em;color:#1a1a1a;">MAD&nbsp;N/CE <span style="font-size:12px;letter-spacing:.12em;color:#00663a;">GROUP</span></span>`;
    const field = (lbl,val) => val ? `<div class="pdf-meta-item"><span class="lbl">${lbl}</span><span class="val">${esc(val)}</span></div>` : '';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:1200px;background:#ffffff;padding:40px;box-sizing:border-box;position:absolute;left:-9999px;top:0;';
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
      .pdf-notes { background: #f0fdf4; border-left: 4px solid #10b981; padding: 14px 18px; font-size: 13px; color: #064e3b; margin-bottom: 24px; border-radius: 4px; line-height: 1.5; }
      .pdf-table-container { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
      table.results { width: 100%; border-collapse: collapse; font-size: 12px; }
      table.results th { background: #f1f5f9; color: #334155; padding: 14px 10px; text-align: right; font-weight: 800; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 11px; }
      table.results th.kundenpreis-cell { background: #00663a; color: #ffffff; text-align: left; padding: 14px 20px; }
      table.results th.kundenpreis-cell .kp-title { font-size: 10px; color: #a7f3d0; margin-bottom: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      table.results th.kundenpreis-cell .kp-amount { font-size: 18px; font-weight: 800; color: #ffffff; }
      table.results td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155; }
      table.results td.rowlabel { text-align: left; font-weight: 700; color: #1e293b; background: #f8fafc; border-right: 1px solid #e2e8f0; padding-left: 20px; width: 240px; }
      table.results .pct-badge { display: inline-block; background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 10px; color: #475569; margin-right: 8px; font-weight: 700; }
      table.results .val-pos { color: #059669; font-weight: 800; }
      table.results .val-neg { color: #dc2626; font-weight: 800; }
      table.results .val-zero { color: #94a3b8; }
      table.results tr.rg-base td { background: #ffffff; }
      table.results tr.rg-sales td { background: #fff7ed; }
      table.results tr.rg-cost td { background: #f0f9ff; }
      table.results tr.rg-fulfill td { background: #f0fdf4; font-weight: 800; color: #064e3b; }
      table.results tr.rg-sum td { background: #e6f4ea; border-top: 2px solid #10b981; border-bottom: 2px solid #10b981; font-weight: 800; font-size: 13px; color: #064e3b; }
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
        ${snap.projNotes ? `<div class="pdf-notes"><strong>Notizen:</strong><br>${esc(snap.projNotes)}</div>` : ''}
        <div class="pdf-table-container">
            ${snap.resultsTableHtml}
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
                pdf.save(`Group-Kalkulator_${name}.pdf`);
                cleanup();
            }).catch(err => { cleanup(); alert('PDF-Fehler: ' + err.message); });
    }, 300);
};

window.addEventListener('beforeprint',()=>{
    if (document.getElementById('view-calculator').classList.contains('hidden')) return;
    if (document.getElementById('results-section').style.display==='none') window.calculate();
});

// INIT
document.addEventListener('DOMContentLoaded', () => {
    buildBaseCards();
    buildCostCards();
    syncCostsToVolume();
    setMode('td');
});