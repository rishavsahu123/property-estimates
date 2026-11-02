// @ts-nocheck
// Passbook: list, filters, sort, select mode.
import { pdfOfEntries } from "./export";
import { RANGES } from "../lib/constants";
import { esc, money, shortDay, pnum, plural, inWords } from "../lib/format";
import { openView, othersOf, personKeys, trashWithUndo } from "./entry-form";
import { attachCount } from "./files";
import { openReceipt } from "./receipt";
import { AS, blankF, D, itemName, restoreIt, trashIt } from "../state";
import { $, $$, toast } from "../ui/dom";
import { rowHTML, sums } from "../ui/rows";
import { ask, openSheet } from "../ui/sheets";

export const PB={limit:150};
export const personKey=e=>(e.vendor||"").trim().toLowerCase();
export function bounds(f){
  const now=new Date(),day=864e5,sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  if(f.range==="week")return[sod(now)-6*day,Infinity];
  if(f.range==="month")return[new Date(now.getFullYear(),now.getMonth(),1).getTime(),Infinity];
  if(f.range==="lastmonth")return[new Date(now.getFullYear(),now.getMonth()-1,1).getTime(),new Date(now.getFullYear(),now.getMonth(),1).getTime()-1];
  if(f.range==="custom")return[f.from?new Date(f.from+"T00:00").getTime():-Infinity,f.to?new Date(f.to+"T23:59:59.999").getTime():Infinity];
  return[-Infinity,Infinity];
}
export function applyF(list,f){
  const [a,b]=bounds(f),items=new Set(f.items),people=new Set(f.people),mn=f.min===""?null:pnum(f.min),mx=f.max===""?null:pnum(f.max);
  return list.filter(e=>e.ts>=a&&e.ts<=b
    &&(!items.size||items.has(e.item||"none"))
    &&(f.mode==="all"||(f.mode==="cash"?e.cash>0:e.online>0))
    &&(!people.size||personKeys(e).some(k=>people.has(k)))
    &&(f.slip==="any"||(f.slip==="yes"?attachCount(e)>0:!attachCount(e)))
    &&(mn==null||e.amount>=mn)&&(mx==null||e.amount<=mx));
}
export function filterTags(){
  const t=[],vendorName=k=>{const c=D.contacts.find(x=>x.name.trim().toLowerCase()===k);return c?c.name:k};
  if(AS.F.range!=="all"){
    let l=RANGES.find(r=>r[0]===AS.F.range)[1];
    if(AS.F.range==="custom")l=AS.F.from&&AS.F.to?`${shortDay(AS.F.from)} – ${shortDay(AS.F.to)}`:AS.F.from?`From ${shortDay(AS.F.from)}`:AS.F.to?`Till ${shortDay(AS.F.to)}`:"Any date";
    t.push([l,()=>{AS.F.range="all";AS.F.from=AS.F.to=""}]);
  }
  AS.F.items.forEach(k=>t.push([k==="none"?"Item not set":(AS.IM.get(k)?.n||"Item"),()=>{AS.F.items=AS.F.items.filter(x=>x!==k)}]));
  if(AS.F.mode!=="all")t.push([AS.F.mode==="cash"?"Cash":"Online",()=>{AS.F.mode="all"}]);
  AS.F.people.forEach(k=>t.push([vendorName(k),()=>{AS.F.people=AS.F.people.filter(x=>x!==k)}]));
  if(AS.F.slip!=="any")t.push([AS.F.slip==="yes"?"With attachment":"No attachment",()=>{AS.F.slip="any"}]);
  if(AS.F.min!==""||AS.F.max!==""){
    const l=AS.F.min!==""&&AS.F.max!==""?`${money(AS.F.min)} – ${money(AS.F.max)}`:AS.F.min!==""?`${money(AS.F.min)} or more`:`Up to ${money(AS.F.max)}`;
    t.push([l,()=>{AS.F.min=AS.F.max=""}]);
  }
  return t;
}
export function openFilters(){
  const w=JSON.parse(JSON.stringify(AS.F));
  const s=openSheet("Filters","");
  const usedItems=new Set(AS.LIVE.map(e=>e.item||"none"));
  const people=[];const seen=new Set();
  AS.LIVE.forEach(e=>{const k=personKey(e);if(k&&!seen.has(k)){seen.add(k);people.push([k,e.vendor.trim()])}
    othersOf(e).forEach(o=>{const n=AS.CM.get(o.contactId).name.trim(),k2=n.toLowerCase();if(!seen.has(k2)){seen.add(k2);people.push([k2,n])}})});
  D.contacts.forEach(c=>{const k=c.name.trim().toLowerCase();if(k&&!seen.has(k)){seen.add(k);people.push([k,c.name.trim()])}});
  people.sort((a,b)=>a[1].localeCompare(b[1]));
  const pCount=k=>AS.LIVE.filter(e=>personKeys(e).includes(k)).length,pName=new Map(people);
  const itemGroups=D.groups.map(({k:g,n:label})=>{const its=D.items.filter(i=>i.cat===g&&usedItems.has(i.k));
    return its.length?`<span class="pg-l" style="margin-top:8px">${esc(label)}</span><div class="chips">${its.map(i=>`<button type="button" class="chip" data-fi="${esc(i.k)}">${esc(i.n)}</button>`).join("")}</div>`:""}).join("")
    +(usedItems.has("none")?`<div class="chips" style="margin-top:8px"><button type="button" class="chip" data-fi="none">Item not set</button></div>`:"");
  s.body.innerHTML=`
    <span class="lbl">Date</span>
    <div class="chips">${RANGES.map(([k,n])=>`<button type="button" class="chip" data-fr="${k}">${esc(n)}</button>`).join("")}</div>
    <div class="row" data-w="custom" style="margin-top:8px">
      <label><small>From</small><input type="date" class="field" data-w="from"></label>
      <label><small>To</small><input type="date" class="field" data-w="to"></label>
    </div>
    <span class="lbl">Items <span style="font-size:12px">(pick any number)</span></span>
    ${itemGroups||'<p class="pmeta" style="margin:0">No entries yet.</p>'}
    <span class="lbl">Paid by</span>
    <div class="seg"><button type="button" data-fm="all">Any</button><button type="button" data-fm="cash">Cash</button><button type="button" data-fm="online">Online</button></div>
    <span class="lbl">Shop or person</span>
    ${people.length?`<select class="field" id="fp-sel" aria-label="Add a shop or person to the filter"><option value="">Pick a shop or person (${people.length})</option>${people.map(([k,n])=>{const c=pCount(k);return `<option value="${esc(k)}">${esc(n)}${c?` (${c})`:" (no entries)"}</option>`}).join("")}</select><div class="chips" id="fp-on" style="margin-top:8px"></div>`:'<p class="pmeta" style="margin:0">No names added to entries yet.</p>'}
    <span class="lbl">Slip photo or file</span>
    <div class="seg"><button type="button" data-fs="any">Any</button><button type="button" data-fs="yes">Attached</button><button type="button" data-fs="no">None</button></div>
    <span class="lbl">Amount ₹</span>
    <div class="row"><label><small>From</small><input class="field" inputmode="decimal" data-w="min" placeholder="0"></label><label><small>To</small><input class="field" inputmode="decimal" data-w="max" placeholder="Any"></label></div>
    <button class="primary" data-w="apply">Show entries</button>
    <button class="more" data-w="clear">Clear all filters</button>`;
  const q=n=>$(`[data-w="${n}"]`,s.body);
  q("from").value=w.from;q("to").value=w.to;q("min").value=w.min;q("max").value=w.max;
  const tog=(arr,k)=>arr.includes(k)?arr.filter(x=>x!==k):[...arr,k];
  function paint(){
    $$("[data-fr]",s.body).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.fr===w.range)));
    q("custom").hidden=w.range!=="custom";
    $$("[data-fi]",s.body).forEach(b=>b.setAttribute("aria-pressed",String(w.items.includes(b.dataset.fi))));
    $$("[data-fm]",s.body).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.fm===w.mode)));
    const on=$("#fp-on",s.body);if(on){on.innerHTML=w.people.map(k=>`<button type="button" class="chip" aria-pressed="true" data-fp="${esc(k)}" aria-label="Remove ${esc(pName.get(k)||k)}">${esc(pName.get(k)||k)} ×</button>`).join("");
      $$("[data-fp]",on).forEach(b=>b.addEventListener("click",()=>{w.people=w.people.filter(x=>x!==b.dataset.fp);paint()}));
      $$("#fp-sel option",s.body).forEach(o=>{if(o.value)o.disabled=w.people.includes(o.value)})}
    $$("[data-fs]",s.body).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.fs===w.slip)));
    const n=applyF(AS.LIVE,w).length;q("apply").textContent=`Show ${plural(n,"entry","entries")}`;
  }
  $$("[data-fr]",s.body).forEach(b=>b.addEventListener("click",()=>{w.range=b.dataset.fr;paint()}));
  $$("[data-fi]",s.body).forEach(b=>b.addEventListener("click",()=>{w.items=tog(w.items,b.dataset.fi);paint()}));
  $$("[data-fm]",s.body).forEach(b=>b.addEventListener("click",()=>{w.mode=b.dataset.fm;paint()}));
  const fsel=$("#fp-sel",s.body);if(fsel)fsel.addEventListener("change",()=>{const k=fsel.value;fsel.value="";if(k&&!w.people.includes(k))w.people=[...w.people,k];paint()});
  $$("[data-fs]",s.body).forEach(b=>b.addEventListener("click",()=>{w.slip=b.dataset.fs;paint()}));
  ["from","to","min","max"].forEach(k=>q(k).addEventListener("input",()=>{w[k]=q(k).value.trim();paint()}));
  q("apply").addEventListener("click",()=>{AS.F=w;PB.limit=150;s.close();renderBook()});
  q("clear").addEventListener("click",()=>{Object.assign(w,blankF());["from","to","min","max"].forEach(k=>q(k).value="");paint()});
  paint();
}
export function renderBook(){
  const list=applyF(AS.LIVE,AS.F);
  const tags=filterTags();
  $("#fcount").hidden=!tags.length;$("#fcount").textContent=tags.length;
  $("#ftags").innerHTML=tags.map(([l],i)=>`<button class="ftag" data-t="${i}" aria-label="Remove filter ${esc(l)}">${esc(l)} <i>×</i></button>`).join("")
    +(tags.length>1?'<button class="linkbtn" data-t="all">Clear all</button>':"");
  $$("[data-t]",$("#ftags")).forEach(b=>b.addEventListener("click",()=>{if(b.dataset.t==="all")AS.F=blankF();else tags[+b.dataset.t][1]();renderBook()}));
  const run={};let acc=0;[...list].sort((a,b)=>a.ts-b.ts).forEach(e=>{acc+=+e.amount||0;run[e.id]=acc});
  const s=$("#sort").value;
  const cmp={"date-desc":(a,b)=>b.ts-a.ts,"date-asc":(a,b)=>a.ts-b.ts,"amt-desc":(a,b)=>b.amount-a.amount||b.ts-a.ts,"amt-asc":(a,b)=>a.amount-b.amount||b.ts-a.ts,
    item:(a,b)=>(!itemName(a)-!itemName(b))||(itemName(a)||"").localeCompare(itemName(b)||"")||b.ts-a.ts,
    person:(a,b)=>(!a.vendor-!b.vendor)||(a.vendor||"").localeCompare(b.vendor||"")||b.ts-a.ts}[s];
  list.sort(cmp);
  const t=sums(list);
  $("#b-total").textContent=money(t.t);$("#b-words").textContent=list.length?"Spent: "+inWords(t.t):"";$("#b-cash").textContent=money(t.c);$("#b-online").textContent=money(t.o);
  $("#b-count").textContent=list.length?`${plural(list.length,"entry","entries")}${s.startsWith("date")?". Running total shown under each amount.":""}`:"";
  const showBal=s.startsWith("date");
  $("#book").classList.toggle("selecting",!!PB.sel);
  $("#book").innerHTML=list.length?list.slice(0,PB.limit).map(e=>rowHTML(e,showBal?run[e.id]:null,PB.sel?PB.sel.has(e.id):null,true)).join("")
    :`<li class="empty">${AS.LIVE.length?"No entries match these filters.":"No entries yet. Add your first payment from the Add tab."}</li>`;
  $("#bookmore").hidden=list.length<=PB.limit;
  PB.list=list;
  $$(".entry",$("#book")).forEach(b=>{longPress(b,()=>{if(PB.sel)return;PB.sel=new Set([b.dataset.id]);PB.lpAt=Date.now();try{navigator.vibrate&&navigator.vibrate(15)}catch{}renderBook()});
    b.addEventListener("click",()=>{
    if(PB.lpAt){PB.lpAt=0;return} // the finger lifting after a long press is not a tap
    if(!PB.sel){openView(b.dataset.id);return}
    const id=b.dataset.id;if(PB.sel.has(id))PB.sel.delete(id);else PB.sel.add(id);
    b.setAttribute("aria-pressed",String(PB.sel.has(id)));paintSel()})});
  $$("[data-ra]",$("#book")).forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.id,a=b.dataset.ra;
    if(a==="share")openReceipt([id]);else if(a==="edit")openView(id,{edit:true});
    else{const e=AS.LIVE.find(x=>x.id===id);if(e)trashWithUndo(e)}}));
  paintSel();
}

export function paintSel(){
  const on=!!PB.sel;document.body.classList.toggle("selmode",on);
  $("#selbar").hidden=!on;$("#selbtn").textContent=on?"Done":"Select";$("#selall").hidden=!on;
  if(!on)return;
  const es=AS.LIVE.filter(e=>PB.sel.has(e.id));
  $("#sel-n").textContent=es.length?`${es.length} selected`:"Tap entries to select";
  $("#sel-t").textContent=money(sums(es).t);$("#sel-share").disabled=!es.length;$("#sel-del").disabled=!es.length;$("#sel-pdf").disabled=!es.length;
}
$("#selbtn").addEventListener("click",()=>{PB.sel=PB.sel?null:new Set();renderBook()});
$("#selall").addEventListener("click",()=>{if(!PB.sel)return;const ids=(PB.list||[]).map(e=>e.id);
  const all=ids.every(id=>PB.sel.has(id));ids.forEach(id=>all?PB.sel.delete(id):PB.sel.add(id));renderBook()});
$("#sel-x").addEventListener("click",()=>{PB.sel=null;renderBook()});
$("#sel-share").addEventListener("click",()=>{if(PB.sel&&PB.sel.size)openReceipt([...PB.sel])});
$("#sel-pdf").addEventListener("click",()=>{if(PB.sel&&PB.sel.size)pdfOfEntries(AS.LIVE.filter(e=>PB.sel.has(e.id)),"Selected entries")});
// a new press clears the long-press flag, so only the lift right after a long press is skipped
document.addEventListener("pointerdown",()=>{PB.lpAt=0},true);
/** press and hold (like WhatsApp): runs fn after 500 ms unless the finger moves or lifts */
export function longPress(el,fn){
  el.addEventListener("contextmenu",ev=>ev.preventDefault());
  el.addEventListener("pointerdown",ev=>{if(ev.button>0)return;const x0=ev.clientX,y0=ev.clientY;
    const t=setTimeout(()=>{stop();fn()},500);
    const mv=e=>{if(Math.abs(e.clientX-x0)>10||Math.abs(e.clientY-y0)>10)stop()};
    function stop(){clearTimeout(t);el.removeEventListener("pointerup",stop);el.removeEventListener("pointercancel",stop);el.removeEventListener("pointerleave",stop);el.removeEventListener("pointermove",mv)}
    el.addEventListener("pointerup",stop);el.addEventListener("pointercancel",stop);el.addEventListener("pointerleave",stop);el.addEventListener("pointermove",mv)});
}
$("#sel-del").addEventListener("click",async()=>{
  const es=PB.sel?AS.LIVE.filter(e=>PB.sel.has(e.id)):[];if(!es.length)return;
  if(!await ask(`Move ${plural(es.length,"entry","entries")} to trash?`,`${money(sums(es).t)} in total. You can restore them from Trash.`,{ok:"Move to trash",danger:true}))return;
  try{for(const e of es)await trashIt(e);PB.sel=null;renderBook();
    toast(`${plural(es.length,"entry","entries")} moved to trash`,{label:"Undo",fn:async()=>{for(const e of es){const x=D.entries.find(y=>y.id===e.id);if(x&&x.deletedAt)await restoreIt(x)}toast("Entries restored")}})}
  catch{toast("Couldn’t move to trash. Try again.")}
});
