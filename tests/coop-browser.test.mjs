import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,chromium,launchOptions,serve,connect,clickAt,nativeCall,target} from './browser-helper.mjs';

test('actual Flash co-op: reservation, shared finds, colored rings, cursors, items, clocks, minigame ammo and restart',{timeout:120000},async()=>{
 const local=await serve();let a,b;
 try{
  a=await chromium.launch(launchOptions);b=await chromium.launch(launchOptions);
  const hostContext=await a.newContext({viewport:{width:1280,height:1000}}),guestContext=await b.newContext({viewport:{width:1280,height:1000}});
  const host=await hostContext.newPage(),guest=await guestContext.newPage();const errors=[],external=[];
  for(const p of [host,guest]){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(local.url)&&!r.url().startsWith('data:'))external.push(r.url());});}
  await host.route('**/game/game-coop.swf',r=>r.fulfill({contentType:'application/x-shockwave-flash',body:fs.readFileSync(path.join(root,'public/game/game-coop-probe.swf'))}));
  await connect(host,guest,local.url,{relay:true});
  assert.equal(await host.locator('.character-button:not(:disabled)').count(),1);
  await host.locator('[data-character="1"]').click();assert.equal(await guest.locator('[data-character="1"]').isDisabled(),true);assert.equal(await host.locator('#stage').getAttribute('data-phase'),'selecting');
  await guest.locator('[data-character="2"]').click();await host.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='playing');await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').enabled===true);
  await guest.waitForFunction(()=>document.querySelector('#remoteVideo').videoWidth>0);assert.equal(await guest.locator('ruffle-player').count(),0,'one original world is shared');
  let p=await target(host,0);await clickAt(host,p.x,p.y);await host.waitForFunction(()=>document.querySelector('#foundStat').textContent==='1 / 5');await guest.waitForFunction(()=>document.querySelector('#foundStat').textContent==='1 / 5');
  p=await target(host,1);await clickAt(guest,p.x,p.y);await host.waitForFunction(()=>document.querySelector('#foundStat').textContent==='2 / 5');
  assert.equal(await nativeCall(host,'probeRead','_global.Framework.logic.im.ef1.success_2.transform.colorTransform.blueOffset'),255);
  assert.equal(await nativeCall(host,'probeRead','_global.Framework.logic.im.ef1.success_2.transform.colorTransform.redOffset'),22);
  p=await target(host,2);await Promise.all([clickAt(host,p.x,p.y),clickAt(guest,p.x,p.y)]);await host.waitForFunction(()=>document.querySelector('#foundStat').textContent==='3 / 5');await host.waitForTimeout(180);assert.equal(await nativeCall(host,'probeRead','_global.Framework.status.find'),3);
  const bounds=await guest.locator('#stage').boundingBox();await guest.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.33);await host.waitForFunction(()=>!document.querySelector('#cursor1').hidden&&parseFloat(document.querySelector('#cursor1').style.left)>64);assert.match(await host.locator('#cursor1 img').getAttribute('src'),/girl/);
  // Button, keyboard and original HUD coordinates must use the same item lock.
  await host.locator('#inputLayer').focus();await host.keyboard.press('2');await host.waitForFunction(()=>document.querySelector('#itemStat').textContent==='4개');await clickAt(guest,270,460);await host.waitForTimeout(180);assert.equal(await nativeCall(host,'probeRead','_global.Framework.status.life'),3);
  await host.waitForTimeout(1050);await guest.locator('#useLife').click();await host.waitForFunction(()=>document.querySelector('#lifeStat').textContent==='♥ 2');assert.equal(await guest.locator('#lifeStat').innerText(),'♥ 2');
  await host.locator('#pauseGame').click();await guest.waitForFunction(()=>!document.querySelector('#pauseOverlay').hidden);const time=await nativeCall(host,'coopSnapshot');await host.waitForTimeout(1100);assert.equal((await nativeCall(host,'coopSnapshot')).time,time.time);await guest.locator('#pauseGame').click();await host.waitForFunction(()=>document.querySelector('#pauseOverlay').hidden);
  // Finish the real first picture and verify the stage transition reaches both.
  for(let attempt=0;attempt<5;attempt++){
    const current=await nativeCall(host,'probeState');if(current.stage!==1||current.find===5)break;
    const remaining=current.boxes.find(box=>!box.ok);assert.ok(remaining,'a native unfound difference remains');
    await clickAt(guest,(remaining.bounds.xMin+remaining.bounds.xMax)/2,(remaining.bounds.yMin+remaining.bounds.yMax)/2);await host.waitForTimeout(130);
  }
  await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').stage===2,null,{timeout:8000});await guest.waitForFunction(()=>document.querySelector('#stage').dataset.epoch.includes(':1:2:'));
  // The stage number changes before its loading/entrance animation finishes.
  // Do not force the diagnostic minigame entry during that native transition.
  await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').enabled===true);
  // Enter both original embedded minigames; only this test probe changes entry.
  for(const kind of ['showMinigame','showMinigame2']){
    await nativeCall(host,'probeCall','_global.Framework.ui',kind,1);await host.waitForTimeout(1700);
    await clickAt(host,100,100);await host.waitForTimeout(120);assert.equal((await nativeCall(host,'coopSnapshot')).mode,'mini-intro','an outside click cannot start the minigame');
    await clickAt(host,550,430);await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').mode==='mini'&&document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').enabled===true);
    const before=await nativeCall(host,'coopSnapshot');assert.ok(before.bullets[0]>0);assert.equal(before.bullets[0],before.bullets[1]);
    await guest.waitForFunction(epoch=>document.querySelector('#stage').dataset.epoch===epoch,before.epoch);
    await clickAt(guest,315,220);await host.waitForFunction(old=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').bullets[1]===old-1,before.bullets[1],{timeout:5000});
    let after=await nativeCall(host,'coopSnapshot');assert.equal(after.bullets[0],before.bullets[0]);
    await host.locator('#reloadGun').click();await host.waitForTimeout(160);after=await nativeCall(host,'coopSnapshot');assert.equal(after.bullets[1],before.bullets[1]-1,'host reload leaves guest ammunition alone');
    await guest.locator('#reloadGun').click();await host.waitForFunction(old=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').bullets[1]===old,before.bullets[1]);
    if(kind==='showMinigame')await nativeCall(host,'probeCall','_root.minigame_mc','hideAll');
  }
  await guest.locator('#newGame').click();await host.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='selecting');await guest.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='selecting');assert.equal(await host.locator('.character-button:not(:disabled)').count(),1);await host.locator('[data-character="1"]').click();await guest.locator('[data-character="2"]').click();await host.waitForFunction(()=>document.querySelector('ruffle-player').ruffle().callExternalInterface('coopSnapshot').enabled===true);assert.equal((await nativeCall(host,'coopSnapshot')).life,3);
  await guest.locator('#leaveRoom').click();await host.waitForFunction(()=>!document.querySelector('#pauseOverlay').hidden);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS real original game, direct media, native blue/red marks, input locks, both original minigames, personal bullets, shared pause and restart.');
 }catch(error){
  for(const context of a?.contexts()||[])for(const page of context.pages())await page.screenshot({path:path.join(root,'scratch/coop-failure.png'),fullPage:true}).catch(()=>{});
  for(const context of a?.contexts()||[])for(const page of context.pages())console.log('failure state',await nativeCall(page,'coopSnapshot').catch(()=>null),await nativeCall(page,'probeCursor').catch(()=>null),await page.evaluate(()=>({epoch:document.querySelector('#stage').dataset.epoch,notice:document.querySelector('#gameNotice').textContent,message:document.querySelector('#message').textContent})).catch(()=>null));
  throw error;
 }finally{await a?.close();await b?.close();await new Promise(r=>local.server.close(r));}
});
