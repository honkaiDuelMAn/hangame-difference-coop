import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
export const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/whdhk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
export const launchOptions={executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding']};
export async function serve(){
 const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.swf':'application/x-shockwave-flash','.xml':'application/xml','.png':'image/png'};
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let name=u.pathname==='/'?'index.html':u.pathname.slice(1);const base=name.startsWith('tests/')?root:path.join(root,'public');const file=path.resolve(base,name);if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,url:`http://127.0.0.1:${server.address().port}/`};
}
export async function connect(host,guest,url,{relay=false}={}){
 await host.goto(url);await host.locator('#createRoom').click();await host.waitForFunction(()=>/#(?:invite|i)=/.test(document.querySelector('#outputLink').value),null,{timeout:45000});
 await guest.goto(await host.locator('#outputLink').inputValue());await guest.waitForFunction(()=>/#(?:answer|a)=/.test(document.querySelector('#outputLink').value),null,{timeout:45000});
 const answer=await guest.locator('#outputLink').inputValue();
 if(relay){const receipt=await host.context().newPage();await receipt.goto(answer);await receipt.waitForFunction(()=>document.querySelector('#lobbyTitle').textContent==='응답 전달 완료');await receipt.close();await host.bringToFront();}
 else{await host.locator('#answerInput').fill(answer);await host.locator('#answerForm button').click();}
 try{
  await host.waitForFunction(()=>document.querySelector('#connectionBadge').textContent==='연결 완료');await guest.waitForFunction(()=>document.querySelector('#connectionBadge').textContent==='연결 완료');
 }catch(error){
  for(const [name,page] of [['host',host],['guest',guest]])console.log(name,await page.evaluate(()=>({badge:document.querySelector('#connectionBadge').textContent,message:document.querySelector('#message').textContent})));
  throw error;
 }
}
export async function clickAt(page,x,y){const r=await page.locator('#stage').boundingBox();await page.mouse.click(r.x+r.width*x/640,r.y+r.height*y/480);}
export async function nativeCall(page,name,...args){return page.evaluate(({name,args})=>document.querySelector('ruffle-player').ruffle().callExternalInterface(name,...args),{name,args});}
export async function target(page,index){const s=await nativeCall(page,'probeState');const b=s.boxes[index*2].bounds;return {x:(b.xMin+b.xMax)/2,y:(b.yMin+b.yMax)/2};}
