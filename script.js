import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas=document.querySelector("#scene");
const scoreEl=document.querySelector("#score");
const coinsEl=document.querySelector("#coins");
const startScreen=document.querySelector("#start-screen");
const gameOverScreen=document.querySelector("#gameover");
const pauseScreen=document.querySelector("#pause-screen");
const finalScore=document.querySelector("#final-score");

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x101b31);
scene.fog=new THREE.Fog(0x101b31,24,115);

const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,180);
camera.position.set(0,5.2,10.5);
camera.lookAt(0,1.4,-5);

const renderer=new THREE.WebGLRenderer({
 canvas,
 antialias:true,
 powerPreference:"high-performance"
});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;

scene.add(new THREE.HemisphereLight(0xa9caff,0x24202b,2));

const moon=new THREE.DirectionalLight(0xffd59a,2.4);
moon.position.set(-5,12,8);
moon.castShadow=true;
moon.shadow.mapSize.set(1024,1024);
scene.add(moon);

const mat=(color,roughness=.75,metalness=0)=>
 new THREE.MeshStandardMaterial({color,roughness,metalness});

const gold=mat(0xffbd45,.35,.65);
const dark=mat(0x171d2b);
const asphalt=mat(0x242b38);
const railMat=mat(0x9aa8ba,.3,.8);
const laneX=[-2.15,0,2.15];

let running=false,paused=false,ended=false;
let lane=1,score=0,coins=0,speed=17,elapsed=0,spawnClock=0;
let objects=[],scenery=[];
let jumpVelocity=0,sliding=0;

const clock=new THREE.Clock();

function box(parent,w,h,d,material,x,y,z,cast=true){
 const mesh=new THREE.Mesh(
  new THREE.BoxGeometry(w,h,d),material
 );
 mesh.position.set(x,y,z);
 mesh.castShadow=cast;
 mesh.receiveShadow=true;
 parent.add(mesh);
 return mesh;
}

function cylinder(parent,r1,r2,h,material,x,y,z,segments=10){
 const mesh=new THREE.Mesh(
  new THREE.CylinderGeometry(r1,r2,h,segments),material
 );
 mesh.position.set(x,y,z);
 mesh.castShadow=true;
 parent.add(mesh);
 return mesh;
}

// الطريق
box(scene,9,.35,150,asphalt,0,-.28,-47,false);

for(const x of [-3.2,3.2]){
 box(scene,.12,.18,150,railMat,x,-.02,-47,false);
}

const sleeperMat=mat(0x596170);

for(let z=5;z>-120;z-=2.5){
 const sleeper=box(scene,7.1,.12,.48,sleeperMat,0,-.08,z,false);
 sleeper.userData.sleeper=true;
}

for(const x of [-1.08,1.08]){
 box(scene,.035,.012,150,mat(0x667080),x,-.095,-47,false);
}

box(scene,180,.3,180,mat(0x111827),0,-.55,-55,false);

// الشخصية
const player=new THREE.Group();
scene.add(player);
player.position.set(0,0,3);

const fallback=new THREE.Group();
player.add(fallback);

const skin=mat(0xb8794b);
const jacket=mat(0x171f31);
const pants=mat(0x202c43);
const shoe=mat(0xf0b747,.45,.25);
const visor=mat(0x0b111c,.2,.5);

const torso=box(fallback,.72,.9,.38,jacket,0,1.35,0);
box(fallback,.42,.28,.405,gold,0,1.45,-.012);

const head=new THREE.Mesh(
 new THREE.SphereGeometry(.27,16,12),skin
);
head.position.set(0,2.02,0);
fallback.add(head);

const hair=new THREE.Mesh(
 new THREE.SphereGeometry(.275,14,9,0,Math.PI*2,0,Math.PI*.55),
 dark
);
hair.position.set(0,2.12,0);
fallback.add(hair);

box(fallback,.38,.12,.29,visor,0,1.98,-.16);
box(fallback,.52,.12,.42,gold,0,1.78,0);

const limbs=[];

function limb(x,y,len,material,width=.19){
 const pivot=new THREE.Group();
 pivot.position.set(x,y,0);
 fallback.add(pivot);
 box(pivot,width,len,width,material,0,-len/2,0);
 limbs.push(pivot);
 return pivot;
}

const armL=limb(-.48,1.68,.58,jacket,.17);
const armR=limb(.48,1.68,.58,jacket,.17);
const legL=limb(-.22,.93,.62,pants,.23);
const legR=limb(.22,.93,.62,pants,.23);

for(const arm of [armL,armR]){
 const glove=new THREE.Mesh(
  new THREE.SphereGeometry(.12,10,8),gold
 );
 glove.position.set(0,-.59,0);
 arm.add(glove);
}

for(const leg of [legL,legR]){
 box(leg,.27,.16,.42,shoe,0,-.62,-.09);
}

const tail=new THREE.Group();
tail.position.set(0,1.2,.23);
fallback.add(tail);

for(let i=0;i<4;i++){
 const seg=box(tail,.12,.12,.28,gold,0,0,.18+i*.22);
 seg.rotation.x=-.2-i*.13;
}

const stinger=new THREE.Mesh(
 new THREE.ConeGeometry(.13,.35,8),gold
);
stinger.position.set(0,.05,1.05);
stinger.rotation.x=Math.PI;
tail.add(stinger);

// الشخصية المتحركة
let mixer=null;
let actions={};
let activeAction=null;
let modelReady=false;

function playAnimation(name){
 if(!actions[name]||activeAction===actions[name])return;

 const next=actions[name];
 next.reset().fadeIn(.2).play();

 if(activeAction)activeAction.fadeOut(.2);

 activeAction=next;
}

const loader=new GLTFLoader();

loader.load(
 "https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb",
 gltf=>{
  const model=gltf.scene;
  model.scale.setScalar(.78);
  model.rotation.y=Math.PI;

  model.traverse(obj=>{
   if(obj.isMesh){
    obj.castShadow=true;
    obj.receiveShadow=true;
   }
  });

  player.add(model);
  fallback.visible=false;

  mixer=new THREE.AnimationMixer(model);

  for(const clip of gltf.animations){
   actions[clip.name]=mixer.clipAction(clip);
  }

  modelReady=true;
  playAnimation("Running");
 },
 undefined,
 error=>console.warn("Character model unavailable:",error)
);

// المدينة
function makeBuilding(x,z){
 const g=new THREE.Group();
 scene.add(g);

 const h=8+Math.random()*13;
 const w=4+Math.random()*3;
 const d=7+Math.random()*5;

 box(
  g,w,h,d,
  mat([0x26354b,0x313b4c,0x202c40][Math.floor(Math.random()*3)]),
  0,h/2-.4,0
 );

 const winMat=mat(0xffc86b,.4,.1);

 for(let yy=1.4;yy<h-1;yy+=1.7){
  for(let xx=-w/2+.7;xx<w/2-.3;xx+=1.1){
   if(Math.random()>.18){
    box(g,.38,.62,.035,winMat,xx,yy,d/2+.02,false);
   }
  }
 }

 g.position.set(x,0,z);
 scenery.push(g);
}

function makeLamp(x,z){
 const g=new THREE.Group();
 scene.add(g);

 cylinder(g,.055,.075,5,railMat,0,2.5,0,8);
 box(g,.75,.09,.12,gold,.3,4.95,0,false);

 const glow=new THREE.PointLight(0xffb64a,1.6,10);
 glow.position.set(.5,4.7,0);
 g.add(glow);

 g.position.set(x,0,z);
 scenery.push(g);
}

for(let z=-10;z>-115;z-=17){
 makeBuilding(-8,z);
 makeBuilding(8,z);
 makeLamp(-4.2,z+4);
 makeLamp(4.2,z+4);
}

// العملات
function makeCoin(l,z){
 const g=new THREE.Group();

 const c=new THREE.Mesh(
  new THREE.TorusGeometry(.34,.105,8,18),gold
 );
 c.rotation.y=Math.PI/2;
 g.add(c);

 const core=new THREE.Mesh(
  new THREE.CircleGeometry(.22,16),mat(0x55330c,.3,.4)
 );
 core.rotation.y=Math.PI/2;
 g.add(core);

 g.position.set(laneX[l],1.25,z);
 scene.add(g);

 objects.push({group:g,type:"coin",lane:l,hit:false});
}

// العقبات
function makeObstacle(l,z,type){
 const g=new THREE.Group();
 scene.add(g);
 g.position.set(laneX[l],0,z);

 if(type==="train"){
  box(g,1.8,2.9,8,mat(0x263c58,.35,.35),0,1.45,0);
  box(g,1.82,.22,8.05,gold,0,2.25,0);

  for(let zz=-2.8;zz<=2.8;zz+=1.8){
   box(g,.55,.72,.035,mat(0x78a9ca,.2,.3),0,1.75,zz-.03,false);
  }

 }else if(type==="barrier"){
  box(g,1.9,.8,.35,mat(0xd94a3c),0,.8,0);
  box(g,2,.14,.42,gold,0,.8,.02);

  for(let x=-.65;x<=.65;x+=.65){
   box(g,.17,1.1,.18,dark,x,.55,0);
  }

 }else{
  box(g,1.9,.35,.4,gold,0,2.05,0);
  box(g,.16,2.2,.16,dark,-.82,1.1,0);
  box(g,.16,2.2,.16,dark,.82,1.1,0);
 }

 objects.push({group:g,type,lane:l,hit:false});
}

function spawnPattern(){
 const l=Math.floor(Math.random()*3);
 const r=Math.random();

 if(r<.28){
  makeObstacle(l,-92,"train");
  for(let i=0;i<5;i++)makeCoin((l+1)%3,-88-i*2.2);

 }else if(r<.55){
  makeObstacle(l,-92,"barrier");
  for(let i=0;i<5;i++)makeCoin(l,-84-i*2.2);

 }else if(r<.72){
  makeObstacle(l,-92,"overhead");
  for(let i=0;i<5;i++)makeCoin((l+2)%3,-84-i*2.2);

 }else{
  for(let i=0;i<7;i++)makeCoin(l,-90-i*2.3);
 }
}

// بداية وإعادة اللعبة
function clearRun(){
 for(const o of objects)scene.remove(o.group);
 objects=[];

 score=0;
 coins=0;
 speed=17;
 elapsed=0;
 spawnClock=0;
 lane=1;
 jumpVelocity=0;
 sliding=0;

 player.position.set(0,0,3);

 scoreEl.textContent="0";
 coinsEl.textContent="0";

 if(modelReady)playAnimation("Running");
}

function startGame(){
 clearRun();
 running=true;
 paused=false;
 ended=false;

 startScreen.classList.add("hidden");
 gameOverScreen.classList.add("hidden");
 pauseScreen.classList.add("hidden");

 clock.getDelta();
}

function endGame(){
 running=false;
 ended=true;

 finalScore.textContent=Math.floor(score);
 gameOverScreen.classList.remove("hidden");

 if(modelReady)playAnimation("Death");
}

function setLane(n){
 lane=Math.max(0,Math.min(2,lane+n));
}

function jump(){
 if(running&&!paused&&player.position.y<.03){
  jumpVelocity=9.2;
  if(modelReady)playAnimation("Jump");
 }
}

function slide(){
 if(running&&!paused&&player.position.y<.1){
  sliding=.65;
 }
}

function pauseGame(){
 if(!running)return;
 paused=true;
 pauseScreen.classList.remove("hidden");
}

function resumeGame(){
 paused=false;
 pauseScreen.classList.add("hidden");
 clock.getDelta();

 if(modelReady)playAnimation("Running");
}

document.querySelector("#start").addEventListener("click",startGame);
document.querySelector("#restart").addEventListener("click",startGame);
document.querySelector("#pause").addEventListener("click",pauseGame);
document.querySelector("#resume").addEventListener("click",resumeGame);

// لوحة المفاتيح
addEventListener("keydown",e=>{
 if(e.key==="ArrowLeft"||e.key==="a")setLane(-1);
 if(e.key==="ArrowRight"||e.key==="d")setLane(1);
 if(e.key==="ArrowUp"||e.key==="w"||e.key===" ")jump();
 if(e.key==="ArrowDown"||e.key==="s")slide();

 if(e.key==="Escape"&&running){
  paused?resumeGame():pauseGame();
 }
});

// اللمس
let startX=0,startY=0;

addEventListener("touchstart",e=>{
 const t=e.changedTouches[0];
 startX=t.clientX;
 startY=t.clientY;
},{passive:true});

addEventListener("touchend",e=>{
 const t=e.changedTouches[0];
 const dx=t.clientX-startX;
 const dy=t.clientY-startY;

 if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;

 if(Math.abs(dx)>Math.abs(dy))setLane(dx>0?1:-1);
 else if(dy<0)jump();
 else slide();
},{passive:true});

// تحديث اللعبة
function update(dt){
 if(mixer)mixer.update(dt);
 if(!running||paused)return;

 elapsed+=dt;
 speed=Math.min(27,17+elapsed*.18);

 score+=dt*speed*.7;
 scoreEl.textContent=Math.floor(score);
 coinsEl.textContent=coins;

 player.position.x=THREE.MathUtils.damp(
  player.position.x,laneX[lane],12,dt
 );

 if(player.position.y>0||jumpVelocity>0){
  player.position.y+=jumpVelocity*dt;
  jumpVelocity-=23*dt;

  if(player.position.y<0){
   player.position.y=0;
   jumpVelocity=0;
   if(modelReady)playAnimation("Running");
  }
 }

 if(sliding>0)sliding-=dt;

 const t=elapsed*12;

 if(!modelReady){
  limbs[0].rotation.x=Math.sin(t)*.75;
  limbs[1].rotation.x=-Math.sin(t)*.75;
  limbs[2].rotation.x=-Math.sin(t)*.9;
  limbs[3].rotation.x=Math.sin(t)*.9;
  tail.rotation.x=Math.sin(t*.5)*.18;
 }

 player.rotation.z=THREE.MathUtils.damp(
  player.rotation.z,(laneX[lane]-player.position.x)*-.07,8,dt
 );

 torso.scale.y=sliding>0?.65:1;
 head.position.y=sliding>0?1.45:2.02;

 spawnClock+=dt;
 if(spawnClock>1.12){
  spawnClock=0;
  spawnPattern();
 }

 for(let i=objects.length-1;i>=0;i--){
  const o=objects[i];
  o.group.position.z+=speed*dt;

  if(o.type==="coin")o.group.rotation.z+=dt*3;

  if(!o.hit&&o.group.position.z>1.8&&o.group.position.z<4.15&&o.lane===lane){
   if(o.type==="coin"){
    o.hit=true;
    coins++;
    score+=35;
    coinsEl.textContent=coins;
    scoreEl.textContent=Math.floor(score);
    scene.remove(o.group);
   }else{
    const safeJump=player.position.y>.85;
    const safeSlide=sliding>0&&o.type==="overhead";

    if(o.type==="overhead"?!safeSlide:!safeJump){
     endGame();
     return;
    }
    o.hit=true;
   }
  }

  if(o.group.position.z>12){
   scene.remove(o.group);
   objects.splice(i,1);
  }
 }

 // تحريك عوارض السكة
 for(const child of scene.children){
  if(child.userData.sleeper){
   child.position.z+=speed*dt;
   if(child.position.z>8)child.position.z-=125;
  }
 }

 // تحريك المباني والأضواء
 for(const g of scenery){
  g.position.z+=speed*dt*.78;
  if(g.position.z>18)g.position.z-=125;
 }

 camera.position.x=THREE.MathUtils.damp(
  camera.position.x,player.position.x*.16,3,dt
 );
 camera.position.y=5.2+Math.sin(elapsed*2)*.035;
 camera.lookAt(player.position.x*.12,1.35,-5);
}

// تشغيل اللعبة
function render(){
 requestAnimationFrame(render);

 const dt=Math.min(clock.getDelta(),.04);
 update(dt);
 renderer.render(scene,camera);
}

render();

addEventListener("resize",()=>{
 camera.aspect=innerWidth/innerHeight;
 camera.updateProjectionMatrix();
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
 renderer.setSize(innerWidth,innerHeight);
});
