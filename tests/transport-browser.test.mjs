import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/whdhk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

async function startServer() {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/transport-test.html') {
      response.writeHead(200, {'Content-Type': 'text/html'}).end('<!doctype html><title>Transport test</title><canvas id="source" width="96" height="64"></canvas><video id="received" autoplay playsinline muted></video><div style="width:280px"><canvas id="qr"></canvas></div>');
      return;
    }
    const file = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(publicRoot + path.sep)) { response.writeHead(403).end(); return; }
    try { const content = await readFile(file); response.writeHead(200, {'Content-Type': 'text/javascript'}).end(content); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {server, base: `http://127.0.0.1:${server.address().port}`};
}

// Removing addTrack or omitting a combined received stream must break real canvas frames.
test('two independent browsers exchange data and generated canvas video plus audio', {timeout: 90000}, async () => {
  const {server, base} = await startServer();
  const browsers = [];
  const issues = [];
  try {
    for (let i = 0; i < 2; i++) browsers.push(await chromium.launch({executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required']}));
    const host = await browsers[0].newPage(), guest = await browsers[1].newPage();
    for (const page of [host, guest]) {
      page.on('pageerror', error => issues.push(error.message));
      await page.goto(base + '/transport-test.html');
      await page.evaluate(async () => {
        window.ManualPeer = (await import('/net/manual-peer.mjs')).ManualPeer;
        window.messages = []; window.states = []; window.incoming = null;
        window.peerOptions = {
          onMessage: event => messages.push(event),
          onState: state => states.push(state),
          onTrack: stream => {
            window.incoming = stream;
            const video = document.querySelector('#received');
            if (video.srcObject !== stream) video.srcObject = stream;
            video.play().catch(error => { window.playError = error.message; });
          },
        };
      });
    }
    const offer = await host.evaluate(async () => {
      const canvas = document.querySelector('#source'), context = canvas.getContext('2d');
      window.paint = color => { context.fillStyle = color; context.fillRect(0, 0, canvas.width, canvas.height); };
      paint('#ef1634');
      window.paintTimer = setInterval(() => {
        context.fillRect(0, 0, canvas.width, canvas.height);
      }, 50);
      const audio = window.audioContext = new AudioContext();
      await audio.resume();
      const destination = audio.createMediaStreamDestination();
      window.oscillator = audio.createOscillator(); oscillator.connect(destination); oscillator.start();
      window.outgoing = new MediaStream([...canvas.captureStream(20).getVideoTracks(), ...destination.stream.getAudioTracks()]);
      window.peer = new ManualPeer({...peerOptions, mediaStream: outgoing});
      return peer.offer('ABCDEF');
    });
    assert.match(offer, /^HG2-/);
    const inviteQR = await host.evaluate(async offer => {
      const {drawQR} = await import('/qr.mjs');
      const {makeConnectionLink} = await import('/net/connection-link.mjs');
      const link = makeConnectionLink(offer, 'invite', location.href);
      let error = null;
      try { drawQR(document.querySelector('#qr'), link); } catch (failure) { error = failure.message; }
      return {codeLength: offer.length, linkLength: link.length, width: document.querySelector('#qr').width, error};
    }, offer);
    assert.equal(inviteQR.error, null, 'the real media invitation must fit a local QR: ' + JSON.stringify(inviteQR));
    const answer = await guest.evaluate(async offer => {
      window.peer = new ManualPeer(peerOptions);
      return peer.answer(offer);
    }, offer);
    await host.evaluate(answer => peer.accept(answer), answer);
    await Promise.all([host, guest].map(page => page.waitForFunction(() => states.includes('connected'), null, {timeout: 20000})));
    await host.evaluate(() => peer.send({type: 'snapshot', score: 17, room: 'ABCDEF'}));
    await guest.evaluate(() => peer.send({type: 'input', x: 0.25, y: 0.5}));
    await Promise.all([host, guest].map(page => page.waitForFunction(() => messages.length > 0, null, {timeout: 3000})));
    assert.deepEqual(await host.evaluate(() => messages), [{type: 'input', x: 0.25, y: 0.5}]);
    assert.deepEqual(await guest.evaluate(() => messages), [{type: 'snapshot', score: 17, room: 'ABCDEF'}]);
    for (const page of [host, guest]) await page.evaluate(() => { window.heartbeatBaseline = peer.lastSeen; });
    await Promise.all([host, guest].map(page => page.waitForFunction(() => peer.lastSeen > heartbeatBaseline, null, {timeout: 5000})));
    assert.deepEqual(await host.evaluate(() => messages), [{type: 'input', x: 0.25, y: 0.5}], 'heartbeat controls must not reach the game');
    assert.deepEqual(await guest.evaluate(() => messages), [{type: 'snapshot', score: 17, room: 'ABCDEF'}], 'heartbeat controls must not reach the game');
    await guest.waitForFunction(() => incoming?.getVideoTracks().length === 1 && incoming?.getAudioTracks().length === 1 && document.querySelector('#received').videoWidth === 96, null, {timeout: 10000});
    await guest.evaluate(() => {
      window.samplePixel = () => {
        const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 64;
        const context = canvas.getContext('2d'); context.drawImage(document.querySelector('#received'), 0, 0);
        return Array.from(context.getImageData(30, 30, 1, 1).data);
      };
    });
    await guest.waitForFunction(() => { const [r, g, b] = samplePixel(); return r > 180 && g < 70 && b < 100; }, null, {timeout: 5000});
    await host.evaluate(() => paint('#12d841'));
    await guest.waitForFunction(() => { const [r, g, b] = samplePixel(); return r < 70 && g > 160 && b < 110; }, null, {timeout: 5000});
    const stats = await guest.evaluate(async () => {
      const report = await peer.pc.getStats();
      return [...report.values()].filter(value => value.type === 'inbound-rtp').map(({kind, framesDecoded, packetsReceived, bytesReceived}) => ({kind, framesDecoded, packetsReceived, bytesReceived}));
    });
    assert.ok(stats.some(value => value.kind === 'video' && value.framesDecoded > 1 && value.bytesReceived > 0), JSON.stringify(stats));
    assert.ok(stats.some(value => value.kind === 'audio' && value.packetsReceived > 0), JSON.stringify(stats));
    assert.deepEqual(await host.evaluate(() => peer.pc.getConfiguration().iceServers.flatMap(server => server.urls)), ['stun:stun.cloudflare.com:3478']);
    assert.equal(await guest.evaluate(() => peer.pc.getSenders().filter(sender => sender.track).length), 0);
    assert.equal(await host.evaluate(() => peer.channel.label), 'hangame-difference-coop');
    const checks = await host.evaluate(async () => {
      const {decodeCode, encodeCode} = await import('/net/connection-code.mjs');
      const current = await decodeCode(await peer.gather());
      const wrong = await encodeCode({...current, kind: 'answer', session: 'ffffffffffffffffffffffffffffffff'});
      let sessionRejected = false;
      try { await peer.accept(wrong); } catch (error) { sessionRejected = /현재 초대/.test(error.message); }
      return {sessionRejected, mediaLive: outgoing.getTracks().every(track => track.readyState === 'live')};
    });
    assert.equal(checks.sessionRejected, true);
    assert.equal(checks.mediaLive, true);
    await host.evaluate(() => peer.close());
    await guest.waitForFunction(() => states.includes('closed'), null, {timeout: 3000});
    assert.equal(await host.evaluate(() => outgoing.getTracks().every(track => track.readyState === 'live')), true, 'peer must not stop the game-owned source tracks');
    assert.deepEqual(issues, []);
    console.log(JSON.stringify({transport: 'two Chrome browser processes', stats, inviteQR, generatedMedia: 'canvas + Web Audio', data: 'bidirectional', heartbeat: 'ping/pong filtered'}));
  } finally {
    for (const browser of browsers) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

// QR generation must work offline and paint both the quiet border and dark modules.
test('invitation QR renders locally without external requests', {timeout: 15000}, async () => {
  const {server, base} = await startServer();
  const browser = await chromium.launch({executablePath, headless: true});
  const external = [];
  try {
    const page = await browser.newPage();
    page.on('request', request => { if (!request.url().startsWith(base)) external.push(request.url()); });
    await page.goto(base + '/transport-test.html');
    const rendered = await page.evaluate(async () => {
      const {drawQR} = await import('/qr.mjs');
      const canvas = document.querySelector('#qr');
      drawQR(canvas, location.origin + '/#invite=HG2-example');
      const context = canvas.getContext('2d');
      const whiteBorder = Array.from(context.getImageData(0, 0, 1, 1).data);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === 0 && data[i + 3] === 255) dark++;
      return {whiteBorder, dark, width: canvas.width, height: canvas.height, styleWidth: parseInt(canvas.style.width)};
    });
    assert.deepEqual(rendered.whiteBorder, [255, 255, 255, 255]);
    assert.ok(rendered.dark > 1000);
    assert.equal(rendered.width, rendered.height);
    assert.ok(rendered.styleWidth <= 280);
    assert.deepEqual(external, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
