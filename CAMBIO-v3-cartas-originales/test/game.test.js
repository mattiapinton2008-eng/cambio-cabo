'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const G=require('../game');
function fresh(){const g=G.createGame([1,2,3].map(i=>({id:`p${i}`,name:`Jugador ${i}`})));for(const p of g.players){G.peek(g,p.id,[p.hand[0].id,p.hand[1].id]);G.finishMemorize(g,p.id);}return g;}
function resolvePowers(g){while(g.powerQueue.length){const q=g.powerQueue[0];G.skipPower(g,q.playerId);}}
test('las cartas rivales no exponen valores en la vista normal',()=>{const g=fresh(),v=G.view(g,'p1');for(const p of v.players)if(p.id!=='p1')for(const c of p.hand)assert.equal('value' in c,false);});
test('la vista permite seleccionar una carta rival sin revelar su valor',()=>{const g=fresh(),v=G.view(g,'p1'),r=v.players.find(p=>p.id==='p2');assert.equal(r.hand.length,4);assert.ok(r.hand.every(c=>typeof c.id==='string'&&!('value' in c)&&!('suit' in c)));});
test('solo se pueden memorizar dos cartas una vez',()=>{const g=G.createGame([{id:'p1',name:'Uno'},{id:'p2',name:'Dos'},{id:'p3',name:'Tres'}]);const p=g.players[0];G.peek(g,'p1',[p.hand[0].id,p.hand[1].id]);assert.throws(()=>G.peek(g,'p1',[p.hand[2].id,p.hand[3].id]));});
test('11 vale cero puntos',()=>assert.equal(G.points({value:11}),0));
test('un acierto propio elimina la carta y un fallo penaliza',()=>{const g=fresh(),p=g.players[0];g.discard=[{id:'top',value:4,suit:'Oros'}];g.quickUntil=8640000000000000;p.hand[0].value=4;const n=p.hand.length;G.quickOwn(g,'p1',p.hand[0].id);assert.equal(p.hand.length,n-1);g.quickUntil=8640000000000000;p.hand[0].value=8;const before=p.hand.length;G.quickOwn(g,'p1',p.hand[0].id);assert.equal(p.hand.length,before+1);});
test('acertar una carta rival obliga a entregar una carta propia',()=>{const g=fresh(),p=g.players[0],r=g.players[1];g.discard=[{id:'top',value:5,suit:'Copas'}];g.quickUntil=8640000000000000;r.hand[0].value=5;const own=p.hand.length;G.quickRival(g,'p1','p2',r.hand[0].id);assert.ok(g.transfer);G.giveCard(g,'p1',p.hand[0].id);assert.equal(p.hand.length,own-1);assert.equal(r.hand.length,4);});
test('el 12 revela las cartas elegidas solo al jugador que lo usa',()=>{const g=fresh(),p=g.players[0],r=g.players[1];g.powerQueue=[{playerId:'p1',value:12}];const result=G.powerStart(g,'p1',12,p.hand[0].id,'p2',r.hand[0].id);assert.ok(result.own.value);assert.equal('value' in G.view(g,'p2').players.find(x=>x.id==='p1').hand[0],false);G.powerDecision(g,'p1','keep');});
test('tocar mesa omite al jugador y revela tras la última vuelta',()=>{const g=fresh();function turn(id){G.beginDraw(g,id);G.resolveDrawChoice(g,id,'center');resolvePowers(g);}turn('p1');G.endTurn(g,'p1');turn('p2');G.endTurn(g,'p2');turn('p3');G.touchTable(g,'p3');turn('p1');G.endTurn(g,'p1');turn('p2');G.endTurn(g,'p2');assert.equal(g.finished,true);assert.equal(g.phase,'finished');});
test('tirada múltiple: acierta si todas las cartas coinciden con el centro',()=>{const g=fresh(),p=g.players[0];g.discard=[{id:'top',value:6,suit:'Oros'}];g.quickUntil=8640000000000000;p.hand[0].value=6;p.hand[1].value=6;const n=p.hand.length;G.quickOwnMany(g,'p1',[p.hand[0].id,p.hand[1].id]);assert.equal(p.hand.length,n-2);assert.equal(g.discard.length,3);});
test('tirada múltiple fallida devuelve las cartas a sus posiciones y penaliza',()=>{const g=fresh(),p=g.players[0];g.discard=[{id:'top',value:6,suit:'Oros'}];g.quickUntil=8640000000000000;p.hand[0].value=7;p.hand[1].value=7;const before=p.hand.map(c=>c.id);G.quickOwnMany(g,'p1',[before[0],before[1]]);assert.deepEqual(p.hand.slice(0,4).map(c=>c.id),before);assert.equal(p.hand.length,5);});


test('la ventana de reacción dura 15 segundos tras descartar',()=>{
 const g=fresh(),before=Date.now();
 G.beginDraw(g,'p1');
 G.resolveDrawChoice(g,'p1','center');
 assert.ok(g.quickUntil>=before+G.CONFIG.QUICK_WINDOW_MS-50);
 assert.equal(G.CONFIG.QUICK_WINDOW_MS,15000);
});
test('el mazo se repone mezclando los descartes cuando se agota',()=>{
 const g=fresh();
 g.deck=[];
 g.discard=[{id:'a',value:2,suit:'Oros'},{id:'b',value:7,suit:'Copas'},{id:'top',value:9,suit:'Bastos'}];
 const c=G.draw(g);
 assert.ok(c && ['a','b'].includes(c.id));
 assert.equal(g.discard.length,1);
 assert.equal(g.discard[0].id,'top');
});
test('una carta propia de valor 9 coincide con un 9 en el centro',()=>{
 const g=fresh(),p=g.players[0];
 g.discard=[{id:'top',value:9,suit:'Oros'}];
 g.quickUntil=Date.now()+15000;
 p.hand[0].value=9;
 const before=p.hand.length;
 G.quickOwn(g,'p1',p.hand[0].id);
 assert.equal(p.hand.length,before-1);
 assert.equal(g.discard.at(-1).value,9);
});
