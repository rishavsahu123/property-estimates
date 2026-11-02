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
// kind of file, from its type or name: drives the little icons in lists
export const fileKind=f=>{const t=String(f.type||""),n=String(f.name||"").toLowerCase();
  if(/^image\//.test(t)||/\.(jpe?g|png|webp|heic|heif|gif)$/.test(n))return"img";
  if(/pdf/.test(t)||n.endsWith(".pdf"))return"pdf";
  if(/\.(csv)$/.test(n)||/csv/.test(t))return"csv";
  if(/\.(xlsx?|ods)$/.test(n)||/sheet|excel/.test(t))return"xls";
  if(/\.(docx?|odt|rtf|txt)$/.test(n)||/word|text/.test(t))return"doc";
  if(/\.(pptx?|odp)$/.test(n))return"ppt";
  if(/\.zip$/.test(n))return"zip";
  return"file"};
const KIND_LABEL={img:"Photo",pdf:"PDF",csv:"CSV",xls:"Excel",doc:"Doc",ppt:"Slides",zip:"ZIP",file:"File"};
const KIND_SVG={
  img:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
  pdf:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 16h4"/>',
  csv:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
  xls:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
  doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 11h6M9 14h6M9 17h4"/>',
  ppt:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M12 17v3M8 20h8"/>',
  zip:'<path d="M6 3h8l4 4v14H6z"/><path d="M11 5h2M11 8h2M11 11h2M10 14h4v3h-4z"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'};
/** small icons for the files on an entry, e.g. [photo] [PDF ×2] */
export function attachIcons(e){
  const n=new Map();if(e.slipKey)n.set("img",1);
  for(const f of filesOf(e)){const k=fileKind(f);n.set(k,(n.get(k)||0)+1)}
  if(!n.size)return"";
  return `<span class="fics">${[...n].map(([k,c])=>`<span class="fic fic-${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${KIND_SVG[k]}</svg>${KIND_LABEL[k]}${c>1?` ×${c}`:""}</span>`).join("")}</span>`;
}
/** one photo per entry for Excel and PDF: the old slip photo, else the first JPEG/PNG file */
export const photoKeyOf=e=>e.slipKey||filesOf(e).find(x=>/^image\/(jpeg|png)$/.test(x.type||""))?.key||null;
export async function storeDoc(file){
  let blob=file;
  if(/^image\//.test(file.type)&&file.size>1.5*1048576&&!/gif|heic|heif/i.test(file.type)){try{blob=await shrink(file,2000,.85)}catch{}}
  const key=newId("f");await dbPut("slips",blob,key);
  return{key,name:file.name||"document",type:blob.type||file.type||"application/octet-stream",size:blob.size};
}
export async function openDoc(f){const b=await dbGet("slips",f.key);if(!b){toast("This file is missing");return}
  if(/^image\//.test(b.type)){viewSlip(URL.createObjectURL(b));return}
  await giveFile(f.name,new Blob([b],{type:f.type||b.type}))}
export const docChip=(f,rm)=>`<span class="doc"><button type="button" class="docb" data-doc="${esc(f.key)}"><span class="ext">${esc(extOf(f.name))}</span><span class="dn">${esc(f.name)}</span><small>${f.size?fsize(f.size):"Photo"}</small></button>${rm?`<button type="button" class="x xs" data-rmdoc="${esc(f.key)}" aria-label="Remove ${esc(f.name)}">×</button>`:""}</span>`;
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
