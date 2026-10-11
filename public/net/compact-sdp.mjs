import {sdpDictionary} from './sdp-dictionary.mjs';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const phrases=sdpDictionary.map(value=>encoder.encode(value));
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const invalid=()=>Error('잘못된 압축 연결 정보입니다.');
const MAX_BYTES=80000,UUID=254,FINGERPRINT=255;
const phraseIDs=new Map(sdpDictionary.map((value,i)=>[value,i+1]));
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=new RegExp('(\\0)|('+sdpDictionary.map(escapeRegex).join('|')+')|([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})|((?:[A-F0-9]{2}:){31}[A-F0-9]{2})','g');

// Match the original text once, so emitted tokens cannot match later phrases.
// Emit markers directly: UTF-8 would change token bytes above 127.
export function packSdp(sdp){
 const bytes=[];let last=0;
 for(const match of sdp.matchAll(pattern)){
  for(const b of encoder.encode(sdp.slice(last,match.index)))bytes.push(b);
  if(match[1]!==undefined)bytes.push(0,0);
  else if(match[2]!==undefined)bytes.push(0,phraseIDs.get(match[2]));
  else{
   bytes.push(0,match[3]?UUID:FINGERPRINT);
   const raw=match[0].replaceAll('-','').replaceAll(':','');
   for(let i=0;i<raw.length;i+=2)bytes.push(parseInt(raw.slice(i,i+2),16));
  }
  last=match.index+match[0].length;
 }
 for(const b of encoder.encode(sdp.slice(last)))bytes.push(b);
 return Uint8Array.from(bytes);
}

export function unpackSdp(bytes){
 const output=[];
 for(let i=0;i<bytes.length;i++){
  if(bytes[i]!==0)output.push(bytes[i]);
  else{
   const token=bytes[++i];
   if(token===0)output.push(0);
   else if(token===UUID||token===FINGERPRINT){
    const size=token===UUID?16:32;if(i+size>=bytes.length)throw invalid();
    const raw=hex(bytes.subarray(i+1,i+1+size));i+=size;
    const value=token===UUID?`${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`:raw.toUpperCase().match(/../g).join(':');
    for(const b of encoder.encode(value))output.push(b);
   }else{
    if(!phrases[token-1])throw invalid();
    for(const b of phrases[token-1])output.push(b);
   }
  }
  if(output.length>MAX_BYTES)throw invalid();
 }
 return decoder.decode(Uint8Array.from(output));
}
