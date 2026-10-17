// Capture the game's own generated canvas and audio. No camera, microphone or
// screen-capture permission is requested.
let mix,output,previewGain,hostVolume=.65;
const sourceContexts=new Set(),captured=new WeakMap();
const nativeConnect=AudioNode.prototype.connect;
export async function prepareAudio(){
  if(!mix){
    mix=new AudioContext();output=mix.createMediaStreamDestination();previewGain=mix.createGain();previewGain.gain.value=hostVolume;
    nativeConnect.call(previewGain,mix.destination);
    AudioNode.prototype.connect=function(destination,...args){
      if(destination===this.context.destination&&this.context!==mix){
        let tap=captured.get(this.context);
        if(!tap){
          tap=this.context.createMediaStreamDestination();captured.set(this.context,tap);sourceContexts.add(this.context);
          const source=mix.createMediaStreamSource(tap.stream);nativeConnect.call(source,output);nativeConnect.call(source,previewGain);
        }
        nativeConnect.call(this,tap,...args);return destination;
      }
      return nativeConnect.call(this,destination,...args);
    };
  }
  await mix.resume();for(const context of sourceContexts)if(context.state==='suspended')await context.resume();
  return output.stream;
}
export async function gameStream(canvas){
  const audio=await prepareAudio();
  if(typeof canvas.captureStream!=='function')throw Error('이 브라우저는 게임 화면 전달을 지원하지 않습니다. 최신 Chrome 또는 Edge로 접속하세요.');
  return new MediaStream([...canvas.captureStream(30).getVideoTracks(),...audio.getAudioTracks()]);
}
export function setHostVolume(value){hostVolume=value;if(previewGain)previewGain.gain.value=value;}
