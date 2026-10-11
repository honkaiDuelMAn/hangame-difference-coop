import {gameStream,prepareAudio} from './media.mjs';

export class OriginalGame {
  constructor(container,onState){this.container=container;this.onState=onState;this.ready=false;this.chain=Promise.resolve();}
  call(name,...args){return this.player?.ruffle().callExternalInterface(name,...args);}
  async load(){
    await prepareAudio();
    window.coopEvent=(kind,data)=>{if(kind==='ready'){this.ready=true;this.resolveReady?.();}else if(kind==='state'){this.updatePixelGrid();this.onState(data);}};
    this.player=window.RufflePlayer.newest().createPlayer();this.container.replaceChildren(this.player);
    const ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.readyTimer=setTimeout(()=>reject(Error('게임을 불러오지 못했습니다. 새로고침해 다시 시도하세요.')),20000);});
    await this.player.ruffle().load({url:new URL('./game/game-coop.swf',location.href).href,base:new URL('./game/',location.href).href,allowScriptAccess:true,autoplay:'on',unmuteOverlay:'hidden',splashScreen:false,scale:'showAll',forceScale:true,forceAlign:true,salign:'',logLevel:'error'});
    await ready;clearTimeout(this.readyTimer);
    this.canvas=this.player.shadowRoot.querySelector('canvas');
    this.resizeObserver=new ResizeObserver(()=>this.updatePixelGrid());this.resizeObserver.observe(this.container);this.resizeObserver.observe(this.canvas);this.updatePixelGrid();
    this.stream=await gameStream(this.canvas);
    return this.stream;
  }
  state(){return this.call('coopSnapshot');}
  updatePixelGrid(){
    if(!this.canvas||!this.ready)return;
    this.call('coopPixelGrid',this.canvas.width,this.canvas.height);
  }
  start(character){return this.call('coopStart',character);}
  reset(){this.player.ruffle().resume();this.call('coopReset');this.paused=false;}
  pause(value){
    if(this.paused===value)return;
    this.call('coopPause',value);this.paused=value;
    value?this.player.ruffle().suspend():this.player.ruffle().resume();
  }
  async input(seat,event){
    const before=this.call('coopBeginAction',seat);
    const focus=document.activeElement;
    // Ruffle focuses its container on pointerdown. Focus it without scrolling
    // first, so the native event uses the same canvas position as the overlay.
    const target=this.player.shadowRoot.querySelector('#container');
    target.focus({preventScroll:true});
    const restoreFocus=()=>{if(focus?.isConnected&&document.activeElement===this.player)focus.focus({preventScroll:true});};
    if(event.kind==='reload'){
      target.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true,composed:true}));
      // Poll the original key-driven reload once while Space is held.
      this.call('coopReload');
      target.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',keyCode:32,which:32,bubbles:true,composed:true}));
    }else if(['life','glasses'].includes(event.kind)){
      const rect=this.canvas.getBoundingClientRect(),outside={clientX:rect.left-4,clientY:rect.top-4};
      // The original handler keeps the effect and cost, without showing the
      // native button's shortcut card over the cooperative picture.
      for(const type of ['pointermove','pointerleave'])this.canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,...outside,pointerId:1,pointerType:'mouse',isPrimary:true,button:-1,buttons:0}));
      this.call('coopUseItem',event.kind);
    }else{
      const x=event.x,y=event.y;
      const rect=this.canvas.getBoundingClientRect(),clientX=rect.left+x*rect.width/640,clientY=rect.top+y*rect.height/480;
      const fire=type=>this.canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,clientX,clientY,pointerId:1,pointerType:'mouse',isPrimary:true,button:type==='pointermove'?-1:0,buttons:type==='pointerdown'?1:0}));
      fire('pointermove');
      if(before.mode==='result'){
        this.call('coopResultButton',x,y);
      }else if(before.mode==='mini'&&before.enabled){
        restoreFocus();
        const deadline=performance.now()+150;
        while(!this.call('coopShoot')&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,8));
      }else if(before.mode!=='mini-intro'||!this.call('coopIntroButton',x,y)){fire('pointerdown');fire('pointerup');}
    }
    restoreFocus();
    await new Promise(resolve=>setTimeout(resolve,85));
    const state=this.call('coopEndAction');this.onState(state);return state;
  }
}
