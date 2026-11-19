'use strict';
const socket=io();let previousState=null,bannerTimer=null,soundEnabled=true,audioCtx=null;let roomId=null,token=localStorage.getItem('cambio-token'),isHost=false,myId=null,state=null,shareUrl='',tutorialIndex=0,peeked=[],powerSelection=null,reorderMode=false,reorderFirst=null;
const $=id=>document.getElementById(id),show=id=>$(id)?.classList.remove('hidden'),hide=id=>$(id)?.classList.add('hidden');
function toast(t){$('toast').textContent=t;show('toast');setTimeout(()=>hide('toast'),2800);}function emit(a,d={}){socket.emit(a,{roomId,...d});}
function leaveGame(){if(!roomId){resetToHome();return;}socket.emit('leave',{roomId,token});}
function resetToHome(){localStorage.removeItem('cambio-token');localStorage.removeItem('cambio-room');token=null;roomId=null;isHost=false;myId=null;state=null;previousState=null;peeked=[];powerSelection=null;reorderMode=false;reorderFirst=null;hide('game');hide('lobby');hide('modal');hide('tutorial');show('home');document.body.classList.remove('playing');location.href='/';}function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function enter(d){roomId=d.roomId;myId=d.playerId||myId;token=d.token||token;if(token)localStorage.setItem('cambio-token',token);if(roomId)localStorage.setItem('cambio-room',roomId);isHost=!!d.host;shareUrl=d.url||location.href;hide('home');if(d.solo){hide('lobby');show('game');}else{show('lobby');hide('game');$('roomCodeLabel').textContent=roomId;}}
$('createBtn').onclick=()=>socket.emit('create',{name:$('playerName').value});$('joinBtn').onclick=()=>socket.emit('join',{roomId:$('roomCode').value||new URLSearchParams(location.search).get('room'),name:$('playerName').value,token});$('soloBtn').onclick=()=>socket.emit('solo',{name:$('playerName').value,difficulty:$('difficulty').value});$('addBotBtn').onclick=()=>emit('addBot',{difficulty:$('difficulty').value});$('removeBotBtn').onclick=()=>emit('removeBot');$('startBtn').onclick=()=>emit('start');$('copyBtn').onclick=async()=>{try{await navigator.clipboard.writeText(shareUrl);toast('Enlace copiado.');}catch{prompt('Copia este enlace:',shareUrl);}};$('waBtn').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent('¡Juega conmigo a CAMBIO! '+shareUrl),'_blank');
socket.on('joined',enter);socket.on('left',resetToHome);socket.on('roomClosed',()=>{toast('La sala se ha cerrado.');resetToHome();});socket.on('toast',toast);socket.on('lobby',l=>{roomId=l.roomId;if(myId)isHost=l.host===myId;$('playersList').innerHTML=l.players.map(p=>`<div class="player-chip"><b>${esc(p.name)} ${p.isBot?'🤖 BOT':''}</b><small>${p.connected?'Conectado':'Desconectado'}</small></div>`).join('');$('startBtn').disabled=!isHost||l.players.length<3||l.players.length>8;$('addBotBtn').disabled=!isHost||l.players.length>=8;$('removeBotBtn').disabled=!isHost||!l.players.some(p=>p.isBot);});socket.on('state',s=>{const old=previousState;state=s;myId=s.myId;hide('lobby');show('game');document.body.classList.add('playing');animateState(old,s);render();previousState=s;});socket.on('peekResult',cards=>{peeked=cards;$('modalContent').innerHTML=`<h2>Memoriza estas dos cartas</h2><p>Obsérvalas bien. Cuando cierres esta ventana no podrás volver a verlas.</p><div class="row">${cards.map(cardHTML).join('')}</div><p id="peekTimer">Tiempo recomendado: 8 segundos</p><button class="primary wide" id="closePeek">Ya me las aprendí</button>`;show('modal');let left=8,done=false;const finish=()=>{if(done)return;done=true;clearInterval(timer);hide('modal');emit('memorizeDone');};const timer=setInterval(()=>{left--;if($('peekTimer'))$('peekTimer').textContent=left>0?`Memoriza… ${left} s`:'Tiempo terminado.';if(left<=0)finish();},1000);$('closePeek').onclick=finish;});socket.on('powerPeek',cards=>{powerSelection=cards;$('modalContent').dataset.kind='power12confirm';$('modalContent').innerHTML=`<h2>Has visto las dos cartas</h2><div class="row">${[cards.own,cards.other].map(cardHTML).join('')}</div><p>¿Quieres intercambiarlas?</p><button class="primary" id="doSwap">Intercambiar</button><button class="secondary" id="keepCards">No intercambiar</button>`;show('modal');$('doSwap').onclick=()=>{hide('modal');emit('powerDecision',{decision:'swap'});};$('keepCards').onclick=()=>{hide('modal');emit('powerDecision',{decision:'keep'});};});

function suitKey(s){return ({Oros:'oros',Copas:'copas',Espadas:'espadas',Bastos:'bastos'})[s]||'oros';}
function cardHTML(c){
 const key=suitKey(c.suit),special=c.value===10?'power10':c.value===12?'power12':'';
 const ext=(c.value===8||c.value===9)?'svg':'jpg';
 return `<div class="card-face ${special}" aria-label="Carta ${c.value} de ${esc(c.suit)}"><img draggable="false" src="/cards/${key}-${c.value}.${ext}" alt="Carta española ${c.value} de ${esc(c.suit)}"><span class="value-index">${c.value}</span>${special?`<span class="power-stamp">${c.value===10?'10 · CAMBIO A CIEGAS':'12 · CAMBIO CON VISIÓN'}</span>`:''}</div>`;
}
function back(id,click='',extra=''){
 return `<button class="card-back ${extra}" data-id="${id||''}" ${click} aria-label="Carta boca abajo"><img draggable="false" src="/cards/back-red.png" alt=""></button>`;
}


function playSound(kind='card'){
 if(!soundEnabled)return;
 try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;if(!audioCtx)audioCtx=new C();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.connect(gain);gain.connect(audioCtx.destination);const now=audioCtx.currentTime;const tones={draw:[420,.09],place:[260,.12],power:[620,.22],error:[150,.18],win:[740,.35]};const [freq,dur]=tones[kind]||tones.card;osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.65),now+dur);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.10,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+dur);osc.start(now);osc.stop(now+dur+.02);}catch{}
}
function cinematic(text,kind=''){
 const b=$('fxBanner');if(!b)return;b.className='fx-banner '+kind;b.textContent=text;clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>b.classList.add('hidden'),1500);
}
function animateState(old,s){
 if(!old)return;
 const oldDraw=!!old.drawn,newDraw=!!s.drawn;
 if(!oldDraw&&newDraw){cinematic('CARTA ROBADA','');playSound('draw');}
 if(oldDraw&&!newDraw&&s.top&&old.top?.id!==s.top.id){cinematic('¡CARTA AL CENTRO!','');playSound('place');}
 const oldTop=old.top?.id,newTop=s.top?.id;
 if(oldTop!==newTop&&!newDraw){playSound('place');}
 const msg=s.log?.at(-1)?.msg||'';
 const oldMsg=old.log?.at(-1)?.msg||'';
 if(msg&&msg!==oldMsg){
  if(/usa el 10|poder del 10|intercambio a ciegas/i.test(msg)){cinematic('✦ INTERCAMBIO A CIEGAS · 10 ✦','power10');playSound('power');}
  else if(/usa.*12|intercambiar con el 12/i.test(msg)){cinematic('✦ PODER DE VISIÓN · 12 ✦','power12');playSound('power');}
  else if(/falla/i.test(msg)){cinematic('¡FALLO! · CARTA DE PENALIZACIÓN','');playSound('error');}
  else if(/acierta/i.test(msg)){cinematic('¡ACIERTO!','');playSound('power');}
  else if(/toca mesa/i.test(msg)){cinematic('¡TOCARON MESA! · ÚLTIMA RONDA','');playSound('power');}
  else if(/Fin de la partida/i.test(msg)){cinematic('¡SE REVELAN LAS CARTAS!','');playSound('win');}
  else if(/roba del mazo/i.test(msg)){cinematic(msg,'');playSound('draw');}
  else if(/tira un/i.test(msg)){cinematic(msg,'');playSound('place');}
 }
}

function seatPositions(total){
 // Asiento local fijo abajo (90°); el resto se distribuye por el perímetro completo.
 const out=[];for(let i=1;i<total;i++)out.push((90+i*360/total)%360);return out;
}
function render(){
 if(!state)return;
 const me=state.players.find(p=>p.id===myId),active=state.turnPlayerId===myId;
 let status='';
 if(state.phase==='memorize')status=state.memorizeDone.includes(myId)?'Esperando a los demás…':'Selecciona dos cartas para memorizarlas.';
 else if(state.phase==='finished')status='Partida terminada';
 else if(state.pendingPower?.playerId===myId)status=`PODER DEL ${state.pendingPower.value} · Resuelve el intercambio`;
 else if(state.transfer?.to)status='¡ACIERTO! Elige una carta de tu mesa para entregarla';
 else if(state.drawn)status='Carta robada: toca una de tus cartas para cambiarla o la mesa para descartarla';
 else if(active)status='TU TURNO · Roba una carta del mazo';
 else status=`Turno de ${state.players.find(p=>p.id===state.turnPlayerId)?.name||'otro jugador'}`;
 $('status').textContent=status;
 const topEl=$('topCard');
 if(state.top){topEl.outerHTML=cardHTML(state.top).replace('class="card-face','id="topCard" class="card-face card-land');}
 else topEl.outerHTML='<div id="topCard" class="card-back static-back"><img draggable="false" src="/cards/back-red.png" alt="Reverso"></div>';

 const rivals=state.players.filter(p=>p.id!==myId),angles=seatPositions(state.players.length);
 const prevPlayers=previousState?.players||[];
 const seat=(p,angle,isMe)=>{
   const rad=angle*Math.PI/180;
   const x=isMe?50:50+42*Math.cos(rad),y=isMe?88:50+37*Math.sin(rad);
   const rotation=isMe?0:angle-90;
   const prior=new Set((prevPlayers.find(q=>q.id===p.id)?.hand||[]).map(c=>c.id));
   const cards=(p.hand||[]).map((c,j)=>{
     const entering=!prior.has(c.id)&&previousState;
     return back(c.id,isMe?'draggable="true"':`data-rival="${p.id}"`,'table-card '+(entering?'deal-in':''));
   }).join('');
   const isActive=p.id===state.turnPlayerId;
   return `<div class="seat ${isMe?'self-seat':''} ${isActive?'active':''}" style="left:${x}%;top:${y}%;--card-rotation:${rotation}deg">
      <div class="seat-identity"><span class="seat-dot"></span><b>${esc(p.name)} ${p.isBot?'🤖':''}</b>${isActive?'<em>JUGANDO</em>':''}</div>
      <div class="seat-cards ${isMe?'my-cards':''}" ${isMe?'id="myHand"':''}>${cards}</div>
      <div class="seat-meta">${p.count} cartas ${p.connected?'':'· desconectado'} ${isMe?'· TÚ':''}</div>
   </div>`;
 };
 $('rivals').innerHTML=state.players.map(p=>p.id===myId?seat(p,90,true):seat(p,angles[rivals.findIndex(r=>r.id===p.id)]??270,false)).join('');

 $('myHand').querySelectorAll('[data-id]').forEach(el=>{
   
   el.onclick=()=>{
     if(reorderMode){
       if(!reorderFirst){reorderFirst=el.dataset.id;el.classList.add('selected');}
       else{const ids=me.hand.map(c=>c.id),a=ids.indexOf(reorderFirst),b=ids.indexOf(el.dataset.id);if(a>=0&&b>=0){ids.splice(a,1);ids.splice(b,0,reorderFirst);emit('reorder',{ids});}reorderFirst=null;}
       return;
     }
     ownClick(el.dataset.id);
   };
   el.ondragstart=e=>e.dataTransfer.setData('text/plain',el.dataset.id);
   el.ondragover=e=>e.preventDefault();
   el.ondrop=e=>{e.preventDefault();const from=e.dataTransfer.getData('text/plain'),to=el.dataset.id,ids=me.hand.map(c=>c.id),a=ids.indexOf(from),b=ids.indexOf(to);if(a>=0&&b>=0){ids.splice(a,1);ids.splice(b,0,from);emit('reorder',{ids});}};
 });
 $('rivals').querySelectorAll('[data-rival]').forEach(el=>el.onclick=()=>{if(state.phase==='play'&&!state.drawn)emit('quickRival',{targetId:el.dataset.rival,cardId:el.dataset.id});});
 $('deckPile').onclick=()=>{if(active&&!state.drawn)emit('draw');};
 $('deckPile').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&active&&!state.drawn){e.preventDefault();emit('draw');}};
 $('drawnArea').innerHTML=state.drawn?`<div class="drawn-card"><div class="drawn-caption">CARTA ROBADA</div>${cardHTML(state.drawn)}<p>SOLO TÚ PUEDES VERLA</p></div>`:'';
 $('centerPile').onclick=()=>{if(state.drawn)emit('drawChoice',{choice:'center'});};
 $('centerPile').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&state.drawn){e.preventDefault();emit('drawChoice',{choice:'center'});}};
 $('orderBtn').textContent=reorderMode?'Terminar orden':'Ordenar';
 $('touchBtn').disabled=!active||!!state.drawn||!!state.pendingPower||!!state.transfer||!!state.lastRound||state.phase!=='play';
 $('touchBtn').onclick=()=>{if(confirm('¿Seguro? Todos tendrán una última ronda y tú no jugarás en ella.'))emit('touch');};
 $('endBtn').disabled=!active||!!state.drawn||!!state.pendingPower||!!state.transfer;
 $('endBtn').onclick=()=>emit('endTurn');
 $('orderBtn').onclick=()=>{reorderMode=!reorderMode;reorderFirst=null;render();};
 $('exitBtn').onclick=()=>{if(confirm('¿Seguro que quieres salir de esta partida?'))leaveGame();};
 $('restartBtn').hidden=!isHost;$('restartBtn').onclick=()=>{if(isHost&&confirm('¿Reiniciar toda la partida? Se repartirán cartas nuevas.'))emit('restart');};


 $('log').innerHTML=state.log.map(x=>`<div>• ${esc(x.msg)}</div>`).join('');
 if(state.phase==='memorize'&&!state.memorizeDone.includes(myId))showMemorize(me);else if(state.phase==='memorize')hide('modal');
 if(state.pendingPower?.playerId===myId&&state.pendingPower.stage==='select')showPowerSelect(state.pendingPower.value);
 if(state.transfer?.to)showGiveCard(me);if(state.finished)showResults();
}
function ownClick(id){if(state.phase==='memorize')return;if(state.transfer?.from===myId){emit('giveCard',{cardId:id});hide('modal');return;}if(state.drawn){emit('drawChoice',{choice:'replace',cardId:id});return;}emit('quickOwn',{cardId:id});}
function showMemorize(me){if($('modal').classList.contains('hidden')===false&&$('modalContent').dataset.kind==='memorize')return;$('modalContent').dataset.kind='memorize';$('modalContent').innerHTML=`<h2>Memoriza dos cartas</h2><p>Selecciona exactamente dos cartas y memorízalas. Solo podrás verlas ahora.</p><div class="hand">${me.hand.map(c=>back(c.id,`data-pick="${c.id}"`)).join('')}</div><button class="primary wide" id="peekBtn" disabled>Ver las dos cartas</button>`;show('modal');let ids=[];$('modalContent').querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const id=b.dataset.pick;if(ids.includes(id))ids=ids.filter(x=>x!==id);else if(ids.length<2)ids.push(id);b.classList.toggle('selected',ids.includes(id));$('peekBtn').disabled=ids.length!==2;});$('peekBtn').onclick=()=>{hide('modal');emit('peek',{ids});};}
function showPowerSelect(value){if(value===10){showPower10();return;}const me=state.players.find(p=>p.id===myId);$('modalContent').dataset.kind='power12select';$('modalContent').innerHTML=`<h2>Poder del 12</h2><p>Elige una carta tuya y otra rival. Podrás ver ambas antes de decidir.</p><label>Tu carta<select id="ownPower">${me.hand.map((c,i)=>`<option value="${c.id}">Mi carta ${i+1}</option>`).join('')}</select></label><label>Rival<select id="targetPower">${state.players.filter(p=>p.id!==myId&&p.count).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><label>Carta rival<select id="otherPower"></select></label><button class="primary" id="peek12">Ver cartas</button><button class="secondary" id="skip12">No usar poder</button>`;show('modal');const update=()=>{const p=state.players.find(p=>p.id===$('targetPower').value);$('otherPower').innerHTML=(p?.hand||[]).map((c,i)=>`<option value="${c.id}">Carta ${i+1}</option>`).join('');};$('targetPower').onchange=update;update();$('peek12').onclick=()=>emit('power',{value:12,ownId:$('ownPower').value,targetId:$('targetPower').value,otherId:$('otherPower').value});$('skip12').onclick=()=>{emit('skipPower');hide('modal');};}
function showPower10(){const me=state.players.find(p=>p.id===myId);$('modalContent').dataset.kind='power';$('modalContent').innerHTML=`<h2>Poder del 10</h2><p>Intercambio a ciegas. Elige una de tus cartas y una de otro jugador. No verás sus valores.</p><label>Tu carta<select id="ownPower">${me.hand.map((c,i)=>`<option value="${c.id}">Mi carta ${i+1}</option>`).join('')}</select></label><label>Rival<select id="targetPower">${state.players.filter(p=>p.id!==myId&&p.count).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><label>Carta rival<select id="otherPower"></select></label><button class="primary" id="swap10">Intercambiar</button><button class="secondary" id="skip10">No usar poder</button>`;show('modal');const update=()=>{const p=state.players.find(p=>p.id===$('targetPower').value);$('otherPower').innerHTML=(p?.hand||[]).map((c,i)=>`<option value="${c.id}">Carta ${i+1}</option>`).join('');};$('targetPower').onchange=update;update();$('swap10').onclick=()=>{emit('power',{value:10,ownId:$('ownPower').value,targetId:$('targetPower').value,otherId:$('otherPower').value});hide('modal');};$('skip10').onclick=()=>{emit('skipPower');hide('modal');};}
function showGiveCard(me){$('modalContent').innerHTML=`<h2>Entrega una carta</h2><p>Has acertado al quitar una carta rival. Elige a ciegas una carta tuya para dársela.</p><div class="hand">${me.hand.map((c,i)=>back(c.id,`data-give="${c.id}"`)).join('')}</div>`;show('modal');$('modalContent').querySelectorAll('[data-give]').forEach(b=>b.onclick=()=>{emit('giveCard',{cardId:b.dataset.give});hide('modal');});}
function showResults(){const scores=state.scores||[];$('modalContent').innerHTML=`<h2>🏆 Resultado final</h2>${scores.slice().sort((a,b)=>a.score-b.score).map((p,i)=>{const n=state.players.find(x=>x.id===p.id);return `<div class="player-chip">${state.winners.includes(p.id)?'🏆 ':''}${esc(n?.name||'Jugador')} — <b>${p.score} puntos</b><div class="row">${p.hand.map(cardHTML).join('')}</div></div>`;}).join('')}<p>${state.winners.length>1?'¡Hay empate!':`Ganador: ${esc(state.players.find(p=>p.id===state.winners[0])?.name||'')}`}</p>${isHost?'<button class="primary wide" id="againBtn">Jugar otra vez</button>':''}<button class="secondary wide" id="exitResultBtn">Salir al menú</button>`;show('modal');if($('againBtn'))$('againBtn').onclick=()=>{if(confirm('¿Reiniciar la partida desde el principio?'))emit('restart');};if($('exitResultBtn'))$('exitResultBtn').onclick=leaveGame;}
function openTutorial(){tutorialIndex=0;renderTutorial();show('tutorial');}function renderTutorial(){const s=TUTORIAL[tutorialIndex];$('tutorialContent').innerHTML=`<h2>${s[0]}</h2><p>${s[1]}</p>${s[2]}`;$('helpProgress').textContent=`${tutorialIndex+1} / ${TUTORIAL.length}`;$('prevHelp').disabled=tutorialIndex===0;$('nextHelp').textContent=tutorialIndex===TUTORIAL.length-1?'Terminar':'Siguiente';}$('helpBtn').onclick=openTutorial;$('closeHelp').onclick=()=>hide('tutorial');$('prevHelp').onclick=()=>{tutorialIndex=Math.max(0,tutorialIndex-1);renderTutorial();};$('nextHelp').onclick=()=>{if(tutorialIndex===TUTORIAL.length-1)hide('tutorial');else{tutorialIndex++;renderTutorial();}};$('closeModal').onclick=()=>hide('modal');$('soundBtn').onclick=()=>{soundEnabled=!soundEnabled;$('soundBtn').textContent=soundEnabled?'🔊':'🔇';if(soundEnabled)playSound('card');};
const queryRoom=new URLSearchParams(location.search).get('room');const savedRoom=queryRoom||localStorage.getItem('cambio-room');if(queryRoom)$('roomCode').value=queryRoom;if(savedRoom&&token){socket.on('connect',()=>socket.emit('join',{roomId:savedRoom,token,name:''}));}
