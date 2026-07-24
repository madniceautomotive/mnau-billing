// ====================================================
// kalkulator.js: GROUP KALKULATOR LOGIC & MULTI-TENANT LOG INTEGRATION
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
      
      <!-- DYNAMISCHE LIEFERANTEN ZEILEN -->
      <div class="field" style="margin-top:6px">
        <label>Lieferanten &amp; Fremdkosten</label>
        <div id="suppliers-list-${e}" class="kalk-suppliers-list"></div>
        <button type="button" class="btn-secondary btn-small" style="padding:3px 8px; font-size:0.68rem; margin-top:4px;" onclick="addKalkSupplierRow('${e}')">+ Lieferant</button>
        <input type="hidden" id="fk-${e}" value="0">
      </div>

      ${e==='MNGR'?`<div class="field" style="margin-top:6px"><label>Fremdkosten MNGR (€)</label><input type="number" id="fkmngr" class="mnau-input" value="0" min="0" step="10"></div>`:''}
      <div class="field" style="margin-top:6px"><label>Spesen (€)</label><input type="number" id="sp-${e}" class="mnau-input" value="0" min="0" step="10"></div>
      <div class="field" style="margin-top:6px"><label>Stundenpreis (€)</label><input type="number" id="hp-${e}" class="mnau-input" value="150" min="0" step="5"></div>
      <div class="field note-field note-sep"><label>✎ Notiz ${e}</label><textarea id="note-${e}" class="mnau-input" rows="1" placeholder="Anmerkung zu ${e} …"></textarea></div>
    </div>`).join('');

    ENTITIES.forEach(e => {
        addKalkSupplierRow(e);
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
        ? `<div class="field" style="margin-bottom:5px"><label>${c.label} % <span class="auto-tag">auto</span></label><input type="number" id="cost-${e}-${c.key}" value="${c.def}" readonly tabindex="-1" class="mnau-input auto-field"></div>`
        : `<div class="field" style="margin-bottom:5px"><label>${c.label} %</label><input type="number" id="cost-${e}-${c.key}" class="mnau-input" value="${c.def}" min="0" step="1" oninput="updateFulfillment()"></div>`
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
            return `<td class="val-zero">${pre}<span class="num-val">${vn(hrs)}</span></div></td>`;
        }).join('')+`</tr>`;

    h+='</tbody></table>';
    document.getElementById('results-table-wrap').innerHTML=h;

    // DYNAMISCHE USER FIRMEN KENNZAHLEN
    const myCompany = window.currentUserCompany || "MNAU";
    const userUmsatz = summe[myCompany] || 0;
    const userEchteFremdkosten = (FK[myCompany] || 0) + (SP[myCompany] || 0);
    const userErtrag = userUmsatz - userEchteFremdkosten;

    const mngrAbgabe = summe['MNGR'] || 0;

    let totalSisterShares = 0;
    ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT'].forEach(comp => {
        if (comp !== myCompany) {
            totalSisterShares += (summe[comp] || 0);
        }
    });

    const btnSave = document.getElementById('btn-save-to-log');
    if (btnSave) {
        btnSave.innerHTML = `<span class="ti">➔</span> ${myCompany} Auftrag im Log erfassen`;
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

    const rn = Object.entries(recipientTotals).filter(([k,v])=>v>0).map(([k,v])=>`${k}: ${fmt(v)}`).join('  ·  ');
    document.getElementById('recipient-note').innerHTML = rn ? '→ Provisionen fließen an: '+rn : '';
    document.getElementById('result-mode-tag').textContent = MODE==='td' ? 'Top-down' : 'Bottom-up';

    const noteLines=[];
    ENTITIES.forEach(e=>{ const n=getVal('note-'+e); if(n) noteLines.push(`<div class="note-line"><span class="ne">${e}</span><span>${esc(n)}</span></div>`); });
    const gen = getVal('proj-notes');
    if(gen) noteLines.push(`<div class="note-line"><span class="ne">Allgem.</span><span>${esc(gen)}</span></div>`);
    const meta=[];
    if(getVal('proj-name')) meta.push(esc(getVal('proj-name')));
    if(getVal('proj-offer')) meta.push('Angebot '+esc(getVal('proj-offer')));
    if(getVal('proj-invoice')) meta.push('Rechnung '+esc(getVal('proj-invoice')));
    const no=document.getElementById('notes-out');
    if(noteLines.length||meta.length){
        no.style.display='block';
        no.innerHTML='<h4>Notizen & Referenzen</h4>'+(meta.length?`<div class="note-line"><span class="ne">Projekt</span><span>${meta.join(' · ')}</span></div>`:'')+noteLines.join('');
    } else { no.style.display='none'; }

    document.getElementById('results-section').style.display='block';
    document.getElementById('results-section').scrollIntoView({behavior:'smooth',block:'nearest'});
};

// ====================================================
// AUFTRAG IM LOG ERFASSEN (HAUPTAUFTRAG + SCHWESTERFIRMEN-ANTEILE + EINHEITLICHE GROUP-ID)
// ====================================================
window.saveMNAUOrderToLog = async function() {
    const myCompany = window.currentUserCompany || "MNAU";
    const projNameRaw = getVal('proj-name');
    const projName = projNameRaw ? projNameRaw : "Unbenanntes Projekt";

    // Der Auftragsname gehört EXAKT der anlegenden Firma an (wird an alle vererbt)!
    const orderTitle = `${projName} (${myCompany})`;

    // Einzigartige Projekt-ID erzeugen, um Haupt- & Passiv-Aufträge unzertrennlich zu koppeln
    const calcGroupId = "grp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

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

    // Hilfsfunktion: Lieferanten & Spesen einer beliebigen Firma aus den Karten extrahieren
    const getSuppliersForCompany = (compName) => {
        const compSuppliers = [];
        const container = document.getElementById(`suppliers-list-${compName}`);

        if (container) {
            container.querySelectorAll('.kalk-supplier-row').forEach(row => {
                const sName = (row.querySelector('.kalk-supp-name').value || '').trim();
                const sAmount = parseFloat(row.querySelector('.kalk-supp-amount').value) || 0;
                if (sName !== '' || sAmount > 0) {
                    compSuppliers.push({
                        name: sName || `Fremdkosten ${compName}`,
                        amount: Math.round(sAmount * 100) / 100,
                        paid: false
                    });

                    // Unbekannte Lieferanten global in Airtable sichern
                    if (sName !== '' && window.globalSuppliers && window.API && window.API.saveSuppliers) {
                        const exists = window.globalSuppliers.some(g => g.name.toLowerCase() === sName.toLowerCase());
                        if (!exists) {
                            window.API.saveSuppliers([{ fields: { "Name": sName } }])
                                .then(res => {
                                    if (res && res.records) {
                                        res.records.forEach(r => window.globalSuppliers.push({ id: r.id, name: r.fields.Name }));
                                        if (window.UI && window.UI.updateSupplierDatalist) window.UI.updateSupplierDatalist();
                                    }
                                }).catch(e => console.warn("Lieferant konnte nicht gespeichert werden:", e));
                        }
                    }
                }
            });
        }

        const compSP = SP[compName] || 0;
        if (compSP > 0) {
            compSuppliers.push({
                name: `Spesen ${compName}`,
                amount: Math.round(compSP * 100) / 100,
                paid: false
            });
        }
        return compSuppliers;
    };

    // 1. Hauptauftrag für den erfassenden User
    const userUmsatz = Math.round((summe[myCompany] || 0) * 100) / 100;

    if (userUmsatz <= 0) {
        alert(`Der ${myCompany}-Umsatz beträgt 0.00 €. Es wurde kein Auftrag erfasst.`);
        return;
    }

    const mainSuppliers = getSuppliersForCompany(myCompany);
    const totalFremdkosten = mainSuppliers.reduce((s, item) => s + item.amount, 0);

    // Basis Group-Infos sammeln
    const mngrAbgabe = summe['MNGR'] || 0;
    const allSharesDetail = {};
    ['MNAG','MNMH','MNWB','MNAT','MNAU','EXT'].forEach(comp => {
        const amt = summe[comp] || 0;
        if (amt > 0) {
            allSharesDetail[comp] = Math.round(amt * 100) / 100;
        }
    });

    const pdfSnapshot = {
        projName: getVal('proj-name'),
        projOffer: getVal('proj-offer'),
        projInvoice: getVal('proj-invoice'),
        projNotes: getVal('proj-notes'),
        resultsTableHtml: document.getElementById('results-table-wrap').innerHTML
    };

    const groupMetaMain = {
        groupId: calcGroupId,
        originCompany: myCompany,
        kundenpreis: Math.round(kundenpreis * 100) / 100,
        mngrAbgabe: Math.round(mngrAbgabe * 100) / 100,
        allSharesDetail: allSharesDetail,
        snapshot: pdfSnapshot
    };

    const recordsToCreate = [];

    // 2. HAUPTAUFTRAG ANLEGEN
    const initialChangelog = [{
        user: window.currentUserEmail || "Unbekannt",
        timestamp: new Date().toISOString(),
        action: "Hauptauftrag aus Group Kalkulator erfasst",
        comment: `Aus Group Kalkulator erfasst (Status: In Bearbeitung)`,
        details: [
            `Auftrag "${orderTitle}" angelegt:`,
            `• ${myCompany} Umsatz: € ${userUmsatz.toFixed(2)}`,
            `• ${myCompany} Echte Fremdkosten: € ${totalFremdkosten.toFixed(2)}`,
            `• Gesamt-Projektvolumen: € ${kundenpreis.toFixed(2)}`
        ]
    }];

    recordsToCreate.push({
        fields: {
            "Auftrag": orderTitle,
            "Betrag_Automotive": userUmsatz,
            "Fremdkosten": Math.round(totalFremdkosten * 100) / 100,
            "Fremdkosten_Details": JSON.stringify({ suppliers: mainSuppliers, groupMeta: groupMetaMain }),
            "Status": "In Bearbeitung",
            "Firma": myCompany,
            "Flagged": false,
            "Changelog": JSON.stringify(initialChangelog)
        }
    });

    // 3. PASSIV-AUFTRÄGE FÜR INVOLVIERTE SCHWESTERFIRMEN ERZEUGEN
    Object.entries(allSharesDetail).forEach(([comp, amt]) => {
        if (comp !== myCompany && amt > 0) {

            const compSuppliers = getSuppliersForCompany(comp);
            const compFremdkosten = compSuppliers.reduce((s, item) => s + item.amount, 0);

            const shareGroupMeta = {
                groupId: calcGroupId, // SELBE GRUPPEN-ID FÜR DIE SCHWESTERFIRMA!
                isReadOnlyShare: true,
                originCompany: myCompany,
                originProject: projName,
                kundenpreis: Math.round(kundenpreis * 100) / 100,
                mngrAbgabe: Math.round(mngrAbgabe * 100) / 100,
                allSharesDetail: allSharesDetail,
                snapshot: pdfSnapshot
            };

            const shareChangelog = [{
                user: window.currentUserEmail || "Unbekannt",
                timestamp: new Date().toISOString(),
                action: "Erlösanteil aus Group Kalkulator erfasst",
                comment: `Automatisch von ${myCompany} für ${comp} angelegt`,
                details: [
                    `Erlösanteil für ${comp} aus Projekt "${projName}" (${myCompany}):`,
                    `• Anteil ${comp}: € ${amt.toFixed(2)}`,
                    `• ${comp} Echte Fremdkosten: € ${compFremdkosten.toFixed(2)}`,
                    `• Gesamt-Projektvolumen: € ${kundenpreis.toFixed(2)}`
                ]
            }];

            recordsToCreate.push({
                fields: {
                    "Auftrag": orderTitle, // DER NAME BLEIBT EXAKT DER ORIGINALE PROJEKTNAME INKL. Z.B. (MNAU)!
                    "Betrag_Automotive": amt,
                    "Fremdkosten": Math.round(compFremdkosten * 100) / 100,
                    "Fremdkosten_Details": JSON.stringify({ suppliers: compSuppliers, groupMeta: shareGroupMeta }),
                    "Status": "An Group verrechnet",
                    "Firma": comp,
                    "Flagged": false,
                    "Changelog": JSON.stringify(shareChangelog)
                }
            });
        }
    });

    const btn = document.getElementById('btn-save-to-log');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Speichere Aufträge...";
    }

    try {
        const createdData = await window.API.saveOrder({ records: recordsToCreate });
        if (createdData && createdData.records && createdData.records.length > 0) {
            createdData.records.forEach(r => window.loadedRecords.unshift(r));
            window.UI.updateSupplierDatalist();
            window.UI.renderOrders(window.loadedRecords);

            const createdCount = createdData.records.length;
            alert(`Erfolg! ${createdCount} Auftrag/Aufträge für ${myCompany} und beteiligte Schwesterfirmen im Log erfasst.`);

            if (typeof window.switchTab === 'function') {
                window.switchTab('billing');
            }
        }
    } catch (err) {
        console.error("Fehler beim Speichern im Log:", err);
        alert("Fehler beim Erfassen des Auftrags im Log: " + (err.message || err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span class="ti">➔</span> ${myCompany} Auftrag im Log erfassen`;
        }
    }
};

// ====================================================
// PDF DOWNLOAD DIREKT AUS DEM AUFTRAGS-LOG
// ====================================================
window.downloadKalkulatorPDFFromLog = function(recordId) {
    const record = (window.loadedRecords || []).find(r => r.id === recordId);
    if (!record || !record.fields.Fremdkosten_Details) {
        alert("Kein Kalkulator-Datensatz für diesen Auftrag gefunden.");
        return;
    }

    let groupMeta = null;
    try {
        const parsed = JSON.parse(record.fields.Fremdkosten_Details);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            groupMeta = parsed.groupMeta;
        }
    } catch(e) {}

    if (!groupMeta || !groupMeta.snapshot) {
        alert("Für diesen Auftrag ist kein Kalkulator-PDF-Snapshot gespeichert.");
        return;
    }

    const snap = groupMeta.snapshot;
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (typeof html2canvas === 'undefined' || !jsPDF) {
        alert("PDF-Bibliotheken nicht geladen.");
        return;
    }

    const d = new Date(record.createdTime || Date.now()), p = n => String(n).padStart(2,'0');
    const ts = `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    const logo = `<span style="font-weight:800;font-size:19px;letter-spacing:-.02em">MAD&nbsp;N/CE <span style="font-size:11px;letter-spacing:.12em">GROUP</span></span>`;
    const field = (lbl,val) => val ? `<div style="margin-right:32px"><span style="color:#777">${lbl}:</span> <strong>${esc(val)}</strong></div>` : '';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:1120px;background:#fff;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:26px;box-sizing:border-box';
    sheet.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1a1a1a;padding-bottom:9px;margin-bottom:16px;gap:24px">
      <strong style="font-size:20px;font-weight:600;white-space:nowrap">Berechnung (Archiviert)</strong>
      <div style="text-align:center;font-size:10px;color:#888;line-height:1.45">
        <div>Erstellt: ${ts}</div>
      </div>
      <div style="display:flex;align-items:center;flex-shrink:0">${logo}</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;font-size:13px;margin-bottom:6px">
      ${field('Projektname', snap.projName)}
      ${field('Angebotsnummer', snap.projOffer)}
      ${field('Rechnungsnummer', snap.projInvoice)}
    </div>
    ${snap.projNotes ? `<div style="font-size:13px;margin-bottom:16px"><span style="color:#777">Notizen:</span> ${esc(snap.projNotes)}</div>` : '<div style="margin-bottom:10px"></div>'}
    <div>${snap.resultsTableHtml}</div>
  `;

    sheet.style.position = 'absolute'; sheet.style.left = '0'; sheet.style.top = '0';
    sheet.style.zIndex = '2147483647'; sheet.style.background = '#fff';
    document.body.appendChild(sheet);

    const tbl = sheet.querySelector('table.results');
    if (tbl) { const need = tbl.offsetWidth + 54; if (need > sheet.offsetWidth) sheet.style.width = need + 'px'; }
    const W = sheet.scrollWidth, H = sheet.scrollHeight;
    const sx = window.scrollX, sy = window.scrollY;
    window.scrollTo(0,0);

    const cleanup = () => { sheet.remove(); window.scrollTo(sx, sy); };

    setTimeout(() => {
        html2canvas(sheet, { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, x: 0, y: 0, width: W, height: H, windowWidth: W, windowHeight: H })
            .then(canvas => {
                const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
                const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
                const m = 7, availW = pw - 2*m, availH = ph - 2*m;
                const r = canvas.width / canvas.height;
                let iw = availW, ih = iw / r;
                if (ih > availH) { ih = availH; iw = ih * r; }
                const x = (pw - iw) / 2, y = m;
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, y, iw, ih);
                const safeName = (snap.projName || record.fields.Auftrag || 'Group-Kalkulator').replace(/[^\wäöüÄÖÜ\- ]+/g,'').trim().replace(/\s+/g,'_');
                pdf.save(`Group-Kalkulator_${safeName}.pdf`);
                cleanup();
            })
            .catch(err => { cleanup(); console.error('PDF-Fehler:', err); alert('PDF-Fehler: ' + (err && err.message ? err.message : err)); });
    }, 250);
};

window.resetAll = function(){
    ENTITIES.forEach(e=>{
        ['base','sp'].forEach(p=>{const el=document.getElementById(p+'-'+e);if(el)el.value=0;});
        const container = document.getElementById(`suppliers-list-${e}`);
        if (container) {
            container.innerHTML = '';
            addKalkSupplierRow(e);
        }
        const hp=document.getElementById('hp-'+e); if(hp) hp.value=150;
        const nt=document.getElementById('note-'+e); if(nt) nt.value='';
        COSTS.forEach(c=>{const el=document.getElementById('cost-'+e+'-'+c.key);if(el){el.value=c.def;el.disabled=false;delete el.dataset.prev;}});
    });
    [['seller',3],['setter',4],['closer1',4],['closer2',4]].forEach(([id,v])=>{document.getElementById('role-'+id+'-pct').value=v;});
    ['proj-name','proj-offer','proj-invoice','proj-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const fm=document.getElementById('fkmngr'); if(fm) fm.value=0;
    window.syncCostsToVolume();
    document.getElementById('results-section').style.display='none';
};

window.preparePrintHeader = function(){
    const d=new Date(), p=n=>String(n).padStart(2,'0');
    const ts=`${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;

    const logo = `<span style="font-weight:800;font-size:19px;letter-spacing:-.02em;color:#ffffff">MAD&nbsp;N/CE <span style="font-size:11px;letter-spacing:.12em;color:#00ff73">GROUP</span></span>`;

    document.getElementById('print-header').innerHTML=
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px">
       <strong style="font-size:20px;font-weight:600;color:#ffffff">Berechnung</strong>
       <span style="font-size:14px;color:#a0aec0">${ts}</span>
       <div style="flex-shrink:0;display:flex;align-items:center">${logo}</div>
     </div>`;
};

window.buildPdfSheet = function(){
    const d=new Date(), p=n=>String(n).padStart(2,'0');
    const ts=`${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    const logo = `<span style="font-weight:800;font-size:19px;letter-spacing:-.02em">MAD&nbsp;N/CE <span style="font-size:11px;letter-spacing:.12em">GROUP</span></span>`;
    const field=(lbl,val)=> val?`<div style="margin-right:32px"><span style="color:#777">${lbl}:</span> <strong>${esc(val)}</strong></div>`:'';
    const notes=getVal('proj-notes');
    const sheet=document.createElement('div');
    sheet.style.cssText='width:1120px;background:#fff;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:26px;box-sizing:border-box';
    sheet.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1a1a1a;padding-bottom:9px;margin-bottom:16px;gap:24px">
      <strong style="font-size:20px;font-weight:600;white-space:nowrap">Berechnung</strong>
      <div style="text-align:center;font-size:10px;color:#888;line-height:1.45">
        <div>${ts}</div>
      </div>
      <div style="display:flex;align-items:center;flex-shrink:0">${logo}</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;font-size:13px;margin-bottom:6px">
      ${field('Projektname',getVal('proj-name'))}
      ${field('Angebotsnummer',getVal('proj-offer'))}
      ${field('Rechnungsnummer',getVal('proj-invoice'))}
    </div>
    ${notes?`<div style="font-size:13px;margin-bottom:16px"><span style="color:#777">Notizen:</span> ${esc(notes)}</div>`:'<div style="margin-bottom:10px"></div>'}
    <div>${document.getElementById('results-table-wrap').innerHTML}</div>`;
    return sheet;
};

window.exportPDF = function(){
    window.calculate();
    const name=(getVal('proj-name')||'Group-Kalkulator').replace(/[^\wäöüÄÖÜ\- ]+/g,'').trim().replace(/\s+/g,'_')||'Group-Kalkulator';
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if(typeof html2canvas==='undefined' || !jsPDF){ alert('PDF-Bibliothek nicht geladen.'); return; }
    const sheet=window.buildPdfSheet();
    sheet.style.position='absolute'; sheet.style.left='0'; sheet.style.top='0';
    sheet.style.zIndex='2147483647'; sheet.style.background='#fff';
    document.body.appendChild(sheet);
    const tbl=sheet.querySelector('table.results');
    if(tbl){ const need=tbl.offsetWidth+54; if(need>sheet.offsetWidth) sheet.style.width=need+'px'; }
    const W=sheet.scrollWidth, H=sheet.scrollHeight;
    const sx=window.scrollX, sy=window.scrollY;
    window.scrollTo(0,0);
    const cleanup=()=>{ sheet.remove(); window.scrollTo(sx,sy); };
    setTimeout(()=>{
        html2canvas(sheet,{scale:2,useCORS:true,backgroundColor:'#ffffff',scrollX:0,scrollY:0,x:0,y:0,width:W,height:H,windowWidth:W,windowHeight:H})
            .then(canvas=>{
                const pdf=new jsPDF({unit:'mm',format:'a4',orientation:'landscape'});
                const pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight();
                const m=7, availW=pw-2*m, availH=ph-2*m;
                const r=canvas.width/canvas.height;
                let iw=availW, ih=iw/r;
                if(ih>availH){ ih=availH; iw=ih*r; }
                const x=(pw-iw)/2, y=m;
                pdf.addImage(canvas.toDataURL('image/jpeg',0.95),'JPEG',x,y,iw,ih);
                pdf.save(`Group-Kalkulator_${name}.pdf`);
                cleanup();
            })
            .catch(err=>{ cleanup(); console.error('PDF-Fehler:',err); alert('PDF-Fehler: '+(err&&err.message?err.message:err)); });
    },250);
};

window.addEventListener('beforeprint',()=>{
    if (document.getElementById('view-calculator').classList.contains('hidden')) return;
    if (document.getElementById('results-section').style.display==='none') window.calculate();
    window.preparePrintHeader();
});

// INIT
document.addEventListener('DOMContentLoaded', () => {
    buildBaseCards();
    buildCostCards();
    syncCostsToVolume();
    setMode('td');
});