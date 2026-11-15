const C=['#ff4757','#2ed573','#1e90ff','#ffa502','#9b59b6','#00d2d3','#ff6b81','#a4b0be'];

export function createGame({ container, players, onScores, onStatus }) {
  const canvas=document.createElement('canvas'); canvas.className='game-canvas'; container.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const S={p:new Map(),b:[],fx:[],run:false,round:1,phase:'count',t:3,roundTime:60,last:0,frame:0,hud:null,nextPower:4,shake:0,
    obs:[.14,.18,.17,.12,.69,.18,.17,.12,.40,.34,.20,.30,.14,.70,.17,.12,.69,.70,.17,.12]};
  const W=()=>container.clientWidth||innerWidth,H=()=>container.clientHeight||innerHeight;
  function resize(){const d=Math.min(devicePixelRatio||1,1.5),w=W(),h=H();canvas.width=w*d;canvas.height=h*d;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(d,0,0,d,0,0)}
  function hud(){const h=document.createElement('div');h.className='game-hud';h.innerHTML='<div class="game-hud-top"><span class="game-pill" id="r">ROUND 1/3</span><span class="game-pill" id="p">GET READY</span></div><div class="game-hud-message" id="m">GET READY</div>';container.appendChild(h);S.hud=h}
  const msg=q=>S.hud&&(S.hud.querySelector('#m').textContent=q);
  const phase=q=>{S.phase=q; if(S.hud){S.hud.querySelector('#p').textContent=q==='play'?`${Math.max(0,Math.ceil(S.t))}s`:q.toUpperCase();S.hud.querySelector('#r').textContent=`ROUND ${S.round}/3`}};
  function blocked(px,py,r){for(let i=0;i<S.obs.length;i+=4){const ox=S.obs[i]*W(),oy=S.obs[i+1]*H(),ow=S.obs[i+2]*W(),oh=S.obs[i+3]*H(),cx=Math.max(ox,Math.min(px,ox+ow)),cy=Math.max(oy,Math.min(py,oy+oh));if(Math.hypot(px-cx,py-cy)<r)return true}return false}
  function pos(slot){const a=[[.1,.12],[.9,.12],[.1,.88],[.9,.88],[.3,.12],[.7,.12],[.3,.88],[.7,.88]][(slot-1)%8];return{x:a[0]*W(),y:a[1]*H()}}
  function add(id,d){const q=pos(d.slot);S.p.set(id,{...d,color:C[(d.slot-1)%8],x:q.x,y:q.y,a:0,hp:4,maxHp:4,score:d.score||0,alive:true,fc:0,bc:0,bt:0,inv:0,i:{x:0,y:0}})}
  function scores(){return[...S.p.values()].map(p=>({id:p.id,score:Math.round(p.score)}))}
  function fx(px,py,col,count=18){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*180;S.fx.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+Math.random()*.4,color:col})}}
  function kill(p,k){if(!p.alive)return;p.alive=false;p.score+=k?0:30;if(k){k.score+=100}fx(p.x,p.y,p.color,28);S.shake=Math.min(10,S.shake+5);onScores(scores());const a=[...S.p.values()].filter(z=>z.alive);if(a.length<=1){if(a[0]){a[0].score+=150;msg(`${a[0].name} WINS ROUND ${S.round}`)}else msg('NO SURVIVOR');onScores(scores());phase('over');S.t=3.2}}
  function input(id,a){const p=S.p.get(id);if(!p||!p.alive)return;
    if(typeof a==='string'&&a.startsWith('MOVE_AXIS:')){const [sx,sy]=a.slice(10).split(',').map(Number);p.i.x=Math.max(-1,Math.min(1,Number.isFinite(sx)?sx:0));p.i.y=Math.max(-1,Math.min(1,Number.isFinite(sy)?sy:0));return}
    const m={MOVE_UP_START:['y',-1],MOVE_UP_STOP:['y',0],MOVE_DOWN_START:['y',1],MOVE_DOWN_STOP:['y',0],MOVE_LEFT_START:['x',-1],MOVE_LEFT_STOP:['x',0],MOVE_RIGHT_START:['x',1],MOVE_RIGHT_STOP:['x',0]};
    if(m[a]){p.i[m[a][0]]=m[a][1];return}
    if(a==='ACTION_A_START'&&p.fc<=0&&S.phase==='play'){S.b.push({o:id,x:p.x+Math.cos(p.a)*42,y:p.y+Math.sin(p.a)*42,vx:Math.cos(p.a)*720,vy:Math.sin(p.a)*720,life:0,b:4});p.fc=.3;fx(p.x+Math.cos(p.a)*34,p.y+Math.sin(p.a)*34,p.color,5)}
    if(a==='ACTION_B_START'&&p.bc<=0&&S.phase==='play'){p.bt=1.2;p.bc=4;fx(p.x,p.y,'#7bed9f',16)}
  }
  function reset(){S.p.forEach(p=>{const q=pos(p.slot);p.x=q.x;p.y=q.y;p.hp=p.maxHp;p.alive=true;p.fc=p.bc=p.bt=p.inv=0;p.i={x:0,y:0}});S.b=[];S.fx=[];S.t=3;phase('count');msg('GET READY')}
  function update(dt){for(let i=S.fx.length-1;i>=0;i--){const f=S.fx[i];f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=.94;f.vy*=.94;if(f.life<=0)S.fx.splice(i,1)}S.shake=Math.max(0,S.shake-dt*16);
    if(S.phase==='count'){S.t-=dt;msg(S.t>0?Math.ceil(S.t):'GO!');if(S.t<=0){S.t=S.roundTime;phase('play')}return}
    if(S.phase==='over'){S.t-=dt;if(S.t<=0){if(S.round>=3){const w=[...S.p.values()].sort((a,b)=>b.score-a.score)[0];msg(w?`${w.name} WINS THE MATCH`:'MATCH COMPLETE');phase('finished');onStatus('finished')}else{S.round++;reset()}}return}
    if(S.phase!=='play')return;
    S.t-=dt;if(S.t<=0){const a=[...S.p.values()].filter(z=>z.alive);if(a.length){a.sort((u,v)=>(v.hp+v.score/1000)-(u.hp+u.score/1000));a[0].score+=75;msg(`${a[0].name} WINS ON TIME`);onScores(scores())}S.t=3.2;phase('over');return}
    for(const p of S.p.values()){if(!p.alive)continue;const mag=Math.hypot(p.i.x,p.i.y);if(mag>.08){const nx=p.i.x/mag,ny=p.i.y/mag;const sp=p.bt>0?480:260;p.x+=nx*sp*dt;p.y+=ny*sp*dt;p.a=Math.atan2(ny,nx)}
      p.x=Math.max(38,Math.min(W()-38,p.x));p.y=Math.max(38,Math.min(H()-38,p.y));p.fc=Math.max(0,p.fc-dt);p.bc=Math.max(0,p.bc-dt);p.bt=Math.max(0,p.bt-dt);p.inv=Math.max(0,p.inv-dt)}
    for(let i=S.b.length-1;i>=0;i--){const b=S.b[i];b.life+=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;let hitWall=false;if(b.x<20||b.x>W()-20){b.vx*=-1;hitWall=true;b.b--}if(b.y<20||b.y>H()-20){b.vy*=-1;hitWall=true;b.b--}if(blocked(b.x,b.y,7)){b.vx*=-1;b.vy*=-1;b.b--;hitWall=true}if(hitWall)fx(b.x,b.y,'#fff',4);for(const p of S.p.values())if(p.alive&&p.inv<=0&&!(p.id===b.o&&b.life<.1)&&Math.hypot(p.x-b.x,p.y-b.y)<34){p.hp--;p.inv=.18;fx(b.x,b.y,p.color,12);b.b=0;if(p.hp<=0)kill(p,S.p.get(b.o));break}if(b.b<=0||b.life>6)S.b.splice(i,1)}
    phase('play')
  }
  function render(){const w=W(),h=H();ctx.clearRect(0,0,w,h);ctx.save();ctx.translate((Math.random()-.5)*S.shake,(Math.random()-.5)*S.shake);ctx.fillStyle='#050913';ctx.fillRect(0,0,w,h);const gr=ctx.createRadialGradient(w*.5,h*.45,50,w*.5,h*.45,Math.max(w,h)*.75);gr.addColorStop(0,'rgba(255,71,87,.06)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(0,242,255,.04)';for(let a=0;a<w;a+=52){ctx.beginPath();ctx.moveTo(a,0);ctx.lineTo(a,h);ctx.stroke()}for(let a=0;a<h;a+=52){ctx.beginPath();ctx.moveTo(0,a);ctx.lineTo(w,a);ctx.stroke()}ctx.strokeStyle='#00f2ff';ctx.lineWidth=3;ctx.strokeRect(12,12,w-24,h-24);
    for(let i=0;i<S.obs.length;i+=4){const ox=S.obs[i]*w,oy=S.obs[i+1]*h,ow=S.obs[i+2]*w,oh=S.obs[i+3]*h;ctx.fillStyle='#111827';ctx.fillRect(ox,oy,ow,oh);ctx.strokeStyle='rgba(0,242,255,.4)';ctx.strokeRect(ox,oy,ow,oh)}
    for(const b of S.b){ctx.fillStyle='#fff';ctx.shadowBlur=14;ctx.shadowColor='#fff';ctx.beginPath();ctx.arc(b.x,b.y,6,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
    for(const f of S.fx){ctx.globalAlpha=Math.max(0,f.life*1.9);ctx.fillStyle=f.color;ctx.fillRect(f.x,f.y,3,3)}ctx.globalAlpha=1;
    for(const p of S.p.values()){if(!p.alive){ctx.fillStyle='#ff4757';ctx.font='700 13px Inter';ctx.textAlign='center';ctx.fillText('OUT',p.x,p.y);continue}ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.shadowBlur=22;ctx.shadowColor=p.color;ctx.fillStyle='#0a0e16';ctx.fillRect(-36,-28,72,14);ctx.fillRect(-36,14,72,14);ctx.fillStyle=p.color;ctx.fillRect(-28,-20,56,40);ctx.fillStyle='#fff';ctx.fillRect(4,-5,44,10);ctx.fillStyle='#070b12';ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.restore();ctx.fillStyle='#fff';ctx.font='700 12px Inter';ctx.textAlign='center';ctx.fillText(`${p.name} · ${Math.round(p.score)}`,p.x,p.y-44);for(let i=0;i<p.maxHp;i++){ctx.fillStyle=i<p.hp?p.color:'rgba(255,255,255,.12)';ctx.fillRect(p.x-24+i*13,p.y-34,9,4)}}ctx.restore()}
  function loop(){if(!S.run)return;const n=performance.now(),dt=Math.min((n-S.last)/1000,.05);S.last=n;update(dt);render();S.frame=requestAnimationFrame(loop)}
  function start(){resize();hud();S.round=1;S.run=true;S.last=performance.now();reset();onStatus('running');loop()}
  function stop(){S.run=false;cancelAnimationFrame(S.frame);S.p.clear();S.b=[];S.fx=[];S.hud?.remove();canvas.remove()}
  return{start,stop,resize,handleAction:input,addPlayer:(id,d)=>S.run&&add(id,d),removePlayer:id=>S.p.delete(id),getScores:scores}
}
