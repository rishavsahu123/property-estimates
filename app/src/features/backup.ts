// @ts-nocheck
// Backup file and restore.
import { APP, OLD_APPS } from "../lib/constants";
import { localDay, plural } from "../lib/format";
import { normDeal } from "../lib/deals";
import { dbAll, dbGet, dbPut, dbDel } from "../data/db";
import { resetAdd } from "./entry-form";
import { giveFile } from "./export";
import { blobToData, dataToBlob, filesOf } from "./files";
import { backupNote } from "./home";
import { D, emit, saveCatalog, saveDeals, upgradeLegacy } from "../state";
import { $, lset, toast } from "../ui/dom";
import { ask } from "../ui/sheets";
import { closeMenus, task } from "../ui/topbar";

/** the whole app (all projects, people, deals, payments, photos and files) as one JSON text */
export async function buildBackupJSON(){
  const slips={};
  for(const e of D.entries){for(const k of [e.slipKey,...filesOf(e).map(x=>x.key)]){if(k&&!slips[k]){const b=await dbGet("slips",k);if(b)slips[k]=await blobToData(b)}}}
  return JSON.stringify({app:APP,version:3,savedAt:Date.now(),projects:D.projects,contacts:D.contacts,groups:D.groups,catalog:D.items,deals:D.deals,entries:D.entries,slips});
}
$("#backup").addEventListener("click",()=>task("Preparing backup…",async()=>{
  try{
    const data=await buildBackupJSON();
    const ok=await giveFile(`property-estimates-backup-${localDay()}.json`,new Blob([data],{type:"application/json"}));
    if(ok){lset("ghk-backup",Date.now());backupNote();toast("Backup ready")}
  }catch(err){console.error(err);toast("Couldn’t make the backup. Try again.")}
}));
$("#restorebtn").addEventListener("click",()=>{closeMenus();$("#restorefile").click()});
$("#restorefile").addEventListener("change",async ev=>{
  const file=ev.target.files[0];ev.target.value="";if(!file)return;
  let d;try{d=JSON.parse(await file.text())}catch{toast("That file isn’t a Property Estimates backup.");return}
  await restoreData(d);
});
/** merge a backup into this phone (asks first). Returns true when something was restored. */
export async function restoreData(d,{from=""}={}){
  const bad="That file isn’t a Property Estimates backup.";
  if(!d||!OLD_APPS.includes(d.app)||!Array.isArray(d.entries)){toast(bad);return false}
  const newProjects=(Array.isArray(d.projects)?d.projects:[]).filter(p=>p&&p.id&&p.name&&!D.projects.some(x=>x.id===p.id));
  const have=new Map(D.entries.map(e=>[e.id,e]));
  const incoming=d.entries.filter(e=>e&&e.id&&(!have.has(e.id)||(e.updatedAt||0)>(have.get(e.id).updatedAt||0)));
  const msg=`Restore ${plural(incoming.length,"payment","payments")}${newProjects.length?` and ${plural(newProjects.length,"project","projects")}`:""} from this backup?`;
  if(!await ask(msg,`${from?from+". ":""}Payments already on this phone are kept.`,{ok:"Restore"}))return false;
  try{
    const freshPhone=!D.entries.length;
    if(freshPhone&&newProjects.length){
      for(const p of D.projects)await dbDel("projects",p.id);
      D.projects=[];D.pid=newProjects[0].id;lset("pe-project",D.pid);
    }
    for(const p of newProjects){await dbPut("projects",p);D.projects.push(p)}
    const pids=new Set(D.projects.map(p=>p.id));
    if(freshPhone&&Array.isArray(d.groups)&&d.groups.length){D.groups=[];if(Array.isArray(d.catalog)&&d.catalog.length)D.items=[]}
    for(const g of(Array.isArray(d.groups)?d.groups:[]))if(g&&g.k&&g.n&&!D.groups.some(x=>x.k===g.k))D.groups.push({k:g.k,n:g.n,kind:g.kind||null});
    for(const it of(Array.isArray(d.catalog)?d.catalog:[]))if(it&&it.k&&it.n&&!D.items.some(x=>x.k===it.k))D.items.push({...it,units:Array.isArray(it.units)?it.units:[]});
    await saveCatalog();
    const remap={};
    for(const c of(Array.isArray(d.contacts)?d.contacts:[])){
      if(!c||!c.id||!c.name)continue;
      const same=D.contacts.find(x=>x.id===c.id)||D.contacts.find(x=>x.name.toLowerCase()===c.name.toLowerCase());
      if(same){remap[c.id]=same.id;if(c.phone&&!same.phone){same.phone=c.phone;await dbPut("contacts",same)}}
      else{await dbPut("contacts",c);D.contacts.push(c)}
    }
    const nd=(Array.isArray(d.deals)?d.deals:[]).filter(x=>x&&x.id&&!D.deals.some(y=>y.id===x.id));
    nd.forEach(x=>{normDeal(x);if(remap[x.contactId])x.contactId=remap[x.contactId];if(!pids.has(x.projectId))x.projectId=D.pid;D.deals.push(x)});
    if(nd.length)await saveDeals();
    for(const e of incoming){
      if(e.contactId&&remap[e.contactId])e.contactId=remap[e.contactId];
      if(Array.isArray(e.others))e.others=e.others.map(o=>remap[o.contactId]?{...o,contactId:remap[o.contactId]}:o);
      if(e.projectId&&!pids.has(e.projectId))e.projectId=D.pid;
      for(const k of [e.slipKey,...filesOf(e).map(x=>x.key)])if(k&&d.slips&&d.slips[k]){await dbPut("slips",await dataToBlob(d.slips[k]),k)}
    }
    upgradeLegacy(incoming,D.pid);
    await saveCatalog();for(const c of D.contacts)await dbPut("contacts",c);
    for(const e of incoming)await dbPut("entries",e);
    D.entries=await dbAll("entries");D.projects.sort((a,b)=>a.createdAt-b.createdAt);
    if(!D.projects.some(p=>p.id===D.pid))D.pid=D.projects[0].id;
    emit();resetAdd();toast(`Restored ${plural(incoming.length,"payment","payments")}${newProjects.length&&!freshPhone?`. Switch projects from the name at the top.`:""}`);
    return true;
  }catch(err){console.error(err);toast("Couldn’t finish the restore. Try again.");return false}
}
