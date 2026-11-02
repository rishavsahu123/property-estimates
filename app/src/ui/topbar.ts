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
import { $, lset, toast } from "./dom";

export function paintView(){const v=$("#viewsel");v.value=AS.VIEW;v.classList.toggle("on",AS.VIEW!=="all");
  const c=paintView.c||(paintView.c=document.createElement("canvas").getContext("2d"));c.font='600 14px Hind, "Noto Sans", system-ui, sans-serif';
  v.style.width=Math.ceil(c.measureText(v.options[v.selectedIndex].text).width+46)+"px"}
document.fonts&&document.fonts.ready.then(()=>{if(dbReady())paintView()});
$("#viewsel").addEventListener("change",()=>{AS.VIEW=$("#viewsel").value;lset("pe-view",AS.VIEW);AS.F=blankF();PB.limit=150;if(PB.sel)PB.sel.clear();
  paintView();emit();resetAdd();
  if(AS.VIEW!=="all"){const unk=D.groups.filter(g=>!g.kind).length;toast(unk?`${KINDS[AS.VIEW]} only. ${plural(unk,"group is","groups are")} Unknown, set them in Edit groups.`:`Showing ${KINDS[AS.VIEW].toLowerCase()} only`)}else toast("Showing everything")});

export const MENUS=[["m-down-b","m-down"],["m-up-b","m-up"],["m-info-b","m-info"]];
export function closeMenus(except){MENUS.forEach(([b,m])=>{if(m!==except){$("#"+m).hidden=true;$("#"+b).setAttribute("aria-expanded","false")}})}
MENUS.forEach(([b,m])=>$("#"+b).addEventListener("click",ev=>{ev.stopPropagation();const open=$("#"+m).hidden;closeMenus(m);
  $("#"+m).hidden=!open;$("#"+b).setAttribute("aria-expanded",String(open));if(open&&m==="m-info"){backupNote();paintTheme();storageNote().then(t=>{const el=$("#storeuse");if(el){el.textContent=t;el.hidden=!t}})}}));
document.addEventListener("click",ev=>{if(!ev.target.closest(".menu"))closeMenus()});
document.addEventListener("keydown",ev=>{if(ev.key==="Escape")closeMenus()});
let busy=false;
export async function task(msg,fn){if(busy){toast("Still working, please wait…");return}busy=true;closeMenus();toast(msg);try{await fn()}finally{busy=false}}
