// @ts-nocheck
// Passbook row markup shared by every list.
import { esc, money, numfmt, MON } from "../lib/format";
import { openView, otherNames } from "../features/entry-form";
import { attachIcons } from "../features/files";
import { ICON } from "../features/people";
import { D, itemName } from "../state";
import { $$ } from "./dom";

export function rowHTML(e,bal,sel,acts,opt={}){
  const d=new Date(e.ts),name=itemName(e),bits=[];
  if(e.qty)bits.push(`${numfmt.format(e.qty)} ${esc(e.unit||"")}${e.rate?` @ ${money(e.rate)}`:""}`);
  if(e.vendor&&!opt.noVendor)bits.push(esc(e.vendor));
  const on=otherNames(e);if(on.length)bits.push("with "+esc(on.join(", ")));
  const dli=e.dealId&&D.deals.find(x=>x.id===e.dealId);if(dli&&!opt.noDeal)bits.push("deal: "+esc(dli.title));
  const mode=e.cash&&e.online?`<span class="tag cash">Cash ${money(e.cash)}</span><br><span class="tag online">Online ${money(e.online)}</span>`
    :e.cash?'<span class="tag cash">Cash</span>':'<span class="tag online">Online</span>';
  return `<li><button class="entry" data-id="${esc(e.id)}"${sel==null?"":` aria-pressed="${!!sel}"`}>
    <span class="ck" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
    <span class="dt"><span class="d">${d.getDate()}</span><span class="m">${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}</span></span>
    <span class="part"><span class="t">${name?esc(name):'<span class="missing">Set item</span>'}</span>
      <span class="s" style="display:block">${bits.join(", ")}</span>
      ${e.note?`<span class="rnote">${esc(e.note)}</span>`:""}
      ${attachIcons(e)}</span>
    <span class="amt"><span class="num">${money(e.amount)}</span><br>${mode}${bal!=null?`<span class="bal">Total ${money(bal)}</span>`:""}</span>
  </button>${acts?`<div class="ract"><button class="ib" data-ra="share" data-id="${esc(e.id)}" aria-label="Share receipt">${ICON.share}</button><button class="ib" data-ra="edit" data-id="${esc(e.id)}" aria-label="Edit entry">${ICON.edit}</button><button class="ib red" data-ra="del" data-id="${esc(e.id)}" aria-label="Move to trash">${ICON.trash}</button></div>`:""}</li>`;
}
export function bindRows(ul){$$(".entry",ul).forEach(b=>b.addEventListener("click",()=>openView(b.dataset.id)))}
export const sums=list=>{let t=0,c=0;list.forEach(e=>{t+=+e.amount||0;c+=+e.cash||0});return{t,c,o:t-c}};
