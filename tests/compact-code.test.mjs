import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deflateSync} from 'node:zlib';
import {encodeCode,decodeCode} from '../public/net/connection-code.mjs';
import {makeConnectionLink,readConnectionLink,connectionInput} from '../public/net/connection-link.mjs';
import {unpackSdp} from '../public/net/compact-sdp.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/media-signals.json',import.meta.url),'utf8'));
const golden=JSON.parse(fs.readFileSync(new URL('./fixtures/media-signals.hg3.json',import.meta.url),'utf8'));
const base='https://example.test/hangame-difference-coop/index.html?old=true';

// Removing the media dictionary or binary packing would exceed message budgets.
for(const [kind,value] of Object.entries(fixtures))test(`compact ${kind} fits a message and restores every original SDP byte`,async()=>{
 const code=await encodeCode(value),old=await encodeCode(value,{format:2});
 assert.match(code,/^HG3-/);
 assert.ok(code.length<(kind==='offer'?1000:700),`${kind}: ${code.length} chars`);
 assert.ok(code.length<old.length*.5,`${code.length} / ${old.length}`);
 assert.deepEqual(await decodeCode(code),value);
 console.log(JSON.stringify({kind,old:old.length,compact:code.length}));
});

// Unknown browser extensions and token-like characters must never be removed.
test('compact packing preserves unknown SDP, uppercase IDs, Unicode and literal token bytes',async()=>{
 const value={...fixtures.answer,sdp:'v=0\r\na=x-unknown:β 한글 \0\u0080\u00fe\u00ff\r\na=custom:01234567-89AB-CDEF-0123-456789ABCDEF\r\na=fingerprint:sha-256 aa:bb:cc\r\n'};
 const code=await encodeCode(value);assert.deepEqual(await decodeCode(code),value);
});

// A later phrase must not reinterpret bytes emitted for an earlier phrase.
test('adjacent unknown text cannot turn an emitted dictionary marker into another match',async()=>{
 const value={...fixtures.answer,sdp:'v=0\r\na=rtcp-fb:49 goog-remb\r\n=msid:unchanged\r\n'};
 assert.deepEqual(await decodeCode(await encodeCode(value)),value);
});

// A cached old host must be able to decode responses to its older invitations.
test('HG1 and HG2 encoding remain available and older invitations still decode',async()=>{
 for(const value of Object.values(fixtures))for(const format of [1,2]){
  const code=await encodeCode(value,{legacy:format===1,format});
  assert.ok(code.startsWith(`HG${format}-`));assert.deepEqual(await decodeCode(code),value);
 }
});

// Reordering HG3's frozen dictionary would break already shared invitations.
test('previously encoded HG3 fixtures still decode to their original signals',async()=>{
 for(const [kind,code] of Object.entries(golden))assert.deepEqual(await decodeCode(code),fixtures[kind]);
});

// Compact fragment aliases reduce length without leaking credentials into queries.
test('compact links drop index.html and use short invitation and answer fragments',()=>{
 for(const [kind,key] of [['invite','i'],['answer','a']]){
  const link=makeConnectionLink('HG3-AA_bb-11',kind,base);
  assert.equal(link,`https://example.test/hangame-difference-coop/#${key}=HG3-AA_bb-11`);
  assert.deepEqual(readConnectionLink(link,base),{kind,code:'HG3-AA_bb-11'});
  assert.equal(connectionInput(link,kind,base),'HG3-AA_bb-11');
  assert.equal(connectionInput(' HG3-AA_bb-11 ',kind,base),'HG3-AA_bb-11');
 }
 assert.throws(()=>readConnectionLink('https://example.test/hangame-difference-coop/#i=HG3-AA&a=HG3-BB',base));
});

// Corruption and dictionary expansion must fail before reaching WebRTC.
test('compact decoding rejects corrupted, truncated and oversized packed signals',async()=>{
 const code=await encodeCode(fixtures.offer);
 const bytes=Buffer.from(code.slice(4),'base64url');bytes[Math.floor(bytes.length/2)]^=1;
 await assert.rejects(()=>decodeCode('HG3-'+bytes.toString('base64url')));
 await assert.rejects(()=>decodeCode(code.slice(0,-10)));
 const metadata=Buffer.concat([Buffer.from([0]),Buffer.from(fixtures.offer.session+fixtures.offer.room,'hex')]);
 const expansion=Buffer.concat([Buffer.from('v=0\r\n'),Buffer.from(Array(100).fill([0,1]).flat())]);
 assert.throws(()=>unpackSdp(expansion),'dictionary expansion has its own output bound');
 for(const body of [Buffer.from([0,253]),Buffer.from([0,254,1]),Buffer.from([0,255,1]),Buffer.from([0xff]),Buffer.from('v=0\r\n'+'a'.repeat(80001)),expansion]){
  const payload=deflateSync(Buffer.concat([metadata,body]));
  await assert.rejects(()=>decodeCode('HG3-'+payload.toString('base64url')));
 }
});
