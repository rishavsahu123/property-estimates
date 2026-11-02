// @ts-nocheck
// People and Deals tabs, person page, contact form.
import { esc, money, fdate, round2, cleanPhone, newId, plural, inWords } from "../lib/format";
import { dealAgreed, balText } from "../lib/deals";
import { dbPut, dbDel } from "../data/db";
import { go } from "../app/nav";
import { bindDeals, dealCard, dealFormHTML, openDealForm, wireDealForm } from "./deals";
import { openPaySheet, openView, othersOf } from "./entry-form";
import { PB, personKey } from "./passbook";
import { openReceipt } from "./receipt";
import { AS, blankF, D, dealBal, dealInView, dealPaid, emit, isLate, itemName, projDeals, saveDeals } from "../state";
import { $, $$, lget, lset, toast } from "../ui/dom";
import { rowHTML, sums } from "../ui/rows";
import { ask, openSheet } from "../ui/sheets";

export const initials=n=>String(n||"?").trim().split(/\s+/).slice(0,2).map(w=>[...w][0]||"").join("").toUpperCase()||"?";
export const waLink=p=>{const d=cleanPhone(p).replace(/^\+/,"");return "https://wa.me/"+(d.length===10?"91"+d:d)};
export const ICON={call:'<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  wa:'<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
  share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>'};
export function peopleRows(){
  const q=($("#psearch").value||"").trim().toLowerCase();
  return D.contacts.map(c=>{const es=AS.LIVE.filter(e=>e.contactId===c.id),inv=AS.LIVE.filter(e=>e.contactId!==c.id&&othersOf(e).some(o=>o.contactId===c.id));return{c,es,inv,t:sums(es).t}})
    .filter(r=>!q||r.c.name.toLowerCase().includes(q)||(r.c.phone||"").includes(q.replace(/\s/g,"")))
    .sort((a,b)=>(!a.es.length-!b.es.length)||b.t-a.t||a.c.name.localeCompare(b.c.name));
}
let PTAB=lget("pe-ptab","contacts"),DEALF=lget("pe-pdf","open");
export function renderPeople(){
  $$("[data-pt]").forEach(b=>{const on=b.dataset.pt===PTAB;b.setAttribute("aria-pressed",String(on));b.setAttribute("aria-selected",String(on))});
  $("#pt-deals").hidden=PTAB!=="deals";$("#pt-contacts").hidden=PTAB!=="contacts";
  const vds=projDeals().filter(dealInView),openN=vds.filter(d=>!d.closed).length;
  $("#pt-dn").hidden=!openN;$("#pt-dn").textContent=openN;
  if(PTAB==="deals"){renderAllDeals(vds);return}
  const rows=peopleRows();
  $("#contacts").innerHTML=rows.length?rows.map(({c,es,inv,t})=>{
    const its=[...new Set(es.map(itemName).filter(Boolean))].slice(0,2).join(", ");
    const roles=[...new Set(inv.flatMap(e=>othersOf(e).filter(o=>o.contactId===c.id&&o.role).map(o=>o.role)))].join(", ");
    const sub=es.length?`${its?its+" · ":""}${plural(es.length,"payment","payments")} · last ${fdate(es[0].ts)}`:inv.length?`${roles?roles+" · ":""}involved in ${plural(inv.length,"entry","entries")}`:(AS.VIEW==="all"?"No entries in this project":"No entries in this view");
    const due=projDeals().filter(d=>d.contactId===c.id&&!d.closed&&dealInView(d)),dueAmt=round2(due.reduce((a,d)=>a+dealBal(d),0));
    const sub2=due.length?`Balance ${balText(dueAmt)} · ${sub}`:sub,nd=projDeals().filter(d=>d.contactId===c.id&&dealInView(d)).length;
    return `<button class="crow${es.length||inv.length||due.length?"":" idle"}" data-pc="${esc(c.id)}"><span class="av" aria-hidden="true">${esc(initials(c.name))}</span>
      <span style="min-width:0"><b>${esc(c.name)}${nd?`<span class="dcount">${plural(nd,"deal","deals")}</span>`:""}</b><small>${esc(sub2)}</small></span><span class="num">${es.length?money(t):""}</span></button>`}).join("")
    :`<p class="empty">${D.contacts.length?"No one matches that search.":"Names you type in “Shop or person” are saved here."}</p>`;
  $$("[data-pc]",$("#contacts")).forEach(b=>b.addEventListener("click",()=>openPerson(b.dataset.pc)));
}
$("#psearch").addEventListener("input",renderPeople);
export function renderAllDeals(vds){
  $$("[data-df]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.df===DEALF)));
  const ds=vds.filter(d=>DEALF==="all"||!d.closed).sort((a,b)=>(!!a.closed-!!b.closed)||(isLate(b)-isLate(a))||dealBal(b)-dealBal(a)||a.title.localeCompare(b.title));
  const box=$("#alldeals");
  if(!ds.length){box.innerHTML=`<p class="hint" style="margin:10px 0 0">${vds.length?"No open deals. Tap All to see completed ones.":"No deals yet. Add one when a price is agreed up front (₹285 per sq ft, ₹75,000 fixed) or for a monthly salary like a watchman."}</p>`;return}
  let ag=0,pd=0;ds.forEach(d=>{ag+=dealAgreed(d);pd+=dealPaid(d)});
  box.innerHTML=`<div class="sumstrip"><div>Agreed / earned<span class="num">${money(ag)}</span></div><div>Paid<span class="num">${money(pd)}</span></div><div>Balance<span class="num">${balText(round2(ag-pd))}</span></div></div>`
    +ds.map(d=>dealCard(d,true,{who:true})).join("");
  bindDeals(box);
  $$("[data-pc]",box).forEach(b=>b.addEventListener("click",()=>openPerson(b.dataset.pc)));
  $$(".entry",box).forEach(b=>b.addEventListener("click",()=>openView(b.dataset.id)));
}
$$("[data-pt]").forEach(b=>b.addEventListener("click",()=>{PTAB=b.dataset.pt;lset("pe-ptab",PTAB);renderPeople();window.scrollTo(0,0)}));
$$("[data-df]").forEach(b=>b.addEventListener("click",()=>{DEALF=b.dataset.df;lset("pe-pdf",DEALF);renderPeople()}));
$("#adddeal2").addEventListener("click",()=>openDealForm(null));
export function openPerson(id){
  if(!AS.CM.get(id))return;
  const s=openSheet(AS.CM.get(id).name,"");
  const paint=()=>{
    const c=AS.CM.get(id);if(!c){s.close();return}
    $(".sheet-top h2",s.el).textContent=c.name;
    const es=AS.LIVE.filter(e=>e.contactId===c.id),t=sums(es);
    const inv=AS.LIVE.filter(e=>e.contactId!==c.id&&othersOf(e).some(o=>o.contactId===c.id));
    const its=[...new Set(es.map(itemName).filter(Boolean))].join(", ");
    const ds=projDeals().filter(d=>d.contactId===c.id),other=es.filter(e=>!e.dealId||!ds.some(d=>d.id===e.dealId));
    s.body.innerHTML=`
    <p class="pmeta" style="margin:0">${esc([c.phone,its].filter(Boolean).join(" · ")||"No mobile number saved")}</p>
    <div class="pacts">
      ${c.phone?`<a class="pill" href="tel:${esc(cleanPhone(c.phone))}">${ICON.call}Call</a><a class="pill" href="${esc(waLink(c.phone))}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a>`:""}
      <button class="pill" data-p="edit">${ICON.edit}${c.phone?"Edit":"Add mobile"}</button>
      <button class="pill" data-p="pay">+ Payment</button>
    </div>
    <div class="phead" style="margin-top:10px"><span class="lbl" style="margin:0">Deals</span><button class="linkbtn" data-p="adddeal">+ Add deal</button></div>
    ${ds.map(d=>dealCard(d,true)).join("")||'<p class="hint" style="margin:2px 0 6px">No deal yet. Add one when the price is agreed up front, for example ₹285 per sq ft or ₹75,000 fixed.</p>'}
    ${es.length?`<div class="sumstrip">
      <div>Paid<span class="num">${money(t.t)}</span></div><div>Cash<span class="num">${money(t.c)}</span></div><div>Online<span class="num">${money(t.o)}</span></div></div>
    <p class="count" style="font-style:italic">${esc(inWords(t.t))}</p>
    <p class="count">${plural(es.length,"payment","payments")}, ${fdate(es[es.length-1].ts)} to ${fdate(es[0].ts)}</p>
    <button class="primary" data-p="share">Share statement</button>
    <button class="second" data-p="book">Show in passbook</button>
    ${ds.length?`<span class="lbl" style="margin-top:14px">Other payments <span style="font-size:12px">(not in any deal)</span></span>`:""}
    ${other.length?`<ul class="book" style="margin-top:${ds.length?0:10}px">${other.map(e=>rowHTML(e,null,null,false,{noVendor:true})).join("")}</ul>`:ds.length?'<p class="hint" style="margin:0">All payments are counted in a deal.</p>':""}`
    :inv.length?"":`<p class="empty">No entries for ${esc(c.name)} ${AS.VIEW==="all"?"in this project":"in this view"} yet.</p>`}
    ${inv.length?`<span class="lbl">Also involved in</span><ul class="book">${inv.map(e=>rowHTML(e)).join("")}</ul>`:""}`;
    $("[data-p=edit]",s.body).addEventListener("click",()=>openContact(c));
    $("[data-p=pay]",s.body).addEventListener("click",()=>openPaySheet({contact:c}));
    $("[data-p=adddeal]",s.body).addEventListener("click",()=>openDealForm(null,{contactId:c.id}));
    bindDeals(s.body);
    const sh=$("[data-p=share]",s.body);if(sh)sh.addEventListener("click",()=>openReceipt([es[0].id]));
    const bk=$("[data-p=book]",s.body);if(bk)bk.addEventListener("click",()=>{AS.F=blankF();AS.F.people=[personKey(es[0])];PB.limit=150;s.close();go("book")});
    $$(".entry",s.body).forEach(b=>b.addEventListener("click",()=>openView(b.dataset.id)));
  };
  s.refresh=paint;paint();
}
export function openContact(c){
  const used=c?D.entries.filter(e=>e.contactId===c.id||(e.others||[]).some(o=>o.contactId===c.id)).length+D.deals.filter(d=>d.contactId===c.id).length:0;
  const s=openSheet(c?"Edit contact":"New contact",`
    <label class="lbl" for="ct-n">Name</label><input class="field" id="ct-n" autocomplete="off" placeholder="e.g. Sharma Cement Store" value="${esc(c?.name||"")}">
    <label class="lbl" for="ct-p">Mobile number</label><input class="field" id="ct-p" type="tel" inputmode="tel" autocomplete="off" placeholder="e.g. 98765 43210 (optional)" value="${esc(c?.phone||"")}">
    ${c&&used?`<p class="hint">Renaming also updates the name on ${plural(used,"entry","entries")}.</p>`:""}
    ${c?"":`<button type="button" class="second" id="ct-adddeal">+ Add a deal</button><div class="deal-inline" id="ct-deal" hidden><div class="phead"><span class="lbl" style="margin:10px 0 0">Deal with this person</span><button type="button" class="linkbtn" id="ct-nodeal">Remove</button></div>${dealFormHTML({type:"calc",fields:[]})}</div>`}
    <button class="primary" id="ct-save">${c?"Save contact":"Add contact"}</button>
    ${c&&!used?'<button class="danger" id="ct-del">Delete contact</button>':""}`);
  let dapi=null;const dbox=$("#ct-deal",s.body);
  if(dbox){dapi=wireDealForm(dbox,{type:"calc",fields:[]});
    $("#ct-adddeal",s.body).addEventListener("click",()=>{dbox.hidden=false;$("#ct-adddeal",s.body).hidden=true;$("#dl-t",dbox).focus()});
    $("#ct-nodeal",s.body).addEventListener("click",()=>{dbox.hidden=true;$("#ct-adddeal",s.body).hidden=false})}
  $("#ct-save",s.body).addEventListener("click",async()=>{
    const name=$("#ct-n",s.body).value.trim(),phone=cleanPhone($("#ct-p",s.body).value);
    if(!name){toast("Type a name");return}
    const dup=D.contacts.find(x=>x.name.toLowerCase()===name.toLowerCase()&&x.id!==c?.id);
    if(dup){toast(`“${dup.name}” is already saved`);return}
    let dr=null;if(dbox&&!dbox.hidden){dr=dapi.collect();dapi.showError(dr.error);if(dr.error){toast(dr.error);return}}
    try{
      const o={...(c||{id:newId("c"),createdAt:Date.now()}),name,phone,updatedAt:Date.now()};
      await dbPut("contacts",o);const i=D.contacts.findIndex(x=>x.id===o.id);if(i>=0)D.contacts[i]=o;else D.contacts.push(o);
      if(dr){D.deals.push({...dr.deal,id:newId("d"),contactId:o.id,projectId:D.pid,createdAt:Date.now(),updatedAt:Date.now()});await saveDeals()}
      if(c&&c.name!==name)for(const e of D.entries.filter(e=>e.contactId===o.id)){e.vendor=name;e.updatedAt=Date.now();await dbPut("entries",e)}
      s.close();emit();toast(c?"Contact saved":dr?"Contact and deal added":"Contact added");
    }catch{toast("Couldn’t save the contact.")}
  });
  const del=$("#ct-del",s.body);
  if(del)del.addEventListener("click",async()=>{if(!await ask(`Delete ${c.name}?`,"This removes the contact from People.",{ok:"Delete",danger:true}))return;
    await dbDel("contacts",c.id);D.contacts=D.contacts.filter(x=>x.id!==c.id);s.close();emit();toast("Contact deleted")});
}
$("#addcontact").addEventListener("click",()=>openContact(null));
