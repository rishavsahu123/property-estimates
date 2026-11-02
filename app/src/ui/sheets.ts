// @ts-nocheck
// Bottom sheets (panels) and the app's own confirm box; back button closes the top one.
import { esc } from "../lib/format";
import { $ } from "./dom";

// Our own confirm box (looks like the app; no "localhost says" title). Resolves true or false.
let DLG=null;
export function ask(title,msg,{ok="OK",cancel="Cancel",danger=false}={}){return new Promise(res=>{
  if(DLG)DLG.close(false);
  const bg=document.createElement("div");bg.className="cdlg-bg";
  bg.innerHTML=`<div class="cdlg" role="alertdialog" aria-modal="true" aria-labelledby="cdlg-t"${msg?' aria-describedby="cdlg-m"':""}><h3 id="cdlg-t">${esc(title)}</h3>${msg?`<p id="cdlg-m">${esc(msg)}</p>`:""}<div class="cbtns"><button type="button" data-no>${esc(cancel)}</button><button type="button" class="ok${danger?" red":""}" data-ok>${esc(ok)}</button></div></div>`;
  const prev=document.activeElement,btns=[...bg.querySelectorAll("button")];
  const key=ev=>{if(ev.key==="Escape"){ev.preventDefault();ev.stopPropagation();close(false)}
    else if(ev.key==="Tab"){ev.preventDefault();const i=btns.indexOf(document.activeElement);btns[(i+(ev.shiftKey?-1:1)+btns.length)%btns.length].focus()}};
  function close(v,fromBack){if(DLG!==me)return;DLG=null;bg.remove();document.removeEventListener("keydown",key,true);
    if(!fromBack&&history.state&&history.state.peDlg){popSkip++;history.back()}
    try{prev&&prev.focus&&prev.focus({preventScroll:true})}catch{}res(v)}
  const me={close};DLG=me;
  bg.addEventListener("click",ev=>{if(ev.target===bg)close(false)});
  bg.querySelector("[data-no]").addEventListener("click",()=>close(false));
  bg.querySelector("[data-ok]").addEventListener("click",()=>close(true));
  document.addEventListener("keydown",key,true);document.body.appendChild(bg);
  try{history.pushState({peDlg:1},"",location.href)}catch{}
  bg.querySelector(danger?"[data-no]":"[data-ok]").focus();
})}
// Panels stack on top of the page. Each can set s.refresh so it redraws itself after any change (you stay where you are).
// The phone's back button closes the top panel instead of leaving the app.
export const SHEETS=[];let popSkip=0;
export function openSheet(title,html,label){
  const bg=document.createElement("div");bg.className="sheet-bg";
  bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label||title)}"><div class="sheet-top"><h2>${esc(title)}</h2><button class="x" aria-label="Close">×</button></div><div class="body">${html||""}</div></div>`;
  const s={el:bg,body:$(".body",bg),onClose:null,refresh:null,open:true,
    close(fromBack){if(!s.open)return;s.open=false;bg.remove();const i=SHEETS.indexOf(s);if(i>=0)SHEETS.splice(i,1);
      if(!fromBack&&history.state&&history.state.peSheet){popSkip++;history.back()}
      s.onClose&&s.onClose()}};
  bg.addEventListener("click",ev=>{if(ev.target===bg)s.close()});$(".x",bg).addEventListener("click",()=>s.close());
  document.body.appendChild(bg);SHEETS.push(s);
  try{history.pushState({peSheet:SHEETS.length},"",location.href)}catch{}
  return s;
}
window.addEventListener("popstate",()=>{if(popSkip){popSkip--;return}if(DLG){DLG.close(false,true);return}const s=SHEETS[SHEETS.length-1];if(s)s.close(true)});
document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&SHEETS.length&&!document.querySelector(".viewer")){const m=document.querySelector(".menu:not([hidden])");if(!m)SHEETS[SHEETS.length-1].close()}});
export function keepScroll(s,fn){const sh=$(".sheet",s.el),y=sh?sh.scrollTop:0;fn();if(sh)sh.scrollTop=y}
