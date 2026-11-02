// @ts-nocheck
// Projects: switch, rename, add, delete.
import { esc, money, newId, plural } from "../lib/format";
import { dbPut, dbDel } from "../data/db";
import { resetAdd } from "./entry-form";
import { PB } from "./passbook";
import { AS, blankF, D, emit, proj } from "../state";
import { $, $$, lset, toast } from "../ui/dom";
import { sums } from "../ui/rows";
import { ask, openSheet } from "../ui/sheets";

export function openProjects(){
  const s=openSheet("Projects","");s.refresh=()=>paint();
  const paint=()=>{
    const cur=proj();
    s.body.innerHTML=D.projects.map(p=>{const es=D.entries.filter(e=>e.projectId===p.id&&!e.deletedAt);
      return `<button class="prow" data-p="${esc(p.id)}" aria-current="${p.id===D.pid}"><span><b>${esc(p.name)}</b><small>${plural(es.length,"entry","entries")}${p.id===D.pid?" · open now":""}</small></span><span class="num">${money(sums(es).t)}</span></button>`}).join("")
      +`<span class="lbl">Rename “${esc(cur.name)}”</span><div class="tools"><input class="field" id="pj-r" value="${esc(cur.name)}" autocomplete="off"><button class="fbtn" id="pj-rs">Save</button></div>
      <span class="lbl">Start a new project</span><div class="tools"><input class="field" id="pj-n" placeholder="e.g. Second floor rent flat" autocomplete="off"><button class="fbtn" id="pj-ns">Create</button></div>
      <p class="hint">Each project has its own entries and totals. Items and contacts are shared.</p>
      ${D.projects.length>1&&!D.entries.some(e=>e.projectId===cur.id)?'<button class="danger" id="pj-del">Delete this empty project</button>':""}`;
    $$("[data-p]",s.body).forEach(b=>b.addEventListener("click",()=>{switchProject(b.dataset.p);s.close()}));
    $("#pj-rs",s.body).addEventListener("click",async()=>{const n=$("#pj-r",s.body).value.trim();if(!n){toast("Type a name");return}
      const p={...cur,name:n};await dbPut("projects",p);D.projects[D.projects.findIndex(x=>x.id===p.id)]=p;emit();paint();toast("Project renamed")});
    $("#pj-ns",s.body).addEventListener("click",async()=>{const n=$("#pj-n",s.body).value.trim();if(!n){toast("Type a name for the new project");return}
      const p={id:newId("p"),name:n,createdAt:Date.now()};await dbPut("projects",p);D.projects.push(p);switchProject(p.id);s.close();toast(`Started ${n}`)});
    const del=$("#pj-del",s.body);
    if(del)del.addEventListener("click",async()=>{if(!await ask(`Delete the project “${cur.name}”?`,"",{ok:"Delete",danger:true}))return;
      await dbDel("projects",cur.id);D.projects=D.projects.filter(p=>p.id!==cur.id);switchProject(D.projects[0].id);paint();toast("Project deleted")});
  };
  paint();
}
export function switchProject(id){D.pid=id;lset("pe-project",id);AS.F=blankF();PB.limit=150;emit();resetAdd()}
$("#projbtn").addEventListener("click",openProjects);
