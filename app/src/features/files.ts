// @ts-nocheck
// Slip photos and attached files: shrink, store, view.
import { esc, newId } from "../lib/format";
import { dbGet, dbPut, dbDel } from "../data/db";
import { giveFile } from "./export";
import { $, toast } from "../ui/dom";

export async function shrink(file,max,q){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
    const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement("canvas");c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(r,"image/jpeg",q));
  }finally{URL.revokeObjectURL(url)}
}
export const blobToData=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
export const dataToBlob=async d=>(await fetch(d)).blob();
// documents attached to an entry: pdf, office files, text, images. No audio or video.
export const DOC_ACCEPT=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.zip";
export const MAX_DOC=15*1024*1024;
export const docOk=f=>!/^(audio|video)\//.test(f.type||"")&&!/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|amr|mp4|m4v|mov|avi|mkv|webm|3gp|wmv)$/i.test(f.name||"");
export const fsize=b=>b<1024?b+" B":b<1048576?Math.round(b/1024)+" KB":(Math.round(b/104857.6)/10)+" MB";
export const extOf=n=>((String(n).match(/\.([a-z0-9]+)$/i)||[])[1]||"file").toUpperCase().slice(0,4);
export const filesOf=e=>Array.isArray(e.files)?e.files:[];
export const attachCount=e=>(e.slipKey?1:0)+filesOf(e).length;
export async function storeDoc(file){
  let blob=file;
  if(/^image\//.test(file.type)&&file.size>1.5*1048576&&!/gif|heic|heif/i.test(file.type)){try{blob=await shrink(file,2000,.85)}catch{}}
  const key=newId("f");await dbPut("slips",blob,key);
  return{key,name:file.name||"document",type:blob.type||file.type||"application/octet-stream",size:blob.size};
}
export async function openDoc(f){const b=await dbGet("slips",f.key);if(!b){toast("This file is missing");return}
  if(/^image\//.test(b.type)){viewSlip(URL.createObjectURL(b));return}
  await giveFile(f.name,new Blob([b],{type:f.type||b.type}))}
export const docChip=(f,rm)=>`<span class="doc"><button type="button" class="docb" data-doc="${esc(f.key)}"><span class="ext">${esc(extOf(f.name))}</span><span class="dn">${esc(f.name)}</span><small>${fsize(f.size||0)}</small></button>${rm?`<button type="button" class="x xs" data-rmdoc="${esc(f.key)}" aria-label="Remove ${esc(f.name)}">×</button>`:""}</span>`;
export async function storeSlip(file){const b=await shrink(file,1600,.8);const key=newId("s");await dbPut("slips",b,key);return key}
export async function delSlip(k){try{await dbDel("slips",k)}catch{}const u=urlCache.get(k);if(u)URL.revokeObjectURL(u);urlCache.delete(k)}
export const urlCache=new Map();
export async function slipURL(k){if(!k)return null;if(urlCache.has(k))return urlCache.get(k);
  const b=await dbGet("slips",k);if(!b)return null;const u=URL.createObjectURL(b);urlCache.set(k,u);return u}
export function viewSlip(src){
  const v=document.createElement("div");v.className="viewer";
  v.innerHTML='<img alt="Payment slip"><button class="x" aria-label="Close">×</button>';
  $("img",v).src=src;v.addEventListener("click",()=>v.remove());document.body.appendChild(v);
}
