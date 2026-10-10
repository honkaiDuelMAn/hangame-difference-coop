import {ManualPeer,decodeCode} from './net/manual-peer.mjs';
import {makeConnectionLink,readConnectionLink,connectionInput} from './net/connection-link.mjs';
import {AnswerInbox,deliverAnswer} from './net/reply-relay.mjs';
import {CoopRoom} from './net/coop-rules.mjs';
import {OriginalGame} from './engine.mjs';
import {prepareAudio,setHostVolume} from './media.mjs';
import {drawQR} from './qr.mjs';
import {characters} from './characters.mjs';

const $=id=>document.getElementById(id);
let peer,inbox,engine,room,seat=null,busy=false,seq=0,jobs=Promise.resolve(),native={},lastPointerSent=0,backgroundPaused=false;
let view={run:null,connected:false,phase:'selecting',characters:[null,null],paused:false,locked:0};
const positions=[null,null];
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function notice(text){$('gameNotice').textContent=text;}
function send(event){if(peer?.channel?.readyState==='open')peer.send(event);}
function updateNative(value){native=value||{};if(seat===0&&room)publish();}
function snapshot(){return {type:'room',protocol:1,run:room.run,connected:room.connected,phase:room.phase,characters:room.characters,paused:room.paused,locked:Math.max(0,room.lockUntil-performance.now()),native};}
function publish(){if(!room)return;const state=snapshot();applyView(state);send(state);}
function applyView(state){if(state.run!==view.run){seq=0;positions.fill(null);}view={...state};native=state.native||{};view.lockDeadline=performance.now()+(state.locked||0);render();}
function pointer(seatNumber,pos){positions[seatNumber]=pos;renderPointers();}
function renderPointers(){for(let i=0;i<2;i++){const el=$('cursor'+i),pos=positions[i],character=characters[view.characters?.[i]];el.hidden=!pos||!character||view.phase!=='playing'||view.paused;if(!el.hidden){el.style.left=pos.x/640*100+'%';el.style.top=pos.y/480*100+'%';el.style.width=character.width/640*100+'%';el.style.height=character.height/480*100+'%';el.style.transform=`translate(${-character.hotX/character.width*100}%,${-character.hotY/character.height*100}%)`;el.querySelector('img').src=`./assets/${character.image}.png`;}}}
function render(){
  const connected=view.connected,playing=view.phase==='playing',canPlay=connected&&playing&&!view.paused;
  $('stage').dataset.phase=playing?'playing':connected?'selecting':'offline';$('stage').dataset.run=view.run||'';$('stage').dataset.epoch=native.epoch||'';$('stage').dataset.seat=seat??'';
  $('connectionBadge').textContent=connected?'연결 완료':busy?'준비 중…':peer&&!peer.closed?'링크 교환 중':'연결 대기';$('connectionBadge').classList.toggle('connected',connected);
  $('seatLabel').textContent=seat===null?'2인 협동':`${seat+1}P${seat===0?' · 방장':''}`;
  $('lobby').hidden=playing;$('lobbyTitle').textContent=connected?'함께할 캐릭터를 골라요':'친구와 함께 입소하기';
  $('lobbyText').textContent=connected?'원본 연필 포인터로 플레이해요. 1P는 소년, 2P는 소녀로 고정됩니다.':'방을 만들거나 친구의 초대 링크를 열어 주세요.';
  const mine=view.characters?.[seat],other=view.characters?.[1-seat];
  for(const button of $('characterGrid').children){const id=Number(button.dataset.character);button.disabled=!connected||playing||id!==seat+1;button.classList.toggle('selected',id===mine);button.classList.toggle('occupied',id===other);button.querySelector('small').textContent=id===mine?'준비 완료':id===other?'상대 준비 완료':`${id}P 전용 · 준비`;}
  $('readyText').textContent=connected?(mine?'내 준비 완료 · 상대의 준비를 기다려요.':'본인의 요원을 눌러 준비하면 두 사람 모두 준비된 뒤 시작합니다.'):'연결 후 1P·2P가 각각 준비를 누르면 시작해요.';
  $('connectedPanel').hidden=!connected;$('sharing').hidden=connected||!$('outputLink').value;$('initialControls').hidden=connected||busy||Boolean(peer&&!peer.closed);$('leaveRoom').hidden=!peer||peer.closed;
  for(let i=0;i<2;i++){const c=characters[view.characters?.[i]];$('player'+i+'Name').textContent=c?c.name+' · 선택 완료':'캐릭터 선택 중';$('player'+i+'Image').src=`./assets/${c?.image||(i?'girl':'boy')}.png`;}
  $('pauseOverlay').hidden=!playing||!view.paused;$('pauseGame').textContent=view.paused?'계속하기':'일시정지';$('pauseGame').disabled=!connected||!playing;$('newGame').disabled=!connected;
  const locked=performance.now()<view.lockDeadline;
  $('useLife').disabled=!canPlay||native.mode!=='puzzle'||!native.enabled||!(native.life>0)||locked;
  $('useGlasses').disabled=!canPlay||native.mode!=='puzzle'||!native.enabled||!(native.item>0)||locked;
  $('lifeStat').textContent=Number.isFinite(native.life)?'♥ '+native.life:'—';$('itemStat').textContent=Number.isFinite(native.item)?native.item+'개':'—';$('foundStat').textContent=Number.isFinite(native.find)?native.find+' / 5':'—';$('timeStat').textContent=Number.isFinite(native.time)?Math.max(0,Math.ceil(native.time))+'초':'—';
  const shooting=playing&&native.mode==='mini';$('ammoHUD').hidden=!shooting;$('reloadGun').hidden=!shooting;$('reloadGun').disabled=!canPlay;
  for(let i=0;i<2;i++)$('ammo'+i).textContent=native.bullets?.[i]??'—';
  renderPointers();
}
for(let id=1;id<characters.length;id++){const c=characters[id],button=document.createElement('button');button.className='character-button';button.dataset.character=id;button.disabled=true;button.innerHTML=`<img src="./assets/${c.image}.png" alt=""><span>${c.name}</span><small>해금 완료</small>`;button.addEventListener('click',()=>{enableSound();request({type:'select',character:id});});$('characterGrid').append(button);}
function onPeerState(state,error){
  if(state==='connected'){
    inbox?.close();send({type:'hello',protocol:1});
    message('연결되었습니다. 각자 캐릭터를 고르면 시작해요.');
  }else if(state==='failed'||state==='closed'){
    inbox?.close();if(room){room.setConnected(false);room.paused=true;engine?.pause(true);publish();}
    view.connected=false;view.paused=true;render();$('pauseText').textContent='연결이 종료되어 두 사람의 게임이 멈췄어요.';
    message(error||'연결이 종료되었습니다. 새 방을 만들어 다시 연결하세요.',state==='failed');
  }
}
function makePeer(mediaStream=null){return new ManualPeer({mediaStream,onMessage:receive,onState:onPeerState,onTrack:stream=>{const video=$('remoteVideo');video.srcObject=stream;video.hidden=false;$('cover').hidden=true;video.play().catch(()=>{});}});}
export function receive(event){
  if(!event||typeof event!=='object')return;
  if(event.type==='hello'){
    if(event.protocol!==1){message('서로 같은 최신 게임 페이지로 접속해 주세요.',true);peer.close();return;}
    if(seat===0){room.setConnected(true);publish();}return;
  }
  if(event.type==='room'&&seat===1&&event.protocol===1){const starting=view.phase!=='playing'&&event.phase==='playing';applyView(event);if(starting)notice('같은 게임이 시작되었습니다. 함께 정답을 찾아요.');return;}
  if(event.type==='pointer'&&event.run===view.run&&Number.isFinite(event.x)&&Number.isFinite(event.y)&&event.x>=0&&event.x<=640&&event.y>=0&&event.y<=480){pointer(1-seat,{x:event.x,y:event.y});return;}
  if(event.type==='notice'){notice(String(event.message||'').slice(0,160));return;}
  if(seat===0)handleRequest(1,event);
}
function request(event){if(!view.connected)return;if(seat===0)handleRequest(0,event);else send({...event,run:view.run});}
function handleRequest(actor,event){
  if(!room?.connected)return;
  if(event.type==='select'){
    const result=room.select(actor,event.character);if(!result.ok){report(actor,result.error);return;}
    if(result.start){native={};engine.start(room.characters[0]);notice('두 사람의 훈련이 시작되었습니다. 정답 5곳을 함께 찾아요.');}
    publish();return;
  }
  const currentRoom=room;
  jobs=jobs.then(async()=>{
    if(currentRoom!==room||!room.connected)return;
    if(event.type==='pause'&&event.run===room.run&&typeof event.paused==='boolean'&&room.phase==='playing'){
      room.paused=event.paused;engine.pause(room.paused);$('pauseText').textContent='두 사람의 시간이 함께 멈췄어요.';publish();return;
    }
    if(event.type==='reset'&&event.run===room.run){
      engine.reset();room=new CoopRoom(crypto.randomUUID());room.setConnected(true);native={};seq=0;positions.fill(null);publish();notice('같은 연결로 다시 캐릭터를 골라 주세요.');return;
    }
    if(event.type!=='input')return;
    const state=engine.state(),result=room.authorize(actor,event,state,performance.now());
    if(!result.ok){report(actor,result.error);return;}
    await engine.input(actor,result.event);publish();
  }).catch(error=>{message(error.message,true);room.paused=true;engine.pause(true);publish();});
}
function report(actor,text){actor===seat?notice(text):send({type:'notice',message:text});}
function action(kind,x,y){if(!view.connected||view.phase!=='playing'||view.paused)return;request({type:'input',run:view.run,epoch:native.epoch,seq:++seq,kind,x,y});}
function stagePosition(event){const rect=$('inputLayer').getBoundingClientRect();return{x:Math.max(0,Math.min(640,(event.clientX-rect.left)/rect.width*640)),y:Math.max(0,Math.min(480,(event.clientY-rect.top)/rect.height*480))};}
$('inputLayer').addEventListener('pointermove',event=>{if(seat===null||view.phase!=='playing')return;const pos=stagePosition(event);pointer(seat,pos);if(performance.now()-lastPointerSent>40){lastPointerSent=performance.now();send({type:'pointer',run:view.run,...pos});}});
$('inputLayer').addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();$('inputLayer').focus({preventScroll:true});const pos=stagePosition(event);pointer(seat,pos);send({type:'pointer',run:view.run,...pos});action('click',pos.x,pos.y);});
$('useLife').addEventListener('click',()=>action('life'));
$('useGlasses').addEventListener('click',()=>action('glasses'));
$('reloadGun').addEventListener('click',()=>action('reload'));
$('pauseGame').addEventListener('click',()=>request({type:'pause',run:view.run,paused:!view.paused}));
$('newGame').addEventListener('click',()=>request({type:'reset',run:view.run}));
document.addEventListener('keydown',event=>{
  if(!event.isTrusted||event.repeat||['INPUT','TEXTAREA'].includes(event.target.tagName)||event.target.isContentEditable)return;
  if(!view.connected||view.phase!=='playing'||!['1','2',' '].includes(event.key))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(event.key==='1')action('life');else if(event.key==='2')action('glasses');else if(native.mode==='mini')action('reload');else request({type:'pause',run:view.run,paused:!view.paused});
},true);
async function shareCode(code,kind){
  $('outputLink').value=makeConnectionLink(code,kind,location.href);$('linkTitle').textContent=kind==='invite'?'친구에게 보낼 초대':'1P에게 보낼 응답';
  $('linkInstructions').textContent=kind==='invite'?'링크나 QR을 친구에게 보내고, 친구의 응답 링크를 여기에 붙여 넣으세요.':'이 응답 링크를 1P에게 보내 주세요. 원래 게임 탭은 계속 열어 두세요.';
  $('answerForm').hidden=kind!=='invite';$('sharing').hidden=false;
  try{drawQR($('qrCanvas'),$('outputLink').value);$('showQR').hidden=false;$('qrNote').textContent='링크나 QR 중 편한 방법으로 공유하세요.';}catch{$('showQR').hidden=true;$('qrNote').textContent='연결 정보가 길어 QR 대신 링크를 공유해 주세요.';}
  render();
}
async function create(){
  if(busy)return;busy=true;render();message('원본 게임과 초대 링크를 준비하고 있습니다…');
  try{
    peer?.close();inbox?.close();seat=0;room=new CoopRoom(crypto.randomUUID());native={};view={run:room.run,connected:false,phase:'selecting',characters:[null,null],paused:false,locked:0};
    if(!engine){engine=new OriginalGame($('gameContainer'),updateNative);await engine.load();}else engine.reset();
    $('cover').hidden=true;$('remoteVideo').hidden=true;await prepareAudio();
    peer=makePeer(engine.stream);const code=await peer.offer(Array.from(crypto.getRandomValues(new Uint8Array(3)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase());
    $('roomCode').textContent=peer.room;inbox=new AnswerInbox(peer.session,accept);await shareCode(code,'invite');message('초대를 보냈다면 친구의 응답 링크를 기다려 주세요. 모바일 데이터에서는 링크 생성에 최대 30초가 걸릴 수 있어요.');
  }catch(error){message(error.message,true);peer?.close();}finally{busy=false;render();}
}
async function join(text){
  if(busy)return;busy=true;render();message('초대에 참가하고 응답 링크를 만드는 중입니다…');
  try{
    const code=connectionInput(text,'invite',location.href);peer?.close();inbox?.close();seat=1;room=null;view={run:null,connected:false,phase:'selecting',characters:[null,null],paused:false,locked:0};seq=0;
    peer=makePeer();const answer=await peer.answer(code);$('roomCode').textContent=peer.room;await shareCode(answer,'answer');message('응답 링크를 1P에게 보내 주세요. 양쪽 게임 탭을 계속 열어 두세요.');
  }catch(error){message(error.message,true);peer?.close();}finally{busy=false;render();}
}
async function accept(text){
  if(seat!==0||!peer)throw Error('방을 만든 원래 탭에 응답 링크를 입력하세요.');
  const code=connectionInput(text,'answer',location.href);await peer.accept(code);message('응답을 적용했습니다. 두 사람의 연결을 기다리고 있습니다…');
}
async function enableSound(){if(seat===0){await prepareAudio();setHostVolume(.65);}else{const video=$('remoteVideo');video.muted=false;try{await video.play();}catch{notice('소리 켜기를 한 번 더 눌러 주세요.');}}}
$('createRoom').addEventListener('click',create);
$('joinForm').addEventListener('submit',event=>{event.preventDefault();join($('inviteInput').value);});
$('answerForm').addEventListener('submit',event=>{event.preventDefault();accept($('answerInput').value).catch(error=>message(error.message,true));});
$('enableSound').addEventListener('click',enableSound);
$('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('outputLink').value);message('링크를 복사했습니다. 상대에게 전달해 주세요.');}catch{$('outputLink').focus();$('outputLink').select();message('선택된 링크를 복사해 상대에게 전달해 주세요.');}});
$('shareLink').addEventListener('click',async()=>{if(!navigator.share){$('copyLink').click();return;}try{await navigator.share({title:'한게임 틀린그림찾기 · 둘이 함께',url:$('outputLink').value});}catch(error){if(error.name!=='AbortError')message(error.message,true);}});
$('showQR').addEventListener('click',()=>{drawQR($('largeQR'),$('outputLink').value);$('qrDialog').showModal();});$('closeQR').addEventListener('click',()=>$('qrDialog').close());
$('leaveRoom').addEventListener('click',()=>{inbox?.close();peer?.close();$('outputLink').value='';render();});
document.addEventListener('visibilitychange',()=>{if(seat!==0||!room?.connected||room.phase!=='playing')return;if(document.hidden&&!room.paused){backgroundPaused=true;request({type:'pause',run:view.run,paused:true});$('pauseText').textContent='방장이 게임 탭으로 돌아오면 이어집니다.';}else if(!document.hidden&&backgroundPaused){backgroundPaused=false;request({type:'pause',run:view.run,paused:false});}});
window.addEventListener('pagehide',()=>peer?.close());
setInterval(()=>{if(view.phase==='playing')render();},150);
render();
async function initialLink(){
  if(!location.hash)return;let link;
  try{link=readConnectionLink(location.href,location.href);history.replaceState(null,'',location.pathname+location.search);
    if(link.kind==='invite'){await join(link.code);return;}
    const answer=await decodeCode(link.code);$('lobbyTitle').textContent='응답 링크 전달 중';$('lobbyText').textContent='같은 브라우저에 열려 있는 원래 대기방으로 전달합니다.';
    await deliverAnswer(link.code,answer.session);message('원래 대기방에 응답을 적용했습니다. 이 탭을 닫고 게임 탭으로 돌아가세요.');$('lobbyTitle').textContent='응답 전달 완료';$('lobbyText').textContent='방을 만든 원래 게임 탭으로 돌아가 주세요.';
  }catch(error){message(error.message,true);if(link?.kind==='answer'){ $('outputLink').value=makeConnectionLink(link.code,'answer',location.href);$('sharing').hidden=false;$('linkInstructions').textContent='원래 대기방에 이 응답 링크를 붙여 넣어 주세요.';}}
}
initialLink();
