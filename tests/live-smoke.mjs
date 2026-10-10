import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,chromium,launchOptions,connect,clickAt} from './browser-helper.mjs';

const url=process.env.LIVE_URL;
if(!url)throw Error('Set LIVE_URL to the deployed Pages URL.');
let a,b;const requestedXML=[];const errors=[];
try{
 a=await chromium.launch(launchOptions);b=await chromium.launch(launchOptions);
 const hc=await a.newContext({viewport:{width:1280,height:1000}}),gc=await b.newContext({viewport:{width:1000,height:900}});
 const host=await hc.newPage(),guest=await gc.newPage();
 for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
 host.on('request',r=>{if(/kro\d+\.xml$/.test(r.url()))requestedXML.push(r.url());});
 await connect(host,guest,url,{relay:true});
 assert.equal(await host.locator('.character-button:not(:disabled)').count(),1);assert.equal(await guest.locator('.character-button:not(:disabled)').count(),1);
 await host.locator('[data-character="1"]').click();await guest.locator('[data-character="2"]').click();
 await host.waitForFunction(()=>!document.querySelector('#useGlasses').disabled);await guest.waitForFunction(()=>document.querySelector('#remoteVideo').readyState>=2);
 // Read public original coordinates; do not replace or instrument the deployed SWF.
 let found=false;
 for(const source of [...new Set(requestedXML)]){
  const xml=await (await host.request.get(source)).text();
  for(const m of xml.matchAll(/<clip\s+rect="(\d+),\s*(\d+),\s*(\d+),\s*(\d+)"/g)){
   const [x,y,w,h]=m.slice(1).map(Number);await clickAt(guest,30+x+w/2,5+y+h/2);await host.waitForTimeout(120);
   if(parseInt(await host.locator('#foundStat').innerText(),10)>0){found=true;break;}
  }
  if(found)break;
 }
 assert.ok(found,'an actual deployed picture was found by 2P');await guest.waitForFunction(()=>parseInt(document.querySelector('#foundStat').textContent,10)>0);
 await host.locator('#inputLayer').focus();await host.keyboard.press('2');await guest.waitForFunction(()=>document.querySelector('#itemStat').textContent==='4개');
 const life=await host.locator('#lifeStat').innerText();await clickAt(guest,270,460);await host.waitForTimeout(200);assert.equal(await host.locator('#lifeStat').innerText(),life);
 await host.waitForFunction(()=>!document.querySelector('#useLife').disabled);await guest.locator('#useLife').click();await host.waitForFunction(()=>document.querySelector('#lifeStat').textContent==='♥ 2');
 await host.locator('#pauseGame').click();await guest.waitForFunction(()=>!document.querySelector('#pauseOverlay').hidden);
 const marker=await guest.locator('#inputLayer').boundingBox();await guest.locator('#pauseGame').click();await guest.mouse.move(marker.x+marker.width*.6,marker.y+marker.height*.35);await host.waitForFunction(()=>!document.querySelector('#cursor1').hidden);assert.match(await host.locator('#cursor1 img').getAttribute('src'),/girl/);
 await host.evaluate(()=>window.scrollTo(0,0));fs.mkdirSync(path.join(root,'scratch'),{recursive:true});await host.screenshot({path:path.join(root,'scratch/deployed-coop.png')});
 await guest.locator('#newGame').click();await host.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='selecting');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({url,connection:'independent Chrome processes; actual invitation and answer relay',originalSWF:'served unmodified from Pages',guestNativeVideo:await guest.evaluate(()=>({width:remoteVideo.videoWidth,height:remoteVideo.videoHeight})),foundBy2P:true,sharedResources:true,lock:true,pause:true,restart:true,errors}));
}finally{await a?.close();await b?.close();}
