// @ts-nocheck
// The entry form used for add, edit and pop-up payments.
import { esc, money, numfmt, fdate, localDay, pnum, round2, perUnit, cleanPhone, newId, plural, inWords } from "../lib/format";
import { isMonthly, agLabel, dealAgreed, termsText, balText } from "../lib/deals";
import { openGroups, openItemForm } from "./catalog";
import { giveFile } from "./export";
import { delSlip, DOC_ACCEPT, docChip, docOk, filesOf, MAX_DOC, openDoc, slipURL, storeDoc, storeSlip, viewSlip } from "./files";
import { personKey } from "./passbook";
import { ICON } from "./people";
import { openReceipt } from "./receipt";
import { byItem } from "./summary";
import { AS, D, dealBal, dealPaid, gName, inView, itemName, phoneOf, projDeals, restoreIt, saveEntry, trashIt, upsertContact, viewGroups } from "../state";
import { $, $$, lget, lset, toast } from "../ui/dom";
import { ask, openSheet } from "../ui/sheets";

export function makeForm(root,{entry,onDone,onCancel}){
  const editing=!!entry;fillLists();
  const st={dealId:entry?.dealId||null,dealTouched:!!entry,item:entry?.item||null,mode:entry?(entry.cash&&entry.online?"both":entry.cash?"cash":"online"):lget("ghk-mode","cash"),
    amountTouched:editing,file:null,removeSlip:false,files:filesOf(entry||{}).map(x=>({...x})),newDocs:[]};
  root.innerHTML=`
    <div class="entrybox">
      <label class="amount"><span>₹</span><input data-f="amount" inputmode="decimal" placeholder="Amount" aria-label="Amount in rupees" autocomplete="off"></label>
      <div class="words" data-f="words" aria-live="polite"></div>
      <div class="seg" role="group" aria-label="Paid by">
        <button type="button" data-mode="cash">Cash</button><button type="button" data-mode="online">Online</button><button type="button" data-mode="both">Both</button>
      </div>
      <div class="splitin" data-f="splitWrap" hidden>
        <label><small>Cash ₹</small><input data-f="cash" inputmode="decimal" placeholder="0" autocomplete="off"></label>
        <label><small>Online ₹</small><input data-f="online" inputmode="decimal" placeholder="0" autocomplete="off"></label>
      </div>
    </div>
    <div class="hint" data-f="splitOut"></div>
    <div class="pickhead"><span class="lbl">What was it for? <span style="font-size:12px">(optional)</span></span><span><button type="button" class="linkbtn" data-f="clearItem" hidden>Clear</button><button type="button" class="linkbtn" data-f="editItems">Edit groups</button></span></div>
    <div class="gsel" data-f="picker"></div>
    <div class="row3" data-f="qtyWrap" hidden style="margin-top:10px">
      <label><small>Quantity</small><input class="field" data-f="qty" inputmode="decimal" placeholder="e.g. 50"></label>
      <label><small>Unit</small><select class="field" data-f="unit"></select></label>
      <label><small>Rate ₹</small><input class="field" data-f="rate" inputmode="decimal" placeholder="e.g. 303"></label>
    </div>
    <div class="hint" data-f="hint"></div>
    <span class="lbl">Shop or person</span>
    <div class="stack">
      <input class="field" data-f="vendor" placeholder="e.g. Sharma Cement Store" autocomplete="off" aria-label="Shop or person">
      <div class="chips" data-f="vendorSug"></div>
      <input class="field" data-f="phone" type="tel" inputmode="tel" placeholder="Mobile number (optional)" autocomplete="off" aria-label="Mobile number">
      <div data-f="dealWrap" hidden><span class="lbl" style="margin-top:4px">Count this payment against</span><div class="chips" data-f="deal" role="group" aria-label="Count this payment against"></div><div class="hint" data-f="dealHint"></div></div>
      <div class="stack" data-f="others"></div>
      <button type="button" class="linkbtn" data-f="addOther" style="justify-self:start">+ Add another person</button>
    </div>
    <span class="lbl">Note</span>
    <input class="field" data-f="note" placeholder="e.g. Slip kept in diary, 2nd floor" autocomplete="off">
    <span class="lbl">Date</span><input class="field" type="date" data-f="when" aria-label="Date of payment">
    <div class="slip">
      <label class="slipbtn"><input type="file" accept="image/*" data-f="file" hidden><span data-f="sliplbl">Add slip photo</span></label>
      <img class="thumb" data-f="thumb" alt="Slip preview" hidden>
      <button type="button" class="linkbtn" data-f="rmslip" hidden>Remove photo</button>
      <label class="slipbtn"><input type="file" accept="${DOC_ACCEPT}" multiple data-f="docs" hidden>Attach file</label>
    </div>
    <div class="docs" data-f="doclist"></div>
    <button type="button" class="primary" data-f="save">${editing?"Save changes":"Save entry"}</button>
    ${onCancel?'<button type="button" class="second" data-f="cancel">Cancel</button>':""}`;
  const f=n=>root.querySelector(`[data-f="${n}"]`);
  const amount=f("amount"),qty=f("qty"),rate=f("rate"),unit=f("unit"),cash=f("cash"),online=f("online"),vendor=f("vendor"),phone=f("phone");

  function paintPicker(){
    if(st.item&&!AS.IM.has(st.item))st.item=null;
    const gs=viewGroups(),cur=AS.IM.get(st.item);
    if(cur&&!gs.some(g=>g.k===cur.cat)){const g=AS.GM.get(cur.cat);if(g)gs.push(g)}
    f("picker").innerHTML=gs.length?gs.map(g=>{
      const its=D.items.filter(i=>i.cat===g.k&&(!i.hidden||i.k===st.item)),on=its.some(i=>i.k===st.item);
      return `<label class="gs${on?" on":""}">${on?`<small>${esc(g.n)}</small>`:""}<select data-g="${esc(g.k)}" aria-label="${esc(g.n)}"><option value="">${esc(g.n)}</option>${its.map(i=>`<option value="${esc(i.k)}"${i.k===st.item?" selected":""}>${esc(i.n)}</option>`).join("")}<option value="__new">+ New item</option></select></label>`}).join("")
      :'<p class="hint" style="margin:0">No groups in this view. Tap Edit groups to add one.</p>';
    $$("select[data-g]",f("picker")).forEach(sel=>sel.addEventListener("change",()=>{
      const v=sel.value,g=sel.dataset.g;
      if(v==="__new"){sel.value=AS.IM.get(st.item)?.cat===g?st.item:"";openItemForm(null,{cat:g,onSaved:it=>{if(it)st.item=it.k;paintItem()}});return}
      st.item=v||null;paintItem()}));
  }
  function paintItem(){
    paintPicker();
    const it=AS.IM.get(st.item),units=it?.units||[];
    f("clearItem").hidden=!st.item;
    f("qtyWrap").hidden=!units.length;
    if(units.length){const cur=unit.value;unit.innerHTML=units.map(u=>`<option>${esc(u)}</option>`).join("");if(units.includes(cur))unit.value=cur}
    hint();if(!vendor.value.trim())paintSug();paintDeal();
  }
  function paintSug(){
    const q=vendor.value.trim().toLowerCase(),box=f("vendorSug");let list;
    // most used names in the last 10 entries (for the picked item if it has history), newest wins ties
    const recent=src=>{const last=src.filter(e=>AS.CM.has(e.contactId)).slice(0,10),n=new Map();
      last.forEach((e,i)=>{const o=n.get(e.contactId)||{c:AS.CM.get(e.contactId),k:0,first:i};o.k++;n.set(e.contactId,o)});
      return [...n.values()].sort((a,b)=>b.k-a.k||a.first-b.first).map(o=>o.c)};
    if(q){const rank=new Map(recent(AS.LIVE).map((c,i)=>[c.id,i]));
      list=D.contacts.filter(c=>c.name.toLowerCase().includes(q)&&c.name.toLowerCase()!==q)
        .sort((a,b)=>(rank.has(a.id)?rank.get(a.id):99)-(rank.has(b.id)?rank.get(b.id):99)||a.name.localeCompare(b.name))}
    else{const byItem=st.item?recent(AS.LIVE.filter(e=>e.item===st.item)):[];list=byItem.length?byItem:recent(AS.LIVE)}
    list=list.slice(0,3);
    box.innerHTML=list.map(c=>`<button type="button" class="chip" data-c="${esc(c.id)}">${esc(c.name)}</button>`).join("");
    box.hidden=!list.length;vendor.placeholder=list.length&&!q?"Type a name or pick one below":"e.g. Sharma Cement Store";
    $$("[data-c]",box).forEach(b=>b.addEventListener("click",()=>{const c=AS.CM.get(b.dataset.c);if(!c)return;vendor.value=c.name;phone.value=c.phone||"";st.dealTouched=false;paintSug();paintDeal()}));
  }
  function addOther(o){
    const box=f("others"),row=document.createElement("div");row.className="xp";
    row.innerHTML=`<div class="xph"><small>Another person</small><button type="button" class="x xs" aria-label="Remove this person">×</button></div>
      <input class="field" data-xn list="pe-contacts" placeholder="Name, e.g. Mahesh" autocomplete="off" aria-label="Name">
      <div class="row"><input class="field" data-xp type="tel" inputmode="tel" placeholder="Mobile (optional)" autocomplete="off" aria-label="Mobile">
      <input class="field" data-xr list="pe-roles" placeholder="Role, e.g. Broker" autocomplete="off" aria-label="Role"></div>`;
    const c=o&&AS.CM.get(o.contactId);if(c){$("[data-xn]",row).value=c.name;$("[data-xp]",row).value=c.phone||"";$("[data-xr]",row).value=o.role||""}
    $(".x",row).addEventListener("click",()=>row.remove());
    $("[data-xn]",row).addEventListener("input",ev=>{const m=D.contacts.find(x=>x.name.toLowerCase()===ev.target.value.trim().toLowerCase());if(m&&m.phone&&!$("[data-xp]",row).value)$("[data-xp]",row).value=m.phone});
    box.appendChild(row);if(!o)$("[data-xn]",row).focus();
  }
  f("addOther").addEventListener("click",()=>{fillLists();addOther()});
  function paintMode(){
    $$("[data-mode]",root).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.mode===st.mode)));
    f("splitWrap").hidden=st.mode!=="both";f("splitOut").hidden=st.mode!=="both";split();
  }
  // Both: type cash or online, the other is worked out from the amount.
  // If the amount is still empty, the amount becomes cash + online instead.
  function split(){
    if(st.mode!=="both")return;
    const a=pnum(amount.value),c=pnum(cash.value),o=pnum(online.value);let msg="";
    if(st.sumMode){const t=round2(c+o);amount.value=t?t:"";words();hint();msg=t?`Amount = cash + online = ${money(t)}`:"Type cash and online, the amount adds up by itself."}
    else if(!a)msg="Type the amount first, or type cash and online and the amount adds up.";
    else if(st.splitSrc==="cash"){online.value=c?round2(Math.max(a-c,0)):"";if(c>a)msg=`Cash is ${money(c-a)} more than the amount.`}
    else if(st.splitSrc==="online"){cash.value=o?round2(Math.max(a-o,0)):"";if(o>a)msg=`Online is ${money(o-a)} more than the amount.`}
    else msg="Fill cash or online, the other is worked out.";
    f("splitOut").textContent=msg;
  }
  function splitInput(src){if(!pnum(amount.value)&&!st.amountTouched)st.sumMode=true;st.splitSrc=src;split()}
  function hint(){
    const it=AS.IM.get(st.item);let h="";
    if(it&&(it.units||[]).length){const q=pnum(qty.value),r=pnum(rate.value),a=pnum(amount.value);
      if(q&&r)h=`${numfmt.format(q)} × ${money(r)} = ${money(q*r)}`;
      else if(q&&a)h=`Works out to ${money(a/q)} per ${perUnit(unit.value)}`;}
    f("hint").textContent=h;
  }
  function words(){const a=pnum(amount.value);f("words").textContent=a>0?inWords(a):"";paintDeal()}
  function paintDeal(){
    const sel=f("deal");if(!sel)return;
    const c=D.contacts.find(x=>x.name.toLowerCase()===vendor.value.trim().toLowerCase());
    const ds=c?projDeals().filter(d=>d.contactId===c.id&&(!d.closed||d.id===st.dealId)):[];
    if(st.dealId&&!ds.some(d=>d.id===st.dealId))st.dealId=null;
    // pick a deal for the user only when it's clear: one open deal, or exactly one matching the item
    if(!st.dealTouched){const open=ds.filter(d=>!d.closed),byItem=open.filter(d=>d.item&&d.item===st.item);
      st.dealId=byItem.length===1?byItem[0].id:open.length===1?open[0].id:null}
    f("dealWrap").hidden=!ds.length;
    sel.innerHTML=`<button type="button" class="chip" data-dl="" aria-pressed="${!st.dealId}">General payment</button>`+ds.map(d=>`<button type="button" class="chip" data-dl="${esc(d.id)}" aria-pressed="${d.id===st.dealId}">${esc(d.title)}</button>`).join("");
    $$("[data-dl]",sel).forEach(b=>b.addEventListener("click",()=>{st.dealId=b.dataset.dl||null;st.dealTouched=true;paintDeal()}));
    const d=ds.find(x=>x.id===st.dealId),a=pnum(amount.value);
    if(d&&!st.item&&d.item&&AS.IM.has(d.item)){st.item=d.item;paintItem();return}
    if(d){const ag=dealAgreed(d),pd=dealPaid(d,Infinity,entry?.id),bal=round2(ag-pd);
      f("dealHint").textContent=`${agLabel(d)} ${money(ag)} · paid ${money(pd)} · balance ${balText(bal,d)}${a?` → ${balText(round2(bal-a),d)} after this`:""}`}
    else f("dealHint").textContent=ds.filter(x=>!x.closed).length>1?"Pick the deal this payment is for. General payments show in the passbook but don’t change any deal.":"Not counted against any deal.";
  }
  function autoAmount(){const q=pnum(qty.value),r=pnum(rate.value);if(q&&r&&!st.amountTouched){amount.value=round2(q*r);st.sumMode=false}hint();split();words()}

  $$("[data-mode]",root).forEach(b=>b.addEventListener("click",()=>{st.mode=b.dataset.mode;paintMode()}));
  f("clearItem").addEventListener("click",()=>{st.item=null;paintItem()});
  f("editItems").addEventListener("click",()=>openGroups(paintItem));
  amount.addEventListener("input",()=>{st.amountTouched=amount.value!=="";st.sumMode=false;hint();split();words()});
  qty.addEventListener("input",autoAmount);rate.addEventListener("input",autoAmount);unit.addEventListener("change",hint);
  cash.addEventListener("input",()=>splitInput("cash"));online.addEventListener("input",()=>splitInput("online"));
  vendor.addEventListener("input",()=>{const q=vendor.value.trim().toLowerCase();const m=D.contacts.find(c=>c.name.toLowerCase()===q);
    if(m&&m.phone&&!phone.value)phone.value=m.phone;paintSug();paintDeal()});
  f("file").addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;st.file=file;st.removeSlip=false;
    const t=f("thumb");t.src=URL.createObjectURL(file);t.hidden=false;f("rmslip").hidden=false;f("sliplbl").textContent="Change photo"});
  f("rmslip").addEventListener("click",()=>{st.file=null;st.removeSlip=true;f("file").value="";f("thumb").hidden=true;f("rmslip").hidden=true;f("sliplbl").textContent="Add slip photo"});
  f("thumb").addEventListener("click",()=>{const s=f("thumb").src;if(s)viewSlip(s)});
  // documents: kept as File objects until Save, so Cancel leaves nothing behind
  function paintDocs(){const box=f("doclist");
    box.innerHTML=st.files.map(x=>docChip(x,true)).join("")+st.newDocs.map((x,i)=>docChip({key:"new"+i,name:x.name,size:x.size},true)).join("");
    $$("[data-rmdoc]",box).forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.rmdoc;
      if(k.startsWith("new"))st.newDocs.splice(+k.slice(3),1);else st.files=st.files.filter(x=>x.key!==k);paintDocs()}));
    $$("[data-doc]",box).forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.doc;
      if(k.startsWith("new")){const x=st.newDocs[+k.slice(3)];if(x)giveFile(x.name,x)}else{const x=st.files.find(y=>y.key===k);if(x)openDoc(x)}}))}
  f("docs").addEventListener("change",ev=>{const picked=[...ev.target.files];ev.target.value="";let bad=0,big=0;
    for(const x of picked){if(!docOk(x)){bad++;continue}if(x.size>MAX_DOC){big++;continue}st.newDocs.push(x)}
    if(bad||big)toast([bad?`${plural(bad,"file","files")} skipped: audio and video can’t be attached`:"",big?`${plural(big,"file","files")} over 15 MB skipped`:""].filter(Boolean).join(". "));
    paintDocs()});
  paintDocs();

  if(entry){
    amount.value=entry.amount??"";qty.value=entry.qty??"";rate.value=entry.rate??"";
    vendor.value=entry.vendor||"";phone.value=phoneOf(entry);f("note").value=entry.note||"";
    if(st.mode==="both"){cash.value=entry.cash;online.value=entry.online;st.splitSrc="cash"}
    othersOf(entry).forEach(o=>addOther(o));
    f("when").value=localDay(new Date(entry.ts));
    if(entry.slipKey)slipURL(entry.slipKey).then(u=>{if(u&&!st.file&&!st.removeSlip){f("thumb").src=u;f("thumb").hidden=false;f("rmslip").hidden=false;f("sliplbl").textContent="Change photo"}});
  }
  if(!entry)f("when").value=localDay();
  paintItem();
  if(entry?.unit){if(![...unit.options].some(o=>o.value===entry.unit))unit.insertAdjacentHTML("beforeend",`<option>${esc(entry.unit)}</option>`);unit.value=entry.unit}
  paintMode();paintSug();words();

  f("save").addEventListener("click",async()=>{
    const a=pnum(amount.value);
    if(!(a>0)){toast("Enter the amount first");amount.focus();return}
    const it=AS.IM.get(st.item);const hasQ=!!(it&&(it.units||[]).length);
    const q=hasQ?pnum(qty.value):0;let r=hasQ?pnum(rate.value):0;if(hasQ&&q&&!r)r=round2(a/q);
    if(st.mode==="both"&&!pnum(cash.value)&&!pnum(online.value)){toast("Fill the cash or online part");cash.focus();return}
    const c=st.mode==="cash"?a:st.mode==="online"?0:st.splitSrc==="online"?round2(Math.max(a-Math.min(pnum(online.value),a),0)):Math.min(pnum(cash.value),a);
    const btn=f("save");btn.disabled=true;btn.textContent="Saving…";
    try{
      const ct=await upsertContact(vendor.value,phone.value);
      const others=[];
      for(const row of $$(".xp",f("others"))){const n=$("[data-xn]",row).value.trim();if(!n)continue;
        const oc=await upsertContact(n,$("[data-xp]",row).value);if(!oc||oc.id===ct?.id||others.some(x=>x.contactId===oc.id))continue;
        const role=$("[data-xr]",row).value.trim();others.push(role?{contactId:oc.id,role}:{contactId:oc.id})}
      const e={...(entry||{}),id:entry?.id||newId("e"),projectId:entry?.projectId||D.pid,ts:entry?entry.ts:Date.now(),item:st.item,
        qty:q||null,unit:hasQ&&q?unit.value:null,rate:r||null,amount:a,cash:c,online:round2(a-c),
        vendor:ct?ct.name:"",contactId:ct?ct.id:null,note:f("note").value.trim(),
        slipKey:entry?.slipKey||null,createdAt:entry?.createdAt||Date.now(),updatedAt:Date.now()};
      delete e.itemName;if(others.length)e.others=others;else delete e.others;
      // made while Construction or Documents is picked at the top: keep it there even with no item
      if(!e.kind&&AS.VIEW!=="all")e.kind=AS.VIEW;
      if(st.dealId&&!f("dealWrap").hidden)e.dealId=st.dealId;else delete e.dealId;
      if(f("when").value){const [y,mo,dd]=f("when").value.split("-").map(Number);const n=new Date(entry?entry.ts:Date.now());n.setFullYear(y,mo-1,dd);if(isFinite(n.getTime()))e.ts=n.getTime()}
      const oldKey=entry?.slipKey;if(st.removeSlip)e.slipKey=null;
      if(st.file)e.slipKey=await storeSlip(st.file);
      const keptDocs=[...st.files];for(const x of st.newDocs)keptDocs.push(await storeDoc(x));
      if(keptDocs.length)e.files=keptDocs;else delete e.files;
      const droppedDocs=filesOf(entry||{}).filter(x=>!keptDocs.some(y=>y.key===x.key));
      await saveEntry(e);
      if(oldKey&&oldKey!==e.slipKey)await delSlip(oldKey);
      for(const x of droppedDocs)await delSlip(x.key);
      if(!editing&&st.mode!=="both")lset("ghk-mode",st.mode);
      toast(!inView(e)?"Saved. It shows under All because its group isn’t in this view.":editing?"Changes saved":"Entry saved");onDone&&onDone();
    }catch(err){
      console.error(err);toast("Couldn’t save. Phone storage may be full.");
      btn.disabled=false;btn.textContent=editing?"Save changes":"Save entry";
    }
  });
  if(onCancel)f("cancel").addEventListener("click",onCancel);
  return{preset(k){st.item=k;paintItem();amount.focus()},refresh(){paintItem()},
    presetContact(c){vendor.value=c.name;phone.value=c.phone||"";st.dealTouched=false;paintSug();paintDeal();amount.focus()},
    presetDeal(d){const c=AS.CM.get(d.contactId);if(c){vendor.value=c.name;phone.value=c.phone||""}if(d.item&&AS.IM.has(d.item))st.item=d.item;
      st.dealId=d.id;st.dealTouched=true;paintItem();paintSug();paintDeal();amount.focus()}};
}

let addForm;
// add a payment in a pop-up without leaving the page; preset a deal or a person
export function openPaySheet({deal,contact}={}){
  const s=openSheet("Add payment","");
  const fm=makeForm(s.body,{onDone:()=>s.close(),onCancel:()=>s.close()});
  if(deal)fm.presetDeal(deal);else if(contact)fm.presetContact(contact);
  if(isMonthly(deal)){const b=Math.round(dealBal(deal)),am=$('[data-f="amount"]',s.body);if(b>0&&am&&!am.value){am.value=b;am.dispatchEvent(new Event("input",{bubbles:true}))}}
}
export function resetAdd(){addForm=makeForm($("#addform"),{onDone:resetAdd})}
export function openEdit(id){openView(id,{edit:true})}
export async function trashWithUndo(e,after){
  if(!await ask("Move this entry to trash?",`${[itemName(e)||e.vendor||e.note||"Entry",money(e.amount),fdate(e.ts)].join(" · ")}. You can restore it from Trash.`,{ok:"Move to trash",danger:true}))return;
  try{await trashIt(e);after&&after();toast("Moved to trash",{label:"Undo",fn:async()=>{const x=D.entries.find(y=>y.id===e.id);if(x){await restoreIt(x);toast("Entry restored")}}})}
  catch{toast("Couldn’t move to trash. Try again.")}
}
export const othersOf=e=>(Array.isArray(e.others)?e.others:[]).filter(o=>o&&AS.CM.has(o.contactId));
export const otherNames=e=>othersOf(e).map(o=>AS.CM.get(o.contactId).name+(o.role?` (${o.role})`:""));
export const personKeys=e=>[personKey(e),...othersOf(e).map(o=>AS.CM.get(o.contactId).name.trim().toLowerCase())].filter(Boolean);
export function fillLists(){
  let a=$("#pe-contacts");if(!a){a=document.createElement("datalist");a.id="pe-contacts";document.body.appendChild(a)}
  a.innerHTML=D.contacts.map(c=>`<option value="${esc(c.name)}">`).join("");
  let r=$("#pe-roles");if(!r){r=document.createElement("datalist");r.id="pe-roles";document.body.appendChild(r)}
  const roles=new Set(["Broker","Owner","Advocate","Agent","Notary","Witness","Supervisor","Engineer","Thekedar"]);
  D.entries.forEach(e=>(e.others||[]).forEach(o=>{if(o.role)roles.add(o.role)}));
  r.innerHTML=[...roles].map(x=>`<option value="${esc(x)}">`).join("");
}
export const personLine=(name,phone,role)=>`<div class="vp"><span><b>${esc(name)}</b>${role?` <span class="tag muted">${esc(role)}</span>`:""}${phone?`<small>${esc(phone)}</small>`:""}</span>${phone?`<a class="ib" href="tel:${esc(cleanPhone(phone))}" aria-label="Call ${esc(name)}">${ICON.call}</a>`:""}</div>`;
export function viewHTML(e){
  const it=AS.IM.get(e.item),c=AS.CM.get(e.contactId);
  const mode=e.cash&&e.online?`<span class="tag cash">Cash ${money(e.cash)}</span> <span class="tag online">Online ${money(e.online)}</span>`:e.cash?'<span class="tag cash">Paid in cash</span>':'<span class="tag online">Paid online</span>';
  const rows=[["Date",esc(fdate(e.ts))],["For",it?`${esc(it.n)} <small>${esc(gName(it.cat))}</small>`:'<span class="missing">Item not set</span>']];
  if(e.qty)rows.push(["Quantity",`${numfmt.format(e.qty)} ${esc(e.unit||"")}${e.rate?` × ${money(e.rate)}`:""}`]);
  if(e.vendor)rows.push(["Paid to",personLine(e.vendor,c?.phone,"")]);
  const os=othersOf(e);if(os.length)rows.push(["Also involved",os.map(o=>{const oc=AS.CM.get(o.contactId);return personLine(oc.name,oc.phone,o.role)}).join("")]);
  const dl=D.deals.find(x=>x.id===e.dealId);
  if(dl)rows.push(["Deal",`${esc(dl.title)}<small> · ${agLabel(dl).toLowerCase()} ${money(dealAgreed(dl))} · balance ${balText(dealBal(dl),dl)}</small>${termsText(dl).length?`<small style="display:block">${esc(termsText(dl).join(" · "))}</small>`:""}`]);
  if(e.note)rows.push(["Note",esc(e.note)]);
  return `<div class="vamt"><span class="num">${money(e.amount)}</span><span class="w">${esc(inWords(e.amount))}</span><div style="margin-top:8px">${mode}</div></div>
    <dl class="vlist">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    ${e.slipKey?'<span class="lbl">Slip photo</span><img class="vslip" alt="Payment slip" data-v="slip">':""}
    ${filesOf(e).length?`<span class="lbl">Files</span><div class="docs">${filesOf(e).map(x=>docChip(x,false)).join("")}</div>`:""}`;
}
export function openView(id,opt={}){
  const find=()=>D.entries.find(x=>x.id===id&&!x.deletedAt);
  if(!find())return;
  const s=openSheet("Entry","");
  const top=$(".sheet-top",s.el),acts=document.createElement("div");acts.className="vacts";
  acts.innerHTML=`<button class="ib" data-v="share" aria-label="Share receipt">${ICON.share}</button><button class="ib" data-v="edit" aria-label="Edit entry">${ICON.edit}</button><button class="ib red" data-v="del" aria-label="Move to trash">${ICON.trash}</button>`;
  top.insertBefore(acts,$(".x",top));
  const h2=$("h2",top);
  let editing=false;
  const view=()=>{editing=false;const e=find();if(!e){s.close();return}
    h2.textContent=itemName(e)||"Entry";acts.hidden=false;s.body.innerHTML=viewHTML(e);
    const img=$("[data-v=slip]",s.body);if(img)slipURL(e.slipKey).then(u=>{if(u){img.src=u;img.addEventListener("click",()=>viewSlip(u))}});
    $$("[data-doc]",s.body).forEach(b=>b.addEventListener("click",()=>{const x=filesOf(e).find(y=>y.key===b.dataset.doc);if(x)openDoc(x)}))};
  const edit=()=>{const e=find();if(!e)return;editing=true;h2.textContent="Edit entry";acts.hidden=true;makeForm(s.body,{entry:e,onDone:view,onCancel:view});s.el.querySelector(".sheet").scrollTop=0};
  $("[data-v=share]",acts).addEventListener("click",()=>openReceipt([id]));
  $("[data-v=edit]",acts).addEventListener("click",edit);
  $("[data-v=del]",acts).addEventListener("click",()=>{const e=find();if(e)trashWithUndo(e,()=>s.close())});
  s.refresh=()=>{if(!editing)view()};
  opt.edit?edit():view();
}
