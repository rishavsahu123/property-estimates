// @ts-nocheck
// Start-up: open data, first draw, install prompt, service worker, error toast.
import { dealAgreed } from "../lib/deals";
import { go } from "./nav";
import { resetAdd } from "../features/entry-form";
import { fsize } from "../features/files";
import { D, init, rebuild, usage } from "../state";
import { $, toast } from "../ui/dom";
import { SHEETS } from "../ui/sheets";
import { paintView } from "../ui/topbar";
import "../features/deals";
import "../features/home";
import "../features/catalog";
import "../ui/rows";
import "../features/passbook";
import "../features/people";
import "../features/projects";
import "../features/summary";
import "../features/trash";
import "../features/export";
import "../features/receipt";
import "../features/backup";

let installEvt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;$("#installcard").hidden=false});
window.addEventListener("appinstalled",()=>{$("#installcard").hidden=true;installEvt=null});
$("#install").addEventListener("click",async()=>{if(!installEvt)return;installEvt.prompt();await installEvt.userChoice.catch(()=>{});installEvt=null;$("#installcard").hidden=true});
if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost")){
  const hadSW=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(()=>{});
  // a new version took over while the app was open: offer a reload (data is safe, it lives in IndexedDB)
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(hadSW)toast("A new version is ready",{label:"Reload",fn:()=>location.reload()})});
}
let errShown=0;
export const onErr=err=>{console.error(err);if(Date.now()-errShown>8000){errShown=Date.now();toast("Something went wrong. Your saved data is safe. Try again.")}};
window.addEventListener("error",ev=>onErr(ev.error||ev.message));
window.addEventListener("unhandledrejection",ev=>onErr(ev.reason));
export async function storageNote(){try{if(!navigator.storage||!navigator.storage.estimate)return"";const{usage,quota}=await navigator.storage.estimate();
  return usage?`Using ${fsize(usage)} on this phone${quota?` (${Math.max(1,Math.round(usage/quota*100))}% of the space the browser allows)`:""}.`:""}catch{return""}}

// read-only handle for the end-to-end tests (state lives inside this module now)
window.__pe={get D(){return D},get SHEETS(){return SHEETS},dealAgreed};

(async()=>{
  let ok=false;
  try{ok=await init()}catch(err){console.error(err);$("#bootmsg").textContent="Couldn’t open your data. Close the app fully and open it again."}
  if(!ok)return;
  rebuild();paintView();resetAdd();
  go(location.hash.slice(1)||"add");
  $("#boot").remove();
})();
