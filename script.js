import * as THREE from "three";

// =====================================
// KAREEM SCORPION - 3D ENDLESS RUNNER
// =====================================

// عناصر الصفحة
const $ = (id) => document.getElementById(id);

const canvas = $("scene");
const scoreEl = $("score");
const coinsEl = $("coins");
const startScreen = $("start-screen");
const gameOverScreen = $("gameover");
const pauseScreen = $("pause-screen");
const finalScore = $("final-score");

if (!canvas) {
  throw new Error("Canvas #scene was not found.");
}

// إعداد المشهد
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b31);
scene.fog = new THREE.Fog(0x101b31, 25, 120);

const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.1,
  180
);

camera.position.set(0, 5.2, 10.5);
camera.lookAt(0, 1.4, -5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// الإضاءة
scene.add(
  new THREE.HemisphereLight(0xa9caff, 0x24202b, 2)
);

const mainLight = new THREE.DirectionalLight(0xffd59a, 2.5);
mainLight.position.set(-5, 12, 8);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(1024, 1024);
scene.add(mainLight);

// الألوان والخامات
function makeMaterial(color, roughness = 0.7, metalness = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

const gold = makeMaterial(0xffbd45, 0.35, 0.6);
const dark = makeMaterial(0x171d2b);
const asphalt = makeMaterial(0x242b38);
const steel = makeMaterial(0x9aa8ba, 0.3, 0.8);

const lanePositions = [-2.15, 0, 2.15];

// حالة اللعبة
let running = false;
let paused = false;

let lane = 1;
let score = 0;
let coins = 0;
let speed = 17;
let elapsed = 0;
let spawnTimer = 0;

let jumpVelocity = 0;
let slideTimer = 0;

const objects = [];
const scenery = [];
const sleepers = [];

const clock = new THREE.Clock();

// =====================================
// أدوات بناء المجسمات
// =====================================

function makeBox(parent, w, h, d, material, x, y, z, cast = true) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;

  parent.add(mesh);
  return mesh;
}

function makeCylinder(parent, r1, r2, h, material, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r1, r2, h, 10),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;

  parent.add(mesh);
  return mesh;
}

// =====================================
// الطريق
// =====================================

makeBox(scene, 9, 0.35, 150, asphalt, 0, -0.28, -47, false);

for (const x of [-3.2, 3.2]) {
  makeBox(scene, 0.12, 0.18, 150, steel, x, -0.02, -47, false);
}

const sleeperMaterial = makeMaterial(0x596170);

for (let z = 5; z > -120; z -= 2.5) {
  const sleeper = makeBox(
    scene, 7.1, 0.12, 0.48,
    sleeperMaterial, 0, -0.08, z, false
  );

  sleepers.push(sleeper);
}

for (const x of [-1.08, 1.08]) {
  makeBox(
    scene, 0.035, 0.012, 150,
    makeMaterial(0x667080), x, -0.095, -47, false
  );
}

makeBox(
  scene, 180, 0.3, 180,
  makeMaterial(0x111827), 0, -0.55, -55, false
);

// =====================================
// شخصية اللاعب ثلاثية الأبعاد
// =====================================

const player = new THREE.Group();
scene.add(player);
player.position.set(0, 0, 3);

const character = new THREE.Group();
player.add(character);

const skin = makeMaterial(0xb8794b);
const jacket = makeMaterial(0x17243a);
const pants = makeMaterial(0x202c43);
const shoes = makeMaterial(0xf0b747, 0.4, 0.2);
const visor = makeMaterial(0x0b111c, 0.2, 0.5);

// الجسم
const torso = makeBox(
  character, 0.72, 0.9, 0.38,
  jacket, 0, 1.35, 0
);

makeBox(
  character, 0.42, 0.28, 0.405,
  gold, 0, 1.45, -0.02
);

// الرأس
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.27, 16, 12),
  skin
);

head.position.set(0, 2.02, 0);
head.castShadow = true;
character.add(head);

// الشعر
const hair = new THREE.Mesh(
  new THREE.SphereGeometry(
    0.275, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.55
  ),
  dark
);

hair.position.set(0, 2.12, 0);
character.add(hair);

// النظارة والوشاح
makeBox(character, 0.38, 0.12, 0.29, visor, 0, 1.98, -0.16);
makeBox(character, 0.52, 0.12, 0.42, gold, 0, 1.78, 0);

// الذراعان والرجلان
const limbs = [];

function makeLimb(x, y, length, material, width) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);

  character.add(pivot);

  makeBox(
    pivot, width, length, width,
    material, 0, -length / 2, 0
  );

  limbs.push(pivot);
  return pivot;
}

const leftArm = makeLimb(-0.48, 1.68, 0.58, jacket, 0.17);
const rightArm = makeLimb(0.48, 1.68, 0.58, jacket, 0.17);

const leftLeg = makeLimb(-0.22, 0.93, 0.62, pants, 0.23);
const rightLeg = makeLimb(0.22, 0.93, 0.62, pants, 0.23);

for (const arm of [leftArm, rightArm]) {
  const glove = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    gold
  );

  glove.position.y = -0.59;
  arm.add(glove);
}

for (const leg of [leftLeg, rightLeg]) {
  makeBox(
    leg, 0.27, 0.16, 0.42,
    shoes, 0, -0.62, -0.09
  );
}

// ذيل العقرب
const tail = new THREE.Group();
tail.position.set(0, 1.2, 0.23);
character.add(tail);

for (let i = 0; i < 4; i++) {
  const segment = makeBox(
    tail, 0.12, 0.12, 0.28,
    gold, 0, 0, 0.18 + i * 0.22
  );

  segment.rotation.x = -0.2 - i * 0.13;
}

const stinger = new THREE.Mesh(
  new THREE.ConeGeometry(0.13, 0.35, 8),
  gold
);

stinger.position.set(0, 0.05, 1.05);
stinger.rotation.x = Math.PI;
tail.add(stinger);

// =====================================
// المدينة والمباني
// =====================================

function makeBuilding(x, z) {
  const group = new THREE.Group();
  scene.add(group);

  const height = 8 + Math.random() * 13;
  const width = 4 + Math.random() * 3;
  const depth = 7 + Math.random() * 5;

  const colors = [0x26354b, 0x313b4c, 0x202c40];

  makeBox(
    group, width, height, depth,
    makeMaterial(colors[Math.floor(Math.random() * colors.length)]),
    0, height / 2 - 0.4, 0
  );

  const windowMaterial = makeMaterial(0xffc86b, 0.4, 0.1);

  for (let y = 1.4; y < height - 1; y += 1.7) {
    for (let xx = -width / 2 + 0.7; xx < width / 2 - 0.3; xx += 1.1) {
      if (Math.random() > 0.2) {
        makeBox(
          group, 0.38, 0.62, 0.035,
          windowMaterial, xx, y, depth / 2 + 0.02, false
        );
      }
    }
  }

  group.position.set(x, 0, z);
  scenery.push(group);
}

function makeLamp(x, z) {
  const group = new THREE.Group();
  scene.add(group);

  makeCylinder(group, 0.055, 0.075, 5, steel, 0, 2.5, 0);

  makeBox(
    group, 0.75, 0.09, 0.12,
    gold, 0.3, 4.95, 0, false
  );

  group.position.set(x, 0, z);
  scenery.push(group);
}

for (let z = -10; z > -115; z -= 17) {
  makeBuilding(-8, z);
  makeBuilding(8, z);

  makeLamp(-4.2, z + 4);
  makeLamp(4.2, z + 4);
}

// =====================================
// العملات
// =====================================

function makeCoin(laneIndex, z) {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.105, 8, 18),
    gold
  );

  ring.rotation.y = Math.PI / 2;
  group.add(ring);

  const center = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 16),
    makeMaterial(0x55330c, 0.3, 0.4)
  );

  center.rotation.y = Math.PI / 2;
  group.add(center);

  group.position.set(lanePositions[laneIndex], 1.25, z);
  scene.add(group);

  objects.push({
    group,
    type: "coin",
    lane: laneIndex,
    hit: false
  });
}

// =====================================
// العقبات والقطارات
// =====================================

function makeObstacle(laneIndex, z, type) {
  const group = new THREE.Group();

  scene.add(group);
  group.position.set(lanePositions[laneIndex], 0, z);

  if (type === "train") {
    makeBox(
      group, 1.8, 2.9, 8,
      makeMaterial(0x263c58, 0.35, 0.35),
      0, 1.45, 0
    );

    makeBox(
      group, 1.82, 0.22, 8.05,
      gold, 0, 2.25, 0
    );

    const windowMaterial = makeMaterial(0x78a9ca, 0.2, 0.3);

    for (let zz = -2.8; zz <= 2.8; zz += 1.8) {
      makeBox(
        group, 0.55, 0.72, 0.035,
        windowMaterial, 0, 1.75, zz, false
      );
    }

  } else if (type === "barrier") {
    makeBox(
      group, 1.9, 0.8, 0.35,
      makeMaterial(0xd94a3c), 0, 0.8, 0
    );

    makeBox(
      group, 2, 0.14, 0.42,
      gold, 0, 0.8, 0.02
    );

    for (let x = -0.65; x <= 0.65; x += 0.65) {
      makeBox(group, 0.17, 1.1, 0.18, dark, x, 0.55, 0);
    }

  } else {
    makeBox(
      group, 1.9, 0.35, 0.4,
      gold, 0, 2.05, 0
    );

    makeBox(group, 0.16, 2.2, 0.16, dark, -0.82, 1.1, 0);
    makeBox(group, 0.16, 2.2, 0.16, dark, 0.82, 1.1, 0);
  }

  objects.push({
    group,
    type,
    lane: laneIndex,
    hit: false
  });
}

// =====================================
// توليد العقبات والعملات
// =====================================

function spawnPattern() {
  const selectedLane = Math.floor(Math.random() * 3);
  const random = Math.random();

  if (random < 0.28) {
    makeObstacle(selectedLane, -92, "train");

    for (let i = 0; i < 5; i++) {
      makeCoin((selectedLane + 1) % 3, -88 - i * 2.2);
    }

  } else if (random < 0.55) {
    makeObstacle(selectedLane, -92, "barrier");

    for (let i = 0; i < 5; i++) {
      makeCoin(selectedLane, -84 - i * 2.2);
    }

  } else if (random < 0.72) {
    makeObstacle(selectedLane, -92, "overhead");

    for (let i = 0; i < 5; i++) {
      makeCoin((selectedLane + 2) % 3, -84 - i * 2.2);
    }

  } else {
    for (let i = 0; i < 7; i++) {
      makeCoin(selectedLane, -90 - i * 2.3);
    }
  }
}

// =====================================
// التحكم في اللعبة
// =====================================

function clearRun() {
  for (const object of objects) {
    scene.remove(object.group);
  }

  objects.length = 0;

  score = 0;
  coins = 0;
  speed = 17;
  elapsed = 0;
  spawnTimer = 0;

  lane = 1;
  jumpVelocity = 0;
  slideTimer = 0;

  player.position.set(0, 0, 3);

  scoreEl.textContent = "0";
  coinsEl.textContent = "0";

  torso.scale.y = 1;
  head.position.y = 2.02;
}

function startGame() {
  clearRun();

  running = true;
  paused = false;

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");

  clock.getDelta();
}

function endGame() {
  running = false;

  finalScore.textContent = Math.floor(score);
  gameOverScreen.classList.remove("hidden");
}

function changeLane(direction) {
  if (!running || paused) return;

  lane = Math.max(0, Math.min(2, lane + direction));
}

function jump() {
  if (!running || paused) return;
  if (player.position.y > 0.03) return;

  jumpVelocity = 9.2;
}

function slide() {
  if (!running || paused) return;
  if (player.position.y > 0.1) return;

  slideTimer = 0.7;
}

function pauseGame() {
  if (!running) return;

  paused = true;
  pauseScreen.classList.remove("hidden");
}

function resumeGame() {
  paused = false;
  pauseScreen.classList.add("hidden");

  clock.getDelta();
}

// =====================================
// أزرار الشاشة
// =====================================

$("start").addEventListener("click", startGame);
$("restart").addEventListener("click", startGame);
$("pause").addEventListener("click", pauseGame);
$("resume").addEventListener("click", resumeGame);

// =====================================
// لوحة المفاتيح
// =====================================

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "a") {
    changeLane(-1);
  }

  if (event.key === "ArrowRight" || event.key === "d") {
    changeLane(1);
  }

  if (event.key === "ArrowUp" || event.key === "w" || event.key === " ") {
    event.preventDefault();
    jump();
  }

  if (event.key === "ArrowDown" || event.key === "s") {
    slide();
  }

  if (event.key === "Escape" && running) {
    if (paused) resumeGame();
    else pauseGame();
  }
});

// =====================================
// التحكم بالسحب على الموبايل
// =====================================

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", (event) => {
  const touch = event.changedTouches[0];

  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

canvas.addEventListener("touchend", (event) => {
  const touch = event.changedTouches[0];

  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    changeLane(dx > 0 ? 1 : -1);
  } else if (dy < 0) {
    jump();
  } else {
    slide();
  }
}, { passive: true });

// =====================================
// تحديث اللعبة
// =====================================

function update(dt) {
  if (!running || paused) return;

  elapsed += dt;

  // زيادة السرعة تدريجيًا
  speed = Math.min(27, 17 + elapsed * 0.18);

  score += dt * speed * 0.7;
  scoreEl.textContent = Math.floor(score);
  coinsEl.textContent = coins;

  // تحريك اللاعب بين المسارات
  player.position.x = THREE.MathUtils.damp(
    player.position.x,
    lanePositions[lane],
    12,
    dt
  );

  // القفز
  if (player.position.y > 0 || jumpVelocity > 0) {
    player.position.y += jumpVelocity * dt;
    jumpVelocity -= 23 * dt;

    if (player.position.y < 0) {
      player.position.y = 0;
      jumpVelocity = 0;
    }
  }

  // الانزلاق
  if (slideTimer > 0) {
    slideTimer -= dt;
  }

  const animationTime = elapsed * 12;

  limbs[0].rotation.x = Math.sin(animationTime) * 0.75;
  limbs[1].rotation.x = -Math.sin(animationTime) * 0.75;
  limbs[2].rotation.x = -Math.sin(animationTime) * 0.9;
  limbs[3].rotation.x = Math.sin(animationTime) * 0.9;

  tail.rotation.x = Math.sin(animationTime * 0.5) * 0.18;

  torso.scale.y = slideTimer > 0 ? 0.65 : 1;
  head.position.y = slideTimer > 0 ? 1.45 : 2.02;

  player.rotation.z = THREE.MathUtils.damp(
    player.rotation.z,
    (lanePositions[lane] - player.position.x) * -0.07,
    8,
    dt
  );

  // ظهور أشياء جديدة
  spawnTimer += dt;

  if (spawnTimer > 1.12) {
    spawnTimer = 0;
    spawnPattern();
  }

  // تحريك العملات والعقبات
  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i];

    object.group.position.z += speed * dt;

    if (object.type === "coin") {
      object.group.rotation.z += dt * 3;
    }

    // التصادم
    if (
      !object.hit &&
      object.group.position.z > 1.8 &&
      object.group.position.z < 4.15 &&
      object.lane === lane
    ) {
      if (object.type === "coin") {
        object.hit = true;

        coins++;
        score += 35;

        coinsEl.textContent = coins;
        scoreEl.textContent = Math.floor(score);

        scene.remove(object.group);

      } else {
        const safeJump =
          object.type === "barrier" && player.position.y > 0.85;

        const safeSlide =
          object.type === "overhead" && slideTimer > 0;

        const safe = safeJump || safeSlide;

        if (!safe) {
          endGame();
          return;
        }

        object.hit = true;
      }
    }

    if (object.group.position.z > 12) {
      scene.remove(object.group);
      objects.splice(i, 1);
    }
  }

  // حركة عوارض السكة
  for (const sleeper of sleepers) {
    sleeper.position.z += speed * dt;

    if (sleeper.position.z > 8) {
      sleeper.position.z -= 125;
    }
  }

  // حركة المباني والأضواء
  for (const item of scenery) {
    item.position.z += speed * dt * 0.78;

    if (item.position.z > 18) {
      item.position.z -= 125;
    }
  }

  // حركة الكاميرا
  camera.position.x = THREE.MathUtils.damp(
    camera.position.x,
    player.position.x * 0.16,
    3,
    dt
  );

  camera.position.y = 5.2 + Math.sin(elapsed * 2) * 0.035;
  camera.lookAt(player.position.x * 0.12, 1.35, -5);
}

// =====================================
// تشغيل الرسم
// =====================================

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.04);

  update(dt);
  renderer.render(scene, camera);
}

animate();

// =====================================
// تغيير حجم الشاشة
// =====================================

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
