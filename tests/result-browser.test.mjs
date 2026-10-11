import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {root,chromium,launchOptions,serve,connect,clickAt,nativeCall} from './browser-helper.mjs';

// A genuine native minigame finish must reach its original result/NEXT flow.
test('bonus shooting failure and success let either player press NEXT and continue the next puzzle',{timeout:150000},async()=>{
 const local=await serve();let a,b;
 try{
  a=await chromium.launch(launchOptions);b=await chromium.launch(launchOptions);
  const host=await a.newPage({viewport:{width:1280,height:1000}}),guest=await b.newPage({viewport:{width:1280,height:1000}});
  await host.route('**/game/game-coop.swf',r=>r.fulfill({contentType:'application/x-shockwave-flash',body:fs.readFileSync(path.join(root,'public/game/game-coop-probe.swf'))}));
  await connect(host,guest,local.url);await host.locator('[data-character="1"]').click();await guest.locator('[data-character="2"]').click();await host.waitForFunction(()=>!document.querySelector('#useGlasses').disabled);
  for(const level of [1,2]){
   for(let stage=1;stage<=4;stage++){
    await host.waitForFunction(({level,stage})=>{const s=document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot');return s.level===level&&s.stage===stage&&s.mode==='puzzle'&&s.enabled;},{level,stage},{timeout:10000});
    for(let find=0;find<5;find++){
     const state=await nativeCall(host,'probeState'),box=state.boxes.find(b=>!b.ok);assert.ok(box);
     await clickAt(host,(box.bounds.xMin+box.bounds.xMax)/2,(box.bounds.yMin+box.bounds.yMax)/2);
     await host.waitForFunction(want=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').find>=want,find+1,{timeout:2500});
    }
   }
   await host.waitForFunction(()=>{const s=document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot');return s.mode==='mini-intro'&&!s.epoch.includes('undefined');},null,{timeout:10000});
   let intro=await nativeCall(host,'coopSnapshot');console.log('native intro',intro.epoch);
   const clip=intro.epoch.includes('minigame_mc2')?'minigame_mc2':'minigame_mc';
   await host.waitForTimeout(1700);await clickAt(host,550,430);
   await host.waitForFunction(()=>{const s=document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot');return s.mode==='mini'&&s.enabled;});
   if(level===1){const limit=await nativeCall(host,'probeRead',`_root.${clip}.timeLimit`);await nativeCall(host,'probeSet',`_root.${clip}`,'time',limit+1);}
   else await nativeCall(host,'probeCall',`_root.${clip}`,'onGameClear');
   await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('probeRead','_root.popup_mc.mc.next_btn._visible')===true,null,{timeout:12000});
   const before=await nativeCall(host,'coopSnapshot');await host.screenshot({path:'scratch/native-result-'+level+'.png',fullPage:true});
   console.log('native result',before);
   const nextPlayer=level===1?host:guest;
   await guest.waitForFunction(epoch=>document.querySelector('#stage').dataset.epoch===epoch,before.epoch);
   await clickAt(nextPlayer,100,100);await host.waitForTimeout(150);assert.equal((await nativeCall(host,'coopSnapshot')).level,level,'outside result click cannot skip');
   await clickAt(nextPlayer,480,450);
   await host.waitForFunction(level=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').level===level,level+1,{timeout:3500});
   assert.equal((await nativeCall(host,'coopSnapshot')).item,before.item,'NEXT must not use glasses');
   await guest.waitForFunction(level=>document.querySelector('#stage').dataset.epoch.includes(':'+level+':1:'),level+1);
   await host.waitForFunction(level=>{const s=document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot');return s.level===level&&s.stage===1&&s.mode==='puzzle'&&s.enabled&&s.find===0&&s.time>0;},level+1,{timeout:10000});
  }
 }catch(error){for(const p of a?.contexts().flatMap(c=>c.pages())||[]){console.log('result failure',await nativeCall(p,'coopSnapshot'),await p.locator('#gameNotice').innerText());await p.screenshot({path:'scratch/real-result-failure.png',fullPage:true});}throw error;}
 finally{await a?.close();await b?.close();await new Promise(r=>local.server.close(r));}
});
