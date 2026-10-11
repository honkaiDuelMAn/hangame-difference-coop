const CODE_LIMIT=32768,LINK_LIMIT=100000;
const error=()=>Error('이 게임의 전체 초대 또는 응답 링크를 입력하세요.');
function pageURL(base){
  const url=new URL(base);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw error();
  url.search='';url.hash='';return url;
}
function validCode(code){return typeof code==='string'&&code.length<=CODE_LIMIT&&/^HG[123]-\S+$/.test(code);}
export function makeConnectionLink(code,kind,base){
  if(!['invite','answer'].includes(kind)||!validCode(code))throw error();
  const url=pageURL(base),compact=code.startsWith('HG3-');
  if(compact&&url.pathname.endsWith('/index.html'))url.pathname=url.pathname.slice(0,-10);
  url.hash=new URLSearchParams({[compact?(kind==='invite'?'i':'a'):kind]:code}).toString();return url.href;
}
export function readConnectionLink(text,base){
  if(typeof text!=='string'||text.length>LINK_LIMIT)throw error();
  const source=pageURL(base);let url;
  try{url=new URL(text.trim());}catch{throw error();}
  const directory=new URL('.',source).pathname;
  if(url.origin!==source.origin||url.username||url.password||
     ![source.pathname,directory,directory+'index.html',directory+'direct.html'].includes(url.pathname))throw error();
  const entries=[...new URLSearchParams(url.hash.slice(1))];
  const kinds={invite:'invite',answer:'answer',i:'invite',a:'answer'};
  if(entries.length!==1||!Object.hasOwn(kinds,entries[0][0])||!validCode(entries[0][1]))throw error();
  return {kind:kinds[entries[0][0]],code:entries[0][1]};
}
export function connectionInput(text,expected,base){
  if(typeof text!=='string'||text.length>LINK_LIMIT)throw error();
  const trimmed=text.trim();
  if(/^HG[123]-/.test(trimmed))return trimmed;
  const link=readConnectionLink(trimmed,base);
  if(link.kind!==expected)throw Error(expected==='invite'?'호스트의 초대 링크를 입력하세요.':'참가자의 응답 링크를 입력하세요.');
  return link.code;
}
