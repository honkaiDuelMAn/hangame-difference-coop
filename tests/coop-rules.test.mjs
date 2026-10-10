import test from 'node:test';
import assert from 'node:assert/strict';
import {CoopRoom} from '../public/net/coop-rules.mjs';

const playing=()=>{const r=new CoopRoom('run-a');r.setConnected(true);r.select(0,1);r.select(1,2);return r;};
const state={epoch:'puzzle:1:1',mode:'puzzle',enabled:true,life:3,item:5};
const input=(seq,kind='click',extra={})=>({run:'run-a',epoch:state.epoch,seq,kind,x:100,y:100,...extra});

test('fixed pencil characters require connection and both players to become ready',()=>{const r=new CoopRoom('run-a');assert.equal(r.select(0,1).ok,false);r.setConnected(true);assert.equal(r.select(0,1).ok,true);assert.equal(r.phase,'selecting');assert.equal(r.select(1,2).ok,true);assert.equal(r.phase,'playing');assert.deepEqual(r.characters,[1,2]);});
test('1P cannot choose girl or portraits without an original pencil cursor',()=>{const r=new CoopRoom('run-a');r.setConnected(true);for(const c of [2,3,4,5])assert.equal(r.select(0,c).ok,false);assert.deepEqual(r.characters,[null,null]);});
test('2P is fixed to the girl and cannot take the boy or a portrait',()=>{const r=new CoopRoom('run-a');r.setConnected(true);for(const c of [1,3,4,5])assert.equal(r.select(1,c).ok,false);assert.equal(r.select(1,2).ok,true);assert.deepEqual(r.characters,[null,2]);});
test('both resource types share a 1000ms lock including the other seat and exact expiry',()=>{const r=playing();assert.equal(r.authorize(0,input(1,'life'),state,100).ok,true);assert.equal(r.authorize(1,input(1,'glasses'),state,1099).ok,false);assert.equal(r.authorize(1,input(2,'glasses'),state,1100).ok,true);assert.equal(r.authorize(0,input(2,'life'),state,1200).ok,false);});
test('empty resources and loading scenes do not consume the item lock',()=>{const r=playing();assert.equal(r.authorize(0,input(1,'life'),{...state,life:0},0).ok,false);assert.equal(r.authorize(1,input(1,'glasses'),{...state,enabled:false},1).ok,false);assert.equal(r.authorize(0,input(2,'glasses'),state,2).ok,true);});
test('replayed, stale stage and previous session requests cannot be applied again',()=>{const r=playing();assert.equal(r.authorize(0,input(1),state,0).ok,true);assert.equal(r.authorize(0,input(1),state,1).ok,false);assert.equal(r.authorize(1,input(1,'life',{epoch:'puzzle:0:1'}),state,2).ok,false);assert.equal(r.authorize(1,input(2,'life',{run:'old'}),state,3).ok,false);assert.equal(r.authorize(1,input(3,'life'),state,4).ok,true);});
test('pause and disconnect stop both seats from forwarding game input',()=>{const r=playing();r.paused=true;assert.equal(r.authorize(0,input(1),state,0).ok,false);r.paused=false;r.setConnected(false);assert.equal(r.authorize(1,input(1),state,1).ok,false);});
test('malformed seats, character IDs, coordinates and commands are rejected',()=>{const r=playing();for(const p of [input(1,'script'),input(2,'click',{x:NaN}),input(3,'click',{x:-1}),input(4,'click',{y:481})])assert.equal(r.authorize(1,p,state,0).ok,false);assert.equal(r.authorize(9,input(5),state,0).ok,false);assert.equal(r.select(0,8).ok,false);});
test('minigame reload belongs to requesting seat and does not lock shared resources',()=>{const r=playing();assert.equal(r.authorize(1,input(1,'reload',{epoch:'mini:1'}),{...state,epoch:'mini:1',mode:'mini'},0).ok,true);assert.equal(r.lockUntil,0);assert.equal(r.authorize(0,input(1,'reload'),state,1).ok,false);});
