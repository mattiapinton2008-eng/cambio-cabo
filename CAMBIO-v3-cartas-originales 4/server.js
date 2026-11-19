'use strict';
const express=require('express'),http=require('http'),crypto=require('crypto');const {Server}=require('socket.io');const G=require('./game');const {Bot,BOT_NAMES}=require('./bot');
const app=express(),server=http.createServer(app),io=new Server(server);app.use(express.static('public'));app.get('/health',(_,res)=>res.json({ok:true}));
const rooms=new Map(),sessions=new Map();const code=()=>crypto.randomBytes(3).toString('hex').toUpperCase();const base=()=>process.env.PUBLIC_URL||'http://localhost:'+ (process.env.PORT||3000);
function roomOf(id){const r=rooms.get(String(id||'').toUpperCase());if(!r)throw Error('No existe esa sala.');return r;}
function who(socket,r){return r.game?.players.find(p=>p.socketId===socket.id)?.id;}
function sendState(r){for(const p of r.game.players)if(p.socketId)io.to(p.socketId).emit('state',G.view(r.game,p.id));}
function lobby(r){io.to(r.id).emit('lobby',{roomId:r.id,host:r.host,players:r.game.players.map(p=>({id:p.id,name:p.name,isBot:!!p.isBot,connected:!!p.connected})),started:['play','finished'].includes(r.game.phase)});}
function reply(socket,fn){return (...args)=>{try{fn(...args);}catch(e){socket.emit('toast',e.message||'No se pudo realizar la acción.');}};}
function makeBot(r,difficulty='Normal'){if(r.game.players.length>=8)throw Error('La sala está completa.');const name=BOT_NAMES.find(n=>!r.game.players.some(p=>p.name===n))||`Bot ${r.game.players.length}`;const id=G.uid();r.game.players.push({id,name,isBot:true,connected:true});r.bots.set(id,new Bot(id,name,difficulty));}
function prepare(r){const players=r.game.players.map(p=>({id:p.id,name:p.name,isBot:p.isBot,connected:p.connected,socketId:p.socketId}));r.game=G.createGame(players,r.mode);r.bots.forEach((b,id)=>{const p=G.player(r.game,id);if(p){b.memory=new Map();const picks=[0,2];b.positions=picks.map(i=>p.hand[i].id);b.memory=new Map(picks.map(i=>[p.hand[i].id,{value:p.hand[i].value,confidence:1}]));G.finishMemorize(r.game,id);}});sendState(r);scheduleBot(r);}
function createRoom(mode){let id;do{id=code();}while(rooms.has(id));const r={id,mode,host:null,game:{players:[],phase:'lobby'},bots:new Map(),timers:new Set(),reactionTimers:new Set(),lastReactionTop:null};rooms.set(id,r);return r;}
function scheduleBot(r){if(r.botTimer||!r.game||r.game.finished||r.game.phase!=='play')return;const p=r.game.players[r.game.turn];if(!p?.isBot||r.game.pendingDraw||r.game.pendingPower||r.game.transfer)return;const bot=r.bots.get(p.id);r.botTimer=setTimeout(()=>{r.botTimer=null;try{botTurn(r,p.id);}catch(e){console.error('Bot action:',e);try{if(r.game.pendingDraw?.playerId===p.id)G.resolveDrawChoice(r.game,p.id,'center');}catch{} }sendState(r);scheduleBot(r);},bot?.delay()||1300);}
function scheduleBotReactions(r){
 const g=r.game,top=G.top(g);if(!top||!g.quickUntil||g.quickUntil<=Date.now()||g.pendingDraw||g.pendingPower||g.transfer)return;
 if(r.lastReactionTop===top.id)return;r.lastReactionTop=top.id;
 for(const [botId,bot] of r.bots){
  const p=G.player(g,botId);if(!p||!p.hand.length)continue;
  const confidence=bot.difficulty==='Dificil'?.55:bot.difficulty==='Normal'?.72:.9;
  let own=p.hand.find(c=>{const m=bot.memory.get(c.id);return m&&m.value===top.value&&m.confidence>=confidence;});
  let rival=null;
  if(!own){for(const other of g.players){if(other.id===botId)continue;for(const card of other.hand){const m=bot.memory.get(`${other.id}:${card.id}`);if(m&&m.value===top.value&&m.confidence>=confidence){rival={target:other.id,card:card.id};break;}}if(rival)break;}}
  if(!own&&!rival)continue;
  const [min,max]=bot.difficulty==='Dificil'?[900,1800]:bot.difficulty==='Normal'?[1600,2800]:[2400,3800];
  const timer=setTimeout(()=>{r.reactionTimers.delete(timer);try{if(g.quickUntil<=Date.now()||G.top(g)?.id!==top.id)return;if(own&&G.player(g,botId)?.hand.some(c=>c.id===own.id)){G.quickOwn(g,botId,own.id);}else if(rival&&G.player(g,rival.target)?.hand.some(c=>c.id===rival.card)){G.quickRival(g,botId,rival.target,rival.card);}sendState(r);scheduleBot(r);}catch{}},min+Math.random()*(max-min));r.reactionTimers.add(timer);
 }
}
function botTurn(r,id){
 const g=r.game,bot=r.bots.get(id);if(!bot||g.turn!==g.players.findIndex(p=>p.id===id))return;
 // El bot decide usando exactamente la vista filtrada disponible para un jugador.
 const before=G.view(g,id);if(!before)return;
 G.beginDraw(g,id);
 const ownView=G.view(g,id),drawn=ownView.drawn;
 if(!drawn){G.endTurn(g,id);return;}
 const known=[...bot.memory.entries()].filter(([cid,v])=>before.players.find(p=>p.id===id)?.hand.some(c=>c.id===cid)&&v.confidence>.55).sort((a,b)=>b[1].value-a[1].value);
 const high=known.find(([,v])=>v.value>drawn.value);
 if(high)G.resolveDrawChoice(g,id,'replace',high[0]);else G.resolveDrawChoice(g,id,'center');
 let v=G.view(g,id),q=v.pendingPower;
 while(q&&q.playerId===id){
  const me=v.players.find(p=>p.id===id),targets=v.players.filter(p=>p.id!==id&&p.count>0);
  if(!me?.count||!targets.length){G.skipPower(g,id);}
  else{
   const target=targets[Math.floor(Math.random()*targets.length)],ownKnown=me.hand.map(c=>({id:c.id,known:bot.memory.get(c.id)})).filter(x=>x.known).sort((a,b)=>b.known.value-a.known.value);
   const own=ownKnown[0]?.id||me.hand[Math.floor(Math.random()*me.hand.length)]?.id;
   const other=target.hand[Math.floor(Math.random()*target.hand.length)]?.id;
   if(!own||!other)G.skipPower(g,id);
   else if(q.value===10){G.powerStart(g,id,10,own,target.id,other);bot.memory.delete(own);bot.memory.delete(`${target.id}:${other}`);}
   else {const seen=G.powerStart(g,id,12,own,target.id,other);if(seen){bot.remember(own,seen.own,.95);bot.remember(`${target.id}:${other}`,seen.other,.75);const swap=seen.own.value>seen.other.value;G.powerDecision(g,id,swap?'swap':'keep');if(swap){bot.memory.delete(own);bot.remember(other,seen.other,.95);bot.remember(`${target.id}:${own}`,seen.own,.75);}}}
  }
  v=G.view(g,id);q=v.pendingPower;
 }
 // Tirada rápida solo con recuerdos propios suficientemente fiables.
 v=G.view(g,id);const me=v.players.find(p=>p.id===id),top=v.top;
 if(top&&me){const duplicate=me.hand.find(c=>{const m=bot.memory.get(c.id);return m&&m.value===top.value&&m.confidence>(bot.difficulty==='Dificil'?.55:bot.difficulty==='Facil'?.9:.75);});if(duplicate&&v.quickUntil>Date.now())try{G.quickOwn(g,id,duplicate.id);}catch{}}
 while(g.powerQueue[0]?.playerId===id){G.skipPower(g,id);}
 if(g.pendingPower?.playerId===id)G.skipPower(g,id);
 const after=G.view(g,id),self=after.players.find(p=>p.id===id);if(!g.lastRound&&self){const expected=self.hand.reduce((sum,c)=>sum+(bot.memory.get(c.id)?.value??6.5),0);const threshold=bot.difficulty==='Dificil'?5:bot.difficulty==='Normal'?8:12;if(expected<=threshold)G.touchTable(g,id);else G.endTurn(g,id);}else G.endTurn(g,id);
 bot.memory.forEach(v=>{v.confidence*=bot.difficulty==='Facil'?.72:bot.difficulty==='Dificil'?.94:.88;});
}
io.on('connection',socket=>{
 socket.on('create',reply(socket,({name})=>{if(!validName(name))throw Error('Escribe un nombre válido.');const r=createRoom('multi'),id=G.uid(),token=G.uid();r.host=id;r.game.players=[{id,name:cleanName(name),isBot:false,connected:true,socketId:socket.id}];socket.join(r.id);sessions.set(token,{roomId:r.id,playerId:id});socket.emit('joined',{roomId:r.id,token,host:true,url:`${base()}/?room=${r.id}`});lobby(r);}));
 socket.on('join',reply(socket,({roomId,name,token})=>{const r=roomOf(roomId);let p,s=token&&sessions.get(token);if(s?.roomId===r.id)p=G.player(r.game,s.playerId);if(!p){if(r.game.phase!=='lobby')throw Error('La partida ya ha empezado.');if(!validName(name))throw Error('Escribe un nombre válido.');if(r.game.players.some(x=>x.name.toLowerCase()===cleanName(name).toLowerCase()))throw Error('Ese nombre ya está ocupado.');if(r.game.players.length>=8)throw Error('La sala está completa.');p={id:G.uid(),name:cleanName(name),isBot:false,connected:true};r.game.players.push(p);token=G.uid();sessions.set(token,{roomId:r.id,playerId:p.id});}p.connected=true;p.socketId=socket.id;socket.join(r.id);socket.emit('joined',{roomId:r.id,token,host:r.host===p.id,url:`${base()}/?room=${r.id}`});lobby(r);if(r.game.phase!=='lobby')sendState(r);}));
 socket.on('solo',reply(socket,({name,difficulty})=>{if(!validName(name))throw Error('Escribe un nombre válido.');const r=createRoom('solo'),id=G.uid(),token=G.uid();r.host=id;r.game.players=[{id,name:cleanName(name),isBot:false,connected:true,socketId:socket.id}];for(let i=0;i<3;i++)makeBot(r,difficulty);socket.join(r.id);sessions.set(token,{roomId:r.id,playerId:id});socket.emit('joined',{roomId:r.id,token,host:true,solo:true});prepare(r);}));
 socket.on('addBot',reply(socket,({roomId,difficulty})=>{const r=roomOf(roomId);if(who(socket,r)!==r.host||r.game.phase!=='lobby')throw Error('Solo el anfitrión puede añadir bots.');makeBot(r,difficulty);lobby(r);}));
 socket.on('removeBot',reply(socket,({roomId})=>{const r=roomOf(roomId);if(who(socket,r)!==r.host||r.game.phase!=='lobby')throw Error('Solo el anfitrión puede quitar bots.');const p=[...r.game.players].reverse().find(x=>x.isBot);if(!p)throw Error('No hay bots que quitar.');r.game.players=r.game.players.filter(x=>x.id!==p.id);r.bots.delete(p.id);lobby(r);}));
 socket.on('start',reply(socket,({roomId})=>{const r=roomOf(roomId);if(who(socket,r)!==r.host)throw Error('Solo el anfitrión puede empezar.');if(r.game.players.length<3||r.game.players.length>8)throw Error('Se necesitan entre 3 y 8 jugadores.');prepare(r);}));
 socket.on('restart',reply(socket,({roomId})=>{const r=roomOf(roomId);if(who(socket,r)!==r.host)throw Error('Solo el anfitrión puede iniciar otra partida.');if(!r.game.finished)throw Error('La partida aún no ha terminado.');prepare(r);}));
 socket.on('peek',reply(socket,({roomId,ids})=>{const r=roomOf(roomId),id=who(socket,r);socket.emit('peekResult',G.peek(r.game,id,ids));}));
 socket.on('memorizeDone',reply(socket,({roomId})=>{const r=roomOf(roomId);G.finishMemorize(r.game,who(socket,r));sendState(r);scheduleBot(r);}));
 const actions={draw:(r,id,d)=>G.beginDraw(r,id),drawChoice:(r,id,d)=>G.resolveDrawChoice(r,id,d.choice,d.cardId),quickOwn:(r,id,d)=>G.quickOwn(r,id,d.cardId),quickOwnMany:(r,id,d)=>G.quickOwnMany(r,id,d.cardIds),quickRival:(r,id,d)=>G.quickRival(r,id,d.targetId,d.cardId),giveCard:(r,id,d)=>G.giveCard(r,id,d.cardId),power:(r,id,d)=>{const result=G.powerStart(r,id,d.value,d.ownId,d.targetId,d.otherId);if(result)socket.emit('powerPeek',result);},powerDecision:(r,id,d)=>G.powerDecision(r,id,d.decision),skipPower:(r,id)=>G.skipPower(r,id),endTurn:(r,id)=>G.endTurn(r,id),touch:(r,id)=>G.touchTable(r,id),reorder:(r,id,d)=>G.reorder(r,id,d.ids)};
 for(const [event,fn] of Object.entries(actions))socket.on(event,reply(socket,(d={})=>{const r=roomOf(d.roomId),id=who(socket,r);if(!id)throw Error('No estás en esta sala.');fn(r.game,id,d);sendState(r);scheduleBotReactions(r);scheduleBot(r);}));
 socket.on('disconnect',()=>{for(const r of rooms.values()){const p=r.game.players.find(x=>x.socketId===socket.id);if(p){p.connected=false;p.socketId=null;lobby(r);}}});
});
function validName(n){return typeof n==='string'&&cleanName(n).length>0&&cleanName(n).length<=14;}function cleanName(n){return String(n||'').trim().replace(/[<>]/g,'').slice(0,14);}
const port=process.env.PORT||3000;server.listen(port,()=>console.log(`CAMBIO escuchando en ${port}`));
