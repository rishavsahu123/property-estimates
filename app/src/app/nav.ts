// @ts-nocheck
// Bottom tabs and redraw of the visible screen.
import { dbReady } from "../data/db";
import { renderHome } from "../features/home";
import { openFilters, paintSel, PB, renderBook } from "../features/passbook";
import { renderPeople } from "../features/people";
import { renderSummary } from "../features/summary";
import { renderTrash } from "../features/trash";
import { AS, proj } from "../state";
import { $, $$ } from "../ui/dom";
import { closeMenus } from "../ui/topbar";

export const VIEWS=["add","book","people","sum","trash"];
export function go(v){
  if(!VIEWS.includes(v))v="add";
  if(v!=="book"&&PB.sel){PB.sel=null;paintSel()}
  closeMenus();
  VIEWS.forEach(k=>$("#v-"+k).hidden=k!==v);
  const tab=v==="trash"?"book":v;
  $$("nav.tabs button").forEach(b=>{if(b.dataset.go===tab)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  if(location.hash.slice(1)!==v)history.replaceState(null,"","#"+v);
  window.scrollTo(0,0);renderAll();
}
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
export function renderAll(){
  if(!dbReady())return;
  $("#projname").textContent=proj()?.name||"Project";
  renderHome();
  if(!$("#v-book").hidden)renderBook();
  if(!$("#v-people").hidden)renderPeople();
  if(!$("#v-sum").hidden)renderSummary();
  if(!$("#v-trash").hidden)renderTrash();
  $("#trashlink").textContent=AS.TRASH.length?`Trash (${AS.TRASH.length})`:"Trash";
}
$("#sort").addEventListener("change",renderBook);
$("#openfilters").addEventListener("click",openFilters);
$("#bookmore").addEventListener("click",()=>{PB.limit+=150;renderBook()});
