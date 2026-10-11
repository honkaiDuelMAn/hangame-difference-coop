export function normalizeAction(event,state){
  if(state?.mode==='puzzle'&&event?.kind==='click'&&event.y>=445&&event.y<=480){
    if(event.x>=226&&event.x<=334)return {...event,kind:'life'};
    if(event.x>=338&&event.x<=495)return {...event,kind:'glasses'};
  }
  return event;
}
export class CoopRoom {
  constructor(run){this.run=run;this.characters=[null,null];this.phase='selecting';this.connected=false;this.paused=false;this.lockUntil=0;this.sequences=[0,0];}
  setConnected(value){this.connected=Boolean(value);}
  select(seat,character){
    if(!this.connected||this.phase!=='selecting'||![0,1].includes(seat)||!Number.isInteger(character)||character<1||character>5)return {ok:false,error:'지금은 캐릭터를 선택할 수 없습니다.'};
    if(character!==seat+1)return {ok:false,error:'연필 포인터를 위해 1P는 소년, 2P는 소녀로 고정됩니다.'};
    if(this.characters[1-seat]===character)return {ok:false,error:'상대가 먼저 선택한 캐릭터입니다.'};
    this.characters[seat]=character;
    if(this.characters.every(c=>c!==null))this.phase='playing';
    return {ok:true,start:this.phase==='playing'};
  }
  authorize(seat,event,state,now){
    event=normalizeAction(event,state);
    const fail=error=>({ok:false,error});
    if(!this.connected||this.paused||this.phase!=='playing')return fail('게임 진행이 멈춰 있습니다.');
    if(![0,1].includes(seat)||!event||event.run!==this.run||!Number.isSafeInteger(event.seq)||event.seq<=this.sequences[seat])return fail('만료되거나 중복된 요청입니다.');
    this.sequences[seat]=event.seq;
    if(event.epoch!==state.epoch)return fail('그림이나 게임 단계가 바뀌었습니다.');
    if(!['click','life','glasses','reload'].includes(event.kind))return fail('올바른 조작이 아닙니다.');
    if(event.kind==='click'){
      if(!Number.isFinite(event.x)||!Number.isFinite(event.y)||event.x<0||event.x>640||event.y<0||event.y>480)return fail('게임 화면 안을 클릭하세요.');
      // Native intro/result buttons remain usable while picture clicks are disabled.
      if(state.mode==='puzzle'&&!state.enabled&&event.y<443)return fail('다음 그림을 준비하고 있습니다.');
    }
    if(event.kind==='life'||event.kind==='glasses'){
      if(state.mode!=='puzzle'||!state.enabled)return fail('그림을 찾는 동안 사용할 수 있습니다.');
      if((event.kind==='life'?state.life:state.item)<=0)return fail('공유 아이템을 모두 사용했습니다.');
      if(now<this.lockUntil)return fail('공유 아이템을 사용했습니다. 1초 뒤에 다시 누르세요.');
      this.lockUntil=now+1000;
    }
    if(event.kind==='reload'&&state.mode!=='mini')return fail('사격 훈련 중에 장전할 수 있습니다.');
    return {ok:true,event};
  }
}
