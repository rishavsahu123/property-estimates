// @ts-nocheck
// Trash: restore or delete forever.
import { esc, fdate } from "../lib/format";
import { AS, purge, restoreIt } from "../state";
import { $, $$, toast } from "../ui/dom";
import { rowHTML } from "../ui/rows";
import { ask } from "../ui/sheets";

export function renderTrash(){
  const t=AS.TRASH,ul=$("#trash");
  ul.innerHTML=t.length?t.map(e=>rowHTML(e).replace(/<\/button><\/li>$/,`</button><div class="pact" style="padding:0 0 10px 54px"><button class="linkbtn" data-restore="${esc(e.id)}">Restore</button><button class="linkbtn" style="color:var(--debit)" data-purge="${esc(e.id)}">Delete forever</button><span class="pmeta">Deleted ${fdate(e.deletedAt)}</span></div></li>`)).join("")
    :'<li class="empty">Trash is empty.</li>';
  $$(".entry",ul).forEach(b=>b.disabled=true);
  $("#emptytrash").hidden=!t.length;
  const find=id=>AS.TRASH.find(x=>x.id===id);
  $$("[data-restore]",ul).forEach(b=>b.addEventListener("click",async()=>{const e=find(b.dataset.restore);if(!e)return;
    try{await restoreIt(e);toast("Entry restored")}catch{toast("Couldn’t restore. Try again.")}}));
  $$("[data-purge]",ul).forEach(b=>b.addEventListener("click",async()=>{const e=find(b.dataset.purge);if(!e)return;
    if(!await ask("Delete this entry forever?","It can’t be recovered after this.",{ok:"Delete forever",danger:true}))return;
    try{await purge(e);toast("Deleted forever")}catch{toast("Couldn’t delete. Try again.")}}));
}
$("#emptytrash").addEventListener("click",async()=>{
  const t=[...AS.TRASH];if(!t.length||!await ask(`Delete all ${t.length} entries in trash forever?`,"They can’t be recovered.",{ok:"Delete forever",danger:true}))return;
  try{for(const e of t)await purge(e);toast("Trash emptied")}catch{toast("Couldn’t empty trash. Try again.")}
});
