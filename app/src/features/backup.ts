// @ts-nocheck
// Backup file and restore.
import { APP, OLD_APPS } from "../lib/constants";
import { esc, localDay, plural, fdatetime, stampName } from "../lib/format";
import { decryptBytes, encryptBytes, isEncrypted } from "../lib/crypto";
import { normDeal } from "../lib/deals";
import { dbAll, dbGet, dbPut, dbDel } from "../data/db";
import { resetAdd } from "./entry-form";
import { giveFile } from "./export";
import { blobToData, dataToBlob, filesOf, fsize } from "./files";
import { backupNote } from "./home";
import { AS, D, emit, itemName, saveCatalog, saveDeals, upgradeLegacy } from "../state";
import { $, lget, lset, toast } from "../ui/dom";
import { ask, openSheet } from "../ui/sheets";
import { closeMenus, paintView, task } from "../ui/topbar";

// Backup file (v4): one .zip with data.json, every photo and file as the original file under files/, and a README.
// With a backup password it becomes an encrypted .pebackup (see lib/crypto). Old .json backups still restore.
const PREF_KEYS=["pe-theme","pe-view","ghk-mode","pe-rc-hist","pe-rc-deal","pe-rc-slips","pe-ptab","pe-pdf","pe-project","pe-welcome-off","pe-catnote-off","pe-st-range"];
const safe=t=>String(t||"").normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"file";
const extFor=(name,type)=>{const m=String(name||"").match(/\.([A-Za-z0-9]{1,5})$/);if(m)return m[1].toLowerCase();
  return({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"})[type]||"bin"};
export async function getBackupPassword(){try{return (await dbGet("meta","backup-pass"))||""}catch{return""}}
export async function setBackupPassword(pw){await dbPut("meta",pw||"","backup-pass")}
/** builds the backup. Returns {blob,name,size,encrypted,count}. */
export async function buildBackupFile(){
  const {zipSync,strToU8}=await import("fflate");
  const files={},index={},used=new Set();let count=0;
  for(const e of D.entries){
    const list=[...(e.slipKey?[{key:e.slipKey,name:"slip-photo.jpg",type:"image/jpeg"}]:[]),...filesOf(e)];
    for(const f of list){if(!f.key||index[f.key])continue;const b=await dbGet("slips",f.key);if(!b)continue;
      const d=new Date(e.ts),base=`${localDay(d)}-${safe(itemName(e)||e.vendor||"payment")}-${safe(String(f.name).replace(/\.[^.]+$/,""))}`;
      let path=`files/${base}.${extFor(f.name,b.type||f.type)}`,i=2;while(used.has(path))path=`files/${base}-${i++}.${extFor(f.name,b.type||f.type)}`;used.add(path);
      files[path]=[new Uint8Array(await b.arrayBuffer()),{level:/^image\/|pdf|zip/.test(b.type||f.type||"")?0:6}];
      index[f.key]={path,name:f.name,type:b.type||f.type||"application/octet-stream"};count++}}
  const prefs={};for(const k of PREF_KEYS){const v=lget(k,undefined);if(v!==undefined)prefs[k]=v}
  const data={app:APP,version:4,savedAt:Date.now(),projects:D.projects,contacts:D.contacts,groups:D.groups,catalog:D.items,deals:D.deals,entries:D.entries,files:index,prefs};
  const readme=`Property Estimates backup\nMade on ${fdatetime(Date.now())}\n\n${D.entries.filter(e=>!e.deletedAt).length} payments, ${D.contacts.length} people, ${D.deals.length} deals, ${count} photos and files.\n\nTo restore: open Property Estimates, tap the restore button (arrow up) or Settings, then Restore from a file, and pick this file.\nThe files folder has every slip photo and document, so you can also open them directly.\n`;
  let bytes=zipSync({"data.json":[strToU8(JSON.stringify(data)),{level:6}],"README.txt":strToU8(readme),...files});
  const pw=await getBackupPassword();
  const stamp=stampName();
  if(pw){bytes=await encryptBytes(bytes,pw);return{blob:new Blob([bytes],{type:"application/octet-stream"}),name:`property-estimates-backup-${stamp}.pebackup`,size:bytes.length,encrypted:true,count}}
  return{blob:new Blob([bytes],{type:"application/zip"}),name:`property-estimates-backup-${stamp}.zip`,size:bytes.length,encrypted:false,count};
}
/** asks for the backup password (for encrypted backups). Resolves "" when cancelled. */
export function askPassword(title,msg){return new Promise(res=>{
  const s=openSheet(title,`<p class="pmeta" style="margin:0 0 8px">${esc(msg)}</p><input class="field" type="password" id="bp-in" autocomplete="current-password" placeholder="Backup password"><div class="formmsg" id="bp-err" hidden></div><button class="primary" id="bp-ok">Open backup</button>`);
  let done=false;s.onClose=()=>{if(!done)res("")};
  const go=()=>{const v=$("#bp-in",s.body).value;if(!v)return;done=true;s.close();res(v)};
  $("#bp-ok",s.body).addEventListener("click",go);$("#bp-in",s.body).addEventListener("keydown",e=>{if(e.key==="Enter")go()});setTimeout(()=>$("#bp-in",s.body).focus(),50)})}
/** reads any backup (zip, encrypted, or old json) into {data with blobs}. Returns null when it isn't a backup or the user gave up. */
export async function readBackupFile(blob){
  let u8=new Uint8Array(await blob.arrayBuffer());
  if(isEncrypted(u8)){
    const saved=await getBackupPassword();let pw=saved,tries=0;
    while(true){
      if(!pw||tries>0)pw=await askPassword("Backup password",tries?"That password didn’t open it. Try again.":"This backup is protected with a password.");
      if(!pw)return null;
      try{u8=await decryptBytes(u8,pw);break}catch{tries++;if(tries>=5){toast("Couldn’t open the backup: wrong password");return null}}
    }
  }
  if(u8[0]===0x50&&u8[1]===0x4b){
    const {unzipSync,strFromU8}=await import("fflate");
    const z=unzipSync(u8);if(!z["data.json"])return null;
    const data=JSON.parse(strFromU8(z["data.json"]));data.blobs={};
    for(const [k,f] of Object.entries(data.files||{}))if(z[f.path])data.blobs[k]=new Blob([z[f.path]],{type:f.type});
    return data;
  }
  try{return JSON.parse(new TextDecoder().decode(u8))}catch{return null}
}
/** Settings → Backup password: optional. Encrypts the backup file and Drive backups. */
export function openBackupPassword(){
  const s=openSheet("Backup password","");
  const paint=async()=>{
    const on=!!(await getBackupPassword());
    s.body.innerHTML=on?`<p class="pmeta" style="margin:0"><b>On.</b> New backups (file and Google Drive) are locked with your password. Only this app with the password can open them.</p>
      <button class="second" id="bp-ch">Change password</button><button class="danger" id="bp-off">Turn off</button>
      <p class="hint">Backups made earlier keep the password they were made with.</p>`
      :`<p class="pmeta" style="margin:0">Lock your backups with a password, so no one can open them without it, even with access to your Google Drive or the file.</p>
      <label class="lbl" for="bp-a">Password</label><input class="field" type="password" id="bp-a" autocomplete="new-password" placeholder="At least 6 characters">
      <label class="lbl" for="bp-b">Same password again</label><input class="field" type="password" id="bp-b" autocomplete="new-password">
      <label class="check"><input type="checkbox" id="bp-ok">I understand: if I forget this password, my backups can’t be opened by anyone, not even the app makers.</label>
      <div class="formmsg" id="bp-msg" hidden></div>
      <button class="primary" id="bp-save">Turn on</button>
      <p class="hint">Keep it somewhere safe. Without a password, backups stay unlocked: you can unzip them and open the photos directly.</p>`;
    if(on){
      $("#bp-off",s.body).addEventListener("click",async()=>{if(!await ask("Turn off the backup password?","New backups won’t be locked. Old locked backups still need their password.",{ok:"Turn off"}))return;await setBackupPassword("");toast("Backup password off");paint()});
      $("#bp-ch",s.body).addEventListener("click",async()=>{await setBackupPassword("");paint()});
    }else $("#bp-save",s.body).addEventListener("click",async()=>{
      const a=$("#bp-a",s.body).value,b=$("#bp-b",s.body).value,m=$("#bp-msg",s.body);
      const err=a.length<6?"Use at least 6 characters":a!==b?"The two passwords don’t match":!$("#bp-ok",s.body).checked?"Tick the box to confirm you understand":"";
      m.textContent=err;m.hidden=!err;if(err)return;
      await setBackupPassword(a);toast("Backup password on. New backups are locked.");paint()});
  };
  s.refresh=paint;paint();
}
export async function backupPassSummary(){return (await getBackupPassword())?"On · backups are locked":"Off"}

// after restoring settings on a fresh phone: theme and view take effect at once
function applyPrefs(){const t=lget("pe-theme","auto");if(t==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",t);
  const v=lget("pe-view","all");if(["all","construction","documents"].includes(v))AS.VIEW=v;try{paintView()}catch{}}
$("#backup").addEventListener("click",()=>task("Preparing backup…",async()=>{
  try{
    const b=await buildBackupFile();
    const ok=await giveFile(b.name,b.blob);
    if(ok){lset("ghk-backup",Date.now());backupNote();toast(`Backup ready · ${b.encrypted?"password-protected · ":""}${fsize(b.size)}`)}
  }catch(err){console.error(err);toast("Couldn’t make the backup. Try again.")}
}));
$("#restorebtn").addEventListener("click",()=>{closeMenus();$("#restorefile").click()});
$("#restorefile").addEventListener("change",async ev=>{
  const file=ev.target.files[0];ev.target.value="";if(!file)return;
  let d=null;try{d=await readBackupFile(file)}catch(err){console.error(err)}
  if(!d){toast("That file isn’t a Property Estimates backup.");return}
  await restoreData(d,{from:d.savedAt?`Backup from ${fdatetime(d.savedAt)}`:""});
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
      for(const k of [e.slipKey,...filesOf(e).map(x=>x.key)]){if(!k)continue;const bl=d.blobs&&d.blobs[k]||(d.slips&&d.slips[k]?await dataToBlob(d.slips[k]):null);if(bl)await dbPut("slips",bl,k)}
    }
    upgradeLegacy(incoming,D.pid);
    await saveCatalog();for(const c of D.contacts)await dbPut("contacts",c);
    for(const e of incoming)await dbPut("entries",e);
    D.entries=await dbAll("entries");D.projects.sort((a,b)=>a.createdAt-b.createdAt);
    if(!D.projects.some(p=>p.id===D.pid))D.pid=D.projects[0].id;
    // a fresh phone also gets the app settings back (theme, view, last project…)
    if(freshPhone&&d.prefs&&typeof d.prefs==="object"){for(const [k,v] of Object.entries(d.prefs))if(PREF_KEYS.includes(k)&&k!=="pe-project")lset(k,v);applyPrefs()}
    emit();resetAdd();toast(`Restored ${plural(incoming.length,"payment","payments")}${newProjects.length&&!freshPhone?`. Switch projects from the name at the top.`:""}`);
    return true;
  }catch(err){console.error(err);toast("Couldn’t finish the restore. Try again.");return false}
}
