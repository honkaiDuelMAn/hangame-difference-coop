import test from 'node:test';
import assert from 'node:assert/strict';

const load = path => import(path).catch(() => null);
const codec = await load('../public/net/connection-code.mjs');
const links = await load('../public/net/connection-link.mjs');
const relay = await load('../public/net/reply-relay.mjs');
const fixture = {
  version: 1, kind: 'offer', session: '0123456789abcdef0123456789abcdef', room: 'ABCDEF',
  sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\na=msid:canvas video\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=msid:canvas audio\r\n',
};
const base = 'https://example.test/hangame-difference-coop/index.html?discard=yes#old';

// Removing media SDP preservation would corrupt the description exchanged by peers.
test('compressed HG2 codes preserve a media offer and tolerate pasted whitespace', async () => {
  assert.ok(codec, 'The connection-code module must be available');
  const code = await codec.encodeCode(fixture, {format: 2});
  assert.match(code, /^HG2-[A-Za-z0-9_-]+$/);
  assert.deepEqual(await codec.decodeCode(' \n' + code.slice(0, 12) + '\n' + code.slice(12)), fixture);
});

// A sender without stream compression must still produce a readable invitation.
test('HG1 fallback codes preserve media answers', async () => {
  assert.ok(codec, 'The connection-code module must be available');
  const answer = {...fixture, kind: 'answer'};
  const code = await codec.encodeCode(answer, {legacy: true});
  assert.match(code, /^HG1-/);
  assert.deepEqual(await codec.decodeCode(code), answer);
});

// Accepting an unrelated game, corrupt gzip, or invalid session can mix rooms.
test('codes reject wrong games, corrupt payloads and invalid metadata', async () => {
  assert.ok(codec, 'The connection-code module must be available');
  for (const code of ['IY1-e30', 'HG2-e30', 'ABCDEF', 'HG1-@@@@']) {
    await assert.rejects(() => codec.decodeCode(code));
  }
  await assert.rejects(() => codec.encodeCode({...fixture, session: 'short'}));
  await assert.rejects(() => codec.encodeCode({...fixture, sdp: 'not SDP'}));
  await assert.rejects(() => codec.decodeCode('HG1-' + 'a'.repeat(32768)));
});

// Moving the invitation to the query string would expose it to the page server.
test('invite and answer links use fragments and preserve the exported input helpers', () => {
  assert.ok(links, 'The connection-link module must be available');
  for (const kind of ['invite', 'answer']) {
    const link = links.makeConnectionLink('HG2-AA_bb-11', kind, base);
    assert.equal(link, 'https://example.test/hangame-difference-coop/index.html#' + kind + '=HG2-AA_bb-11');
    assert.deepEqual(links.readConnectionLink(link, base), {kind, code: 'HG2-AA_bb-11'});
    assert.equal(links.connectionInput(link, kind, base), 'HG2-AA_bb-11');
  }
  assert.equal(links.connectionInput(' HG1-e30 ', 'invite', base), 'HG1-e30');
});

// Taking links from another origin or a mismatched response defeats room isolation.
test('connection links reject another origin, another directory and duplicate fragments', () => {
  assert.ok(links, 'The connection-link module must be available');
  for (const link of [
    'https://other.test/hangame-difference-coop/#invite=HG2-AA',
    'https://example.test/another-game/#invite=HG2-AA',
    'https://example.test/hangame-difference-coop/#invite=HG2-AA&answer=HG2-BB',
    'https://example.test/hangame-difference-coop/#invite=IY2-AA',
  ]) assert.throws(() => links.readConnectionLink(link, base));
  assert.throws(() => links.connectionInput('https://example.test/hangame-difference-coop/#answer=HG2-AA', 'invite', base));
  assert.throws(() => links.makeConnectionLink('HG2-AA', 'invite', 'javascript:alert(1)'));
});

// A response opened in another same-browser tab must reach the original host.
test('answer relay delivers once and carries acceptance failures back to the sender', async () => {
  assert.ok(relay, 'The reply-relay module must be available');
  let accepted = [];
  const session = '0123456789abcdef0123456789abcdef';
  const inbox = new relay.AnswerInbox(session, async code => {
    accepted.push(code);
    if (code === 'HG1-fail') throw Error('wrong invitation');
  });
  try {
    await relay.deliverAnswer('HG1-good', session, {timeout: 2000});
    assert.deepEqual(accepted, ['HG1-good']);
    await assert.rejects(() => relay.deliverAnswer('HG1-fail', session, {timeout: 2000}), /wrong invitation/);
    assert.deepEqual(accepted, ['HG1-good', 'HG1-fail']);
  } finally { inbox.close(); }
});

// A missing host tab must not leave the user waiting forever.
test('answer receipt survives connection completion closing its inbox during accept', async () => {
  const session='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';let accepted=0;
  const inbox=new relay.AnswerInbox(session,async()=>{accepted++;inbox.close();});
  try{
    await relay.deliverAnswer('HG3-good',session,{timeout:400});
    assert.equal(accepted,1);assert.equal(inbox.closed,true);
  }finally{inbox.close();}
});

test('answer relay reports a missing original tab', async () => {
  assert.ok(relay, 'The reply-relay module must be available');
  await assert.rejects(() => relay.deliverAnswer('HG1-good', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {timeout: 30}), /방 탭/);
  assert.throws(() => new relay.AnswerInbox('invalid', () => {}));
});
