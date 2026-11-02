// @ts-nocheck
// Deals: cards, linking payments, the deal form (multiply, fixed, monthly salary).
import { esc, money, numfmt, fdate, localDay, pnum, round2, numVal, newId, plural, inWords } from "../lib/format";
import { fieldsOf, mulFields, salaryCalc, isMonthly, workedText, agLabel, dealAgreed, dealFormula, termsOf, balText } from "../lib/deals";
import { dbPut } from "../data/db";
import { fillLists, openPaySheet } from "./entry-form";
import { ICON } from "./people";
import { openReceipt } from "./receipt";
import { AS, D, dealPaid, dueText, emit, isLate, itemName, saveDeals, upsertContact } from "../state";
import { $, $$, toast } from "../ui/dom";
import { rowHTML } from "../ui/rows";
import { ask, keepScroll, openSheet } from "../ui/sheets";

export function dealCard(d,withPays,opts={}){
  const ag=dealAgreed(d),pd=dealPaid(d),bal=round2(ag-pd),pct=ag?Math.min(100,Math.round(pd/ag*100)):0,c=AS.CM.get(d.contactId),it=AS.IM.get(d.item);
  return `<div class="deal${d.closed?" done":""}">
    <div class="dhead"><b>${esc(d.title)}</b><span class="dicons"><button class="ib" data-ds="${esc(d.id)}" aria-label="Share deal ${esc(d.title)}">${ICON.share}</button><button class="ib" data-de="${esc(d.id)}" aria-label="Edit deal ${esc(d.title)}">${ICON.edit}</button><button class="ib red" data-dd="${esc(d.id)}" aria-label="Delete deal ${esc(d.title)}">${ICON.trash}</button></span></div>
    ${opts.who&&c?`<button type="button" class="wholink" data-pc="${esc(c.id)}">${esc(c.name)} ›</button>`:""}
    <small>${esc([dealFormula(d),it?.n,opts.who?"":c?.name].filter(Boolean).join(" · "))}</small>
    ${isMonthly(d)?`<div class="due sal">${esc(workedText(d))}${!salaryCalc(d).ended&&!d.closed?` · next month’s salary on ${fdate(salaryCalc(d).next)}`:""}</div>`:""}
    ${d.deadline?`<div class="due${isLate(d)?" late":""}">${esc(dueText(d))}</div>`:""}
    ${termsOf(d).length?`<dl class="dterms">${termsOf(d).map(t=>`<div><dt>${esc(t.label||"Term")}</dt><dd>${esc(t.value)}</dd></div>`).join("")}</dl>`:""}
    <div class="dbarw"><div class="dbar" role="img" aria-label="${pct}% paid"><i style="width:${pct}%"></i></div><span class="pc">${d.closed?"Complete":pct+"% paid"}</span></div>
    <div class="dnums"><span>${agLabel(d)}<b class="num">${money(ag)}</b></span><span>Paid<b class="num">${money(pd)}</b></span><span>${isMonthly(d)&&bal>0?"Due now":"Balance"}<b class="num${bal<0&&!isMonthly(d)?" over":""}">${balText(bal,d)}</b></span></div>
    ${withPays?dealPays(d):""}
    <div class="pact">${d.closed?"":`<button class="linkbtn" data-dp="${esc(d.id)}">+ Add payment</button>`}<button class="linkbtn" data-dk="${esc(d.id)}">Link existing payments</button></div></div>`;
}
// payments counted against this deal, shown inside its card (first 5, then "Show all")
export function dealPays(d){
  const ps=D.entries.filter(e=>!e.deletedAt&&e.dealId===d.id).sort((a,b)=>b.ts-a.ts);
  if(!ps.length)return'<p class="dnone">No payments against this deal yet.</p>';
  return `<div class="dpays"><span class="pg-l">${plural(ps.length,"payment","payments")} in this deal</span>
    <ul class="book mini">${ps.map((e,i)=>rowHTML(e,null,null,false,{noVendor:true,noDeal:true}).replace("<li>",i>=5?'<li class="more5" hidden>':"<li>")).join("")}</ul>
    ${ps.length>5?`<button type="button" class="linkbtn" data-dmore>Show all ${ps.length}</button>`:""}</div>`;
}
export function bindDeals(root){
  $$("[data-dmore]",root).forEach(b=>b.addEventListener("click",()=>{const box=b.closest(".dpays");const open=b.dataset.open!=="1";
    $$(".more5",box).forEach(li=>li.hidden=!open);b.dataset.open=open?"1":"";b.textContent=open?"Show fewer":`Show all ${$$("li",box).length}`}));
  const find=b=>D.deals.find(x=>x.id===b.dataset.de||x.id===b.dataset.dp||x.id===b.dataset.dd||x.id===b.dataset.ds||x.id===b.dataset.dk);
  $$("[data-dk]",root).forEach(b=>b.addEventListener("click",()=>{const d=find(b);if(d)openLinkPays(d)}));
  $$("[data-ds]",root).forEach(b=>b.addEventListener("click",()=>{const d=find(b);if(!d)return;const ids=D.entries.filter(e=>!e.deletedAt&&e.projectId===D.pid&&e.dealId===d.id).map(e=>e.id);
    if(!ids.length){toast("No payments in this deal yet. Add one to share a receipt.");return}openReceipt(ids,{deal:true})}));
  $$("[data-de]",root).forEach(b=>b.addEventListener("click",()=>{const d=find(b);if(d)openDealForm(d)}));
  $$("[data-dd]",root).forEach(b=>b.addEventListener("click",()=>{const d=find(b);if(d)deleteDeal(d)}));
  $$("[data-dp]",root).forEach(b=>b.addEventListener("click",()=>{const d=find(b);if(d)openPaySheet({deal:d})}));
}
// tick payments already in the passbook to count them in this deal (untick to take them out)
export function openLinkPays(d){
  const c=AS.CM.get(d.contactId);let everyone=!c;
  const start=new Set(D.entries.filter(e=>!e.deletedAt&&e.dealId===d.id).map(e=>e.id)),on=new Set(start);
  const s=openSheet("Link payments to this deal","",`Link payments to ${d.title}`);
  const paint=()=>{
    const es=D.entries.filter(e=>!e.deletedAt&&e.projectId===D.pid&&(on.has(e.id)||start.has(e.id)||everyone||e.contactId===d.contactId)).sort((a,b)=>b.ts-a.ts);
    const paid=round2(D.entries.filter(e=>!e.deletedAt&&on.has(e.id)).reduce((a,e)=>a+(+e.amount||0),0)),ag=dealAgreed(d),changed=[...on].filter(x=>!start.has(x)).length+[...start].filter(x=>!on.has(x)).length;
    keepScroll(s,()=>{s.body.innerHTML=`
      <p class="pmeta" style="margin:0 0 8px"><b>${esc(d.title)}</b>${c?` · ${esc(c.name)}`:""}. Tick the payments that belong to this deal.</p>
      ${c?`<div class="seg s2" role="group" aria-label="Whose payments"><button type="button" data-lw="me" aria-pressed="${!everyone}">${esc(c.name)}</button><button type="button" data-lw="all" aria-pressed="${everyone}">Everyone</button></div>`:""}
      <div style="margin-top:6px">${es.length?es.map(e=>{const od=e.dealId&&e.dealId!==d.id?D.deals.find(x=>x.id===e.dealId):null;
        return `<button type="button" class="lrow" data-le="${esc(e.id)}" aria-pressed="${on.has(e.id)}"><span class="bx" aria-hidden="true"></span>
          <span style="min-width:0"><b>${esc(itemName(e)||e.vendor||e.note||"Payment")}</b><small>${esc([fdate(e.ts),e.vendor&&itemName(e)?e.vendor:"",e.note].filter(Boolean).join(" · "))}</small>${od?`<small class="mv">In “${esc(od.title)}”. Ticking moves it here.</small>`:""}</span>
          <span class="num">${money(e.amount)}</span></button>`}).join(""):`<p class="empty">No payments ${c&&!everyone?`to ${esc(c.name)} `:""}yet.${c&&!everyone?" Tap Everyone to see all payments.":""}</p>`}</div>
      <div class="lsum"><div class="sumstrip" style="margin-top:4px"><div>${agLabel(d)}<span class="num">${money(ag)}</span></div><div>Paid<span class="num">${money(paid)}</span></div><div>Balance<span class="num">${balText(round2(ag-paid),d)}</span></div></div>
      <button class="primary" id="lk-save"${changed?"":" disabled"}>${changed?`Save (${plural(on.size,"payment","payments")} in this deal)`:"No changes yet"}</button></div>`});
    $$("[data-lw]",s.body).forEach(b=>b.addEventListener("click",()=>{everyone=b.dataset.lw==="all";paint()}));
    $$("[data-le]",s.body).forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.le;if(on.has(id))on.delete(id);else on.add(id);paint()}));
    $("#lk-save",s.body).addEventListener("click",async()=>{
      try{let n=0;
        for(const e of D.entries.filter(x=>on.has(x.id)!==start.has(x.id))){if(on.has(e.id))e.dealId=d.id;else delete e.dealId;e.updatedAt=Date.now();await dbPut("entries",e);n++}
        s.close();emit();toast(`Deal updated · ${plural(on.size,"payment","payments")} linked`)}
      catch{toast("Couldn’t save. Try again.")}});
  };
  paint();
}
export async function deleteDeal(d,after){
  const linked=D.entries.filter(e=>e.dealId===d.id&&!e.deletedAt).length;
  if(!await ask(`Delete the deal “${d.title}”?`,linked?`${linked===1?"Its 1 payment stays":`Its ${linked} payments stay`} in the passbook but won’t be linked to a deal.`:"This can’t be undone.",{ok:"Delete",danger:true}))return false;
  for(const e of D.entries.filter(e=>e.dealId===d.id)){delete e.dealId;e.updatedAt=Date.now();await dbPut("entries",e)}
  D.deals=D.deals.filter(x=>x.id!==d.id);await saveDeals();after&&after();emit();toast("Deal deleted");return true;
}
export function itemOptions(sel){return '<option value="">No item</option>'+D.groups.map(g=>{const its=D.items.filter(i=>i.cat===g.k&&(!i.hidden||i.k===sel));
  return its.length?`<optgroup label="${esc(g.n)}">${its.map(i=>`<option value="${esc(i.k)}"${i.k===sel?" selected":""}>${esc(i.n)}</option>`).join("")}</optgroup>`:""}).join("")}
// placeholder for a value box, based on what the field is called
export const VAL_PH=[["rate","e.g. 285"],["price","e.g. 285"],["per ","e.g. 20"],["quantity","e.g. 7000"],["qty","e.g. 7000"],["area","e.g. 7000"],["length","e.g. 200"],["count","e.g. 1000"],
  ["unit","e.g. sq ft, metre"],["material","e.g. Copper wire"],["brand","e.g. Polycab"],["work","e.g. Brick work and plaster"],["not included","e.g. Material"],["includes","e.g. Labour only"],
  ["advance","e.g. 50000"],["payment","e.g. 30% advance, rest weekly"],["warranty","e.g. 1 year"],["size","e.g. 2.5 sq mm"],["floor","e.g. 4"],["days","e.g. 90"],
  ["deliver","e.g. March 2027"],["start","e.g. 15 Nov 2026"],["finish","e.g. June 2027"],["colour","e.g. Off white"],["color","e.g. Off white"],["grade","e.g. Fe 500"]];
export const valPh=l=>{const k=String(l||"").trim().toLowerCase();if(!k)return"Value";const m=VAL_PH.find(([w])=>k.includes(w));return m?m[1]:`${String(l).trim()} value`};
export function dealFormHTML(o){
  return `<label class="lbl" for="dl-t">What is the deal for?</label><input class="field" id="dl-t" autocomplete="off" placeholder="e.g. Construction labour, Copper wire supply" value="${esc(o.title||"")}">
    <label class="lbl" for="dl-i">Item <span style="font-size:12px">(optional, helps link payments)</span></label><select class="field" id="dl-i">${itemOptions(o.item)}</select>
    <div class="phead" style="margin-top:14px"><span class="lbl" style="margin:0">Details <span style="font-size:12px">(your own fields)</span></span><button type="button" class="linkbtn" id="dl-addf">+ Add field</button></div>
    <div class="stack" id="dl-fields"></div>
    <div class="chips" id="dl-quick" style="margin-top:8px">${["Rate","Quantity","Unit","Material","Brand","Work"].map(x=>`<button type="button" class="chip sm" data-qf="${x}">+ ${x}</button>`).join("")}</div>
    <span class="lbl">Agreed total</span>
    <div class="seg" role="group" aria-label="Agreed total"><button type="button" data-dt="calc">Multiply fields</button><button type="button" data-dt="fixed">Fixed amount</button><button type="button" data-dt="monthly">Monthly salary</button></div>
    <div data-w="fixed" style="margin-top:10px"><input class="field" id="dl-a" inputmode="decimal" placeholder="Agreed amount ₹, e.g. 75000" value="${o.amount??""}" aria-label="Agreed amount"></div>
    <div data-w="monthly" style="margin-top:10px">
      <input class="field" id="dl-ma" inputmode="decimal" placeholder="Salary per month ₹, e.g. 8000" value="${o.type==="monthly"?(o.amount??""):""}" aria-label="Salary per month">
      <label class="lbl" for="dl-ms">Started work on</label><input class="field" type="date" id="dl-ms" value="${esc(o.start||localDay())}">
      <label class="check"><input type="checkbox" id="dl-hase"${o.end?" checked":""}>Stopped working</label>
      <input class="field" type="date" id="dl-me" value="${esc(o.end||"")}" aria-label="Last working day"${o.end?"":" hidden"}>
      <p class="hint">Salary is counted day by day from the start date. Pay every month or many months together. Every payment reduces what is due.</p>
    </div>
    <div class="dtotal"><span class="pmeta" id="dl-how">Agreed total</span><span class="num" id="dl-tot">₹0</span><span class="w" id="dl-words"></span></div>
    <p class="hint" data-w="calc">Number fields with × switched on are multiplied, for example Rate 285 × Quantity 7000. Change any value later and the total and balance update.</p>
    <label class="check" id="dl-hasdw"><input type="checkbox" id="dl-hasd"${o.deadline?" checked":""}>Has a deadline</label>
    <div id="dl-dwrap"${o.deadline?"":" hidden"}>
      <div class="chips" style="margin-top:8px">${[["7d","1 week"],["3m","3 months"],["6m","6 months"],["1y","1 year"],["5y","5 years"]].map(([k,l])=>`<button type="button" class="chip sm" data-dq="${k}">${l}</button>`).join("")}</div>
      <input class="field" type="date" id="dl-date" value="${esc(o.deadline||"")}" style="margin-top:8px" aria-label="Deadline">
    </div>
    <label class="lbl" for="dl-n">Note</label><input class="field" id="dl-n" autocomplete="off" placeholder="e.g. Material by owner, labour only" value="${esc(o.note||"")}">
    <div class="formmsg" id="dl-msg" hidden></div>`;
}
export function wireDealForm(root,o){
  const q=x=>$(x,root);let type=o.type||"calc";
  let tl=$("#pe-termlabels");if(!tl){tl=document.createElement("datalist");tl.id="pe-termlabels";document.body.appendChild(tl)}
  tl.innerHTML=[...new Set(["Rate","Quantity","Unit","Area","Material","Brand","Work","Includes","Not included","Advance","Payment terms","Warranty",...D.deals.flatMap(x=>fieldsOf(x).map(f=>String(f.label||"").trim())).filter(Boolean)])].map(x=>`<option value="${esc(x)}">`).join("");
  const noMul=l=>/advance|deposit|year|date|deliver|due|by\b|phone|mobile|floor|warranty|days|month|size|gauge|mm\b/i.test(l||"");
  const addField=(f,focus)=>{const row=document.createElement("div");row.className="frow";
    row.innerHTML=`<input class="field" data-fl list="pe-termlabels" placeholder="Field name, e.g. Rate" autocomplete="off" aria-label="Field name"><input class="field" data-fv placeholder="Value" autocomplete="off" aria-label="Field value"><button type="button" class="mul" aria-label="Multiply this into the total" title="Multiply into the total">×</button><button type="button" class="x xs" aria-label="Remove field">×</button>`;
    const fl=$("[data-fl]",row),fv=$("[data-fv]",row),mul=$(".mul",row);
    if(f){fl.value=f.label||"";fv.value=f.value||""}
    const ph=()=>{fv.placeholder=valPh(fl.value);fv.setAttribute("aria-label",fl.value.trim()?`${fl.value.trim()} value`:"Field value")};ph();
    row.dataset.mul=String(f&&"mul" in f?!!f.mul:!noMul(f?.label));row.dataset.touched=f&&"mul" in f?"1":"";
    mul.addEventListener("click",()=>{row.dataset.mul=String(row.dataset.mul!=="true");row.dataset.touched="1";paint()});
    fl.addEventListener("input",()=>{if(!row.dataset.touched)row.dataset.mul=String(!noMul(fl.value));ph();paint()});
    fv.addEventListener("input",paint);
    $(".x",row).addEventListener("click",()=>{row.remove();paint()});
    q("#dl-fields").appendChild(row);if(focus)(f&&f.label?fv:fl).focus();paint()};
  const rows=()=>$$(".frow",q("#dl-fields")).map(r=>({label:$("[data-fl]",r).value.trim(),value:$("[data-fv]",r).value.trim(),mul:r.dataset.mul==="true",row:r}));
  const cur=()=>({type,fields:rows().filter(f=>f.value).map(({label,value,mul})=>numVal(value)!=null?{label,value,mul}:{label,value}),amount:pnum(q(type==="monthly"?"#dl-ma":"#dl-a").value),
    start:q("#dl-ms").value,end:q("#dl-hase").checked?q("#dl-me").value:""});
  function paint(){
    $$("[data-dt]",root).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.dt===type)));
    q("[data-w=fixed]").hidden=type!=="fixed";q("[data-w=calc]").hidden=type!=="calc";q("[data-w=monthly]").hidden=type!=="monthly";
    q("#dl-hasdw").hidden=type==="monthly";q("#dl-dwrap").hidden=type==="monthly"||!q("#dl-hasd").checked;
    rows().forEach(f=>{const m=$(".mul",f.row),isNum=numVal(f.value)!=null;m.classList.toggle("na",type!=="calc"||!isNum);m.setAttribute("aria-pressed",String(f.mul&&isNum))});
    const c=cur(),t=dealAgreed(c);
    q("#dl-how").textContent=type==="monthly"?(c.amount&&c.start?`${agLabel(c)} (${workedText(c)})`:"Earned till today"):type==="calc"?(mulFields(c).length?mulFields(c).map(f=>numfmt.format(numVal(f.value))).join(" × ")+" =":"Add number fields to multiply"):"Agreed total";
    q("#dl-tot").textContent=money(t);q("#dl-words").textContent=t?inWords(t):"";return t;
  }
  fieldsOf(o).forEach(f=>addField(f));if(!fieldsOf(o).length&&type==="calc")addField();
  q("#dl-addf").addEventListener("click",()=>addField(null,true));
  $$("[data-qf]",root).forEach(b=>b.addEventListener("click",()=>addField({label:b.dataset.qf},true)));
  $$("[data-dt]",root).forEach(b=>b.addEventListener("click",()=>{type=b.dataset.dt;paint();if(type==="fixed")q("#dl-a").focus()}));
  q("#dl-a").addEventListener("input",paint);
  ["#dl-ma","#dl-ms","#dl-me"].forEach(x=>q(x).addEventListener("input",paint));
  q("#dl-hase").addEventListener("change",()=>{q("#dl-me").hidden=!q("#dl-hase").checked;if(q("#dl-hase").checked&&!q("#dl-me").value)q("#dl-me").value=localDay();paint()});
  q("#dl-hasd").addEventListener("change",()=>{q("#dl-dwrap").hidden=!q("#dl-hasd").checked});
  // shortcuts count from today
  $$("[data-dq]",root).forEach(b=>b.addEventListener("click",()=>{const d=new Date(),k=b.dataset.dq,n=parseInt(k);
    if(k.endsWith("d"))d.setDate(d.getDate()+n);else if(k.endsWith("m"))d.setMonth(d.getMonth()+n);else d.setFullYear(d.getFullYear()+n);
    q("#dl-date").value=localDay(d);$$("[data-dq]",root).forEach(x=>x.setAttribute("aria-pressed",String(x===b)))}));
  q("#dl-date").addEventListener("input",()=>$$("[data-dq]",root).forEach(x=>x.setAttribute("aria-pressed","false")));
  q("#dl-i").addEventListener("change",()=>{if(!q("#dl-t").value.trim()){const it=AS.IM.get(q("#dl-i").value);if(it)q("#dl-t").value=it.n}});
  paint();
  return{item:()=>q("#dl-i").value||null,onItem:fn=>q("#dl-i").addEventListener("change",fn),
    showError(m){const el=q("#dl-msg");el.textContent=m||"";el.hidden=!m;if(m)el.scrollIntoView({block:"nearest",behavior:"smooth"})},
    collect(){const c=cur(),t=dealAgreed(c);
      if(type==="monthly"){
        if(!(c.amount>0))return{error:"Enter the salary per month"};
        if(!c.start)return{error:"Pick the date the work started"};
        if(q("#dl-hase").checked&&!c.end)return{error:"Pick the last working day"};
        if(c.end&&c.end<c.start)return{error:"The last working day is before the start date"};
        const it=q("#dl-i").value||null;
        const n={title:q("#dl-t").value.trim()||(AS.IM.get(it)?.n)||"Monthly salary",item:it,type,fields:c.fields,note:q("#dl-n").value.trim(),amount:c.amount,start:c.start};
        if(c.end)n.end=c.end;return{deal:n}}
      if(!(t>0))return{error:type==="calc"?(rows().some(f=>f.value&&numVal(f.value)!=null)?"Switch on × for the numbers to multiply, for example Rate and Quantity":"Add fields with numbers to multiply (for example Rate 285 and Quantity 7000), or choose Fixed amount"):"Enter the agreed amount"};
      if(q("#dl-hasd").checked&&!q("#dl-date").value)return{error:"Pick the deadline date"};
      const it=q("#dl-i").value||null;
      const n={title:q("#dl-t").value.trim()||(AS.IM.get(it)?.n)||"Deal",item:it,type,fields:c.fields,note:q("#dl-n").value.trim()};
      if(type==="fixed")n.amount=c.amount;
      if(q("#dl-hasd").checked)n.deadline=q("#dl-date").value;
      return{deal:n}}};
}
export function openDealForm(d,{contactId,onSaved}={}){
  const o=d?{...d}:{type:"calc",contactId,projectId:D.pid,fields:[]};
  const pick=!d&&!contactId;if(pick)fillLists();
  const c=AS.CM.get(o.contactId),linked=d?D.entries.filter(e=>e.dealId===d.id&&!e.deletedAt).length:0;
  const s=openSheet(d?"Edit deal":"New deal",`
    ${pick?`<label class="lbl" for="dl-who" style="margin-top:0">Deal with</label><input class="field" id="dl-who" list="pe-contacts" autocomplete="off" placeholder="Person or shop, e.g. Ramesh (watchman)">`:`<p class="pmeta" style="margin:0">${esc(c?`With ${c.name}`:"")}</p>`}
    ${dealFormHTML(o)}
    ${d?`<label class="check"><input type="checkbox" id="dl-c" ${o.closed?"checked":""}>Deal is complete (hide from new payments)</label>`:`<label class="check" id="dl-ew" hidden><input type="checkbox" id="dl-e"${D.deals.some(x=>x.contactId===o.contactId&&x.projectId===o.projectId)?"":" checked"}><span id="dl-el"></span></label>`}
    <button class="primary" id="dl-save">${d?"Save deal":"Add deal"}</button>
    ${d?'<button class="danger" id="dl-del">Delete deal</button>':""}`);
  const q=x=>$(x,s.body),api=wireDealForm(s.body,o);
  // earlier payments to this person (same item if one is picked) that aren't linked to any deal yet
  const earlier=()=>{const it=api.item();if(!o.contactId)return[];return D.entries.filter(e=>!e.deletedAt&&!e.dealId&&e.projectId===o.projectId&&e.contactId===o.contactId&&(!it||e.item===it))};
  const paintEarlier=()=>{const w=q("#dl-ew");if(!w)return;const es=earlier();w.hidden=!es.length;
    q("#dl-el").textContent=`Count earlier payments to ${AS.CM.get(o.contactId)?.name||"this person"} against this deal (${plural(es.length,"payment","payments")}, ${money(es.reduce((a,e)=>a+(+e.amount||0),0))})`};
  api.onItem(paintEarlier);paintEarlier();if(!d)setTimeout(()=>q(pick?"#dl-who":"#dl-t").focus(),50);
  if(pick)q("#dl-who").addEventListener("input",()=>{const v=q("#dl-who").value.trim().toLowerCase();o.contactId=D.contacts.find(x=>x.name.toLowerCase()===v)?.id;paintEarlier()});
  q("#dl-save").addEventListener("click",async()=>{
    const r=api.collect();if(!r.error&&pick&&!q("#dl-who").value.trim())r.error="Type who the deal is with";
    api.showError(r.error);if(r.error){toast(r.error);return}
    if(pick){try{o.contactId=(await upsertContact(q("#dl-who").value,""))?.id}catch{toast("Couldn’t save the contact.");return}}
    const n={...o,...r.deal,id:o.id||newId("d"),updatedAt:Date.now(),createdAt:o.createdAt||Date.now()};
    if(n.type==="calc")delete n.amount;if(!r.deal.deadline)delete n.deadline;
    if(n.type!=="monthly"){delete n.start;delete n.end}else if(!r.deal.end)delete n.end;
    if(d){n.closed=q("#dl-c").checked;if(!n.closed)delete n.closed}
    const i=D.deals.findIndex(x=>x.id===n.id);if(i>=0)D.deals[i]=n;else D.deals.push(n);
    try{await saveDeals();
      if(!d&&q("#dl-e")?.checked&&!q("#dl-ew").hidden)for(const e of earlier()){e.dealId=n.id;e.updatedAt=Date.now();await dbPut("entries",e)}
    }catch{toast("Couldn’t save the deal.");return}
    s.close();emit();toast(d?"Deal saved":"Deal added");onSaved&&onSaved();
  });
  const del=q("#dl-del");
  if(del)del.addEventListener("click",()=>deleteDeal(d,()=>{s.close();onSaved&&onSaved()}));
}
