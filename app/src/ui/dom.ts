// @ts-nocheck
// Small DOM helpers: $, $$, toast, local settings.

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export function toast(msg,act){document.querySelectorAll(".toast").forEach(x=>x.remove());const t=document.createElement("div");t.className="toast";t.textContent=msg;
  if(act){const b=document.createElement("button");b.className="tact";b.textContent=act.label;b.addEventListener("click",()=>{t.remove();act.fn()});t.appendChild(b)}
  document.body.appendChild(t);setTimeout(()=>t.remove(),act?5000:2600)}
export function lget(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}}
export function lset(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
