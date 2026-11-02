// @ts-nocheck
// Excel and PDF exports.
import { openSheet } from "../ui/sheets";
import { KINDS } from "../lib/constants";
import { numfmt, fdate, localDay, round2, slug, plural, inWords, money } from "../lib/format";
import { dealAgreed, dealFormula, termsText } from "../lib/deals";
import { dbGet } from "../data/db";
import { otherNames } from "./entry-form";
import { blobToData, filesOf, photoKeyOf } from "./files";
import { filterTags, PB } from "./passbook";
import { byItem, kindTotals } from "./summary";
import { AS, D, dealBal, dealInView, dealPaid, gName, groupOf, itemName, phoneOf, proj, projDeals } from "../state";
import { $, toast, $$ } from "../ui/dom";
import { sums } from "../ui/rows";
import { task } from "../ui/topbar";

export async function giveFile(name,blob){
  const file=new File([blob],name,{type:blob.type});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:name});return true}catch(e){if(e&&e.name==="AbortError")return false}
  }
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),10000);return true;
}
export const libLoading={};
export function loadLib(src,ready){
  if(ready())return Promise.resolve();
  return libLoading[src]||(libLoading[src]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;
    s.onload=()=>ready()?res():rej(new Error("lib"));s.onerror=()=>{delete libLoading[src];s.remove();rej(new Error("lib"))};document.head.appendChild(s)}));
}
export const loadExcel=()=>loadLib("exceljs.min.js",()=>window.ExcelJS);
export async function imgSize(blob){try{const b=await createImageBitmap(blob);const r={w:b.width,h:b.height};b.close&&b.close();return r}catch{return{w:3,h:4}}}
export async function buildExcel(){
  await loadExcel();
  const p=proj(),wb=new ExcelJS.Workbook();wb.creator="Property Estimates";wb.created=new Date();
  const MONEY='"₹"#,##0.00',head=r=>{r.font={bold:true};r.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF2B705"}};c.alignment={vertical:"middle"}})};
  const ws=wb.addWorksheet("Entries",{views:[{state:"frozen",ySplit:1}]});
  ws.columns=[{header:"Date",key:"date",width:13},{header:"Item",key:"item",width:18},{header:"Group",key:"group",width:20},
    {header:"Quantity",key:"qty",width:10},{header:"Unit",key:"unit",width:10},{header:"Rate",key:"rate",width:12},
    {header:"Amount",key:"amount",width:14},{header:"Cash",key:"cash",width:13},{header:"Online",key:"online",width:13},
    {header:"Shop or person",key:"vendor",width:24},{header:"Mobile",key:"phone",width:15},{header:"Note",key:"note",width:28},{header:"Slip photo",key:"slip",width:24},{header:"Files",key:"files",width:28}];
  head(ws.getRow(1));
  const list=[...AS.LIVE].sort((a,b)=>a.ts-b.ts);let slips=0;
  for(const e of list){
    const d=new Date(e.ts),g=groupOf(e);
    const row=ws.addRow({date:new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),item:itemName(e)||"",group:g==="none"?"":gName(g),
      qty:e.qty||null,unit:e.unit||"",rate:e.rate||null,amount:+e.amount||0,cash:+e.cash||0,online:+e.online||0,
      vendor:[e.vendor||"",...otherNames(e)].filter(Boolean).join("; "),phone:phoneOf(e),note:e.note||"",slip:"",files:filesOf(e).map(x=>x.name).join(", ")});
    row.getCell("date").numFmt="dd mmm yyyy";["rate","amount","cash","online"].forEach(k=>row.getCell(k).numFmt=MONEY);
    row.alignment={vertical:"top",wrapText:true};
    if(photoKeyOf(e)){
      const blob=await dbGet("slips",photoKeyOf(e));
      if(blob){
        const ext=/png/.test(blob.type)?"png":"jpeg";const{w,h}=await imgSize(blob);
        let H=120,W=Math.round(H*w/h);if(W>165){W=165;H=Math.round(W*h/w)}
        const id=wb.addImage({base64:await blobToData(blob),extension:ext});
        ws.addImage(id,{tl:{col:12.05,row:row.number-1+0.05},ext:{width:W,height:H},editAs:"oneCell"});
        row.height=Math.max(20,H*0.75+6);slips++;
      }
    }
  }
  const n=list.length+1,tr=ws.addRow({date:"Total",amount:{formula:`SUM(G2:G${n})`,result:sums(list).t},cash:{formula:`SUM(H2:H${n})`,result:sums(list).c},online:{formula:`SUM(I2:I${n})`,result:sums(list).o}});
  tr.font={bold:true};["amount","cash","online"].forEach(k=>tr.getCell(k).numFmt=MONEY);
  ws.autoFilter={from:"A1",to:`N${n}`};

  const s2=wb.addWorksheet("By item");
  s2.columns=[{header:"Group",key:"g",width:22},{header:"Item",key:"i",width:22},{header:"Entries",key:"n",width:9},{header:"Quantity",key:"q",width:36},{header:"Amount",key:"a",width:15}];
  head(s2.getRow(1));
  const groups=byItem(list);
  [...D.groups.map(g=>g.k),"none"].forEach(cat=>groups.filter(g=>g.cat===cat).forEach(g=>{
    const r=s2.addRow({g:gName(cat),i:g.name,n:g.n,q:g.qtext,a:g.amt});r.getCell("a").numFmt=MONEY}));
  s2.addRow({});
  const t=sums(list),kt=kindTotals(list);
  [["Construction",kt.construction],["Documents",kt.documents],...(kt.unknown?[["Not sorted yet",kt.unknown]]:[]),["Total",t.t],["Paid in cash",t.c],["Paid online",t.o]]
    .forEach(([l,v])=>{const r=s2.addRow({g:l,a:v});r.getCell("a").numFmt=MONEY;if(l==="Total")r.font={bold:true}});
  s2.addRow({});s2.addRow({g:`Project: ${p.name}${AS.VIEW!=="all"?` (${KINDS[AS.VIEW]} only)`:""}`});s2.addRow({g:`Made on ${fdate(Date.now())} by Property Estimates`});

  const pdl=projDeals().filter(dealInView);
  if(pdl.length){const s3=wb.addWorksheet("Deals");
    s3.columns=[{header:"Deal",key:"t",width:26},{header:"Shop or person",key:"c",width:22},{header:"Pricing",key:"f",width:34},{header:"Agreed",key:"a",width:15},{header:"Paid",key:"p",width:15},{header:"Balance",key:"b",width:15},{header:"Status",key:"s",width:11},{header:"Terms",key:"tm",width:40}];
    head(s3.getRow(1));
    pdl.forEach(d=>{const r=s3.addRow({t:d.title,c:AS.CM.get(d.contactId)?.name||"",f:dealFormula(d).replace(/₹/g,"Rs "),a:dealAgreed(d),p:dealPaid(d),b:dealBal(d),s:d.closed?"Complete":"Open",tm:termsText(d).join("; ")});["a","p","b"].forEach(k=>r.getCell(k).numFmt=MONEY)})}
  const buf=await wb.xlsx.writeBuffer();
  return{blob:new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),name:`property-estimates-${slug(p.name)}${AS.VIEW!=="all"?"-"+AS.VIEW:""}-${localDay()}.xlsx`,rows:list.length,slips};
}
$("#excel").addEventListener("click",()=>task("Preparing Excel…",async()=>{
  if(!AS.LIVE.length){toast("No entries to export yet");return}
  try{const x=await buildExcel();await giveFile(x.name,x.blob)}
  catch(err){console.error(err);toast(err&&err.message==="lib"?"Couldn’t load the Excel tool. Open the app once with internet, then try again.":"Couldn’t make the Excel file. Try again.")}
}));

export const pdfMoney=n=>"Rs "+numfmt.format(round2(+n||0));
export const pdfText=s=>String(s??"").replace(/₹\s?/g,"Rs ").replace(/[–—]/g,"-").replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/×/g,"x");
export async function buildPdf(list,{title,filters,photos=true}){
  await loadLib("jspdf.umd.min.js",()=>window.jspdf&&window.jspdf.jsPDF);
  const doc=new window.jspdf.jsPDF({unit:"pt",format:"a4",compress:true});
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=36,CW=W-2*M,BOTTOM=H-M-16;
  const INK=[28,43,58],MUTED=[93,107,119],RULE=[204,213,206],TAPE=[242,183,5],RED=[163,49,42];
  const p=proj();let y=M;
  list=[...list].sort((a,b)=>a.ts-b.ts);
  const slipNo=new Map();if(photos)list.forEach(e=>{if(photoKeyOf(e))slipNo.set(e.id,slipNo.size+1)});
  const font=(style,size,color)=>{doc.setFont("helvetica",style);doc.setFontSize(size);doc.setTextColor(...color)};
  const stripe=()=>{for(let x=-20;x<W;x+=24){doc.setFillColor(...TAPE);doc.triangle(x,0,x+12,0,x+6,6,"F")}doc.setFillColor(...TAPE);doc.rect(0,0,W,3,"F")};
  const newPage=()=>{doc.addPage();stripe();y=M};
  stripe();

  // heading
  font("normal",9,MUTED);doc.text("PROPERTY ESTIMATES",M,y+6);
  y+=30;font("bold",20,INK);doc.text(pdfText(p.name),M,y);
  y+=17;font("normal",10,MUTED);
  const span=list.length?`${fdate(list[0].ts)} to ${fdate(list[list.length-1].ts)}`:"";
  doc.splitTextToSize(pdfText(`${title}${AS.VIEW!=="all"?` (${KINDS[AS.VIEW]} only)`:""}. ${plural(list.length,"entry","entries")}${span?", "+span:""}. Made on ${fdate(Date.now())}.`),CW).forEach(l=>{doc.text(l,M,y);y+=13});
  if(filters){doc.splitTextToSize(pdfText("Filters: "+filters),CW).forEach(l=>{doc.text(l,M,y);y+=13})}

  // totals
  y+=6;const t=sums(list),kt=kindTotals(list);
  const boxes=[["Construction",kt.construction],["Documents",kt.documents],[kt.unknown?`Total (incl. ${pdfMoney(kt.unknown)} not sorted)`:"Total",t.t]],bw=(CW-16)/3;
  boxes.forEach(([l,v],i)=>{const x=M+i*(bw+8);doc.setDrawColor(...RULE);doc.setLineWidth(.8);
    if(i===2){doc.setFillColor(255,244,204);doc.roundedRect(x,y,bw,48,6,6,"FD")}else doc.roundedRect(x,y,bw,48,6,6,"S");
    font("normal",8,MUTED);doc.text(doc.splitTextToSize(l,bw-16)[0],x+8,y+15);font("bold",15,INK);doc.text(pdfMoney(v),x+8,y+37)});
  y+=62;font("italic",10,MUTED);doc.splitTextToSize(`Total in words: ${inWords(t.t)}`,CW).forEach(l=>{doc.text(l,M,y);y+=13});
  font("normal",10,MUTED);doc.text(`Paid in cash ${pdfMoney(t.c)}     Paid online ${pdfMoney(t.o)}${slipNo.size?`     ${plural(slipNo.size,"slip photo","slip photos")} at the end`:""}`,M,y);
  y+=18;

  // entries table
  const cols=photos?[{h:"Date",w:64},{h:"Item",w:84},{h:"Details",w:183},{h:"Paid by",w:76},{h:"Amount",w:72,r:true},{h:"Slip",w:CW-479}]
    :[{h:"Date",w:64},{h:"Item",w:84},{h:"Details",w:CW-296},{h:"Paid by",w:76},{h:"Amount",w:72,r:true}];
  const head=()=>{doc.setFillColor(...TAPE);doc.rect(M,y,CW,18,"F");font("bold",9,[26,26,26]);let x=M;
    cols.forEach(c=>{doc.text(c.h,c.r?x+c.w-4:x+4,y+12.5,c.r?{align:"right"}:undefined);x+=c.w});y+=18};
  head();
  for(const e of list){
    const det=[e.qty?`${numfmt.format(e.qty)} ${e.unit||""}${e.rate?` @ ${pdfMoney(e.rate)}`:""}`:"",e.vendor||"",phoneOf(e),otherNames(e).length?"with "+otherNames(e).join(", "):"",e.note||"",filesOf(e).length?"files: "+filesOf(e).map(x=>x.name).join(", "):""].filter(Boolean).join(", ");
    const paid=e.cash&&e.online?`Cash ${pdfMoney(e.cash)}\nOnline ${pdfMoney(e.online)}`:e.cash?"Cash":"Online";
    const cells=[fdate(e.ts),itemName(e)||"Item not set",det,paid,pdfMoney(e.amount),slipNo.has(e.id)?`Slip ${slipNo.get(e.id)}`:""].slice(0,cols.length);
    font("normal",9,INK);
    const lines=cells.map((c,i)=>doc.splitTextToSize(pdfText(c),cols[i].w-8));
    const h=Math.max(...lines.map(l=>l.length))*11+8;
    if(y+h>BOTTOM){newPage();head()}
    let x=M;
    lines.forEach((l,i)=>{const c=cols[i];
      if(i===4)font("bold",9,RED);else if(i===5)font("bold",9,[44,106,142]);else font("normal",9,i===2||i===3?MUTED:INK);
      l.forEach((ln,j)=>doc.text(ln,c.r?x+c.w-4:x+4,y+12+j*11,c.r?{align:"right"}:undefined));x+=c.w});
    y+=h;doc.setDrawColor(...RULE);doc.setLineWidth(.5);doc.line(M,y,M+CW,y);
  }
  if(y+24>BOTTOM)newPage();
  doc.setDrawColor(...INK);doc.setLineWidth(1.2);doc.line(M,y+1,M+CW,y+1);
  font("bold",11,INK);doc.text("Total",M+4,y+16);doc.text(pdfMoney(t.t),M+cols.slice(0,5).reduce((a,c)=>a+c.w,0)-4,y+16,{align:"right"});
  y+=52;

  // by item
  const groups=byItem(list);
  if(groups.length){
    if(y+60>BOTTOM)newPage();
    font("bold",13,INK);doc.text("By item",M,y);y+=8;
    [...D.groups.map(g=>g.k),"none"].forEach(cat=>groups.filter(g=>g.cat===cat).forEach(g=>{
      font("normal",9,MUTED);const q=doc.splitTextToSize(pdfText(`${cat==="none"?"":gName(cat)+". "}${plural(g.n,"entry","entries")}${g.qtext?". "+g.qtext:""}`),CW-110);
      const h=16+q.length*11;if(y+h>BOTTOM)newPage();
      font("bold",10,INK);doc.text(pdfText(g.name),M,y+14);doc.text(pdfMoney(g.amt),M+CW,y+14,{align:"right"});
      font("normal",9,MUTED);q.forEach((l,j)=>doc.text(l,M,y+26+j*11));
      y+=h+4;doc.setDrawColor(...RULE);doc.setLineWidth(.5);doc.line(M,y,M+CW,y);
    }));
  }

  // deals
  const pdl=projDeals().filter(dealInView);
  if(pdl.length){
    if(y+70>BOTTOM)newPage();
    y+=10;font("bold",13,INK);doc.text("Deals and balances",M,y);y+=8;
    for(const d of pdl){const ag=dealAgreed(d),pd=dealPaid(d),b=round2(ag-pd);if(y+40>BOTTOM)newPage();
      font("bold",10,INK);doc.text(pdfText(`${d.title}${AS.CM.get(d.contactId)?" · "+AS.CM.get(d.contactId).name:""}`),M,y+14);doc.text(pdfText(b>=0?"Balance "+pdfMoney(b):pdfMoney(-b)+" over"),M+CW,y+14,{align:"right"});
      font("normal",9,MUTED);doc.text(doc.splitTextToSize(pdfText(`${dealFormula(d)}. Agreed ${pdfMoney(ag)}, paid ${pdfMoney(pd)}${d.closed?". Complete":""}${termsText(d).length?". "+termsText(d).join("; "):""}`),CW)[0],M,y+26);
      y+=34;doc.setDrawColor(...RULE);doc.setLineWidth(.5);doc.line(M,y,M+CW,y)}
  }

  // slip photos, two per page
  const withSlip=list.filter(e=>slipNo.has(e.id));
  const slotH=(H-2*M-30)/2;let slot=2;
  for(const e of withSlip){
    const blob=await dbGet("slips",photoKeyOf(e));if(!blob)continue;
    if(slot===2){newPage();font("bold",13,INK);doc.text("Slip photos",M,y+4);y+=20;slot=0}
    const top=y+slot*slotH;
    font("bold",10,INK);doc.text(pdfText(`Slip ${slipNo.get(e.id)}   ${fdate(e.ts)}   ${itemName(e)||"Item not set"}   ${pdfMoney(e.amount)}`),M,top+10);
    font("normal",9,MUTED);const sub=[e.vendor,phoneOf(e),e.note].filter(Boolean).join(", ");
    if(sub)doc.text(doc.splitTextToSize(pdfText(sub),CW)[0],M,top+23);
    const {w,h}=await imgSize(blob),boxW=CW,boxH=slotH-40;let iw=boxW,ih=iw*h/w;if(ih>boxH){ih=boxH;iw=ih*w/h}
    doc.addImage(await blobToData(blob),/png/.test(blob.type)?"PNG":"JPEG",M+(boxW-iw)/2,top+30,iw,ih,undefined,"FAST");
    slot++;
  }

  // page numbers
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){doc.setPage(i);font("normal",8,MUTED);doc.text(pdfText(`${p.name}   page ${i} of ${n}`),W/2,H-18,{align:"center"})}
  return{blob:doc.output("blob"),name:`property-estimates-${slug(p.name)}${AS.VIEW!=="all"?"-"+AS.VIEW:""}-${localDay()}.pdf`};
}
export async function pdfClick(btn,list,opts){
  if(!list.length){toast("No entries to export");return}
  const label=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent="Preparing PDF…"}
  try{const x=await buildPdf(list,opts);await giveFile(x.name,x.blob)}
  catch(err){console.error(err);toast(err&&err.message==="lib"?"Couldn’t load the PDF tool. Open the app once with internet, then try again.":"Couldn’t make the PDF. Try again.")}
  if(btn){btn.disabled=false;btn.textContent=label}
}
$("#pdf").addEventListener("click",()=>task("Preparing PDF…",()=>pdfClick(null,AS.LIVE,{title:"All entries",photos:false})));
$("#pdf-photos").addEventListener("click",()=>task("Preparing PDF…",()=>pdfClick(null,AS.LIVE,{title:"All entries",photos:true})));
/** PDF of picked entries: asks with or without slip photos */
export function pdfOfEntries(list,title){
  if(!list.length){toast("No entries to export");return}
  const nPh=list.filter(e=>photoKeyOf(e)).length;
  const s=openSheet("PDF of these entries",`
    <p class="pmeta" style="margin:0 0 4px">${plural(list.length,"entry","entries")} · ${money(sums(list).t)}</p>
    <button class="primary" data-pp="0">PDF report</button>
    <button class="second" data-pp="1"${nPh?"":" disabled"}>PDF with slip photos${nPh?` (${nPh})`:" (none attached)"}</button>`);
  $$("[data-pp]",s.body).forEach(b=>b.addEventListener("click",()=>{const photos=b.dataset.pp==="1";s.close();
    task("Preparing PDF…",()=>pdfClick(null,list,{title,photos}))}));
}
