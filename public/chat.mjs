// Messages use the existing ordered peer channel; identities come from its seat.
export function createRoomChat({send}){
 const input=document.getElementById('chatInput'),button=document.getElementById('chatSend');
 const messages=document.getElementById('chatMessages'),empty=document.getElementById('chatEmpty'),status=document.getElementById('chatStatus');
 let session=null,mySeat=null,connected=false,composing=false,sequence=0,received=0;
 const clean=text=>typeof text==='string'?text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim():'';
 function append(seat,text){
  const follow=messages.scrollHeight-messages.scrollTop-messages.clientHeight<36||seat===mySeat;
  const item=document.createElement('div');item.className='chat-message'+(seat===mySeat?' chat-message-mine':'');
  const sender=document.createElement('span');sender.className='chat-sender '+(seat===0?'red':'blue');sender.textContent=`${seat+1}P${seat===mySeat?' · 나':''}`;
  const body=document.createElement('p');body.className='chat-text';body.textContent=text;
  item.append(sender,body);messages.append(item);empty.hidden=true;
  while(messages.children.length>200)messages.firstElementChild.remove();
  if(follow)messages.scrollTop=messages.scrollHeight;
 }
 input.addEventListener('compositionstart',()=>{composing=true;});
 input.addEventListener('compositionend',()=>{composing=false;});
 input.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&(composing||event.isComposing||event.keyCode===229||event.repeat))event.preventDefault();
 });
 input.form.addEventListener('submit',event=>{
  event.preventDefault();if(!connected||composing)return;
  const text=clean(input.value);if(!text)return;
  if(text.length>500){status.textContent='메시지는 500자까지 보낼 수 있어요.';return;}
  try{
   if(!send({type:'chat',session,seq:sequence+1,text})){status.textContent='상대와 연결된 뒤 전송할 수 있어요.';return;}
   sequence++;append(mySeat,text);input.value='';input.focus({preventScroll:true});
  }catch{status.textContent='연결이 종료되어 전송하지 못했습니다.';}
 });
 return {
  setConnection(id,seat,ready){
   const valid=typeof id==='string'&&/^[a-f0-9]{32}$/.test(id)&&[0,1].includes(seat);
   if(valid&&(id!==session||seat!==mySeat)){
    session=id;mySeat=seat;sequence=0;received=0;composing=false;input.value='';messages.replaceChildren();empty.hidden=false;
   }
   connected=Boolean(valid&&ready);input.disabled=!connected;button.disabled=!connected;
   status.textContent=connected?'Enter 전송 · 한글, 영어, 숫자 입력 가능':'두 사람이 연결되면 채팅할 수 있어요.';
  },
  receive(event){
   if(!connected||event?.type!=='chat'||event.session!==session||!Number.isSafeInteger(event.seq)||event.seq<=received||typeof event.text!=='string'||event.text.length>500)return;
   const text=clean(event.text);if(!text)return;
   received=event.seq;append(1-mySeat,text);
  }
 };
}
