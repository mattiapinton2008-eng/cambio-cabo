'use strict';
// Los bots reciben exclusivamente la vista filtrada que también recibe un jugador humano.
const BOT_NAMES=['Don Manuel','Lucía','Paco','Rosa','El Tuerto','Marisol','Chencho','Carmela'];
const LEVELS={Facil:{delay:[6200,7800],confidence:.9,forget:.25,touch:12},Normal:{delay:[5200,6800],confidence:.72,forget:.12,touch:8},Dificil:{delay:[4500,6000],confidence:.58,forget:.06,touch:5}};
class Bot{
 constructor(id,name,difficulty='Normal'){this.id=id;this.name=name;this.isBot=true;this.difficulty=LEVELS[difficulty]?difficulty:'Normal';this.memory=new Map();this.seen=new Set();}
 remember(position,card,confidence=1){this.memory.set(position,{value:card.value,suit:card.suit,confidence,at:Date.now()});}
 observe(view){for(const p of view.players){if(p.id===this.id)continue;for(const c of p.hand){if(c.value!==undefined)this.remember(`${p.id}:${c.id}`,c,.8);}}}
 delay(){const [a,b]=LEVELS[this.difficulty].delay;return a+Math.random()*(b-a);}
 async act(view,io){const me=view.players.find(p=>p.id===this.id);if(!me||view.finished)return;
  if(view.phase==='memorize'){io.finishMemorize(this.id);return;}
  if(view.turnPlayerId!==this.id||view.pendingPower||view.pendingDraw)return;
  await new Promise(r=>setTimeout(r,this.delay()));
  const c=io.draw(this.id);if(!c)return;
  // Estrategia basada en la carta robada y, cuando se conoce, en la memoria propia.
  const ownKnown=[...this.memory.entries()].filter(([k,v])=>k.startsWith(`${this.id}:`)&&v.confidence>LEVELS[this.difficulty].confidence).sort((a,b)=>b[1].value-a[1].value);
  const highest=ownKnown[0];
  if(highest&&c.value<highest[1].value)io.replace(this.id,highest[0].split(':')[1]);else io.throwDraw(this.id);
 }
}
module.exports={Bot,BOT_NAMES,LEVELS};
