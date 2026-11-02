// @ts-nocheck
// App state: data loaded from the phone, the current project and view, saving entries.
import { DEFAULT_ITEMS, DEFAULT_GROUPS, KINDS } from "./lib/constants";
import { shortDay, round2, cleanPhone, newId } from "./lib/format";
import { normDeal, dealAgreed } from "./lib/deals";
import { openDB, dbAll, dbGet, dbPut, dbDel } from "./data/db";
import { renderAll } from "./app/nav";
import { delSlip, filesOf } from "./features/files";
import { $, lget } from "./ui/dom";
import { keepScroll, SHEETS } from "./ui/sheets";

export const D={entries:[],projects:[],contacts:[],items:[],groups:[],deals:[],pid:null};
export const blankF=()=>({range:"all",from:"",to:"",items:[],mode:"all",people:[],slip:"any",min:"",max:""});
export const AS={IM:new Map(),CM:new Map(),GM:new Map(),LIVE:[],TRASH:[],VIEW:lget("pe-view","all"),F:blankF()};
if(!["all","construction","documents"].includes(AS.VIEW))AS.VIEW="all";
export const proj=()=>D.projects.find(p=>p.id===D.pid);
export function rebuild(){
  AS.IM=new Map(D.items.map(i=>[i.k,i]));AS.CM=new Map(D.contacts.map(c=>[c.id,c]));AS.GM=new Map(D.groups.map(g=>[g.k,g]));
  const mine=D.entries.filter(e=>e.projectId===D.pid&&inView(e));
  AS.LIVE=mine.filter(e=>!e.deletedAt).sort((a,b)=>b.ts-a.ts);
  AS.TRASH=mine.filter(e=>e.deletedAt).sort((a,b)=>b.deletedAt-a.deletedAt);
}
export function emit(){rebuild();renderAll();[...SHEETS].forEach(s=>{if(s.open&&s.refresh)try{keepScroll(s,s.refresh)}catch(err){console.error(err)}})}
export const itemName=e=>AS.IM.get(e.item)?.n||(e.item?(e.itemName||"Other"):null);
export const groupOf=e=>e.item&&AS.IM.has(e.item)?AS.IM.get(e.item).cat:"none";
export const kindOf=e=>AS.GM.get(groupOf(e))?.kind||e.kind||null;
export const inView=e=>AS.VIEW==="all"||kindOf(e)===AS.VIEW;
export const viewGroups=()=>D.groups.filter(g=>AS.VIEW==="all"||g.kind===AS.VIEW);
export const gName=k=>k==="none"?"Item not set":(AS.GM.get(k)?.n||"Other");
export const kindTag=k=>k?`<span class="tag ${k==="documents"?"online":"cash"}">${KINDS[k]}</span>`:'<span class="tag unk">Unknown</span>';
export function ensureGroups(){for(const i of D.items)if(!D.groups.some(g=>g.k===i.cat)){const d=DEFAULT_GROUPS.find(g=>g.k===i.cat);D.groups.push({k:i.cat,n:d?d.n:"Other",kind:null})}}
export function usage(){const u={};for(const e of D.entries)if(e.item)u[e.item]=(u[e.item]||0)+1;return u}
export const subOf=i=>i.sub||(i.units||[]).join(", ");
export const phoneOf=e=>AS.CM.get(e.contactId)?.phone||"";
export const saveCatalog=async()=>{ensureGroups();await dbPut("meta",D.items,"catalog");await dbPut("meta",D.groups,"groups")};

// Turns older entries (v1 "other" items, vendor names without contacts, no project) into the current shape.
export function upgradeLegacy(list,pid){
  const changed=[],newContacts=[];let catalogChanged=false;
  for(const e of list){
    let ch=false;
    if(!e.projectId){e.projectId=pid;ch=true}
    if(e.item==="other"){
      const n=(e.itemName||"").trim()||"Other";
      let it=D.items.find(i=>i.cat==="other"&&i.n.toLowerCase()===n.toLowerCase());
      if(!it){it={k:newId("i"),n,sub:"",cat:"other",units:[]};D.items.push(it)}
      if(e.unit&&!it.units.includes(e.unit))it.units.push(e.unit);
      e.item=it.k;delete e.itemName;ch=true;catalogChanged=true;
    }else if(e.item&&!D.items.some(i=>i.k===e.item)){
      D.items.push({k:e.item,n:e.itemName||e.item,sub:"",cat:"other",units:e.unit?[e.unit]:[]});catalogChanged=true;
    }
    const v=(e.vendor||"").trim();
    if(v&&!(e.contactId&&D.contacts.some(c=>c.id===e.contactId))){
      let c=D.contacts.find(c=>c.name.toLowerCase()===v.toLowerCase());
      if(!c){c={id:newId("c"),name:v,phone:"",createdAt:Date.now(),updatedAt:Date.now()};D.contacts.push(c);newContacts.push(c)}
      e.contactId=c.id;e.vendor=c.name;ch=true;
    }
    if(ch)changed.push(e);
  }
  return{changed,newContacts,catalogChanged};
}
export async function persistUpgrade(u){
  for(const c of u.newContacts)await dbPut("contacts",c);
  for(const e of u.changed)await dbPut("entries",e);
  if(u.catalogChanged)await saveCatalog();
}

export async function init(){
  try{await openDB(()=>{const m=$("#bootmsg");if(m)m.textContent="Close other tabs of this app, then reopen it."})}catch{$("#bootmsg").textContent="This browser can’t save data. Open the app in Chrome.";return false}
  [D.entries,D.projects,D.contacts]=await Promise.all([dbAll("entries"),dbAll("projects"),dbAll("contacts")]);
  const cat=await dbGet("meta","catalog"),grp=await dbGet("meta","groups");
  D.items=Array.isArray(cat)&&cat.length?cat:DEFAULT_ITEMS.map(i=>({...i,units:[...i.units]}));
  if(Array.isArray(grp))D.groups=grp;
  // first run ever: groups come with a category; older installs start as Unknown until edited
  else D.groups=DEFAULT_GROUPS.map(g=>({...g,kind:Array.isArray(cat)?null:g.kind}));
  if(!Array.isArray(cat)||!Array.isArray(grp))await saveCatalog();
  const dl=await dbGet("meta","deals");D.deals=Array.isArray(dl)?dl:[];
  if(D.deals.map(normDeal).some(Boolean))await saveDeals();
  if(!D.projects.length){const p={id:newId("p"),name:"My house",createdAt:Date.now()};await dbPut("projects",p);D.projects.push(p)}
  D.projects.sort((a,b)=>a.createdAt-b.createdAt);
  const want=lget("pe-project",null);
  D.pid=D.projects.some(p=>p.id===want)?want:D.projects[0].id;
  await persistUpgrade(upgradeLegacy(D.entries,D.projects[0].id));
  try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist()}catch{}
  return true;
}
export async function saveEntry(e){await dbPut("entries",e);const i=D.entries.findIndex(x=>x.id===e.id);if(i>=0)D.entries[i]=e;else D.entries.push(e);emit()}
export async function trashIt(e){await saveEntry({...e,deletedAt:Date.now()})}
export async function restoreIt(e){const o={...e,updatedAt:Date.now()};delete o.deletedAt;await saveEntry(o)}
export async function purge(e){await dbDel("entries",e.id);D.entries=D.entries.filter(x=>x.id!==e.id);if(e.slipKey&&!D.entries.some(x=>x.slipKey===e.slipKey))await delSlip(e.slipKey);
  for(const x of filesOf(e))await delSlip(x.key);emit()}
/* deals: fixed amount or rate × quantity, paid off in parts */
export const projDeals=()=>D.deals.filter(d=>d.projectId===D.pid);
// deal = your own fields (label + value). "calc" multiplies the number fields switched to ×; "fixed" uses amount.
export const dealPaid=(d,upto=Infinity,skip)=>round2(D.entries.filter(e=>!e.deletedAt&&e.dealId===d.id&&e.ts<=upto&&e.id!==skip).reduce((a,e)=>a+(+e.amount||0),0));
export const dealBal=d=>round2(dealAgreed(d)-dealPaid(d));
export const dealInView=d=>{if(AS.VIEW==="all")return true;const it=AS.IM.get(d.item),k=it&&AS.GM.get(it.cat)?.kind;return !k||k===AS.VIEW};
export const isLate=d=>!!d.deadline&&!d.closed&&dealBal(d)>0&&new Date(d.deadline+"T23:59:59").getTime()<Date.now();
export const dueText=d=>d.deadline?`${isLate(d)?"Overdue, was due":"Due by"} ${shortDay(d.deadline)}`:"";
export const saveDeals=()=>dbPut("meta",D.deals,"deals");
export async function upsertContact(name,phone){
  name=String(name||"").trim();phone=cleanPhone(phone);if(!name)return null;
  let c=D.contacts.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(c){c={...c,updatedAt:Date.now()};if(phone)c.phone=phone;D.contacts[D.contacts.findIndex(x=>x.id===c.id)]=c}
  else{c={id:newId("c"),name,phone,createdAt:Date.now(),updatedAt:Date.now()};D.contacts.push(c)}
  await dbPut("contacts",c);AS.CM.set(c.id,c);return c;
}
