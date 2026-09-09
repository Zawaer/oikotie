// Capture the real pages used as tiles in the hand-made promo collage, into
// dist/store/tiles/. The collage itself is composed in Figma; this just keeps
// the raw material reproducible, since a service restyling its login page is
// the likeliest reason to redo the image.
//
// Left/centre of the collage: the three service login pages, the MPASSid
// picker and the school ADFS page (all reachable without credentials), plus
// the popup. The logged-in dashboards for the right-hand column need a real
// account and are captured by hand.
//
//   node scripts/build-promo-tiles.mjs
import { COMMON_SCRIPTS, TEST_ADFS_DOMAIN, launchBrowser, installExtensionStubs, injectScripts, defaultSettings }
  from '../tests/harness.mjs';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const T=path.join(ROOT,'dist','store','tiles');
mkdirSync(T,{recursive:true});
const browser=await launchBrowser(['--allow-file-access-from-files','--lang=fi-FI']);
const settle=(ms)=>new Promise(r=>setTimeout(r,ms));

async function plain(name,url,wait=3000){
  const p=await browser.newPage(); await p.setViewport({width:1280,height:800,deviceScaleFactor:1});
  await installExtensionStubs(p);
  try{await p.goto(url,{waitUntil:'networkidle2',timeout:45000});}catch(e){}
  await settle(wait);
  // dismiss Studeo cookie banner if present
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>/necessary only|vain välttämättömät|hyväksy/i.test(e.textContent||''));if(b)b.click();}).catch(()=>{});
  await settle(600);
  await p.screenshot({path:`${T}/${name}.png`}); console.log('tile',name); await p.close();
}
await plain('kampus','https://kirjautuminen.sanomapro.fi/sso/XUI/?realm=%2Fratkoo',6000);
await plain('nova','https://nova.otava.fi/login/student');
await plain('studeo','https://app.studeo.fi/auth/login');

// MPASSid picker and Espoo ADFS: ride the Kampus flow.
{
  const p=await browser.newPage(); await p.setViewport({width:1280,height:800,deviceScaleFactor:1});
  const stubs=await installExtensionStubs(p); stubs.local.loginFlow={service:'kampus',startedAt:Date.now()};
  let mpassShot=false;
  const MATCH=[['kirjautuminen.sanomapro.fi','scripts/kampus-login-content.js'],['mpass-proxy.csc.fi','scripts/mpass-content.js']];
  p.on('load',async()=>{try{
    const h=new URL(p.url()).hostname;
    if(h==='mpass-proxy.csc.fi'&&!mpassShot){ await p.waitForSelector('#searchschoolterm',{timeout:20000}); await settle(1500);
      await p.screenshot({path:`${T}/mpass.png`}); mpassShot=true; console.log('tile mpass'); }
    const m=MATCH.find(([host])=>host===h); if(m) await injectScripts(p,[...COMMON_SCRIPTS,m[1]]);
  }catch(e){}});
  await p.goto('https://kampus.sanomapro.fi/',{waitUntil:'domcontentloaded',timeout:45000});
  for(let i=0;i<120&&!p.url().includes(TEST_ADFS_DOMAIN);i++) await settle(500);
  await settle(2500);
  await p.screenshot({path:`${T}/espoo.png`}); console.log('tile espoo'); await p.close();
}
// Popup at 2x.
{
  const p=await browser.newPage(); await p.setViewport({width:300,height:580,deviceScaleFactor:2});
  await installExtensionStubs(p,{sync:{...defaultSettings(),language:'fi'}});
  await p.evaluateOnNewDocument((root)=>{chrome.runtime.getURL=(x)=>`file://${root}/${x}`;chrome.runtime.getManifest=()=>({version:'3.0'});},ROOT);
  await p.goto(`file://${ROOT}/ui/popup.html`,{waitUntil:'networkidle0'}); await settle(900);
  await p.screenshot({path:`${T}/popup.png`,fullPage:true}); console.log('tile popup'); await p.close();
}
await browser.close();
