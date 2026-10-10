import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,chromium,launchOptions,serve,connect} from './browser-helper.mjs';

test('fixed boy/girl ready independently and both pencil tips track their actual click coordinate',{timeout:60000},async()=>{
 const local=await serve();let a,b;
 try{
  a=await chromium.launch(launchOptions);b=await chromium.launch(launchOptions);
  const host=await a.newPage({viewport:{width:1280,height:1000}}),guest=await b.newPage({viewport:{width:800,height:900}});
  await connect(host,guest,local.url);
  assert.equal(await host.locator('.character-button').count(),2);assert.equal(await host.locator('.character-button:not(:disabled)').count(),1);
  assert.equal(await guest.locator('.character-button:not(:disabled)').count(),1);assert.equal(await host.locator('[data-character="2"]').isDisabled(),true);assert.equal(await guest.locator('[data-character="1"]').isDisabled(),true);
  await host.locator('[data-character="1"]').click();assert.equal(await host.locator('#stage').getAttribute('data-phase'),'selecting');
  await guest.locator('[data-character="2"]').click();await host.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='playing');await guest.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='playing');
  for(const [page,other,number,ratioX,ratioY,file] of [[host,guest,0,6.5/68,6.3/66,'boy'],[guest,host,1,8.55/80,4/65,'girl']]){
    const stage=await page.locator('#inputLayer').boundingBox(),point={x:stage.x+stage.width*.37,y:stage.y+stage.height*.41};
    await page.mouse.move(point.x,point.y);await page.waitForFunction(n=>!document.querySelector('#cursor'+n).hidden,number);await other.waitForFunction(n=>!document.querySelector('#cursor'+n).hidden,number);
    const marker=await page.locator('#cursor'+number).boundingBox();assert.ok(Math.abs(marker.x+marker.width*ratioX-point.x)<1,'pencil tip X matches actual mouse X');assert.ok(Math.abs(marker.y+marker.height*ratioY-point.y)<1,'pencil tip Y matches actual mouse Y');
    assert.match(await other.locator('#cursor'+number+' img').getAttribute('src'),new RegExp(file+'\\.png$'));
  }
  fs.mkdirSync(path.join(root,'scratch'),{recursive:true});await host.evaluate(()=>window.scrollTo(0,0));await host.screenshot({path:path.join(root,'scratch/fixed-pencil-cursors.png')});
  console.log('PASS fixed 1P boy / 2P girl and original pencil registration points on two viewport sizes.');
 }finally{await a?.close();await b?.close();await new Promise(r=>local.server.close(r));}
});
