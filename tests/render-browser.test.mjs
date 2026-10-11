import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,chromium,launchOptions,serve,connect,nativeCall} from './browser-helper.mjs';

// Fractional bitmap translation must not change non-answer letter thickness.
for(const deviceScaleFactor of [1,1.25,1.5])test(`identical Heaven lettering and unobstructed item use at device scale ${deviceScaleFactor}`,{timeout:60000},async()=>{
 const local=await serve();let a,b;
 try{
  a=await chromium.launch(launchOptions);b=await chromium.launch(launchOptions);
  const host=await a.newPage({viewport:{width:1280,height:1000},deviceScaleFactor}),guest=await b.newPage();
  await host.route('**/game/game-coop.swf',r=>r.fulfill({contentType:'application/x-shockwave-flash',body:fs.readFileSync(path.join(root,'public/game/game-coop-probe.swf'))}));
  await host.route(/\/kro\d+\.(swf|xml)$/,r=>r.fulfill({body:fs.readFileSync(path.join(root,'public/game/data/newimage/kro000060.'+r.request().url().split('.').pop()))}));
  await connect(host,guest,local.url);
  await host.locator('[data-character="1"]').click();await guest.locator('[data-character="2"]').click();
  await host.waitForFunction(()=>!document.querySelector('#useGlasses').disabled);
  for(const width of [642,802,962,796,901]){
   await host.evaluate(width=>{document.querySelector('.play-section').style.width=width+'px';},width);await host.waitForTimeout(200);
   const source=await nativeCall(host,'probePicture',145,210,45,17);assert.deepEqual(source.left,source.right,'Heaven is not an original difference');
   const sizes=await host.evaluate(()=>{const c=document.querySelector('ruffle-player').shadowRoot.querySelector('canvas'),r=c.getBoundingClientRect();return {canvasWidth:c.width,canvasHeight:c.height,pageX:Math.floor(r.left*devicePixelRatio),pageY:Math.floor(r.top*devicePixelRatio)};});
   const file=path.join(root,'scratch/heaven-regression-'+width+'.png');await host.screenshot({path:file,fullPage:true});
   const pixels=JSON.parse(execFileSync('python',[path.join(root,'tests/render-pixels.py'),file,JSON.stringify({...source,...sizes})],{encoding:'utf8'}));
   assert.equal(pixels.differentPixels,0,'matching glyphs keep their thickness at '+width+': '+JSON.stringify(pixels));
   console.log(JSON.stringify({deviceScaleFactor,width,...pixels}));
  }
  await host.locator('#useGlasses').click();await host.waitForFunction(()=>document.querySelector('#itemStat').textContent==='4개');
  assert.equal(await nativeCall(host,'probeRead','_global.Framework.logic.im.magic_b'),true,'glasses effect remains active after removing the shortcut card');
  assert.ok(await nativeCall(host,'probeRead','_root._ymouse')<0,'native hover must leave the item button so its shortcut card cannot cover the photo');
  await host.screenshot({path:path.join(root,'scratch/no-glasses-tooltip.png')});
 }finally{await a?.close();await b?.close();await new Promise(r=>local.server.close(r));}
});
