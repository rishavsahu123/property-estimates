// Built-in items, groups and labels.
import type { Group, Item, Kind } from "../types";

export const APP = "property-estimates";
/** app ids accepted in backup files (old name included) */
export const OLD_APPS = ["property-estimates", "ghar-ka-hisaab"];
export const DEFAULT_ITEMS: Item[] = [
  {k:"cement",n:"Cement",sub:"50 kg bag",cat:"material",units:["bag"]},
  {k:"gitti",n:"Gitti",sub:"cu m, brass",cat:"material",units:["cu m","cu ft","brass","ton","trolley"]},
  {k:"reti",n:"Reti",sub:"cu ft, brass",cat:"material",units:["cu ft","brass","trolley","ton"]},
  {k:"brick",n:"Bricks",sub:"per piece",cat:"material",units:["piece","1000 pcs","trolley"]},
  {k:"tmt",n:"TMT saria",sub:"kg, ton",cat:"material",units:["kg","quintal","ton"]},
  {k:"thekedar",n:"Thekedar",sub:"contractor",cat:"people",units:[]},
  {k:"engineer",n:"Engineer",sub:"civil engineer",cat:"people",units:[]},
  {k:"chowkidar",n:"Chowkidar",sub:"site guard",cat:"people",units:[]},
  {k:"land",n:"Land",sub:"plot cost",cat:"land",units:[]},
  {k:"registry",n:"Registry",sub:"stamp duty, papers",cat:"land",units:[]}
];
export const DEFAULT_GROUPS: Group[] = [{k:"material",n:"Material",kind:"construction"},{k:"people",n:"Payments to people",kind:"construction"},{k:"land",n:"Land and documents",kind:"documents"}];
export const KINDS: Record<Kind, string> = {construction:"Construction",documents:"Documents"};
export const RANGES: [string, string][] = [["all","All time"],["week","Last 7 days"],["month","This month"],["lastmonth","Last month"],["custom","Custom dates"]];

