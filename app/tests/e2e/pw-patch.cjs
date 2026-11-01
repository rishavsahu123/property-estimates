// Auto-accept the app's own confirm box in old tests (they used page.on('dialog') before).
const pw=require('playwright');
const AUTO=`new MutationObserver(()=>{const b=document.querySelector('.cdlg-bg [data-ok]');if(b&&!window.__noAuto)setTimeout(()=>b.click(),30)}).observe(document,{childList:true,subtree:true})`;
const orig=pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch=async(...a)=>{const b=await orig(...a);const nc=b.newContext.bind(b);b.newContext=async(...x)=>{const c=await nc(...x);await c.addInitScript(AUTO);return c};return b};
