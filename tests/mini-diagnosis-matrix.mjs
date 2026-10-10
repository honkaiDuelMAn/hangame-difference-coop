import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root, chromium, launchOptions, serve, nativeCall} from './browser-helper.mjs';

const own = path.join(root,'scratch/mini-diagnosis');
const local = await serve();
const browser = await chromium.launch(launchOptions);
const results = [];
try {
 const page = await browser.newPage({viewport:{width:900,height:700}});
 await page.route('**/game/probe-game.swf', route => route.fulfill({contentType:'application/x-shockwave-flash',body:fs.readFileSync(path.join(own,'mini-probe.swf'))}));
 await page.goto(local.url+'tests/probe.html');
 await page.waitForFunction(()=>window.probeReady==='ready');
 await page.waitForTimeout(1000);
 await nativeCall(page,'probeSet','_root','start',true);
 await nativeCall(page,'probeSet','_global.Framework.logic','characterCode',1);
 await nativeCall(page,'miniCallExact','_global.Framework.ui','showMain',[]);
 await page.waitForTimeout(1700);
 for(const kind of (process.argv.includes('--only2')?['showMinigame2']:['showMinigame','showMinigame2'])) for(const mode of ['visible','hidden','transparent']) {
   const m = kind==='showMinigame'?'_root.minigame_mc':'_root.minigame_mc2';
   await nativeCall(page,'miniCallExact','_global.Framework.ui',kind,[1]);
   await page.waitForTimeout(1700);
   await page.mouse.click(550,430,{delay:50});
   await page.waitForFunction(m=>player.ruffle().callExternalInterface('probeRead',m+'.clickEnabled')===true,m,{timeout:8000});
   await nativeCall(page,'probeSet',m+'.cursor_mc','_visible',mode!=='hidden');
   await nativeCall(page,'probeSet',m+'.cursor_mc','_alpha',mode==='transparent'?0:100);
   const read=()=>nativeCall(page,'miniInspect',m);
   const result={kind,mode,before:await read()};
   await page.mouse.click(315,220,{delay:100});
   result.afterFirst=await read();
   await page.mouse.click(315,220,{delay:100});
   result.afterQuickSecond=await read();
   await page.keyboard.press('Space',{delay:100});
   result.afterReload=await read();
   await page.waitForTimeout(650);
   if(kind==='showMinigame2')await page.waitForFunction(m=>{
     for(let i=1;i<=15;i++){
       const frame=player.ruffle().callExternalInterface('probeRead',m+'.target'+i+'._currentframe');
       if(frame>0&&frame<6)return true;
     }
     return false;
   },m,{timeout:8000});
   let real;
   result.targetFields=[];
   for(let i=1;i<=15;i++){
     const target=await nativeCall(page,'miniInspect',m+'.target'+i);
     const visible=await nativeCall(page,'probeRead',m+'.target'+i+'._visible');
     const frame=await nativeCall(page,'probeRead',m+'.target'+i+'._currentframe');
     result.targetFields.push({i,visible,frame,keys:target.keys});
     if(visible && (kind==='showMinigame2'?frame<6:target.keys.isDead===false && target.keys.true===1 && target.keys.score>0)){real=i;break;}
   }
   if(real){
     const targets=await nativeCall(page,'probeTargets');
     const b=targets.find(t=>t.index===real).bounds;
     await page.mouse.move((b.xMin+b.xMax)/2,(b.yMin+b.yMax)/2);
     result.realTarget=real;
     result.cursorInspect=await nativeCall(page,'miniInspect',m+'.cursor_mc');
     result.beforeDirect=await read();
     result.nativeShot=await nativeCall(page,'miniNativeShot',m);
     result.duringDirect=await read();
     result.afterDirect=await read();
     assert.equal(result.nativeShot.afterFrame,result.nativeShot.beforeFrame+1,'native one-frame shot consumes exactly one round');
     assert.equal(result.nativeShot.afterScore,result.nativeShot.beforeScore+1,'native one-frame shot scores a live target');
     result.targetAfterDirect=await nativeCall(page,'miniInspect',m+'.target'+real);
     if(result.duringDirect.clips.bullet_mc.frame===result.beforeDirect.clips.bullet_mc.frame){
       await page.waitForTimeout(600);
       result.beforeRealHeld=await read();
       await page.mouse.click((b.xMin+b.xMax)/2,(b.yMin+b.yMax)/2,{delay:100});
       result.afterRealHeld=await read();
       result.targetAfterHeld=await nativeCall(page,'miniInspect',m+'.target'+real);
     }
   }
   results.push(result);
   result.cooldown=[];
   await page.mouse.move(315,220);
   for(let delay=0;delay<=10;delay++) result.cooldown.push(await nativeCall(page,'miniCooldown',m,delay));
   result.ammoBoundary=[];
   for(const frame of [12,13]) result.ammoBoundary.push(await nativeCall(page,'miniAmmoBoundary',m,frame));
   await page.keyboard.down('Space');
   result.reloadFrame=await nativeCall(page,'miniReloadFrame',m);
   await page.keyboard.up('Space');
   assert.equal(result.afterFirst.clips.bullet_mc.frame,2,kind+' '+mode+' held native shot consumes one round');
   assert.equal(result.afterReload.clips.bullet_mc.frame,1,kind+' '+mode+' native reload restores twelve rounds');
   assert.deepEqual(result.ammoBoundary.map(x=>[x.before,x.after]),[[12,13],[13,kind==='showMinigame2'?1:13]]);
   assert.equal(result.reloadFrame.bulletFrame,1);
   const cooldownThreshold=kind==='showMinigame'?3:2;
   assert.deepEqual(result.cooldown.map(x=>x.bulletFrame),Array.from({length:11},(_,i)=>i<cooldownThreshold?1:2));
   console.log(JSON.stringify({kind,mode,frames:[result.before,result.afterFirst,result.afterQuickSecond,result.afterReload].map(x=>x?.clips.bullet_mc?.frame),realTarget:real,nativeShot:result.nativeShot,cooldownThreshold,reloadFrame:result.reloadFrame,ammoBoundary:result.ammoBoundary}));
   await nativeCall(page,'miniCallExact',m,'hideAll',[]);
 }
 fs.writeFileSync(path.join(own,'matrix.json'),JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(resolve=>local.server.close(resolve));}
