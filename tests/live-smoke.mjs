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
 await host.locator('#chatInput').fill('함께 찾아요 Hello 123');await host.locator('#chatInput').press('Enter');await guest.waitForFunction(()=>document.querySelector('#chatMessages').textContent.includes('함께 찾아요 Hello 123'));
 await guest.locator('#chatInput').fill('좋아요 ABC 456');await guest.locator('#chatSend').click();await host.waitForFunction(()=>document.querySelector('#chatMessages').textContent.includes('좋아요 ABC 456'));
 const linkSizes={};
 for(const [kind,page] of [['invite',host],['answer',guest]]){
  linkSizes[kind]=await page.evaluate(async kind=>{
   const {readConnectionLink,makeConnectionLink}=await import('./net/connection-link.mjs');
   const {decodeCode,encodeCode}=await import('./net/connection-code.mjs');
   const link=document.querySelector('#outputLink').value,{code}=readConnectionLink(link,location.href);
   const old=makeConnectionLink(await encodeCode(await decodeCode(code),{format:2}),kind,location.href);
   return {current:link.length,previous:old.length,compact:code.startsWith('HG3-')};
  },kind);
  assert.equal(linkSizes[kind].compact,true);assert.ok(linkSizes[kind].current<linkSizes[kind].previous*.5);
 }
 assert.equal(await host.locator('.character-button:not(:disabled)').count(),1);assert.equal(await guest.locator('.character-button:not(:disabled)').count(),1);
 await host.locator('[data-character="1"]').click();await guest.locator('[data-character="2"]').click();
 await host.waitForFunction(()=>!document.querySelector('#useGlasses').disabled);await guest.waitForFunction(()=>document.querySelector('#remoteVideo').readyState>=2);
 // Volume is local to each listener, including after the ready sound unlock.
 await host.locator('#volume').focus();await host.keyboard.press('Home');
 assert.equal(await host.locator('#volumeValue').innerText(),'음소거');
 await guest.locator('#volume').focus();await guest.keyboard.press('End');
 assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.volume),1);
 await guest.keyboard.press('Home');assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.muted),true);
 await guest.keyboard.press('End');await guest.locator('#enableSound').click();
 assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.volume),1);assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.muted),false);
 assert.equal(await host.locator('#volume').inputValue(),'0');
 // Read public original coordinates; do not replace or instrument the deployed SWF.
 let found=false,matchedSource=null;
 for(const source of [...new Set(requestedXML)]){
  const xml=await (await host.request.get(source)).text();
  for(const m of xml.matchAll(/<clip\s+rect="(\d+),\s*(\d+),\s*(\d+),\s*(\d+)"/g)){
   const [x,y,w,h]=m.slice(1).map(Number);await clickAt(guest,30+x+w/2,5+y+h/2);await host.waitForTimeout(120);
   if(parseInt(await host.locator('#foundStat').innerText(),10)>0){found=true;matchedSource=source;break;}
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
 let nextResult=false;
 if(process.env.FULL_NEXT==='1'){
  const state=()=>host.evaluate(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot'));
  for(let picture=0;picture<4;picture++){
   await host.waitForFunction(()=>{const s=document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot');return s.mode==='puzzle'&&s.enabled;},null,{timeout:15000});
   const current=await state();await guest.waitForFunction(epoch=>document.querySelector('#stage').dataset.epoch===epoch,current.epoch);
   // The original preloads the next picture, so the last requested XML is ahead
   // of the currently displayed stage. Follow its native request order instead.
   const source=requestedXML[requestedXML.indexOf(matchedSource)+picture],xml=await (await host.request.get(source)).text();
   for(const m of xml.matchAll(/<clip\s+rect="(\d+),\s*(\d+),\s*(\d+),\s*(\d+)"/g)){
    if((await state()).epoch!==current.epoch||(await state()).find===5)break;
    await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').enabled,null,{timeout:4000});
    const [x,y,w,h]=m.slice(1).map(Number);await clickAt(guest,30+x+w/2,8+y+h/2);await host.waitForTimeout(200);
   }
   assert.ok((await state()).find===5||(await state()).epoch!==current.epoch,'public picture '+current.stage+' completes from original coordinates');
   console.log('public picture complete',current.level,current.stage);
  }
  await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').mode==='mini-intro',null,{timeout:12000});await host.waitForTimeout(1700);await clickAt(guest,550,430);
  await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').mode==='mini',null,{timeout:8000});
  await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').mode==='result',null,{timeout:50000});
  await guest.waitForFunction(()=>document.querySelector('#stage').dataset.epoch.startsWith('result:'));
  for(let i=0;i<25&&(await state()).level===1;i++){await clickAt(guest,480,450);await host.waitForTimeout(400);}
  await host.waitForFunction(()=>{const s=document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot');return s.level===2&&s.stage===1&&s.mode==='puzzle'&&s.enabled&&s.find===0&&s.time>0;},null,{timeout:12000});
  nextResult=true;
 }
 await guest.locator('#newGame').click();await host.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='selecting');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({url,connection:'independent Chrome processes; actual invitation and answer relay',linkSizes,originalSWF:'served unmodified from Pages',guestNativeVideo:await guest.evaluate(()=>({width:remoteVideo.videoWidth,height:remoteVideo.videoHeight})),chat:'Korean, English, digits; bidirectional',volume:'independent slider, mute and sound unlock',nextResult,foundBy2P:true,sharedResources:true,lock:true,pause:true,restart:true,errors}));
}finally{await a?.close();await b?.close();}
