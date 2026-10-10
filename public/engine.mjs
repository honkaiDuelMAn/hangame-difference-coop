import {gameStream,prepareAudio} from './media.mjs';

export class OriginalGame {
  constructor(container,onState){this.container=container;this.onState=onState;this.ready=false;this.chain=Promise.resolve();}
  call(name,...args){return this.player?.ruffle().callExternalInterface(name,...args);}
  async load(){
    await prepareAudio();
    window.coopEvent=(kind,data)=>{if(kind==='ready'){this.ready=true;this.resolveReady?.();}else if(kind==='state')this.onState(data);};
    this.player=window.RufflePlayer.newest().createPlayer();this.container.replaceChildren(this.player);
    const ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.readyTimer=setTimeout(()=>reject(Error('게임을 불러오지 못했습니다. 새로고침해 다시 시도하세요.')),20000);});
    await this.player.ruffle().load({url:new URL('./game/game-coop.swf',location.href).href,base:new URL('./game/',location.href).href,allowScriptAccess:true,autoplay:'on',unmuteOverlay:'hidden',splashScreen:false,scale:'showAll',forceScale:true,forceAlign:true,salign:'',logLevel:'error'});
    await ready;clearTimeout(this.readyTimer);
    this.canvas=this.player.shadowRoot.querySelector('canvas');
    this.stream=await gameStream(this.canvas);
    return this.stream;
  }
  state(){return this.call('coopSnapshot');}
  start(character){return this.call('coopStart',character);}
  reset(){this.player.ruffle().resume();this.call('coopReset');}
  pause(value){value?this.player.ruffle().suspend():this.player.ruffle().resume();}
  async input(seat,event){
    const before=this.call('coopBeginAction',seat);
    const focus=document.activeElement;
    if(event.kind==='reload'){
      const target=this.player.shadowRoot.querySelector('#container');target.focus();
      target.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true,composed:true}));
      // Poll the original key-driven reload once while Space is held.
      this.call('coopReload');
      target.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true,composed:true}));
    }else{
      const x=event.kind==='life'?276:event.kind==='glasses'?418:event.x;
      const y=['life','glasses'].includes(event.kind)?460:event.y;
      const rect=this.canvas.getBoundingClientRect(),clientX=rect.left+x*rect.width/640,clientY=rect.top+y*rect.height/480;
      const fire=type=>this.canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,clientX,clientY,pointerId:1,pointerType:'mouse',isPrimary:true,button:type==='pointermove'?-1:0,buttons:type==='pointerdown'?1:0}));
      fire('pointermove');
      if(before.mode==='mini'&&before.enabled){
        const deadline=performance.now()+150;
        while(!this.call('coopShoot')&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,8));
      }else{fire('pointerdown');fire('pointerup');}
    }
    await new Promise(resolve=>setTimeout(resolve,85));
    if(focus?.isConnected)focus.focus({preventScroll:true});
    const state=this.call('coopEndAction');this.onState(state);return state;
  }
}
