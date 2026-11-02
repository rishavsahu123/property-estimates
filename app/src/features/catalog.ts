// @ts-nocheck
// Groups and items: add, rename, hide, delete.
import { KINDS } from "../lib/constants";
import { esc, newId, plural } from "../lib/format";
import { go } from "../app/nav";
import { AS, D, emit, kindTag, saveCatalog, usage, viewGroups } from "../state";
import { $, $$, toast } from "../ui/dom";
import { ask, openSheet } from "../ui/sheets";

export function openItemForm(item,{cat,onSaved}={}){
  if(!D.groups.length){toast("Add a group first");return}
  const it=item||{n:"",sub:"",cat:cat||(viewGroups()[0]||D.groups[0]).k,units:[]};
  const used=item?(usage()[item.k]||0):0;
  const s=openSheet(item?"Edit item":"New item",`
    <label class="lbl" for="if-n">Name</label><input class="field" id="if-n" autocomplete="off" placeholder="e.g. Binding wire" value="${esc(it.n)}">
    <label class="lbl" for="if-g">Group</label>
    <select class="field" id="if-g">${D.groups.map(g=>`<option value="${esc(g.k)}"${g.k===it.cat?" selected":""}>${esc(g.n)} (${g.kind?KINDS[g.kind]:"Unknown"})</option>`).join("")}</select>
    <label class="lbl" for="if-u">Units <span style="font-size:12px">(optional, comma separated)</span></label><input class="field" id="if-u" autocomplete="off" placeholder="e.g. kg, bundle" value="${esc((it.units||[]).join(", "))}">
    <p class="hint">Add units if you want quantity × rate on this item. Leave empty for payments.</p>
    <label class="lbl" for="if-s">Short note under the name <span style="font-size:12px">(optional)</span></label><input class="field" id="if-s" autocomplete="off" placeholder="e.g. 50 kg bag" value="${esc(it.sub||"")}">
    ${item?`<label class="check"><input type="checkbox" id="if-h" ${it.hidden?"checked":""}>Hide from the Add screen</label><p class="hint">Hidden items keep their old entries and totals.</p>`:""}
    <button class="primary" id="if-save">${item?"Save item":"Add item"}</button>
    ${item?(used?`<p class="hint">Used in ${plural(used,"entry","entries")}, so it can’t be deleted. Hide it instead.</p>`:'<button class="danger" id="if-del">Delete item</button>'):""}`);
  if(!item)setTimeout(()=>$("#if-n",s.body).focus(),50);
  $("#if-save",s.body).addEventListener("click",async()=>{
    const n=$("#if-n",s.body).value.trim();if(!n){toast("Type a name for the item");return}
    const dup=D.items.find(i=>i.n.toLowerCase()===n.toLowerCase()&&(!item||i.k!==item.k));
    if(dup){toast(`“${dup.n}” already exists${dup.hidden?" (hidden)":""}`);return}
    const units=[...new Set($("#if-u",s.body).value.split(",").map(u=>u.trim()).filter(Boolean))];
    const o={...(item||{k:newId("i")}),n,cat:$("#if-g",s.body).value,units,sub:$("#if-s",s.body).value.trim()};
    if(item){o.hidden=$("#if-h",s.body).checked;if(!o.hidden)delete o.hidden}
    const i=D.items.findIndex(x=>x.k===o.k);if(i>=0)D.items[i]=o;else D.items.push(o);
    try{await saveCatalog()}catch{toast("Couldn’t save the item.");return}
    s.close();emit();toast(item?"Item saved":"Item added");onSaved&&onSaved(o);
  });
  const del=$("#if-del",s.body);
  if(del)del.addEventListener("click",async()=>{if(!await ask(`Delete the item “${item.n}”?`,"",{ok:"Delete",danger:true}))return;
    D.items=D.items.filter(x=>x.k!==item.k);await saveCatalog();s.close();emit();toast("Item deleted");onSaved&&onSaved(null)});
}
export function openGroupForm(g,{onSaved}={}){
  let kind=g?g.kind:(AS.VIEW!=="all"?AS.VIEW:null);
  const s=openSheet(g?"Edit group":"New group",`
    <label class="lbl" for="gf-n">Group name</label><input class="field" id="gf-n" autocomplete="off" placeholder="e.g. Electrical" value="${esc(g?.n||"")}">
    <span class="lbl">Belongs to</span>
    <div class="seg s2" role="group" aria-label="Belongs to"><button type="button" data-kd="construction">Construction</button><button type="button" data-kd="documents">Documents</button></div>
    <p class="hint">Documents is for land, registry and paperwork. Everything spent on building is Construction.</p>
    <div class="formmsg" id="gf-msg" hidden></div>
    <button class="primary" id="gf-save">${g?"Save group":"Add group"}</button>
    ${g?'<button class="danger" id="gf-del">Delete group</button>':""}`);
  const msg=t=>{const m=$("#gf-msg",s.body);m.textContent=t;m.hidden=!t};
  const paintK=()=>$$("[data-kd]",s.body).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.kd===kind)));
  $$("[data-kd]",s.body).forEach(b=>b.addEventListener("click",()=>{kind=b.dataset.kd;paintK();msg("")}));paintK();
  if(!g)setTimeout(()=>$("#gf-n",s.body).focus(),50);
  $("#gf-save",s.body).addEventListener("click",async()=>{
    const n=$("#gf-n",s.body).value.trim();if(!n){msg("Type a name for the group.");return}
    if(!kind){msg("Choose Construction or Documents.");return}
    const dup=D.groups.find(x=>x.n.toLowerCase()===n.toLowerCase()&&x.k!==g?.k);if(dup){msg(`A group called “${dup.n}” already exists.`);return}
    const o={...(g||{k:newId("g")}),n,kind};
    const i=D.groups.findIndex(x=>x.k===o.k);if(i>=0)D.groups[i]=o;else D.groups.push(o);
    try{await saveCatalog()}catch{msg("Couldn’t save the group.");return}
    s.close();emit();toast(g?"Group saved":"Group added");onSaved&&onSaved(o);
  });
  const del=$("#gf-del",s.body);
  if(del)del.addEventListener("click",async()=>{
    const its=D.items.filter(i=>i.cat===g.k),u=usage(),n=its.reduce((a,i)=>a+(u[i.k]||0),0);
    if(n){msg(`Items in this group are used in ${plural(n,"entry","entries")}. Move those items to another group first (tap an item and change its group), then delete the group.`);return}
    if(!await ask(`Delete the group “${g.n}”${its.length?` and its ${plural(its.length,"item","items")}`:""}?`,"",{ok:"Delete",danger:true}))return;
    D.items=D.items.filter(i=>i.cat!==g.k);D.groups=D.groups.filter(x=>x.k!==g.k);
    await saveCatalog();s.close();emit();toast("Group deleted");onSaved&&onSaved(null);
  });
}
export function openGroups(onChange){
  const s=openSheet("Edit groups","");s.refresh=()=>paint();
  const again=()=>{paint();onChange&&onChange()};
  const paint=()=>{
    const u=usage();
    s.body.innerHTML=`<p class="hint" style="margin-top:0">Each group belongs to Construction or Documents. The switch next to the project name uses this to filter the app. Groups marked Unknown show only under All.</p>`
      +D.groups.map(g=>{const its=D.items.filter(i=>i.cat===g.k);
        return `<div class="grp"><div class="ghead"><span><b>${esc(g.n)}</b> ${kindTag(g.kind)}</span><button class="linkbtn" data-eg="${esc(g.k)}">Edit group</button></div>`
          +(its.length?its.map(i=>`<button class="irow" data-k="${esc(i.k)}"><span><b>${esc(i.n)}</b>${i.hidden?' <span class="tag muted">Hidden</span>':""}<small>${esc([(i.units||[]).length?"Units: "+i.units.join(", "):"No units",u[i.k]?plural(u[i.k],"entry","entries"):""].filter(Boolean).join(" · "))}</small></span><span class="go">Edit</span></button>`).join(""):'<p class="pmeta" style="margin:8px 0">No items yet.</p>')
          +`<button class="linkbtn" data-ni="${esc(g.k)}" style="margin:4px 0">+ Add item</button></div>`}).join("")
      +'<button class="primary" id="gr-new">+ Add new group</button>';
    $$("[data-k]",s.body).forEach(b=>b.addEventListener("click",()=>openItemForm(AS.IM.get(b.dataset.k),{onSaved:again})));
    $$("[data-ni]",s.body).forEach(b=>b.addEventListener("click",()=>openItemForm(null,{cat:b.dataset.ni,onSaved:again})));
    $$("[data-eg]",s.body).forEach(b=>b.addEventListener("click",()=>openGroupForm(AS.GM.get(b.dataset.eg),{onSaved:again})));
    $("#gr-new",s.body).addEventListener("click",()=>openGroupForm(null,{onSaved:again}));
  };
  paint();
}
