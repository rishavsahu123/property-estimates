// @ts-nocheck
// Top bar: All / Construction / Documents switch and the download / restore / info menus.
import { KINDS } from "../lib/constants";
import { plural } from "../lib/format";
import { dbReady } from "../data/db";
import { storageNote } from "../app/boot";
import { resetAdd } from "../features/entry-form";
import { backupNote } from "../features/home";
import { PB } from "../features/passbook";
import { paintTheme } from "../features/summary";
import { AS, blankF, D, emit } from "../state";
import { $, $$, lset, toast } from "./dom";

export function paintView(){
  $$("#viewseg [data-v]").forEach(b=>{const on=b.dataset.v===AS.VIEW;b.setAttribute("aria-pressed",String(on))});
  $("#viewseg").classList.toggle("on",AS.VIEW!=="all");
}
document.fonts&&document.fonts.ready.then(()=>{if(dbReady())paintView()});
$$("#viewseg [data-v]").forEach(b=>b.addEventListener("click",()=>{if(AS.VIEW===b.dataset.v)return;AS.VIEW=b.dataset.v;lset("pe-view",AS.VIEW);AS.F=blankF();PB.limit=150;if(PB.sel)PB.sel.clear();
  paintView();emit();resetAdd();
  if(AS.VIEW!=="all"){const unk=D.groups.filter(g=>!g.kind).length;if(unk)toast(`${plural(unk,"group has","groups have")} no category yet, set them in Edit groups.`)}}));


$("#set-backup").addEventListener("click",()=>{closeMenus();$("#backup").click()});
$("#set-restore").addEventListener("click",()=>{closeMenus();$("#restorefile").click()});

export const MENUS=[["m-down-b","m-down"],["m-up-b","m-up"],["m-info-b","m-info"]];
export function closeMenus(except){MENUS.forEach(([b,m])=>{if(m!==except){$("#"+m).hidden=true;$("#"+b).setAttribute("aria-expanded","false")}})}
MENUS.forEach(([b,m])=>$("#"+b).addEventListener("click",ev=>{ev.stopPropagation();const open=$("#"+m).hidden;closeMenus(m);
  $("#"+m).hidden=!open;$("#"+b).setAttribute("aria-expanded",String(open));if(open&&m==="m-info"){backupNote();paintTheme();$("#appver").textContent=`Property Estimates ${__APP_VERSION__.replace(/^pe-v/,"v").replace(/-[a-z0-9]+$/,"")}`;storageNote().then(t=>{const el=$("#storeuse");if(el){el.textContent=t;el.hidden=!t}})}}));
document.addEventListener("click",ev=>{if(!ev.target.closest(".menu"))closeMenus()});
document.addEventListener("keydown",ev=>{if(ev.key==="Escape")closeMenus()});
let busy=false;
export async function task(msg,fn){if(busy){toast("Still working, please wait…");return}busy=true;closeMenus();toast(msg);try{await fn()}finally{busy=false}}
