// @ts-nocheck
// Summary: totals, deals and balances, charts.
import { KINDS } from "../lib/constants";
import { esc, money, numfmt, MON, round2, perUnit, plural } from "../lib/format";
import { isMonthly, dealAgreed, dealFormula, balText } from "../lib/deals";
import { initials, openPerson } from "./people";
import { AS, D, dealBal, dealInView, dealPaid, dueText, gName, groupOf, itemName, kindOf, projDeals, viewGroups } from "../state";
import { $, $$, lget, lset } from "../ui/dom";
import { sums } from "../ui/rows";

export function renderSummary(){
  const es=AS.LIVE,t=sums(es);
  const k=kindTotals(es);
  $("#costsplit").innerHTML=AS.VIEW==="all"?`
    <div class="trow"><span>Construction</span><span class="num">${money(k.construction)}</span></div>
    <div class="trow"><span>Documents</span><span class="num">${money(k.documents)}</span></div>
    ${k.unknown?`<div class="trow"><span>Not sorted yet<br><small class="pmeta">groups marked Unknown, or entries without an item</small></span><span class="num">${money(k.unknown)}</span></div>`:""}
    <div class="trow total"><span>Total</span><span class="num">${money(t.t)}</span></div>`
    :`<div class="trow total" style="border-top:0"><span>${KINDS[AS.VIEW]} total<br><small class="pmeta">${plural(es.length,"entry","entries")}</small></span><span class="num">${money(t.t)}</span></div>`;
  $("#mbar").innerHTML=t.t?`<i style="width:${t.c/t.t*100}%;background:var(--cash)"></i><i style="width:${t.o/t.t*100}%;background:var(--online)"></i>`:"";
  $("#mlegend").innerHTML=`<span style="color:var(--cash)">Cash ${money(t.c)}</span><span style="color:var(--online)">Online ${money(t.o)}</span>`;
  const groups=byItem(es);let html="";
  [...D.groups.map(g=>g.k),"none"].forEach(cat=>{
    const gs=groups.filter(g=>g.cat===cat);if(!gs.length)return;
    html+=`<div class="cathead"><span>${esc(gName(cat))}</span><span>${money(gs.reduce((s,g)=>s+g.amt,0))}</span></div>`;
    html+=gs.map(g=>`<div class="trow"><span>${esc(g.name)}</span><span class="num">${money(g.amt)}</span><span class="s">${plural(g.n,"entry","entries")}${g.qtext?". "+esc(g.qtext):""}</span></div>`).join("");
  });
  $("#byitem").innerHTML=html||'<p class="empty">Totals appear here once you add entries.</p>';
  renderGroupBar(es,t.t);renderMonthly(es);renderDeals(t.t);
}
export const paintTheme=()=>$$("#theme button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.theme===lget("pe-theme","auto"))));
export function renderDeals(spent){
  const ds=projDeals().filter(dealInView);
  if(!ds.length){$("#deals").innerHTML='<p class="hint" style="margin:0">When a price is fixed up front (thekedar ₹285 per sq ft, engineer ₹75,000), open the person in People and tap + Add deal. Their payments then count against it and the balance shows here.</p>';return}
  let ag=0,pd=0;ds.forEach(d=>{ag+=dealAgreed(d);pd+=dealPaid(d)});const bal=round2(ag-pd),open=round2(ds.filter(d=>!d.closed).reduce((a,d)=>a+Math.max(dealBal(d),0),0));
  $("#deals").innerHTML=`<div class="sumstrip" style="margin-top:0"><div>Agreed<span class="num">${money(ag)}</span></div><div>Paid<span class="num">${money(pd)}</span></div><div>Balance<span class="num">${balText(bal)}</span></div></div>
    <div class="trow total" style="border-top:0"><span>Expected total cost<br><small class="pmeta">spent so far ${money(spent)} + balance still to pay ${money(open)}</small></span><span class="num">${money(spent+open)}</span></div>
    ${ds.map(d=>{const c=AS.CM.get(d.contactId),b=dealBal(d);return `<button class="crow" data-dc="${esc(d.contactId)}"><span class="av" aria-hidden="true">${esc(initials(c?.name||d.title))}</span><span style="min-width:0"><b>${esc(d.title)}</b><small>${esc([c?.name,dealFormula(d),dueText(d),d.closed?"complete":""].filter(Boolean).join(" · "))}</small></span><span class="num${b<0&&!isMonthly(d)?" over":""}" style="font-size:22px">${balText(b,d)}</span></button>`}).join("")}`;
  $$("[data-dc]",$("#deals")).forEach(b=>b.addEventListener("click",()=>openPerson(b.dataset.dc)));
}
export function kindTotals(es){const o={construction:0,documents:0,unknown:0};es.forEach(e=>{const k=kindOf(e);o[k||"unknown"]+=+e.amount||0});return o}
export function byItem(es){
  const m=new Map();
  es.forEach(e=>{const k=e.item||"none";const g=m.get(k)||{name:itemName(e)||"Item not set",cat:groupOf(e),amt:0,n:0,q:{}};
    g.amt+=+e.amount||0;g.n++;if(e.qty&&e.unit)g.q[e.unit]=(g.q[e.unit]||0)+e.qty;m.set(k,g)});
  return [...m.values()].map(g=>{const u=Object.keys(g.q);
    g.qtext=u.map(x=>`${numfmt.format(g.q[x])} ${x}${u.length===1&&g.q[x]?`, average ${money(g.amt/g.q[x])} per ${perUnit(x)}`:""}`).join("; ");return g}).sort((a,b)=>b.amt-a.amt);
}
$$("#theme button").forEach(b=>b.addEventListener("click",()=>{const t=b.dataset.theme;lset("pe-theme",t);
  if(t==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",t);paintTheme()}));

// colour follows the group: its position in the group list picks a fixed palette slot
export const gColor=k=>{const i=D.groups.findIndex(g=>g.k===k);return i>=0&&i<8?`var(--g${i+1})`:"var(--gx)"};
export function chartGroups(es){const has=new Set(es.map(groupOf));
  const out=viewGroups().filter(g=>has.has(g.k)||AS.VIEW!=="all"||g.kind).map(g=>[g.k,g.n,gColor(g.k)]);
  D.groups.forEach(g=>{if(has.has(g.k)&&!out.some(o=>o[0]===g.k))out.push([g.k,g.n,gColor(g.k)])});
  if(has.has("none"))out.push(["none","Item not set","var(--gx)"]);return out}
export const vgOf=e=>groupOf(e);
export const compact=n=>{const a=Math.abs(n);return a>=1e7?"₹"+numfmt.format(Math.round(n/1e5)/100)+" Cr":a>=1e5?"₹"+numfmt.format(Math.round(n/1e4)/10)+" L":a>=1e3?"₹"+numfmt.format(Math.round(n/100)/10)+"k":"₹"+numfmt.format(Math.round(n))};
export function renderGroupBar(es,total){
  const VG=chartGroups(es);
  const by=Object.fromEntries(VG.map(g=>[g[0],0]));es.forEach(e=>by[vgOf(e)]=(by[vgOf(e)]||0)+(+e.amount||0));
  const shown=VG.filter(g=>by[g[0]]>0);
  $("#gbar").innerHTML=shown.map(g=>`<i style="flex:${by[g[0]]} 1 0;background:${g[2]}"></i>`).join("");
  $("#gbar").setAttribute("aria-label","Share of total: "+VG.map(g=>`${g[1]} ${money(by[g[0]])}`).join(", "));
  $("#gbar").hidden=!total;
  $("#glegend").innerHTML=VG.map(g=>`<span class="sw" style="background:${g[2]}"></span><span>${g[1]}</span><span class="v">${money(by[g[0]])}</span><span class="pc">${total?Math.round(by[g[0]]/total*100)+"%":"–"}</span>`).join("");
}
export function monthRows(es){
  if(!es.length)return[];
  let lo=Infinity,hi=-Infinity;es.forEach(e=>{lo=Math.min(lo,e.ts);hi=Math.max(hi,e.ts)});
  const a=new Date(lo),b=new Date(Math.max(hi,Date.now())),out=[];
  for(let y=a.getFullYear(),m=a.getMonth();y<b.getFullYear()||(y===b.getFullYear()&&m<=b.getMonth());m===11?(m=0,y++):m++)
    out.push({y,m,g:{},t:0,n:0});
  const base=a.getFullYear()*12+a.getMonth();
  es.forEach(e=>{const d=new Date(e.ts),o=out[d.getFullYear()*12+d.getMonth()-base];const v=+e.amount||0;o.g[vgOf(e)]=(o.g[vgOf(e)]||0)+v;o.t+=v;o.n++});
  return out;
}
export const niceMax=v=>{if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v))),f=v/p;return(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p};
let hideTip=null;document.addEventListener("click",()=>{if(hideTip)hideTip()});
export const rrTop=(x,y,w,h,r)=>`M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`;
export function renderMonthly(es){
  const VGm=chartGroups(es);
  const all=monthRows(es),ms=all.slice(-12),wrap=$("#mchart");
  $("#mtoggle").hidden=!ms.length;
  if(!ms.length){wrap.innerHTML='<p class="empty">The chart appears once you add entries.</p>';$("#mtable").innerHTML="";$("#mlg").innerHTML="";$("#mnote").textContent="";return}
  const W=360,H=214,L=44,R=6,T=16,B=34,pw=W-L-R,ph=H-T-B,max=niceMax(Math.max(...ms.map(m=>m.t)));
  const band=pw/ms.length,bw=Math.max(6,Math.min(28,band*.62)),peak=ms.reduce((a,m,i)=>m.t>ms[a].t?i:a,0);
  let svg=`<svg class="mchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending by month, ${ms.map(m=>`${MON[m.m]} ${m.y}: ${money(m.t)}`).join(", ")}">`;
  for(let i=0;i<=4;i++){const yy=T+ph-ph*i/4;svg+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/><text x="${L-6}" y="${yy+3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${i?compact(max*i/4):"₹0"}</text>`}
  ms.forEach((m,i)=>{
    const cx=L+band*i+band/2,x=cx-bw/2;let yy=T+ph;
    const segs=VGm.filter(g=>m.g[g[0]]>0);
    segs.forEach((g,j)=>{const h=m.g[g[0]]/max*ph;yy-=h;
      if(j===segs.length-1)svg+=`<path d="${rrTop(x,yy,bw,Math.max(h,1),Math.min(4,bw/2,Math.max(h,1)))}" fill="${g[2]}"/>`;
      else if(h>2.5)svg+=`<rect x="${x}" y="${yy+2}" width="${bw}" height="${h-2}" fill="${g[2]}"/>`;});
    if(i===peak&&m.t>0)svg+=`<text x="${cx}" y="${Math.max(yy-5,9)}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--ink)">${compact(m.t)}</text>`;
    const showLbl=ms.length<=8||i%2===(ms.length-1)%2;
    if(showLbl)svg+=`<text x="${cx}" y="${T+ph+14}" text-anchor="middle" font-size="10" fill="var(--muted)">${MON[m.m]}</text>`;
    if(i===0||m.m===0)svg+=`<text x="${cx}" y="${T+ph+27}" text-anchor="middle" font-size="9" fill="var(--muted)">${m.y}</text>`;
    svg+=`<rect class="hit" data-i="${i}" x="${L+band*i}" y="${T}" width="${band}" height="${ph+B-4}" fill="transparent"/>`;
  });
  svg+=`<line x1="${L}" x2="${W-R}" y1="${T+ph}" y2="${T+ph}" stroke="var(--muted)" stroke-width="1"/></svg><div class="tip" hidden></div>`;
  wrap.innerHTML=svg;
  const tip=$(".tip",wrap),sv=$("svg",wrap);
  let shown=-1;
  const show=i=>{const m=ms[i];shown=i;
    tip.innerHTML=`<b>${MON[m.m]} ${m.y}: ${money(m.t)}</b>${VGm.filter(g=>m.g[g[0]]>0).map(g=>`<div class="r"><span class="sw" style="background:${g[2]}"></span><span>${g[1]}</span><span>${money(m.g[g[0]])}</span></div>`).join("")||'<div>No spending</div>'}`;
    tip.hidden=false;const k=wrap.clientWidth/W,cx=(L+band*i+band/2)*k,tw=tip.offsetWidth;
    tip.style.left=Math.max(0,Math.min(wrap.clientWidth-tw,cx-tw/2))+"px";tip.style.top="-8px";tip.style.transform="translateY(-100%)";
    $$(".hit",sv).forEach(r=>r.setAttribute("fill",+r.dataset.i===i?"rgba(127,127,127,.12)":"transparent"))};
  const hide=()=>{tip.hidden=true;shown=-1;$$(".hit",sv).forEach(r=>r.setAttribute("fill","transparent"))};
  $$(".hit",sv).forEach(r=>{r.addEventListener("click",ev=>{ev.stopPropagation();const i=+r.dataset.i;if(!tip.hidden&&shown===i&&ev.pointerType!=="mouse")hide();else show(i)});
    r.addEventListener("pointerenter",ev=>{if(ev.pointerType==="mouse")show(+r.dataset.i)})});
  sv.addEventListener("pointerleave",ev=>{if(ev.pointerType==="mouse")hide()});
  hideTip=hide;
  $("#mlg").innerHTML=VGm.map(g=>`<span><i style="background:${g[2]}"></i>${g[1]}</span>`).join("");
  $("#mtable").innerHTML=[...all].reverse().map(m=>`<div class="trow"><span>${MON[m.m]} ${m.y}</span><span class="num">${money(m.t)}</span><span class="s">${m.n?VGm.filter(g=>m.g[g[0]]>0).map(g=>`${g[1]} ${money(m.g[g[0]])}`).join(" · "):"No spending"}</span></div>`).join("");
  $("#mnote").textContent=(all.length>12?"Showing the last 12 months. The table has every month. ":"")+(AS.VIEW!=="all"?`${KINDS[AS.VIEW]} only. `:"")+"Tap a bar to see the split.";
}
$("#mtoggle").addEventListener("click",()=>{const t=$("#mtable");t.hidden=!t.hidden;$("#mtoggle").textContent=t.hidden?"Show table":"Show chart";$("#mchart").hidden=!t.hidden;$("#mlg").hidden=!t.hidden});
