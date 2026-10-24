const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const elements=new Map(),storage=new Map();
const context=new Proxy({},{get:()=>()=>{}});
const el=id=>{if(!elements.has(id))elements.set(id,{width:800,height:450,clientWidth:800,clientHeight:450,style:{},dataset:{},focus(){},addEventListener(){},setAttribute(){},setPointerCapture(){},getContext:()=>context});return elements.get(id);};
const sandbox={document:{getElementById:el,querySelector:el,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},console,assert};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../game.js'),'utf8'),sandbox);
vm.runInContext(`
// Every floor tile, room, and exit must be reachable across a range of seeds and sizes.
for(let floor=1;floor<=12;floor++)for(let seed=1;seed<=8;seed++){
 const m=generateFloor(floor,seed);state.map=m;navCache=null;
 const p={x:(m.rooms[0].cx+.5)*TILE,y:(m.rooms[0].cy+.5)*TILE};const dist=navigation(p);
 assert.ok(m.tiles.every((tile,i)=>!tile||dist[i]>=0),'disconnected floor');
 assert.ok(!collision(m.exit.x,m.exit.y,16),'blocked exit');
 assert.ok(m.rooms.length>=9);assert.ok(m.width*TILE>1500);
}
assert.notDeepEqual(generateFloor(1,1).tiles,generateFloor(1,2).tiles);
state=fresh();spawn();begin();
assert.equal(state.map.rooms[0].seen,true);assert.ok(state.enemies.every(e=>!collision(e.x,e.y,16)));
// Enemy route must traverse multiple rooms without crossing a wall.
let m=state.map,p={...state.player},end=m.rooms[m.exitRoom],enemy={x:(end.cx+.5)*TILE,y:(end.cy+.5)*TILE};
for(let i=0;i<16000&&Math.hypot(enemy.x-p.x,enemy.y-p.y)>20;i++){chase(enemy,p,160,.04);assert.ok(!collision(enemy.x,enemy.y,16));}
assert.ok(Math.hypot(enemy.x-p.x,enemy.y-p.y)<25,'enemy trapped in maze');
const savedTiles=JSON.stringify(state.map.tiles);save();assert.equal(JSON.stringify(load().map.tiles),savedTiles);
// Combat still chooses a crowd, rather than the nearest isolated enemy.
state.player={x:(m.rooms[0].cx+.5)*TILE,y:(m.rooms[0].cy+.5)*TILE,dx:0,dy:-1};p=state.player;
state.enemies=[{x:p.x,y:p.y-30,hp:100,max:100},{x:p.x+55,y:p.y-15,hp:100,max:100},{x:p.x+65,y:p.y,hp:100,max:100},{x:p.x+55,y:p.y+15,hp:100,max:100}];attackCD=0;attack();assert.equal(state.enemies[0].hp,100);assert.equal(bullets.length,1);assert.ok(bullets[0].dx>.9);assert.ok(state.enemies.every(e=>e.hp===100),'damage before projectile impact');
attack();assert.equal(bullets.length,1,'cooldown ignored');updateBullets(.2);assert.ok(state.enemies.slice(1).some(e=>e.hp<100));assert.equal(state.enemies[0].hp,100);assert.equal(bullets.length,0,'projectile should stop on impact');
assert.equal(FIRE_INTERVAL,.16);attackCD=0;attack();assert.equal(bullets.length,1);
// Wall impacts terminate bullets even with a long simulated frame.
state.enemies=[];bullets=[{x:p.x,y:p.y,dx:-1,dy:0,remaining:600,damage:17}];updateBullets(2);assert.equal(bullets.length,0);


attackPointer=7;keys.add('attack');releaseAttack({pointerId:8});assert.ok(keys.has('attack'));releaseAttack({pointerId:7});assert.ok(!keys.has('attack'));
state.enemies=[];state.player={...state.map.exit,dx:0,dy:1};const oldSeed=state.map.seed;tick(.01);assert.equal(state.floor,2);assert.notEqual(state.map.seed,oldSeed);assert.equal(state.map.theme,1);
state.floor=5;spawn();assert.ok(state.enemies.some(e=>e.boss));
draw();const oldCamera=camera.x;state.player.x+=200;draw();assert.ok(camera.x>oldCamera,'camera does not follow');
state=fresh();spawn();assert.ok(roomCleared(0),'safe start should be purple');assert.equal(roomCleared(1),false);
const roomEnemies=state.enemies.filter(e=>e.roomId===1);roomEnemies.forEach(e=>{e.x=state.player.x;e.y=state.player.y;});assert.equal(roomCleared(1),false,'chasing enemies must not clear their room');
state.enemies=state.enemies.filter(e=>e.roomId!==1);assert.ok(roomCleared(1));assert.equal(roomCleared(2),false);save();assert.ok(load().enemies.every(e=>Number.isInteger(e.roomId)));
state=fresh();spawn();state.kills=7;state.hp=1;state.enemies=[{...state.player,hp:50,max:50,cooldown:0,boss:false}];mode='playing';invincible=0;keys.clear();tick(.01);assert.equal(mode,'dead');assert.ok(document.getElementById('modal-copy').textContent.includes('7 monsters defeated'),'death screen missing kill count');
assert.equal(document.getElementById('death-screen').hidden,false);assert.equal(document.getElementById('stat-kills').textContent,7);assert.equal(document.getElementById('best-badge').hidden,false);assert.equal(recentRuns()[0].kills,7);assert.equal(runTime(78),'1:18');
state.floor=1;showDeath();assert.equal(document.getElementById('best-badge').hidden,true,'tied score should not be new best');
document.getElementById('retry').onclick();assert.equal(mode,'playing');assert.equal(state.kills,0);assert.equal(document.getElementById('death-screen').hidden,true);
mode='dead';showDeath();document.getElementById('return-title').onclick();assert.equal(mode,'ready');assert.equal(document.getElementById('overlay').hidden,false);
state=fresh();spawn();state.elapsed=65;rememberMoment(32,'Two monsters defeated!');state.elapsed=80;rememberMoment(101,'Floor 1 cleared!');state.elapsed=90;rememberMoment(10,'One monster defeated');assert.equal(state.highlight.text,'Floor 1 cleared!');assert.ok(bestMoment().includes('1:20'));rememberMoment(1005,'Guardian defeated on floor 5!');assert.ok(bestMoment().includes('Guardian'));save();assert.equal(load().highlight.rank,1005);
state.kills=6;mode='dead';showDeath();assert.equal(document.getElementById('death-title').textContent,'You defeated 6 monsters.');
document.getElementById('joystick').getBoundingClientRect=()=>({left:0,top:0,width:140,height:140});
state=fresh();spawn();mode='playing';state.enemies=[];joystick.pointer=12;steerJoystick({clientX:112,clientY:70});assert.equal(joystick.x,1);assert.equal(joystick.y,0);const before=state.player.x;tick(.02);assert.ok(state.player.x>before);steerJoystick({clientX:300,clientY:300});assert.ok(Math.hypot(joystick.x,joystick.y)<=1.00001);document.getElementById('joystick').onpointerup({pointerId:13});assert.equal(joystick.pointer,12);document.getElementById('joystick').onpointercancel({pointerId:12});assert.equal(joystick.pointer,null);assert.equal(joystick.x,0);
console.log('PASS: death statistics, best score, history, retry and title return;  room clear status and saved ownership;  96 connected maze layouts, spawn and exit clearance, multi-room enemy routing, saved map persistence, projectile travel, crowd aiming, faster fire cooldown, wall impacts, multitouch release, floor progression, bosses, camera following');
`,sandbox);
