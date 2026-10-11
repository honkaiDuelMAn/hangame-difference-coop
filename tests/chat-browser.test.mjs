import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,launchOptions,serve,connect} from './browser-helper.mjs';

// Missing routing, unsafe HTML insertion or Enter during IME composition
// must break observable delivery, rather than only a source-text assertion.
test('direct room chat preserves Korean/English/digits and composition without game hotkeys',{timeout:70000},async()=>{
 const local=await serve();let a,b;
 try{
  a=await chromium.launch(launchOptions);b=await chromium.launch(launchOptions);
  const host=await a.newPage({viewport:{width:1875,height:1000}}),guest=await b.newPage({viewport:{width:1280,height:1000}});
  await host.goto(local.url);assert.equal(await host.locator('#chatInput').count(),1,'room chat input is available');assert.equal(await host.locator('#chatInput').isDisabled(),true);
  await connect(host,guest,local.url);
  await host.locator('#chatInput').fill('안녕하세요 Hello 123');await host.locator('#chatInput').press('Enter');
  await guest.waitForFunction(()=>document.querySelector('#chatMessages').textContent.includes('안녕하세요 Hello 123'));
  assert.match(await guest.locator('.chat-sender').first().innerText(),/^1P/);
  await host.locator('#chatInput').evaluate(input=>{input.value='한글 조합 456';input.dispatchEvent(new CompositionEvent('compositionstart'));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true,cancelable:true}));input.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await host.waitForTimeout(150);assert.equal(await guest.locator('.chat-message').count(),1,'composing Enter must not send');
  await host.locator('#chatInput').evaluate(input=>input.dispatchEvent(new CompositionEvent('compositionend')));await host.locator('#chatInput').press('Enter');
  await guest.waitForFunction(()=>document.querySelectorAll('.chat-message').length===2);
  await guest.locator('#chatInput').fill('<img src=x onerror=alert(1)> English 789');await guest.locator('#chatSend').click();
  await host.waitForFunction(()=>document.querySelectorAll('.chat-message').length===3);assert.equal(await host.locator('#chatMessages img').count(),0);
  assert.match(await host.locator('.chat-sender').last().innerText(),/^2P/);
  await host.locator('[data-character="1"]').click();await guest.locator('[data-character="2"]').click();await host.waitForFunction(()=>!document.querySelector('#useGlasses').disabled);
  await host.locator('#chatInput').focus();
  const keptFocus=await host.evaluate(async()=>{
   const {OriginalGame}=await import('./engine.mjs');const game=new OriginalGame(document.querySelector('#gameContainer'),()=>{});
   game.player=document.querySelector('ruffle-player');game.canvas=game.player.shadowRoot.querySelector('canvas');
   window.pendingChatInput=game.input(1,{kind:'click',x:630,y:470});
   return document.activeElement===document.querySelector('#chatInput');
  });
  assert.equal(keptFocus,true,'remote native input must return chat focus before its asynchronous wait');
  await host.evaluate(()=>window.pendingChatInput);
  await host.locator('#chatInput').focus();await host.keyboard.type('12 Space 34');await host.locator('#chatInput').press('Enter');await guest.waitForFunction(()=>document.querySelector('#chatMessages').textContent.includes('12 Space 34'));
  assert.equal(await host.locator('#itemStat').innerText(),'5개');assert.equal(await host.locator('#lifeStat').innerText(),'♥ 3');assert.equal(await host.locator('#pauseOverlay').evaluate(e=>e.hidden),true);
  const chat=await host.locator('#chatPanel').boundingBox(),game=await host.locator('#stage').boundingBox();assert.ok(chat.x+chat.width<game.x,'wide-screen chat is left of the game');
  await host.screenshot({path:'scratch/chat-wide.png',fullPage:true});
  await host.locator('#pauseGame').click();await guest.locator('#chatInput').fill('쉬는 동안에도 채팅');await guest.locator('#chatInput').press('Enter');await host.waitForFunction(()=>document.querySelector('#chatMessages').textContent.includes('쉬는 동안에도 채팅'));
  await guest.locator('#newGame').click();await host.waitForFunction(()=>document.querySelector('#stage').dataset.phase==='selecting');assert.equal(await host.locator('.chat-message').count(),5,'same connection restart preserves chat');
  await host.evaluate(async()=>{
   const {readConnectionLink}=await import('./net/connection-link.mjs'),{decodeCode}=await import('./net/connection-code.mjs'),{receive}=await import('./app.mjs');
   const {session}=await decodeCode(readConnectionLink(document.querySelector('#outputLink').value,location.href).code);
   for(const event of [{session:'0'.repeat(32),seq:3,text:'wrong room'},{session,seq:2,text:'duplicate'},{session,seq:3,text:'x'.repeat(501)},{session,seq:3,text:'  '}])receive({type:'chat',...event});
   window.chatTestSession=session;
  });assert.equal(await host.locator('.chat-message').count(),5,'wrong room, replay and invalid messages are ignored');
  await host.setViewportSize({width:390,height:850});await host.waitForTimeout(150);assert.ok(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile layout must not scroll horizontally');await host.screenshot({path:'scratch/chat-mobile.png',fullPage:true});
  await host.evaluate(async()=>{const {receive}=await import('./app.mjs');for(let seq=3;seq<205;seq++)receive({type:'chat',session:window.chatTestSession,seq,text:'bounded '+seq,seat:0});});
  assert.equal(await host.locator('.chat-message').count(),200);assert.equal(await host.locator('.chat-sender').last().innerText(),'2P','peer cannot claim local identity');
  await guest.locator('#leaveRoom').click();await host.waitForFunction(()=>document.querySelector('#chatInput').disabled);assert.equal(await host.locator('.chat-message').count(),200);
  const oldInvite=await host.locator('#outputLink').inputValue();await host.locator('#createRoom').click();await host.waitForFunction(old=>{const value=document.querySelector('#outputLink').value;return value!==old&&value.includes('#i=');},oldInvite);assert.equal(await host.locator('.chat-message').count(),0,'a new connection clears previous chat');
 }finally{await a?.close();await b?.close();await new Promise(r=>local.server.close(r));}
});
