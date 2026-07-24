// ====================================================
// kalkulator.js: GROUP KALKULATOR LOGIC & MNAU LOG INTEGRATION
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
      <div class="field" style="margin-top:6px"><label>Fremdkosten (€)</label><input type="number" id="fk-${e}" class="mnau-input" value="0" min="0" step="10"></div>
      ${e==='MNGR'?`<div class="field" style="margin-top:6px"><label>Fremdkosten MNGR (€)</label><input type="number" id="fkmngr" class="mnau-input" value="0" min="0" step="10"></div>`:''}
      <div class="field" style="margin-top:6px"><label>Spesen (€)</label><input type="number" id="sp-${e}" class="mnau-input" value="0" min="0" step="10"></div>
      <div class="field" style="margin-top:6px"><label>Stundenpreis (€)</label><input type="number" id="hp-${e}" class="mnau-input" value="150" min="0" step="5"></div>
      <div class="field note-field note-sep"><label>✎ Notiz ${e}</label><textarea id="note-${e}" class="mnau-input" rows="1" placeholder="Anmerkung zu ${e} …"></textarea></div>
    </div>`).join('');
}

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
    const OTHER = COSTS.filter(c=>c.key!==FUL_KEY);
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

    const gKunde=kundenpreis;
    if(MODE==='bu'){
        const factor = gBase>0 ? (gRef/gBase) : 0;
        document.getElementById('metrics').innerHTML=`
      <div class="metric"><div class="ml">Summe Wunschbeträge</div><div class="mv">${fmt(gBase)}</div></div>
      <div class="metric"><div class="ml">Endpreis (verteilbar)</div><div class="mv">${fmt(gRef)}</div></div>
      <div class="metric"><div class="ml">Kundenpreis (brutto)</div><div class="mv">${fmt(gKunde)}</div></div>
      <div class="metric"><div class="ml">Ø Faktor</div><div class="mv">${factor.toFixed(2)}×</div></div>`;
    } else {
        const nettoShare = gBase>0 ? (gFul/gBase*100) : 0;
        document.getElementById('metrics').innerHTML=`
      <div class="metric"><div class="ml">Summe Volumen</div><div class="mv">${fmt(gBase)}</div></div>
      <div class="metric"><div class="ml">Verteilbares Volumen</div><div class="mv">${fmt(gRef)}</div></div>
      <div class="metric"><div class="ml">Netto · Fulfillment</div><div class="mv">${fmt(gFul)}</div></div>
      <div class="metric"><div class="ml">Netto-Anteil v. Volumen</div><div class="mv">${nettoShare.toFixed(1)}%</div></div>`;
    }

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
// NEU: MNAU AUFTRAG IM LOG ERFASSEN
// ====================================================
window.saveMNAUOrderToLog = async function() {
    const projNameRaw = getVal('proj-name');
    const projName = projNameRaw ? projNameRaw : "Unbenanntes Projekt";
    const orderTitle = `${projName} (MNAU)`;

    const roles = getRoles();
    const OTHER = COSTS.filter(c => c.key !== FUL_KEY);

    const baseInput = getNum('base-MNAU');
    const fk = getNum('fk-MNAU');
    const sp = getNum('sp-MNAU');
    const fulPct = getNum('cost-MNAU-' + FUL_KEY);
    const d = MODE === 'bu' ? (fulPct > 0 ? baseInput / (fulPct / 100) : baseInput) : (baseInput - fk - sp);

    const fulAmt = d * fulPct / 100;
    const costAmts = OTHER.map(c => ({ label: c.label, pct: getNum('cost-MNAU-' + c.key), amt: d * getNum('cost-MNAU-' + c.key) / 100 }));
    const salesAmts = roles.map(r => ({ label: r.label, entity: r.entity, pct: r.pct, amt: d * r.pct / 100 }));

    let mnauSalesReceived = 0;
    ENTITIES.forEach(e => {
        const eBase = getNum('base-' + e);
        const eFk = getNum('fk-' + e);
        const eSp = getNum('sp-' + e);
        const eFulPct = getNum('cost-' + e + '-' + FUL_KEY);
        const eD = MODE === 'bu' ? (eFulPct > 0 ? eBase / (eFulPct / 100) : eBase) : (eBase - eFk - eSp);

        roles.forEach(r => {
            if (r.entity === 'MNAU') {
                mnauSalesReceived += eD * r.pct / 100;
            }
        });
    });

    const mnauSumme = fulAmt + mnauSalesReceived + fk + sp;

    if (mnauSumme <= 0) {
        alert("Der berechnete Betrag (Summe) für MNAU beträgt 0.00 € oder weniger. Es wurde kein Auftrag erfasst.");
        return;
    }

    // Fremdkosten & Lieferanten für MNAU aufbauen
    const suppliers = [];

    if (fk > 0) {
        suppliers.push({ name: "Fremdkosten MNAU", amount: Math.round(fk * 100) / 100, paid: false });
    }

    if (sp > 0) {
        suppliers.push({ name: "Spesen MNAU", amount: Math.round(sp * 100) / 100, paid: false });
    }

    salesAmts.forEach(s => {
        if (s.amt > 0) {
            suppliers.push({ name: `Provision ${s.entity}`, amount: Math.round(s.amt * 100) / 100, paid: false });
        }
    });

    costAmts.forEach(c => {
        if (c.amt > 0) {
            suppliers.push({ name: `${c.label} OVERHEAD`, amount: Math.round(c.amt * 100) / 100, paid: false });
        }
    });

    const totalFremdkosten = suppliers.reduce((sum, item) => sum + item.amount, 0);

    const btn = document.getElementById('btn-save-to-log');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Speichere im Log...";
    }

    try {
        const initialChangelog = [{
            user: window.currentUserEmail || "Unbekannt",
            timestamp: new Date().toISOString(),
            action: "Auftrag aus Group Kalkulator erstellt",
            comment: "Automatisch aus Group Kalkulator erfasst",
            details: [`Auftrag "${orderTitle}" mit Betrag € ${mnauSumme.toFixed(2)} und € ${totalFremdkosten.toFixed(2)} Fremdkosten angelegt`]
        }];

        const payload = {
            records: [{
                fields: {
                    "Auftrag": orderTitle,
                    "Betrag_Automotive": Math.round(mnauSumme * 100) / 100,
                    "Fremdkosten": Math.round(totalFremdkosten * 100) / 100,
                    "Fremdkosten_Details": JSON.stringify(suppliers),
                    "Status": "An Group verrechnet",
                    "Flagged": false,
                    "Changelog": JSON.stringify(initialChangelog)
                }
            }]
        };

        const createdData = await window.API.saveOrder(payload);
        if (createdData && createdData.records && createdData.records.length > 0) {
            window.loadedRecords.unshift(createdData.records[0]);
            window.UI.updateSupplierDatalist();
            window.UI.renderOrders(window.loadedRecords);
            alert(`Erfolg! Auftrag "${orderTitle}" über € ${mnauSumme.toFixed(2)} wurde im Auftrags-Log erfasst.`);

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
            btn.innerHTML = '<span class="ti">➔</span> MNAU Auftrag im Log erfassen';
        }
    }
};

window.resetAll = function(){
    ENTITIES.forEach(e=>{
        ['base','fk','sp'].forEach(p=>{const el=document.getElementById(p+'-'+e);if(el)el.value=0;});
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