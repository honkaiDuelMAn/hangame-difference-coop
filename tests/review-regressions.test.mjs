import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,chromium,launchOptions,serve,connect,clickAt,nativeCall,target} from './browser-helper.mjs';

test('native clicks survive short scrolled windows; pause reasons and current-run readiness stay authoritative',{timeout:90000},async()=>{
 const local=await serve();let a,b;const failures=[];
 const check=(condition,label)=>{if(!condition)failures.push(label);};
 try{
  a=await chromium.launch(launchOptions);b=await chromium.launch(launchOptions);
  const host=await a.newPage({viewport:{width:1280,height:720}}),guest=await b.newPage({viewport:{width:1280,height:1000}});
  await host.route('**/game/game-coop.swf',r=>r.fulfill({contentType:'application/x-shockwave-flash',body:fs.readFileSync(path.join(root,'public/game/game-coop-probe.swf'))}));
  await connect(host,guest,local.url);
  await host.locator('[data-character="1"]').click();await guest.locator('[data-character="2"]').click();
  await host.waitForFunction(()=>!document.querySelector('#useGlasses').disabled);
  await host.locator('#useGlasses').click();await host.waitForTimeout(400);
  check((await nativeCall(host,'coopSnapshot')).item===4,'short-window glasses button must reach native item');
  await host.waitForTimeout(1100);await host.locator('#useLife').click();await host.waitForTimeout(400);
  check((await nativeCall(host,'coopSnapshot')).life===2,'short-window life button must reach native item');
  await host.locator('#inputLayer').scrollIntoViewIfNeeded();
  const scrollBefore=await host.evaluate(()=>scrollY);const p=await target(host,0);await clickAt(host,p.x,p.y);await host.waitForTimeout(400);
  check((await nativeCall(host,'coopSnapshot')).find===1,'scrolled native target must match pencil coordinates');
  check(Math.abs(await host.evaluate(()=>scrollY)-scrollBefore)<2,'native input must preserve page scroll');
  await host.setViewportSize({width:1280,height:1000});
  await host.locator('#pauseGame').click();await guest.waitForFunction(()=>!document.querySelector('#pauseOverlay').hidden);
  const paused=(await nativeCall(host,'coopSnapshot')).time;await host.waitForTimeout(2000);
  await guest.locator('#pauseGame').click();await host.waitForFunction(()=>document.querySelector('#pauseOverlay').hidden);await host.waitForTimeout(350);
  check(paused-(await nativeCall(host,'coopSnapshot')).time<1,'paused duration must not be deducted after resume');
  await host.evaluate(()=>{window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});document.dispatchEvent(new Event('visibilitychange'));});
  await guest.waitForFunction(()=>!document.querySelector('#pauseOverlay').hidden);await guest.locator('#pauseGame').click();await host.waitForTimeout(250);
  check(!(await host.locator('#pauseOverlay').evaluate(el=>el.hidden)),'guest cannot resume while host is hidden');
  await host.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await host.waitForTimeout(150);
  // A manual pause must survive a subsequent hide and return.
  if(await host.locator('#pauseOverlay').evaluate(el=>el.hidden))await host.locator('#pauseGame').click();
  await host.evaluate(()=>{window.testHidden=true;document.dispatchEvent(new Event('visibilitychange'));window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await host.waitForTimeout(150);
  check(!(await host.locator('#pauseOverlay').evaluate(el=>el.hidden)),'host returning must preserve a manual pause');
  const oldRun=await host.locator('#stage').getAttribute('data-run');await guest.locator('#newGame').click();await host.waitForFunction(old=>document.querySelector('#stage').dataset.run!==old,oldRun);
  await host.evaluate(async run=>{const app=await import('./app.mjs');app.receive({type:'select',run,character:2});},oldRun);await host.waitForTimeout(150);
  check(await host.locator('#player1Name').innerText()==='캐릭터 선택 중','stale prior-run select must not mark guest ready');
  await host.locator('[data-character="1"]').click();await host.waitForTimeout(100);
  check(await host.locator('#stage').getAttribute('data-phase')==='selecting','both current-run ready requests are required');
  await guest.locator('[data-character="2"]').click();await host.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='playing');
  assert.deepEqual(failures,[]);
 }finally{await a?.close();await b?.close();await new Promise(r=>local.server.close(r));}
});
