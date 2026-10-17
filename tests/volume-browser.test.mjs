import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,launchOptions,serve} from './browser-helper.mjs';

// Catch volume resets on ready/unmute and accidental attenuation of the
// outgoing audio: both browsers use the real media graph and peer connection.
test('volume slider controls each listener independently and survives ready/reset',{timeout:70000},async()=>{
 const local=await serve();let a,b;
 try{
  a=await chromium.launch(launchOptions);b=await chromium.launch(launchOptions);
  const host=await a.newPage({viewport:{width:1875,height:1000}}),guest=await b.newPage();
  await host.addInitScript(()=>{
   window.audioGains=[];window.audioOutputs=[];
   for(const [method,list] of [['createGain','audioGains'],['createMediaStreamDestination','audioOutputs']]){
    const original=AudioContext.prototype[method];
    AudioContext.prototype[method]=function(...args){const node=original.apply(this,args);window[list].push(node);return node;};
   }
  });
  await host.goto(local.url);
  assert.equal(await host.getByRole('slider',{name:'음량'}).count(),1,'a labelled volume slider is available before connection');
  const set=async(page,value)=>page.locator('#volume').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await set(host,20);await host.locator('#createRoom').click();
  await host.waitForFunction(()=>document.querySelector('#outputLink').value.includes('#i='),null,{timeout:45000});
  await guest.goto(await host.locator('#outputLink').inputValue());
  await guest.waitForFunction(()=>document.querySelector('#outputLink').value.includes('#a='),null,{timeout:45000});
  await set(guest,35);
  await host.locator('#answerInput').fill(await guest.locator('#outputLink').inputValue());await host.locator('#answerForm button').click();
  await guest.waitForFunction(()=>document.querySelector('#connectionBadge').textContent==='연결 완료');
  await guest.waitForFunction(()=>document.querySelector('#remoteVideo').readyState>=2);
  const hostVolume=()=>host.evaluate(()=>audioGains.find(node=>node.context===audioOutputs[0].context).gain.value);
  assert.ok(Math.abs(await hostVolume()-.2)<1e-6,'pre-load host choice reaches local audio output');
  assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.volume),.35);
  await host.locator('[data-character="1"]').click();await guest.locator('[data-character="2"]').click();
  await host.waitForFunction(()=>!document.querySelector('#pauseGame').disabled);
  assert.ok(Math.abs(await hostVolume()-.2)<1e-6,'ready does not reset host choice');
  assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.volume),.35);
  assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.muted),false);
  await host.locator('#enableSound').click();await guest.locator('#enableSound').click();
  assert.ok(Math.abs(await hostVolume()-.2)<1e-6,'sound enable respects chosen volume');
  // A known tone enters the same capture path as Ruffle. Muting the host must
  // silence only its preview; the transmitted stream must keep this energy.
  await host.evaluate(async()=>{
   const {prepareAudio}=await import('./media.mjs');const stream=await prepareAudio();
   const context=new AudioContext();await context.resume();const tone=context.createOscillator(),gain=context.createGain();gain.gain.value=.1;
   tone.connect(gain);gain.connect(context.destination);tone.start();
   window.volumeProbe=context.createAnalyser();context.createMediaStreamSource(stream).connect(volumeProbe);
   window.readEnergy=()=>{const samples=new Float32Array(volumeProbe.fftSize);volumeProbe.getFloatTimeDomainData(samples);return samples.reduce((sum,v)=>sum+v*v,0)/samples.length;};
  });
  await host.waitForFunction(()=>readEnergy()>.001);
  await set(host,0);assert.equal(await hostVolume(),0);
  await host.waitForTimeout(150);assert.ok(await host.evaluate(()=>readEnergy()>.001),'host mute leaves outgoing game audio live');
  assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.volume),.35,'host mute leaves guest choice alone');
  await set(guest,0);assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.muted),true);
  await set(host,100);await set(guest,80);
  assert.equal(await hostVolume(),1);assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.volume),.8);
  assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.muted),false,'raising volume unmutes guest');
  await guest.locator('#newGame').click();await host.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='selecting');
  assert.equal(await host.locator('#volume').inputValue(),'100');assert.equal(await guest.locator('#volume').inputValue(),'80');
  assert.equal(await hostVolume(),1);assert.equal(await guest.locator('#remoteVideo').evaluate(v=>v.volume),.8);
  await host.screenshot({path:'scratch/volume-wide.png',fullPage:true});
  await host.setViewportSize({width:390,height:850});await host.waitForTimeout(150);
  assert.ok(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await host.locator('#volume').isVisible(),true);
  await host.screenshot({path:'scratch/volume-mobile.png',fullPage:true});
 }finally{await a?.close();await b?.close();await new Promise(r=>local.server.close(r));}
});
