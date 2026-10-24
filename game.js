'use strict';
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d'),keys=new Set(),SAVE='dungeon-break-v1';
let state,mode='ready',last=0,attackCD=0,invincible=0,slash=0,slashAngle=0,particles=[],bullets=[],audioOn=false,audioContext,saveClock=0,toastTimer;
const TILE=48;
const themes=[{name:'THE OVERGROWN KEEP',floor:'#29372f',edge:'#425748',wall:'#526957',trim:'#89a574'}, {name:'THE VIOLET CATACOMBS',floor:'#30273e',edge:'#453652',wall:'#605075',trim:'#ba9ade'}, {name:'THE EMBER VAULTS',floor:'#3b2b28',edge:'#553a31',wall:'#745344',trim:'#efb475'}, {name:'THE FROZEN ARCHIVE',floor:'#24343f',edge:'#344b59',wall:'#4d697c',trim:'#8bc5df'}];
let camera={x:0,y:0},navCache=null;
function fresh(){return {version:2,floor:1,hp:100,coins:0,kills:0,bosses:0,biggestHit:0,highlight:null,recentKills:[],player:{x:0,y:0,dx:0,dy:-1},enemies:[],elapsed:0};}
function random(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function generateFloor(floor,seed){
 const rand=random(seed),cols=3+Math.min(2,Math.floor((floor-1)/3)),rows=3+floor%2;
 const width=cols*13+2,height=rows*11+2,tiles=Array(width*height).fill(0),rooms=[],links=[];
 const carve=(x,y)=>{tiles[y*width+x]=1;};
 for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){
  const w=7+Math.floor(rand()*4),h=6+Math.floor(rand()*3),x=2+gx*13+Math.floor((11-w)/2),y=2+gy*11+Math.floor((9-h)/2);
  const room={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),seen:false};rooms.push(room);
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)carve(xx,yy);
 }
 const seen=new Set([0]),stack=[0];
 function join(a,b){links.push([a,b]);const A=rooms[a],B=rooms[b];let x=A.cx,y=A.cy;while(x!==B.cx){carve(x,y);carve(x,y+1);x+=Math.sign(B.cx-x);}while(y!==B.cy){carve(x,y);carve(x+1,y);y+=Math.sign(B.cy-y);}carve(x,y);}
 while(stack.length){const a=stack[stack.length-1],x=a%cols,y=Math.floor(a/cols),opts=[];if(x>0&&!seen.has(a-1))opts.push(a-1);if(x<cols-1&&!seen.has(a+1))opts.push(a+1);if(y>0&&!seen.has(a-cols))opts.push(a-cols);if(y<rows-1&&!seen.has(a+cols))opts.push(a+cols);if(!opts.length){stack.pop();continue;}const b=opts[Math.floor(rand()*opts.length)];seen.add(b);stack.push(b);join(a,b);}
 // Extra loops offer alternate routes, with a different layout on every floor/run.
 for(let i=0;i<cols;i++){const a=Math.floor(rand()*(rooms.length-1)),b=a%cols<cols-1?a+1:a+cols;if(b<rooms.length&&!links.some(([x,y])=>x===a&&y===b||x===b&&y===a))join(a,b);}
 const distance=Array(rooms.length).fill(-1),queue=[0];distance[0]=0;for(const a of queue)for(const [x,y] of links){const b=x===a?y:y===a?x:-1;if(b>=0&&distance[b]<0){distance[b]=distance[a]+1;queue.push(b);}}
 const exitRoom=distance.indexOf(Math.max(...distance)),end=rooms[exitRoom];
 return {seed,width,height,tiles,rooms,links,exitRoom,exit:{x:(end.cx+.5)*TILE,y:(end.cy+.5)*TILE},theme:(floor-1)%themes.length};
}
function spawn(){
 bullets=[];state.version=2;state.map=generateFloor(state.floor,Math.floor(Math.random()*4294967296));const map=state.map,start=map.rooms[0];start.seen=true;
 state.player={x:(start.cx+.5)*TILE,y:(start.cy+.5)*TILE,dx:1,dy:0};state.enemies=[];state.pickups=[];
 const rand=random(map.seed+17);
 map.rooms.forEach((room,index)=>{if(index===0)return;const count=2+Math.floor(rand()*2)+Math.min(2,Math.floor(state.floor/4));for(let i=0;i<count;i++){
  const boss=state.floor%5===0&&index===map.exitRoom&&i===0,hp=boss?220+state.floor*22:42+state.floor*9;
  const x=(room.x+1+Math.floor(rand()*(room.w-2))+.5)*TILE,y=(room.y+1+Math.floor(rand()*(room.h-2))+.5)*TILE;
  state.enemies.push({x,y,hp,max:hp,boss,cooldown:1,roomId:index,seed:index*5+i});
 }if(index%3===0)state.pickups.push({x:(room.cx+.5)*TILE,y:(room.cy+.5)*TILE,type:'health'});});
 navCache=null;camera={x:state.player.x-canvas.width/2,y:state.player.y-canvas.height/2};updateHUD();
}
function save(){if(!state||state.hp<=0)return;try{localStorage.setItem(SAVE,JSON.stringify(state));$('save-status').textContent='Progress saved on this device';}catch{$('save-status').textContent='Saving unavailable in this browser';}}
function load(){try{let s=JSON.parse(localStorage.getItem(SAVE));if(s&&Number.isInteger(s.floor)&&s.floor>0&&Number.isFinite(s.hp)&&s.hp>0&&s.hp<=100&&s.player&&Number.isFinite(s.player.x)&&Number.isFinite(s.player.y)&&Array.isArray(s.enemies)&&s.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.hp)&&Number.isFinite(e.max))&&Number.isFinite(s.coins)&&Number.isFinite(s.elapsed))return s;}catch{}return null;}
function toast(t){$('toast').textContent=t;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,2300);}
function tone(freq,dur=.08){if(!audioOn)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();let o=audioContext.createOscillator(),g=audioContext.createGain();o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(.06,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+dur);o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+dur);}catch{}}
function updateHUD(){document.querySelector('.floor small').textContent=themes[state.map.theme].name;$('hp').textContent=Math.ceil(state.hp);$('healthbar').style.width=state.hp+'%';$('floor').textContent=String(state.floor).padStart(2,'0');$('coins').textContent=state.coins;$('objective').textContent=state.enemies.length?(state.floor%5===0?'BOSS FLOOR · ':'')+state.enemies.length+' foes · '+state.map.rooms.filter(r=>r.seen).length+'/'+state.map.rooms.length+' rooms explored':'Floor cleared! Find the glowing stairs on your map';}
function menu(title,copy,label,button){$('overlay').hidden=false;$('modal-title').textContent=title;$('modal-copy').textContent=copy;$('modal-label').textContent=label;$('start').innerHTML=button+' <span>→</span>';$('restart').hidden=mode==='dead';}
const RUNS_KEY='dungeon-break-runs-v1',BEST_KEY='dungeon-break-best-floor';
function recentRuns(){try{const runs=JSON.parse(localStorage.getItem(RUNS_KEY));return Array.isArray(runs)?runs.filter(r=>Number.isFinite(r.floor)&&Number.isFinite(r.kills)&&Number.isFinite(r.time)).slice(0,20):[];}catch{return [];}}
function runTime(seconds){const total=Math.floor(seconds||0);return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');}
function rememberMoment(rank,text){if(!state.highlight||rank>state.highlight.rank)state.highlight={rank,text,time:state.elapsed,floor:state.floor};}
function bestMoment(){return state.highlight?state.highlight.text+' · '+runTime(state.highlight.time):state.kills?'You defeated '+state.kills+' monsters on this adventure.':'You took your first steps into the dungeon.';}
function showDeath(){
 const runs=recentRuns();let best=0;try{best=Number(localStorage.getItem(BEST_KEY))||0;}catch{}
 const isBest=state.floor>best;best=Math.max(best,state.floor);
 const run={floor:state.floor,kills:state.kills,bosses:state.bosses||0,hit:state.biggestHit||0,gold:state.coins,time:state.elapsed,highlight:bestMoment()};
 runs.unshift(run);try{localStorage.setItem(RUNS_KEY,JSON.stringify(runs.slice(0,20)));localStorage.setItem(BEST_KEY,String(best));}catch{}
 $('overlay').hidden=true;$('death-title').textContent='You defeated '+run.kills+' monster'+(run.kills===1?'':'s')+'.';
 $('best-badge').hidden=!isBest;$('best-copy').textContent=isBest?'Floor '+best+' is your new personal best.':'Personal best: floor '+best;
 for(const [id,value] of Object.entries({'stat-floor':run.floor,'stat-bosses':run.bosses,'stat-kills':run.kills,'stat-hit':run.hit,'stat-gold':run.gold,'stat-time':runTime(run.time)}))$(id).textContent=value;
 $('run-history').hidden=true;$('show-runs').setAttribute('aria-expanded','false');$('death-screen').hidden=false;$('retry').focus();
}
$('retry').onclick=begin;
$('return-title').onclick=()=>{state=fresh();spawn();mode='ready';bullets=[];keys.clear();$('death-screen').hidden=true;menu('Got a minute?','Explore rooms, fight monsters, find the stairs.','A POCKET-SIZED ADVENTURE','Enter the dungeon');$('restart').hidden=true;$('start').focus();};
$('show-runs').onclick=()=>{const panel=$('run-history');panel.hidden=!panel.hidden;$('show-runs').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){panel.replaceChildren();for(const run of recentRuns()){const row=document.createElement('p');row.textContent='Floor '+run.floor+' · '+run.kills+' defeated · '+runTime(run.time);panel.appendChild(row);}}};
$('death-screen').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const buttons=[$('retry')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[0].focus();}else if(!e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[0].focus();}});
function pause(){if(mode!=='playing')return;resetJoystick();mode='paused';keys.clear();save();menu('Take your time.','Your progress is saved. The monsters can wait.','DUNGEON ON HOLD','Keep adventuring');}
function begin(){
 $('death-screen').hidden=true;if(mode==='dead'||mode==='confirm'){state=fresh();attackCD=0;invincible=0;slash=0;spawn();$('restart').textContent='Start a fresh run';}mode='playing';$('overlay').hidden=true;last=performance.now();tone(440);}
$('start').onclick=begin;$('pause').onclick=()=>mode==='playing'?pause():mode==='paused'?begin():null;
$('restart').onclick=()=>{if(mode!=='confirm'){mode='confirm';menu('A fresh adventure?','This replaces the saved run on this device.','START OVER','Yes, start fresh');$('restart').textContent='Keep my current run';}else{mode='paused';$('restart').textContent='Start a fresh run';begin();}};

$('sound').onclick=()=>{audioOn=!audioOn;$('sound').textContent=audioOn?'Sound on':'Sound off';$('sound').setAttribute('aria-label',audioOn?'Disable sound':'Enable sound');tone(550);};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game').requestFullscreen();}catch{toast('Rotate your phone for a wider view');}};
const FIRE_INTERVAL=.16,BULLET_SPEED=660,BULLET_RANGE=600;
function firingAim(p,enemies){
 const targets=enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<BULLET_RANGE&&clearStrike(p,e));
 if(!targets.length)return Math.atan2(p.dy,p.dx);
 // Aim directly at an enemy in the densest group, never at empty space between them.
 let best=targets[0],score=-1,distance=Infinity;
 for(const e of targets){const count=targets.filter(n=>Math.cos(Math.atan2(n.y-p.y,n.x-p.x)-Math.atan2(e.y-p.y,e.x-p.x))>=Math.cos(Math.PI/4)).length,d=Math.hypot(e.x-p.x,e.y-p.y);if(count>score||count===score&&d<distance){best=e;score=count;distance=d;}}
 return Math.atan2(best.y-p.y,best.x-p.x);
}
function attack(){if(mode!=='playing'||attackCD>0)return;attackCD=FIRE_INTERVAL;slash=.06;tone(480,.035);const p=state.player;
 slashAngle=firingAim(p,state.enemies);
 bullets.push({x:p.x,y:p.y,dx:Math.cos(slashAngle),dy:Math.sin(slashAngle),remaining:BULLET_RANGE,damage:16+state.floor});
}
function updateBullets(dt){
 for(const bullet of bullets){let travel=Math.min(BULLET_SPEED*dt,bullet.remaining);
  // Small swept steps prevent fast rounds passing through walls or enemies.
  while(travel>0&&bullet.remaining>0){const step=Math.min(4,travel);bullet.x+=bullet.dx*step;bullet.y+=bullet.dy*step;bullet.remaining-=step;travel-=step;
   if(solid(bullet.x,bullet.y)){bullet.remaining=0;break;}
   const hit=state.enemies.find(e=>e.hp>0&&Math.hypot(e.x-bullet.x,e.y-bullet.y)<(e.boss?30:19));
   if(hit){state.biggestHit=Math.max(state.biggestHit||0,Math.min(hit.hp,bullet.damage));hit.hp-=bullet.damage;bullet.remaining=0;burst(bullet.x,bullet.y,hit.boss?'#fa9b66':'#b795fc');}
  }
 }
 bullets=bullets.filter(b=>b.remaining>0);
 const dead=state.enemies.filter(e=>e.hp<=0);if(!dead.length)return;
 for(const e of dead){state.coins+=e.boss?50:5;state.kills++;rememberMoment(10,'You defeated a monster on floor '+state.floor+'.');state.recentKills=(state.recentKills||[]).filter(t=>state.elapsed-t<=5);state.recentKills.push(state.elapsed);if(state.recentKills.length>=2)rememberMoment(30+state.recentKills.length,'You defeated '+state.recentKills.length+' monsters in 5 seconds on floor '+state.floor+'!');if(e.boss)rememberMoment(1000+state.floor,'You brought down the dungeon guardian on floor '+state.floor+'!');if(e.boss)state.bosses=(state.bosses||0)+1;}state.enemies=state.enemies.filter(e=>e.hp>0);
 if(!state.enemies.length){rememberMoment(100+state.floor,'You cleared every monster from floor '+state.floor+'!');state.hp=Math.min(100,state.hp+10);toast('Dungeon cleared · +10 health · Find the stairs');tone(700,.2);save();}updateHUD();
}
// A 90-degree cone changes membership only at an enemy angle +/- 45 degrees.
// Test those boundaries plus centered candidates; ties favor the closest group.
function groupAim(p,enemies){
 const visible=enemies.map(e=>({e,d:Math.hypot(e.x-p.x,e.y-p.y),a:Math.atan2(e.y-p.y,e.x-p.x)}))
  .filter(t=>clearStrike(p,t.e));
 const reachable=visible.filter(t=>t.d<(t.e.boss?104:82));
 const nearby=reachable.length?reachable:visible;
 if(!nearby.length){const nearest=[...enemies].sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];return nearest?Math.atan2(nearest.y-p.y,nearest.x-p.x):Math.atan2(p.dy,p.dx);}
 const half=Math.PI/4,epsilon=1e-7;
 let best=nearby[0].a,bestCount=-1,bestDistance=Infinity;
 for(const t of nearby)for(const angle of [t.a,t.a-half+epsilon,t.a+half-epsilon]){
  const hits=nearby.filter(n=>Math.cos(n.a-angle)>=Math.cos(half));
  const distance=hits.reduce((sum,n)=>sum+n.d,0);
  if(hits.length>bestCount||(hits.length===bestCount&&distance<bestDistance)){
   best=angle;bestCount=hits.length;bestDistance=distance;
  }
 }
 return best;
}
// Walls block sword hits as well as movement.
function solid(x,y){const m=state.map,tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);return tx<0||ty<0||tx>=m.width||ty>=m.height||!m.tiles[ty*m.width+tx];}
function clearStrike(p,e){const n=Math.ceil(Math.hypot(e.x-p.x,e.y-p.y)/8);for(let i=1;i<n;i++)if(solid(p.x+(e.x-p.x)*i/n,p.y+(e.y-p.y)*i/n))return false;return true;}
let attackPointer=null;
$('attack').onpointerdown=e=>{e.preventDefault();attackPointer=e.pointerId;$('attack').setPointerCapture(e.pointerId);keys.add('attack');attack();};
function releaseAttack(e){if(e.pointerId===attackPointer){attackPointer=null;keys.delete('attack');}}
$('attack').onpointerup=$('attack').onpointercancel=$('attack').onlostpointercapture=releaseAttack;
const joystick={pointer:null,x:0,y:0};
function resetJoystick(){joystick.pointer=null;joystick.x=joystick.y=0;$('stick-knob').style.transform='translate(0px,0px)';}
function steerJoystick(e){const box=$('joystick').getBoundingClientRect(),radius=box.width*.3;let x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2;const distance=Math.hypot(x,y);if(distance>radius){x=x/distance*radius;y=y/distance*radius;}
 $('stick-knob').style.transform='translate('+x+'px,'+y+'px)';const amount=Math.hypot(x,y)/radius;
 if(amount<.12){joystick.x=joystick.y=0;}else{joystick.x=x/radius;joystick.y=y/radius;}}
$('joystick').onpointerdown=e=>{if(mode!=='playing'||joystick.pointer!==null)return;e.preventDefault();joystick.pointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);steerJoystick(e);};
$('joystick').onpointermove=e=>{if(e.pointerId===joystick.pointer){e.preventDefault();steerJoystick(e);}};
$('joystick').onpointerup=$('joystick').onpointercancel=$('joystick').onlostpointercapture=e=>{if(e.pointerId===joystick.pointer)resetJoystick();};
const mapping={w:'up',ArrowUp:'up',s:'down',ArrowDown:'down',a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right',' ':'attack'};
window.addEventListener('keydown',e=>{let k=mapping[e.key];if(k){e.preventDefault();keys.add(k);}if(e.key==='Escape'||e.key==='p'){mode==='playing'?pause():mode==='paused'?begin():null;}});window.addEventListener('keyup',e=>keys.delete(mapping[e.key]));window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',save);
function collision(x,y,r){for(const dx of [-r,0,r])for(const dy of [-r,0,r])if(solid(x+dx,y+dy))return true;return false;}
function move(p,dx,dy,r){if(!collision(p.x+dx,p.y,r))p.x+=dx;if(!collision(p.x,p.y+dy,r))p.y+=dy;}
function walkableLine(a,b,r){const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/8);for(let i=0;i<=n;i++){const t=n?i/n:0;if(collision(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,r))return false;}return true;}
// A shared flood field routes enemies through the actual corridors, without per-enemy searches.
function navigation(p){const m=state.map,goal=Math.floor(p.y/TILE)*m.width+Math.floor(p.x/TILE);if(navCache&&navCache.goal===goal)return navCache.dist;const dist=new Int32Array(m.tiles.length).fill(-1),q=[goal];dist[goal]=0;for(let i=0;i<q.length;i++){const k=q[i];for(const n of [k-1,k+1,k-m.width,k+m.width])if(n>=0&&n<m.tiles.length&&m.tiles[n]&&dist[n]<0){dist[n]=dist[k]+1;q.push(n);}}navCache={goal,dist};return dist;}
function chase(e,p,speed,dt){const r=16;let target=p;if(!walkableLine(e,p,r)){
 const m=state.map,dist=navigation(p),cx=Math.floor(e.x/TILE),cy=Math.floor(e.y/TILE),k=cy*m.width+cx;
 let next=k;for(const n of [k-1,k+1,k-m.width,k+m.width])if(dist[n]>=0&&(dist[next]<0||dist[n]<dist[next]))next=n;
 if(next===k)return;const center={x:(cx+.5)*TILE,y:(cy+.5)*TILE},dest={x:(next%m.width+.5)*TILE,y:(Math.floor(next/m.width)+.5)*TILE};target=walkableLine(e,dest,r)?dest:center;
 }const d=Math.hypot(target.x-e.x,target.y-e.y);if(d>.1){const step=Math.min(speed*dt,d);move(e,(target.x-e.x)/d*step,(target.y-e.y)/d*step,r);}}
function burst(x,y,c){for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,t:.5,c});}
function tick(dt){attackCD=Math.max(0,attackCD-dt);invincible=Math.max(0,invincible-dt);slash=Math.max(0,slash-dt);state.elapsed+=dt;let p=state.player,dx=joystick.pointer!==null?joystick.x:Number(keys.has('right'))-Number(keys.has('left')),dy=joystick.pointer!==null?joystick.y:Number(keys.has('down'))-Number(keys.has('up'));if(dx||dy){let l=Math.hypot(dx,dy);p.dx=dx/l;p.dy=dy/l;const throttle=Math.min(1,l);move(p,p.dx*210*dt*throttle,p.dy*210*dt*throttle,16);}if(keys.has('attack'))attack();updateBullets(dt);for(let e of state.enemies){if(Math.hypot(e.x-p.x,e.y-p.y)>650)continue;let x=p.x-e.x,y=p.y-e.y,d=Math.hypot(x,y);e.cooldown-=dt;if(d>30){let speed=e.boss?74:70+Math.min(state.floor*3,54);chase(e,p,speed,dt);}if(d<(e.boss?53:34)&&e.cooldown<=0&&invincible<=0){state.hp=Math.max(0,state.hp-(e.boss?28:12+Math.floor(state.floor/3)));e.cooldown=.8;invincible=.35;burst(p.x,p.y,'#ff829a');tone(95);updateHUD();if(state.hp<=0){mode='dead';resetJoystick();keys.clear();try{localStorage.removeItem(SAVE);}catch{}menu('A brave little break.','Floor '+state.floor+' · '+state.kills+' monster'+(state.kills===1?'':'s')+' defeated · '+state.coins+' gold. Another adventure awaits.','RUN COMPLETE','Try again');showDeath();return;}}}if(!state.enemies.length&&Math.hypot(p.x-state.map.exit.x,p.y-state.map.exit.y)<40){state.floor++;state.hp=Math.min(100,state.hp+5);spawn();save();toast(state.floor%5===0?'A guardian awaits. Get ready!':'Floor '+state.floor+' · Keep climbing');}for(const room of state.map.rooms)if(!room.seen&&p.x>=room.x*TILE&&p.x<(room.x+room.w)*TILE&&p.y>=room.y*TILE&&p.y<(room.y+room.h)*TILE){room.seen=true;updateHUD();}state.pickups=state.pickups.filter(item=>{if(Math.hypot(item.x-p.x,item.y-p.y)<28&&state.hp<100){state.hp=Math.min(100,state.hp+20);toast('+20 health');updateHUD();return false;}return true;});particles=particles.filter(a=>{a.t-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;return a.t>0;});saveClock+=dt;if(saveClock>3){save();saveClock=0;}}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function sprite(x,y,type,boss=false){const sc=boss?2:1;ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(sc,sc);ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(0,16,19,7,0,0,7);ctx.fill();if(type==='hero'){rect(-13,-15,26,28,'#55517f');rect(-10,-21,20,17,'#cecce1');rect(-8,-16,16,7,'#333344');rect(2,-15,4,3,'#d9fa8c');rect(-10,1,20,16,'#8d87b9');rect(-14,0,7,19,'#d4f878');rect(-8,17,6,8,'#302d46');rect(5,17,6,8,'#302d46');rect(14,-5,16,9,'#acb7c3');rect(18,3,6,9,'#625b71');}else{let c=boss?'#ca6b68':type==='slime'?'#86a979':'#a48acb';rect(-15,-11,30,25,c);rect(-10,-18,20,9,c);rect(-19,0,38,12,c);rect(-10,-7,6,7,'#282333');rect(5,-7,6,7,'#282333');rect(-9,-6,3,3,'#f5e5b8');rect(6,-6,3,3,'#f5e5b8');rect(-8,14,7,5,c);rect(5,14,7,5,c);if(boss){rect(-15,-23,7,13,'#edc077');rect(8,-23,7,13,'#edc077');}}ctx.restore();}
function draw(){
 const width=Math.max(240,Math.round(canvas.clientWidth||800)),height=Math.max(180,Math.round(canvas.clientHeight||450));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 const m=state.map,theme=themes[m.theme],p=state.player;
 camera.x=Math.max(0,Math.min(m.width*TILE-width,p.x-width/2));camera.y=Math.max(0,Math.min(m.height*TILE-height,p.y-height/2));
 ctx.fillStyle='#11121b';ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(-Math.round(camera.x),-Math.round(camera.y));
 const x0=Math.max(0,Math.floor(camera.x/TILE)),y0=Math.max(0,Math.floor(camera.y/TILE));
 for(let y=y0;y<Math.min(m.height,Math.ceil((camera.y+height)/TILE));y++)for(let x=x0;x<Math.min(m.width,Math.ceil((camera.x+width)/TILE));x++){
  const floor=m.tiles[y*m.width+x],px=x*TILE,py=y*TILE;
  if(floor){rect(px,py,TILE-1,TILE-1,theme.floor);if((x*13+y*7)%9===0)rect(px+8,py+12,17,2,theme.edge);}
  else if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>a>=0&&b>=0&&a<m.width&&b<m.height&&m.tiles[b*m.width+a])){rect(px,py,TILE-1,TILE-1,theme.wall);rect(px,py,TILE-1,6,theme.trim);rect(px+6,py+24,35,2,theme.edge);}
 }
 const exit=m.exit;rect(exit.x-23,exit.y-23,46,46,'#161420');for(let i=0;i<4;i++)rect(exit.x-18,exit.y-16+i*10,36,5,state.enemies.length?'#72677f':'#d4f878');
 for(const item of state.pickups){rect(item.x-4,item.y-12,8,24,'#ff92aa');rect(item.x-12,item.y-4,24,8,'#ff92aa');}
 for(const e of state.enemies){if(e.x<camera.x-60||e.x>camera.x+width+60||e.y<camera.y-60||e.y>camera.y+height+60)continue;sprite(e.x,e.y,e.seed%2?'slime':'goblin',e.boss);if(e.hp<e.max||e.boss){rect(e.x-22,e.y-(e.boss?60:32),44,4,'#19151f');rect(e.x-22,e.y-(e.boss?60:32),44*e.hp/e.max,4,'#ef8f9b');}}
 ctx.save();if(invincible>0)ctx.globalAlpha=.55;sprite(p.x,p.y,'hero');ctx.restore();
 const aim=slash>0?slashAngle:firingAim(p,state.enemies);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(aim);ctx.fillStyle='#d4f878';ctx.beginPath();ctx.moveTo(40,0);ctx.lineTo(30,-6);ctx.lineTo(30,6);ctx.closePath();ctx.fill();ctx.restore();
 for(const bullet of bullets){ctx.strokeStyle='#e7ffad';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(bullet.x-bullet.dx*13,bullet.y-bullet.dy*13);ctx.lineTo(bullet.x,bullet.y);ctx.stroke();}
 if(slash>0){rect(p.x+Math.cos(slashAngle)*24-4,p.y+Math.sin(slashAngle)*24-4,8,8,'#fff4ba');}
 for(const a of particles)rect(a.x,a.y,5,5,a.c);ctx.restore();
 drawMap();
}
function roomCleared(index){return !state.enemies.some(e=>e.hp>0&&e.roomId===index);}
function drawMap(){const mini=$('minimap'),c=mini.getContext('2d'),m=state.map,scale=Math.min(mini.width/m.width,mini.height/m.height);c.clearRect(0,0,mini.width,mini.height);c.fillStyle='#121218';c.fillRect(0,0,mini.width,mini.height);
 for(const [a,b] of m.links){const A=m.rooms[a],B=m.rooms[b];c.strokeStyle='#555963';c.beginPath();c.moveTo(A.cx*scale,A.cy*scale);c.lineTo(B.cx*scale,A.cy*scale);c.lineTo(B.cx*scale,B.cy*scale);c.stroke();}
 m.rooms.forEach((room,index)=>{c.fillStyle=roomCleared(index)?'#a875e8':'#626873';c.fillRect(room.x*scale,room.y*scale,room.w*scale,room.h*scale);});
 if(m.rooms[m.exitRoom].seen||!state.enemies.length){c.fillStyle='#d4f878';c.fillRect(m.exit.x/TILE*scale-2,m.exit.y/TILE*scale-2,5,5);}c.fillStyle='#fff';c.beginPath();c.arc(state.player.x/TILE*scale,state.player.y/TILE*scale,3,0,Math.PI*2);c.fill();}
function loop(time){const dt=Math.min((time-last)/1000,.04);last=time;if(mode==='playing')tick(dt);draw();requestAnimationFrame(loop);}
const saved=load();state=saved||fresh();if(!saved||!state.map||state.version!==2){spawn();if(saved)$('modal-copy').textContent='Your health, gold, and floor are kept. This floor is now a full dungeon to explore.';}else{updateHUD();$('modal-title').textContent='Back for more?';$('modal-copy').textContent='Your adventure is waiting on floor '+state.floor+'. Pick up right where you left off.';$('start').innerHTML='Continue your adventure <span>→</span>';$('restart').hidden=false;}
// Old maze saves encode the original room in each enemy's stable spawn seed.
for(const enemy of state.enemies)if(!Number.isInteger(enemy.roomId))enemy.roomId=Math.floor(enemy.seed/5);
requestAnimationFrame(loop);
