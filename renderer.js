'use strict';
/* Educational particle diagrams: projection and interaction, not molecular dynamics. */
class AtomRenderer {
 constructor(canvas) {
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.atoms=[];this.bonds=[];this.counts={};this.model=null;this.state='unknown';this.view='molecule';this.angle=.25;this.tilt=-.18;this.zoom=1;this.paused=matchMedia('(prefers-reduced-motion: reduce)').matches;this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.effect=null;this.dragging=false;this.last=0;
  this.colors={H:'#d9eaff',O:'#ff6c7f',C:'#8299ac',N:'#7299ff',Na:'#b99aff',Cl:'#72edbd',Mg:'#8be4e8',Fe:'#bdad95',Cu:'#eda77c',S:'#e8d56e',Si:'#bdaaff',Ca:'#b7e88b'};
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
  canvas.addEventListener('pointerdown',e=>{this.dragging=true;this.pointer=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!this.dragging)return;this.angle+=(e.clientX-this.pointer[0])*.008;this.tilt=Math.max(-1.2,Math.min(1.2,this.tilt+(e.clientY-this.pointer[1])*.005));this.pointer=[e.clientX,e.clientY]});
  canvas.addEventListener('pointerup',()=>this.dragging=false);canvas.addEventListener('pointercancel',()=>this.dragging=false);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.55,Math.min(1.9,this.zoom-e.deltaY*.001))},{passive:false});
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')this.angle-=.12;if(e.key==='ArrowRight')this.angle+=.12;if(e.key==='ArrowUp')this.tilt-=.08;if(e.key==='ArrowDown')this.tilt+=.08;if(e.key==='+'||e.key==='=')this.zoom=Math.min(1.9,this.zoom+.1);if(e.key==='-')this.zoom=Math.max(.55,this.zoom-.1)}});
  this.reduced.addEventListener('change',e=>{if(e.matches)this.paused=true});
  this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);
 }
 resize(){let r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;let d=Math.min(devicePixelRatio||1,2);this.canvas.width=r.width*d;this.canvas.height=r.height*d;this.ctx.setTransform(d,0,0,d,0,0)}
 set(counts,compound=null){this.counts={...counts};this.model=compound?.model;this.state=compound?.state||'unknown';this.atoms=[];this.bonds=[];let add=(s,x,y,z=0)=>this.atoms.push({s,x,y,z,seed:this.atoms.length*.71});
  let keys=Object.keys(counts);let total=Object.values(counts).reduce((a,b)=>a+b,0);this.total=total;
  if(this.model==='water'){add('O',0,.3);add('H',-1.18,-.6);add('H',1.18,-.6);this.bonds=[[0,1],[0,2]]}
  else if(this.model==='linear'){add('C',0,0);add('O',-1.65,0);add('O',1.65,0);this.bonds=[[0,1],[0,2]]}
  else if(this.model==='diatomic'){add(keys[0],-.85,0);add(keys[0],.85,0);this.bonds=[[0,1]]}
  else if(this.model==='tetra'){add('C',0,0);[[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]].forEach(p=>add('H',...p));this.bonds=[[0,1],[0,2],[0,3],[0,4]]}
  else if(this.model==='pyramid'){add('N',0,.65);[0,2.094,4.189].forEach(a=>add('H',Math.cos(a)*1.4,-.55,Math.sin(a)*1.4));this.bonds=[[0,1],[0,2],[0,3]]}
  else if(this.model==='lattice'||this.model==='metal'){for(let x=0;x<3;x++)for(let y=0;y<3;y++)for(let z=0;z<3;z++){let s=this.model==='metal'?keys[0]:keys[(x+y+z)%keys.length];add(s,(x-1)*1.13,(y-1)*1.13,(z-1)*1.13)}}
  else {let n=0;for(let [s,count] of Object.entries(counts)){let limit=Math.min(count,Math.max(1,Math.round(count/total*100)));for(let i=0;i<limit&&n<120;i++){let a=n*2.39996;let r=Math.sqrt(n)*.31;add(s,Math.cos(a)*r,Math.sin(a)*r,Math.sin(n*1.7)*.7);n++}}}
 }
 trigger(kind){this.effect={kind,start:performance.now(),particles:Array.from({length:80},(_,i)=>({a:i*2.39996,s:.3+Math.random(),r:2+Math.random()*4}))}}
 project(p){let c=Math.cos(this.angle),s=Math.sin(this.angle),x=p.x*c+p.z*s,z=-p.x*s+p.z*c,y=p.y*Math.cos(this.tilt)-z*Math.sin(this.tilt);z=p.y*Math.sin(this.tilt)+z*Math.cos(this.tilt);let scale=Math.min(this.width/8,this.height/6)*this.zoom;let perspective=7/(7+z*.22);return{x:this.width/2+x*scale*perspective,y:this.height*.53-y*scale*perspective,z,scale:scale*perspective}}
 frame(time){let dt=Math.min((time-this.last)/1000,.05)||0;this.last=time;if(!document.hidden){if(!this.paused&&!this.dragging)this.angle+=dt*.17;this.draw(time)}requestAnimationFrame(this.frame)}
 draw(time){const c=this.ctx,w=this.width,h=this.height;if(!w||!h)return;c.clearRect(0,0,w,h);c.save();
  // Perspective coordinate grid, a diagram reference plane.
  c.lineWidth=1;for(let i=-10;i<=10;i++){c.strokeStyle=i===0?'#34506188':'#29455644';let a=this.project({x:i,y:-2,z:-10}),b=this.project({x:i,y:-2,z:10});c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();a=this.project({x:-10,y:-2,z:i});b=this.project({x:10,y:-2,z:i});c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()}
  c.fillStyle='#06101a77';c.beginPath();c.ellipse(w/2,h*.76,w*.22,17,0,0,Math.PI*2);c.fill();
  let points=this.atoms.map(p=>({...p})),bonds=this.bonds;
  if(this.view==='matter'&&this.state!=='unknown'){
   points=[];bonds=[];let symbols=Object.keys(this.counts), clock=this.paused||this.reduced.matches?0:time/1000;
   const solid=this.state==='solid';for(let i=0;i<48;i++){let x,y,z;if(solid){x=(i%4-1.5)*.72;y=(Math.floor(i/4)%4-1.5)*.72;z=(Math.floor(i/16)-1)*.72;x+=Math.sin(clock*5+i)*.022;y+=Math.cos(clock*5+i)*.022}else if(this.state==='liquid'){x=Math.sin(i*7+clock*.16)*2.45;y=-1.2+(Math.sin(i*3+clock*.3)+1)*.72;z=Math.cos(i*4+clock*.2)*1.9}else{x=Math.sin(i*7+clock*.34)*2.5;y=Math.cos(i*3+clock*.42)*1.7;z=Math.cos(i*4+clock*.28)*2}points.push({s:'unit',x,y,z,particle:true,seed:i})}
  }
  let projected=points.map((p,i)=>({...p,...this.project(p),index:i}));
  for(let [a,b] of bonds){if(!projected[a]||!projected[b])continue;let p=projected[a],q=projected[b];let g=c.createLinearGradient(p.x,p.y,q.x,q.y);g.addColorStop(0,'#aac8d877');g.addColorStop(.5,'#d4eefbaa');g.addColorStop(1,'#aac8d866');c.strokeStyle=g;c.lineWidth=11*this.zoom;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.strokeStyle='#e9faff66';c.lineWidth=2;c.beginPath();c.moveTo(p.x-2,p.y-2);c.lineTo(q.x-2,q.y-2);c.stroke()}
  projected.sort((a,b)=>b.z-a.z).forEach(p=>{let many=points.length>8;let radius=p.scale*(p.particle?.15:many?.24:p.s==='H'?.39:.57);let color=this.colors[p.s]||'#82d9df';let g=c.createRadialGradient(p.x-radius*.35,p.y-radius*.45,0,p.x,p.y,radius);g.addColorStop(0,'#ffffff');g.addColorStop(.12,color);g.addColorStop(.6,color);g.addColorStop(1,'#102331');c.save();c.shadowColor=color+'45';c.shadowBlur=p.particle?3:18;c.fillStyle=g;c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fill();c.shadowBlur=0;c.strokeStyle=color+'b0';c.lineWidth=1;c.stroke();if(!p.particle&&points.length<40){c.fillStyle=p.s==='H'?'#23465c':'#ffffff';c.shadowColor='#0007';c.shadowBlur=4;c.font=`600 ${Math.max(11,radius*.58)}px Consolas,monospace`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.s,p.x,p.y+1)}c.restore()});
  if(!points.length){c.textAlign='center';c.fillStyle='#6e8e9f';c.font='15px "Segoe UI","Microsoft JhengHei",sans-serif';c.fillText('從左側選一顆原子，開始探索',w/2,h/2)}
  if(this.view==='molecule'&&this.model==='water'&&projected.length===3){let o=projected.find(p=>p.index===0);c.font='11px Consolas,monospace';c.fillStyle='#9dbacb';c.textAlign='center';c.fillText('104.5°',o.x,o.y+80*this.zoom)}
  c.textAlign='center';c.font='11px "Segoe UI","Microsoft JhengHei",sans-serif';c.fillStyle='#829eae';let caption=this.view==='matter'?(this.state==='unknown'?'物態未知，無法推定粒子運動':'每顆點代表一個粒子單位 · 排列與運動示意'):(this.model==='lattice'||this.model==='metal'?'延伸固體排列概念 · 非精確晶胞':!this.model&&points.length?'組成示意 · 不代表真實分子結構':'球棍結構示意 · 非實際原子比例');c.fillText(caption,w/2,h-58);
  if(this.effect){let t=(time-this.effect.start)/1000;if(t>2.8)this.effect=null;else{let kind=this.effect.kind,color=kind==='explosion'||kind==='fire'?'#ff9c55':kind==='glow'?'#b2e9ff':kind==='precipitate'?'#d6c4ff':'#72f6cf';c.globalAlpha=Math.max(0,1-t/2.8);if(!this.reduced.matches){
   if(kind==='bubbles'){for(let p of this.effect.particles.slice(0,36)){let x=w*.5+Math.cos(p.a)*w*.28,y=h*.75-((t*p.s*.45+p.s*.25)%1)*h*.6;c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();c.arc(x,y,p.r*2.2,0,Math.PI*2);c.stroke()}}
   else if(kind==='precipitate'){for(let p of this.effect.particles){let x=w*.5+Math.cos(p.a)*w*.25,y=Math.min(h*.76,h*.27+(t*p.s*.3+p.s*.12)*h);c.fillStyle=color;c.beginPath();c.arc(x,y,p.r*.8,0,Math.PI*2);c.fill()}c.fillStyle='#c5a0ff44';c.fillRect(w*.23,h*.77,w*.54,4+Math.min(t*6,12))}
   else{let r=30+t*130;c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.ellipse(w/2,h*.5,r,r*.65,0,0,Math.PI*2);c.stroke();for(let p of this.effect.particles){let d=t*p.s*160;c.fillStyle=color;c.beginPath();c.arc(w/2+Math.cos(p.a)*d,h*.5+Math.sin(p.a)*d*.7+(kind==='fire'?-t*45:0),Math.max(.2,p.r*(1-t/3)),0,Math.PI*2);c.fill()}}
  }else{c.strokeStyle=color;c.lineWidth=2;c.strokeRect(w*.2,h*.3,w*.6,h*.4)}}}
  c.restore();
 }
}
globalThis.AtomRenderer=AtomRenderer;
