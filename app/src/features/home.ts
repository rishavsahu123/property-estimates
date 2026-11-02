// @ts-nocheck
// Home: total card, recent entries, backup note.
import { KINDS } from "../lib/constants";
import { money, fdate, inWords } from "../lib/format";
import { AS } from "../state";
import { $, lget } from "../ui/dom";
import { bindRows, rowHTML, sums } from "../ui/rows";

export function backupNote(){
  const last=lget("ghk-backup",0),n=AS.LIVE.length;
  $("#status").textContent=!n?"Everything is saved only on this phone.":last?`Saved on this phone. Last backup ${fdate(last)}.`:"Saved on this phone. No backup yet, save one from the download button at the top.";
  $("#lastbackup").textContent=last?`Last backup: ${fdate(last)}`:"No backup taken yet.";
}

export function renderHome(){
  backupNote();const t=sums(AS.LIVE);
  $("#h-label").textContent=AS.VIEW==="all"?"Total spent so far":`${KINDS[AS.VIEW]} spent so far`;
  $("#h-total").textContent=money(t.t);$("#h-words").textContent=t.t?inWords(t.t):"";$("#h-cash").textContent=money(t.c);$("#h-online").textContent=money(t.o);
  const r=AS.LIVE.slice(0,5);
  $("#recent").innerHTML=r.length?r.map(e=>rowHTML(e)).join(""):'<li class="empty">Your entries will show here.</li>';
  bindRows($("#recent"));
}
