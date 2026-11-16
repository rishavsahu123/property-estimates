// @ts-nocheck
import { openPaySheet } from "./entry-form";
import { isMonthly, workedText } from "../lib/deals";
import { openGroups } from "./catalog";
import { go } from "../app/nav";
// Home: total card, recent entries, backup note.
import { KINDS } from "../lib/constants";
import { money, fdate, fdatetime, inWords, plural, esc } from "../lib/format";
import { AS, D, projDeals, dealInView, dealBal, isLate, dueText } from "../state";
import { $, lget, lset, $$ } from "../ui/dom";
import { bindRows, rowHTML, sums } from "../ui/rows";

export function backupNote(){
  const last=lget("ghk-backup",0),n=AS.LIVE.length;
  $("#status").textContent=!n?"Everything is saved only on this phone.":last?`Saved on this phone. Last backup ${fdatetime(last)}.`:"Saved on this phone. No backup yet, save one from the download button at the top.";
  $("#lastbackup").textContent=last?`Last backup: ${fdatetime(last)}`:"No backup taken yet.";
}

// first steps for a new user; hides itself once done or closed
function renderWelcome(){
  const box=$("#welcome"),steps=[["pay","Add your first payment",D.entries.some(e=>!e.deletedAt)],["people","Add a person or a deal (thekedar, engineer)",D.contacts.length>0||D.deals.length>0],["backup","Save a backup file",!!lget("ghk-backup",0)]];
  const done=steps.filter(x=>x[2]).length;
  if(lget("pe-welcome-off",false)||done===steps.length||(D.entries.length>20)){box.hidden=true;return}
  box.hidden=false;
  box.innerHTML=`<div class="phead"><h2 style="margin:0">Getting started</h2><button class="x xs" id="wl-x" aria-label="Hide getting started">×</button></div>
    <p class="pmeta" style="margin:2px 0 6px">${done} of ${steps.length} done</p>
    ${steps.map(([k,t,ok],i)=>`<button type="button" class="wstep${ok?" ok":""}" data-ws="${k}"${ok?" disabled":""}><span class="wn">${ok?"✓":i+1}</span><span>${t}</span></button>`).join("")}`;
  $("#wl-x").addEventListener("click",()=>{lset("pe-welcome-off",true);box.hidden=true});
  $$("[data-ws]",box).forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.ws;
    if(k==="pay"){$("#addcard").scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>$('#addform [data-f="amount"]')?.focus(),300)}
    else if(k==="people")go("people");else $("#backup").click()}));
}
// older groups without a category show only under All: say so once, with a direct way to fix
function renderCatNote(){
  const n=$("#catnote"),unk=D.groups.filter(g=>!g.kind).length;
  if(!unk||lget("pe-catnote-off",false)){n.hidden=true;return}
  n.hidden=false;n.innerHTML=`<span>${plural(unk,"group has","groups have")} no category (Construction or Documents), so ${unk===1?"it shows":"they show"} only under All.</span><span class="pact"><button class="linkbtn" id="cn-set">Set now</button><button class="linkbtn" id="cn-x">Later</button></span>`;
  $("#cn-set").addEventListener("click",()=>openGroups(()=>{}));$("#cn-x").addEventListener("click",()=>{lset("pe-catnote-off",true);n.hidden=true});
}
// overdue deals and salary earned but not paid: one tap to pay
function renderDue(){
  const box=$("#duecard");
  const ds=projDeals().filter(d=>dealInView(d)&&!d.closed&&(isLate(d)||(isMonthly(d)&&dealBal(d)>=1)));
  if(!ds.length){box.hidden=true;return}
  const tot=ds.reduce((a,d)=>a+Math.max(dealBal(d),0),0);
  box.hidden=false;
  box.innerHTML=`<div class="phead"><h2 style="margin:0">Due now</h2><span class="num duetot">${money(tot)}</span></div>
    ${ds.map(d=>{const c=AS.CM.get(d.contactId);return `<button class="crow" data-due="${esc(d.id)}"><span class="av${isLate(d)?" late":""}" aria-hidden="true">${isLate(d)?"!":"₹"}</span>
      <span style="min-width:0"><b>${esc(d.title)}${c?` · ${esc(c.name)}`:""}</b><small>${esc(isMonthly(d)?workedText(d)+" · salary earned, not paid yet":dueText(d))}</small></span><span class="num">${money(dealBal(d))}</span></button>`}).join("")}
    <p class="hint" style="margin:6px 0 0">Tap one to pay it now.</p>`;
  $$("[data-due]",box).forEach(b=>b.addEventListener("click",()=>{const d=D.deals.find(x=>x.id===b.dataset.due);if(d)openPaySheet({deal:d})}));
}
export function renderHome(){
  renderWelcome();renderCatNote();renderDue();
  backupNote();const t=sums(AS.LIVE);
  $("#h-label").textContent=AS.VIEW==="all"?"Total spent so far":`${KINDS[AS.VIEW]} spent so far`;
  $("#h-total").textContent=money(t.t);$("#h-words").textContent=t.t?inWords(t.t):"";$("#h-cash").textContent=money(t.c);$("#h-online").textContent=money(t.o);
  const r=AS.LIVE.slice(0,5);
  $("#recent").innerHTML=r.length?r.map(e=>rowHTML(e)).join(""):'<li class="empty">Your payments will show here.</li>';
  bindRows($("#recent"));
}
