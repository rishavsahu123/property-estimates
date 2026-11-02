// @ts-nocheck
// Receipt image for sharing.
import { esc, money, numfmt, fdate, localDay, round2, slug, plural, inWords } from "../lib/format";
import { isMonthly, dealAgreed, dealFormula, termsText, balText } from "../lib/deals";
import { dbGet } from "../data/db";
import { otherNames } from "./entry-form";
import { giveFile } from "./export";
import { attachCount, filesOf } from "./files";
import { personKey } from "./passbook";
import { AS, D, dealPaid, itemName, proj } from "../state";
import { $, $$, lget, lset, toast } from "../ui/dom";
import { sums } from "../ui/rows";
import { openSheet } from "../ui/sheets";

export const personOf=e=>e.contactId?"c:"+e.contactId:personKey(e)?"n:"+personKey(e):"";
export async function makeReceipt(sel,{history,slips,deal}){
  try{await document.fonts.ready}catch{}
  const S=1080,P=64,CWr=S-2*P,c=document.createElement("canvas"),g=c.getContext("2d");
  const K={paper:"#FFFFFF",ink:"#1C2B3A",muted:"#5D6B77",rule:"#D5DCD6",tape:"#F2B705",dark:"#1A1A1A",hl:"#FFF4CC",red:"#A3312A",cash:"#4F7A2E",online:"#2C6A8E"};
  const TX='Hind, "Noto Sans", "Noto Sans Devanagari", system-ui, sans-serif',NUM='Teko, "Arial Narrow", sans-serif';
  const font=(w,sz,fam=TX)=>`${w} ${sz}px ${fam}`;
  const wrapT=(t,f,maxW)=>{g.font=f;const out=[];let cur="";for(const w of String(t||"").split(/\s+/).filter(Boolean)){const n=cur?cur+" "+w:w;if(cur&&g.measureText(n).width>maxW){out.push(cur);cur=w}else cur=n}if(cur)out.push(cur);return out.length?out:[""]};
  const ops=[];let y=0;
  const text=(t,x,yy,f,col,al="left")=>ops.push(()=>{g.font=f;g.fillStyle=col;g.textAlign=al;g.textBaseline="alphabetic";g.fillText(t,x,yy)});
  const box=(x,yy,w,h,col)=>ops.push(()=>{g.fillStyle=col;g.fillRect(x,yy,w,h)});
  const line=(yy,col=K.rule,w=2)=>ops.push(()=>{g.fillStyle=col;g.fillRect(P,yy,CWr,w)});
  const stripe=yy=>ops.push(()=>{g.save();g.beginPath();g.rect(0,yy,S,18);g.clip();g.fillStyle=K.tape;g.fillRect(0,yy,S,18);g.fillStyle=K.dark;
    for(let x=-40;x<S+40;x+=48){g.beginPath();g.moveTo(x,yy);g.lineTo(x+24,yy);g.lineTo(x+6,yy+18);g.lineTo(x-18,yy+18);g.closePath();g.fill()}g.restore()});
  const p=proj(),es=[...sel].sort((a,b)=>a.ts-b.ts),t=sums(es),first=es[0],last=es[es.length-1];
  const pk=personOf(first),single=!!pk&&es.every(e=>personOf(e)===pk);
  const ct=single&&first.contactId?AS.CM.get(first.contactId):null,who=single?(ct?.name||first.vendor):"",phone=ct?.phone||"";
  const modeTxt=e=>e.cash&&e.online?`Cash ${money(e.cash)} + Online ${money(e.online)}`:e.cash?"Cash":"Online";

  stripe(0);y=100;
  text("PAYMENT RECEIPT",P,y,font(600,26),K.muted);text(p.name,S-P,y,font(500,26),K.muted,"right");
  if(single){y+=62;text("Paid to",P,y,font(400,28),K.muted);
    for(const l of wrapT(who,font(600,54),CWr)){y+=62;text(l,P,y,font(600,54),K.ink)}
    if(phone){y+=44;text(phone,P,y,font(400,30),K.muted)}}
  y+=single?70:80;
  const when=es.length===1?`Paid on ${fdate(first.ts)}`:fdate(first.ts)===fdate(last.ts)?`${plural(es.length,"payment","payments")} on ${fdate(first.ts)}`:`${plural(es.length,"payment","payments")}, ${fdate(first.ts)} to ${fdate(last.ts)}`;
  text(when,P,y,font(400,30),K.muted);
  y+=150;text(money(t.t),P-4,y,font(500,170,NUM),K.ink);
  for(const l of wrapT(inWords(t.t),font(400,30),CWr)){y+=46;text(l,P,y,font(400,30),K.muted)}
  y+=50;text(t.c&&t.o?`Cash ${money(t.c)}   ·   Online ${money(t.o)}`:t.c?"Paid in cash":"Paid online",P,y,font(500,30),K.ink);
  y+=40;line(y);y+=4;

  // past payments table (same person) — when it is drawn, the picked payments are shown only there, highlighted
  const histAll=history&&single?D.entries.filter(e=>!e.deletedAt&&e.projectId===D.pid&&personOf(e)===pk&&e.ts<=last.ts).sort((a,b)=>a.ts-b.ts):[];
  const showHist=histAll.length>1;
  const detailOf=e=>[e.qty?`${numfmt.format(e.qty)} ${e.unit||""}${e.rate?` @ ${money(e.rate)}`:""}`:"",otherNames(e).length?"with "+otherNames(e).join(", "):"",e.note||""].filter(Boolean).join(" · ");
  // details of the selected payments, newest first
  for(const e of showHist?[]:[...es].reverse()){
    const bits=[e.qty?`${numfmt.format(e.qty)} ${e.unit||""}${e.rate?` @ ${money(e.rate)}`:""}`:"",!single&&e.vendor?e.vendor:"",otherNames(e).length?"with "+otherNames(e).join(", "):"",e.note||"",es.length>1?modeTxt(e):""].filter(Boolean).join(" · ");
    const sub=bits?wrapT(bits,font(400,27),CWr-260):[];
    y+=58;text(itemName(e)||"Payment",P,y,font(600,34),K.ink);text(money(e.amount),S-P,y,font(500,52,NUM),K.ink,"right");
    if(es.length>1){y+=34;text(inWords(e.amount),P,y,font(400,24),K.muted)}
    if(es.length>1){y+=36;text(fdate(e.ts),P,y,font(400,26),K.muted)}
    for(const l of sub){y+=36;text(l,P,y,font(400,27),K.muted)}
    y+=24;line(y);
  }

  // deal box when all picked payments are against one deal
  const dl=deal&&es.every(e=>e.dealId&&e.dealId===first.dealId)?D.deals.find(d=>d.id===first.dealId):null;
  if(dl){const ag=dealAgreed(dl,last.ts),pd=dealPaid(dl,last.ts),bal=round2(ag-pd);
    y+=60;text(`Deal: ${dl.title}`,P,y,font(600,32),K.ink);
    y+=38;text(dealFormula(dl),P,y,font(400,26),K.muted);
    for(const l of termsText(dl).flatMap(t=>wrapT(t,font(400,24),CWr))){y+=32;text(l,P,y,font(400,24),K.muted)}
    y+=20;box(P,y,CWr,96,"#F6F8F5");
    const w3=CWr/3;[[isMonthly(dl)?`Earned till ${fdate(last.ts)}`:"Agreed",money(ag)],[`Paid till ${fdate(last.ts)}`,money(pd)],["Balance",balText(bal,dl)]].forEach(([l,v],i)=>{text(l,P+20+i*w3,y+34,font(400,22),K.muted);text(v,P+20+i*w3,y+78,font(500,44,NUM),i===2&&bal<0?K.red:K.ink)});
    y+=96;
  }

  // account history for the same person
  if(showHist){
    const maxTs=last.ts,selIds=new Set(es.map(e=>e.id));
    const hist=histAll,ht=sums(hist);
    const runOf=new Map();{let r=0;for(const e of hist){r+=+e.amount||0;runOf.set(e.id,r)}}
    if(hist.length>1){
    y+=78;for(const l of wrapT(`All payments to ${who} till ${fdate(maxTs)}`,font(600,36),CWr)){text(l,P,y,font(600,36),K.ink);y+=46}
    y-=8;text(`${plural(hist.length,"payment","payments")}   ·   Cash ${money(ht.c)}   ·   Online ${money(ht.o)}`,P,y,font(400,27),K.muted);
    if(hist.length>es.length){y+=36;text("Highlighted rows are the payments in this receipt",P,y,font(400,24),K.muted)}
    y+=28;
    const cx=[P+14,P+196,S-P-450,S-P-196,S-P-14];
    box(P,y,CWr,52,K.tape);
    [["Date",0,"left"],["Item",1,"left"],["Paid by",2,"left"],["Amount",3,"right"],["Total so far",4,"right"]].forEach(([h,i,al])=>text(h,cx[i],y+35,font(600,25),K.dark,al));
    y+=52;
    for(const e of [...hist].reverse()){
      const run=runOf.get(e.id);
      const il=wrapT(itemName(e)||"Payment",font(400,27),cx[2]-cx[1]-16).slice(0,2),dl2=detailOf(e)?wrapT(detailOf(e),font(400,22),cx[2]-cx[1]-16).slice(0,2):[],h=Math.max(1,il.length)*34+dl2.length*28+20;
      if(selIds.has(e.id))box(P,y,CWr,h,K.hl);
      text(fdate(e.ts),cx[0],y+40,font(400,26),K.ink);
      il.forEach((l,j)=>text(l,cx[1],y+40+j*34,font(selIds.has(e.id)?600:400,27),K.ink));
      dl2.forEach((l,j)=>text(l,cx[1],y+40+il.length*34+j*28-6,font(400,22),K.muted));
      text(e.cash&&e.online?"Both":e.cash?"Cash":"Online",cx[2],y+40,font(400,26),K.muted);
      text(money(e.amount),cx[3],y+40,font(500,34,NUM),K.ink,"right");
      text(money(run),cx[4],y+40,font(500,34,NUM),K.muted,"right");
      y+=h;line(y,K.rule,1);
    }
    y+=2;line(y,K.ink,3);y+=50;
    text("Total paid",P+14,y,font(600,30),K.ink);text(money(ht.t),S-P-14,y,font(500,48,NUM),K.ink,"right");
    y+=40;text(inWords(ht.t),S-P-14,y,font(400,24),K.muted,"right");
    y+=10;
    }
  }
  y+=56;stripe(y);y+=18;

  c.width=S;c.height=Math.ceil(y);g.fillStyle=K.paper;g.fillRect(0,0,c.width,c.height);ops.forEach(f=>f());
  const blob=await new Promise(r=>c.toBlob(r,"image/png"));
  return{blob,single,who,total:t.t,first,last,count:es.length};
}
export function openReceipt(ids,force={}){
  const es=D.entries.filter(e=>!e.deletedAt&&e.projectId===D.pid&&ids.includes(e.id)).sort((a,b)=>b.ts-a.ts);if(!es.length){toast("Pick at least one entry");return}
  const pk=personOf(es[0]),single=!!pk&&es.every(e=>personOf(e)===pk);
  const slips=es.filter(e=>attachCount(e));
  const nAtt=es.reduce((a,e)=>a+attachCount(e),0);
  const dealOk=es.every(e=>e.dealId&&e.dealId===es[0].dealId)&&D.deals.some(d=>d.id===es[0].dealId);
  const opt={history:single&&lget("pe-rc-hist",true),slips:slips.length>0&&lget("pe-rc-slips",true),deal:dealOk&&(force.deal??lget("pe-rc-deal",false))};
  // every option is always shown on one line; the ⓘ explains it (hover on desktop, tap on phone)
  const optRow=(id,on,ok,label,info,why)=>`<div class="rcopt${ok?"":" off"}"><label class="check"><input type="checkbox" id="${id}"${on?" checked":""}${ok?"":" disabled"}><span>${label}</span></label><button type="button" class="tipi" data-tip="${esc(ok?info:why)}" aria-label="${esc(ok?info:why)}">i</button></div>`;
  const s=openSheet("Share receipt",`
    <div class="rcopts">
      ${optRow("rc-h",opt.history,single,"Past payments","Adds a table of all payments to this person up to this date","These entries are for different shops or people")}
      ${optRow("rc-d",opt.deal,dealOk,"Deal summary","Adds the deal’s agreed amount, paid so far and balance",es.some(e=>e.dealId)?"Pick payments of a single deal":"Not linked to a deal")}
      ${optRow("rc-s",opt.slips,nAtt>0,nAtt?`Attachments (${nAtt})`:"Attachments","Sends slip photos and attached files along with the receipt","No slip photo or file attached")}
    </div>
    <div class="rprev"><img id="rc-img" alt="Receipt preview"></div>
    <button class="primary" id="rc-share" disabled>Share receipt</button>
    <button class="second" id="rc-save" disabled>Save image</button>`);
  let cur=null,url=null;
  const build=async()=>{
    $("#rc-share",s.body).disabled=$("#rc-save",s.body).disabled=true;
    try{cur=await makeReceipt(es,opt);if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(cur.blob);$("#rc-img",s.body).src=url}
    catch(err){console.error(err);toast("Couldn’t make the receipt.")}
    $("#rc-share",s.body).disabled=$("#rc-save",s.body).disabled=!cur;
  };
  const h=$("#rc-h",s.body),sl=$("#rc-s",s.body);
  const dk=$("#rc-d",s.body);
  // tap the ⓘ (or a greyed-out row) to read why; hover shows the same text on desktop
  $$(".rcopt",s.body).forEach(row=>{const tip=$(".tipi",row);
    tip.addEventListener("click",ev=>{ev.preventDefault();$$(".tipi.show",s.body).forEach(x=>x!==tip&&x.classList.remove("show"));tip.classList.toggle("show")});
    if(row.classList.contains("off"))row.addEventListener("click",ev=>{if(ev.target!==tip){$$(".tipi.show",s.body).forEach(x=>x.classList.remove("show"));tip.classList.add("show")}})});
  h.addEventListener("change",()=>{opt.history=h.checked;lset("pe-rc-hist",h.checked);build()});
  dk.addEventListener("change",()=>{opt.deal=dk.checked;lset("pe-rc-deal",dk.checked);build()});
  sl.addEventListener("change",()=>{opt.slips=sl.checked;lset("pe-rc-slips",sl.checked);build()});
  const fname=()=>`receipt-${slug(cur.who||proj().name)}-${localDay(new Date(cur.last.ts))}.png`;
  $("#rc-share",s.body).addEventListener("click",async()=>{
    if(!cur)return;
    const files=[new File([cur.blob],fname(),{type:"image/png"})];
    if(opt.slips){for(const [i,e] of es.filter(e=>e.slipKey).entries()){const b=await dbGet("slips",e.slipKey);if(b)files.push(new File([b],`slip-${i+1}-${localDay(new Date(e.ts))}.jpg`,{type:b.type||"image/jpeg"}))}
      for(const e of es)for(const x of filesOf(e)){const b=await dbGet("slips",x.key);if(b)files.push(new File([b],x.name,{type:x.type||b.type}))}}
    const msg=`Payment receipt: ${money(cur.total)}${cur.who?` to ${cur.who}`:""}, ${cur.count===1?fdate(cur.first.ts):`${fdate(cur.first.ts)} to ${fdate(cur.last.ts)}`}.`;
    if(navigator.canShare&&navigator.canShare({files})){
      try{await navigator.share({files,title:"Payment receipt",text:msg});return}catch(e){if(e&&e.name==="AbortError")return}
    }
    await giveFile(fname(),cur.blob);toast("Receipt image saved. Share it from your Downloads.");
  });
  $("#rc-save",s.body).addEventListener("click",()=>{if(!cur)return;const a=document.createElement("a");a.href=url;a.download=fname();document.body.appendChild(a);a.click();a.remove();toast("Receipt image saved")});
  s.onClose=()=>{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000)};
  build();
}
