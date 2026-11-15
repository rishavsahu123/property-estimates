// @ts-nocheck
// Small DOM helpers: $, $$, toast, local settings.

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
// short message at the bottom. Problems ("Couldn’t…", "Something went wrong") stay longer, look different and close on tap.
export function toast(msg,act){document.querySelectorAll(".toast").forEach(x=>x.remove());const t=document.createElement("div");
  const bad=/^(Couldn’t|Couldn't|Something went wrong|This browser can’t|That file isn’t)/.test(msg);t.className="toast"+(bad?" bad":"");t.textContent=msg;
  if(bad){t.setAttribute("role","alert");t.addEventListener("click",ev=>{if(ev.target===t)t.remove()})}
  if(act){const b=document.createElement("button");b.className="tact";b.textContent=act.label;b.addEventListener("click",()=>{t.remove();act.fn()});t.appendChild(b)}
  document.body.appendChild(t);setTimeout(()=>t.remove(),bad?9000:act?5000:2600)}
export function lget(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}}
export function lset(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
