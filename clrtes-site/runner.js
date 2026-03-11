import * as THREE from "https://esm.sh/three@0.179.1";
import { GLTFLoader } from "https://esm.sh/three@0.179.1/examples/jsm/loaders/GLTFLoader.js";

const TELEGRAM_BOT_URL = "https://t.me/Mysmsverification_bot";

const canvasHost = document.getElementById("runnerCanvas");
const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const bestScoreEl = document.getElementById("bestScore");
const rewardValueEl = document.getElementById("rewardValue");
const dataGiftsEl = document.getElementById("dataGifts");
const finalScoreEl = document.getElementById("finalScore");
const finalCoinsEl = document.getElementById("finalCoins");
const finalRewardValueEl = document.getElementById("finalRewardValue");
const finalDataGiftsEl = document.getElementById("finalDataGifts");
const gameOverPanel = document.getElementById("gameOverPanel");
const restartBtn = document.getElementById("restartBtn");
const startPanel = document.getElementById("startPanel");
const startBtn = document.getElementById("startBtn");
const rewardPopup = document.getElementById("rewardPopup");
const rewardText = document.getElementById("rewardText");
const claimRewardBtn = document.getElementById("claimRewardBtn");
const redeemRewardBtn = document.getElementById("redeemRewardBtn");
const claimOverlay = document.getElementById("claimOverlay");
const claimCountdown = document.getElementById("claimCountdown");
const closeClaimOverlay = document.getElementById("closeClaimOverlay");
const musicToggle = document.getElementById("musicToggle");
const runnerMusic = document.getElementById("runnerMusic");

const LANES = [-1.6, 0, 1.6];
const PREVIEW_AVATAR_PATH = "./assets/avatar.glb";
const RUNNER_AVATAR_PATH = "./assets/avatar-run.glb";

let scene, camera, renderer, clock, loader;
let player = null;
let mixer = null;
let activeAction = null;

let targetLane = 1;
let obstacles = [];
let coins = [];
let missiles = [];
let fires = [];
let dataGifts = [];

let score = 0;
let collectedCoins = 0;
let collectedDataGifts = 0;
let speed = 0.18;
let gameRunning = false;
let spawnTimer = 0;
let coinSpawnTimer = 0;
let missileSpawnTimer = 0;
let dataGiftSpawnTimer = 0;
let difficultyTime = 0;
let baseY = 0;
let rewardMilestonesShown = new Set();

let claimInterval = null;
let claimSecondsLeft = 10;
let musicMuted = false;

let currentAvatarMode = "preview";
let currentLoadToken = 0;

const previewCameraBase = { x: 0, y: 2.35, z: 5.8 };
const runnerCameraBase = { x: 0, y: 2.6, z: 6.7 };

const bestScore = Number(localStorage.getItem("clrtes_best_score") || 0);
bestScoreEl.textContent = bestScore;

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080808);

  clock = new THREE.Clock();
  loader = new GLTFLoader();

  camera = new THREE.PerspectiveCamera(
    45,
    canvasHost.clientWidth / 700,
    0.1,
    1000
  );
  camera.position.set(previewCameraBase.x, previewCameraBase.y, previewCameraBase.z);
  camera.lookAt(0, 1.1, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(canvasHost.clientWidth, 700);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasHost.appendChild(renderer.domElement);

  if (runnerMusic) {
    runnerMusic.volume = 0.35;
  }

  addLights();
  addTrack();
  loadPreviewAvatar();

  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);
  restartBtn.addEventListener("click", restartGame);
  startBtn.addEventListener("click", startGame);
  claimRewardBtn.addEventListener("click", openClaimOverlay);
  redeemRewardBtn.addEventListener("click", openClaimOverlay);
  closeClaimOverlay.addEventListener("click", closeClaimPopup);
  musicToggle.addEventListener("click", toggleMusic);

  updateRewardValue();
  updateDataGiftValue();
}

function addLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 1.8));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(5, 9, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xbcbcbc, 0.9);
  fillLight.position.set(-5, 4, 5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
  rimLight.position.set(0, 5, -8);
  scene.add(rimLight);
}

function addTrack() {
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.95,
    metalness: 0.05
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 220),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, -80);
  scene.add(floor);

  const laneLineMat = new THREE.MeshStandardMaterial({
    color: 0x2f2f2f,
    roughness: 0.6,
    metalness: 0.2
  });

  for (const x of [-0.8, 0.8]) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 220),
      laneLineMat
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.001, -80);
    scene.add(line);
  }
}

function pickBestAnimation(animations, mode = "runner") {
  if (!animations || animations.length === 0) return null;

  if (mode === "runner") {
    const priority = ["run", "running", "sprint", "jog", "walk"];
    for (const keyword of priority) {
      const clip = animations.find((a) =>
        a.name.toLowerCase().includes(keyword)
      );
      if (clip) return clip;
    }
  } else {
    const priority = ["idle", "breath", "stand", "pose"];
    for (const keyword of priority) {
      const clip = animations.find((a) =>
        a.name.toLowerCase().includes(keyword)
      );
      if (clip) return clip;
    }
  }

  return animations[0];
}

function clearCurrentAvatar() {
  if (player) scene.remove(player);
  player = null;
  mixer = null;
  activeAction = null;
}

function prepareAvatarModel(model, mode = "preview") {
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());

  model.position.x -= center.x;
  model.position.y -= center.y;
  model.position.z -= center.z;

  const box2 = new THREE.Box3().setFromObject(model);
  const size2 = box2.getSize(new THREE.Vector3());
  const targetHeight = 2.3;
  const scale = targetHeight / size2.y;
  model.scale.setScalar(scale);

  const box3 = new THREE.Box3().setFromObject(model);
  const center3 = box3.getCenter(new THREE.Vector3());
  const size3 = box3.getSize(new THREE.Vector3());

  model.position.x -= center3.x;
  model.position.z -= center3.z;
  model.position.y += -(center3.y - size3.y / 2);

  model.position.x = LANES[targetLane];
  model.rotation.x = 0;
  model.rotation.z = 0;

  if (mode === "preview") {
    model.position.z = 0.3;
    model.rotation.y = Math.PI + 0.22;
  } else {
    model.position.z = 1.5;
    model.rotation.y = Math.PI;
  }

  baseY = model.position.y;
}

function loadAvatar(path, mode = "preview", onDone = null) {
  const loadToken = ++currentLoadToken;

  loader.load(
    path,
    (gltf) => {
      if (loadToken !== currentLoadToken) return;

      clearCurrentAvatar();

      player = gltf.scene;
      currentAvatarMode = mode;

      prepareAvatarModel(player, mode);

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        const chosenClip = pickBestAnimation(gltf.animations, mode);
        if (chosenClip) {
          activeAction = mixer.clipAction(chosenClip);
          activeAction.reset();
          activeAction.play();
        }
      }

      if (mode === "preview") {
        camera.position.set(previewCameraBase.x, previewCameraBase.y, previewCameraBase.z);
        camera.lookAt(0, 1.05, 0.3);
      } else {
        camera.position.set(runnerCameraBase.x, runnerCameraBase.y, runnerCameraBase.z);
        camera.lookAt(0, 1.2, -6);
      }

      if (typeof onDone === "function") onDone();
    },
    undefined,
    (error) => {
      console.error(`Failed to load ${mode} avatar:`, error);
    }
  );
}

function loadPreviewAvatar() {
  loadAvatar(PREVIEW_AVATAR_PATH, "preview");
}

function loadRunnerAvatar(onDone = null) {
  loadAvatar(RUNNER_AVATAR_PATH, "runner", onDone);
}

function onKeyDown(e) {
  if (!gameRunning) return;

  const key = e.key.toLowerCase();

  if (key === "arrowleft" || key === "a") {
    targetLane = Math.max(0, targetLane - 1);
  }

  if (key === "arrowright" || key === "d") {
    targetLane = Math.min(2, targetLane + 1);
  }
}

function spawnObstacle() {
  const laneIndex = Math.floor(Math.random() * 3);

  const obstacle = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.2, 0.9),
    new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.7,
      metalness: 0.2
    })
  );

  obstacle.position.set(LANES[laneIndex], 0.6, -30);
  obstacle.userData.kind = "block";
  scene.add(obstacle);
  obstacles.push(obstacle);
}

function spawnCoin() {
  const laneIndex = Math.floor(Math.random() * 3);

  const coin = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.09, 12, 24),
    new THREE.MeshStandardMaterial({
      color: 0xd8b34b,
      roughness: 0.35,
      metalness: 0.8,
      emissive: 0x4a370c,
      emissiveIntensity: 0.4
    })
  );

  coin.rotation.y = Math.PI / 2;
  coin.position.set(LANES[laneIndex], 1.1, -28);
  scene.add(coin);
  coins.push(coin);
}

function spawnMissile() {
  const laneIndex = Math.floor(Math.random() * 3);

  const missile = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 1.0, 12),
    new THREE.MeshStandardMaterial({
      color: 0x6a6a6a,
      roughness: 0.45,
      metalness: 0.5
    })
  );
  body.rotation.z = Math.PI / 2;
  missile.add(body);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.28, 12),
    new THREE.MeshStandardMaterial({
      color: 0x8f8f8f,
      roughness: 0.35,
      metalness: 0.55
    })
  );
  tip.position.x = 0.62;
  tip.rotation.z = -Math.PI / 2;
  missile.add(tip);

  missile.position.set(LANES[laneIndex], 6.2, -18);
  missile.userData = {
    laneIndex,
    speedY: 0.22 + Math.random() * 0.08,
    speedZ: 0.08
  };

  scene.add(missile);
  missiles.push(missile);
}

function createFlameLayer(color, emissive, scaleX, scaleY, scaleZ, opacity = 1) {
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 14),
    new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 1.2,
      transparent: opacity < 1,
      opacity,
      roughness: 0.5,
      metalness: 0.02
    })
  );
  flame.scale.set(scaleX, scaleY, scaleZ);
  return flame;
}

function spawnFire(laneIndex, zPos) {
  const fire = new THREE.Group();

  const baseGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 20),
    new THREE.MeshStandardMaterial({
      color: 0xff5a00,
      emissive: 0xff3b00,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.65
    })
  );
  baseGlow.rotation.x = -Math.PI / 2;
  baseGlow.position.y = 0.03;
  fire.add(baseGlow);

  const ember = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffd066,
      emissive: 0xffb300,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.9
    })
  );
  ember.rotation.x = -Math.PI / 2;
  ember.position.y = 0.035;
  fire.add(ember);

  const flame1 = createFlameLayer(0xff7a1a, 0xff5500, 0.75, 1.35, 0.75, 0.95);
  flame1.position.y = 0.22;
  fire.add(flame1);

  const flame2 = createFlameLayer(0xffb347, 0xff7a00, 0.5, 1.05, 0.5, 0.72);
  flame2.position.y = 0.34;
  flame2.position.x = 0.08;
  fire.add(flame2);

  const flame3 = createFlameLayer(0xff5e1a, 0xff2a00, 0.42, 0.95, 0.42, 0.62);
  flame3.position.y = 0.28;
  flame3.position.x = -0.09;
  fire.add(flame3);

  fire.position.set(LANES[laneIndex], 0.02, zPos);
  fire.userData = {
    life: 8.5,
    pulse: Math.random() * Math.PI * 2,
    flame1,
    flame2,
    flame3,
    baseGlow,
    ember
  };

  scene.add(fire);
  fires.push(fire);
}

function spawnDataGift() {
  const laneIndex = Math.floor(Math.random() * 3);

  const gift = new THREE.Group();

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.65, 0.65),
    new THREE.MeshStandardMaterial({
      color: 0x2c6bff,
      emissive: 0x2040aa,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.35
    })
  );
  gift.add(box);

  const ribbon1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.68, 0.68),
    new THREE.MeshStandardMaterial({
      color: 0xe6f0ff,
      emissive: 0x88aaff,
      emissiveIntensity: 0.3
    })
  );
  gift.add(ribbon1);

  const ribbon2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.12, 0.68),
    new THREE.MeshStandardMaterial({
      color: 0xe6f0ff,
      emissive: 0x88aaff,
      emissiveIntensity: 0.3
    })
  );
  gift.add(ribbon2);

  gift.position.set(LANES[laneIndex], 1.0, -36);
  gift.userData = { value: 100 };
  scene.add(gift);
  dataGifts.push(gift);
}

function updatePreviewAvatar(delta) {
  if (!player || currentAvatarMode !== "preview") return;

  const t = performance.now() * 0.001;

  player.rotation.y += 0.22 * delta;
  player.position.y = baseY + Math.sin(t * 1.8) * 0.025;

  camera.position.x = previewCameraBase.x + Math.sin(t * 0.4) * 0.08;
  camera.position.y = previewCameraBase.y + Math.sin(t * 0.9) * 0.03;
  camera.position.z = previewCameraBase.z + Math.sin(t * 0.7) * 0.12;
  camera.lookAt(0, 1.05, 0.3);
}

function updateRunnerAvatar(delta) {
  if (!player || currentAvatarMode !== "runner") return;

  const targetX = LANES[targetLane];
  player.position.x += (targetX - player.position.x) * 11 * delta;
  player.rotation.y += (Math.PI - player.rotation.y) * 10 * delta;
  player.position.y = baseY;
}

function updateObstacles(delta) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    obstacle.position.z += speed * 60 * delta;

    if (obstacle.position.z > 8) {
      scene.remove(obstacle);
      obstacles.splice(i, 1);
      continue;
    }

    if (
      player &&
      currentAvatarMode === "runner" &&
      checkCollision(player.position, obstacle.position, 0.65, 0.7)
    ) {
      endGame();
      return;
    }
  }
}

function updateCoins(delta) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i];
    coin.position.z += speed * 60 * delta;
    coin.rotation.z += 4 * delta;
    coin.rotation.y += 6 * delta;

    if (coin.position.z > 8) {
      scene.remove(coin);
      coins.splice(i, 1);
      continue;
    }

    if (player && currentAvatarMode === "runner" && checkCollision(player.position, coin.position, 0.7, 0.5)) {
      collectedCoins += 1;
      coinsEl.textContent = collectedCoins;
      updateRewardValue();
      scene.remove(coin);
      coins.splice(i, 1);
      checkRewards();
    }
  }
}

function updateMissiles(delta) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const missile = missiles[i];
    missile.position.y -= missile.userData.speedY * 60 * delta;
    missile.position.z += missile.userData.speedZ * 60 * delta;
    missile.rotation.y += 8 * delta;
    missile.rotation.z -= 2 * delta;

    if (missile.position.y <= 0.35) {
      spawnFire(missile.userData.laneIndex, missile.position.z);
      scene.remove(missile);
      missiles.splice(i, 1);
      continue;
    }
  }
}

function updateFires(delta) {
  for (let i = fires.length - 1; i >= 0; i--) {
    const fire = fires[i];
    fire.position.z += speed * 60 * delta;

    fire.userData.life -= delta;
    fire.userData.pulse += delta * 11;

    const p = fire.userData.pulse;
    fire.userData.flame1.scale.set(
      0.75 + Math.sin(p) * 0.08,
      1.35 + Math.abs(Math.sin(p * 1.2)) * 0.18,
      0.75 + Math.sin(p * 0.8) * 0.08
    );
    fire.userData.flame2.scale.set(
      0.5 + Math.sin(p * 1.3) * 0.07,
      1.05 + Math.abs(Math.sin(p * 1.4)) * 0.12,
      0.5 + Math.sin(p) * 0.06
    );
    fire.userData.flame3.scale.set(
      0.42 + Math.sin(p * 1.5) * 0.05,
      0.95 + Math.abs(Math.sin(p * 1.1)) * 0.1,
      0.42 + Math.sin(p * 1.2) * 0.05
    );

    fire.userData.baseGlow.material.opacity = 0.48 + Math.abs(Math.sin(p * 0.9)) * 0.22;
    fire.userData.ember.material.opacity = 0.65 + Math.abs(Math.sin(p * 1.4)) * 0.25;

    if (fire.position.z > 8 || fire.userData.life <= 0) {
      scene.remove(fire);
      fires.splice(i, 1);
      continue;
    }

    if (
      player &&
      currentAvatarMode === "runner" &&
      checkCollision(player.position, fire.position, 0.62, 0.65)
    ) {
      endGame();
      return;
    }
  }
}

function updateDataGifts(delta) {
  for (let i = dataGifts.length - 1; i >= 0; i--) {
    const gift = dataGifts[i];
    gift.position.z += speed * 60 * delta;
    gift.rotation.y += 2.5 * delta;
    gift.rotation.x += 1.2 * delta;
    gift.position.y = 1.0 + Math.sin(performance.now() * 0.004 + i) * 0.12;

    if (gift.position.z > 8) {
      scene.remove(gift);
      dataGifts.splice(i, 1);
      continue;
    }

    if (player && currentAvatarMode === "runner" && checkCollision(player.position, gift.position, 0.72, 0.55)) {
      collectedDataGifts += 1;
      updateDataGiftValue();
      showReward("Rare reward found: 100MB data gift collected.");
      scene.remove(gift);
      dataGifts.splice(i, 1);
    }
  }
}

function checkCollision(a, b, xThreshold, zThreshold) {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return dx < xThreshold && dz < zThreshold;
}

function getRewardValue(coinsCount) {
  return Math.floor(coinsCount / 1000);
}

function updateRewardValue() {
  const value = getRewardValue(collectedCoins);
  rewardValueEl.textContent = `₵${value}`;
}

function updateDataGiftValue() {
  dataGiftsEl.textContent = String(collectedDataGifts);
}

function checkRewards() {
  const milestones = [
    { coins: 1000, text: "You reached 1000 coins. Reward value is now ₵1." },
    { coins: 5000, text: "You reached 5000 coins. Reward value is now ₵5." },
    { coins: 10000, text: "You reached 10000 coins. Reward value is now ₵10." }
  ];

  for (const milestone of milestones) {
    if (collectedCoins >= milestone.coins && !rewardMilestonesShown.has(milestone.coins)) {
      rewardMilestonesShown.add(milestone.coins);
      showReward(milestone.text);
    }
  }
}

function showReward(text) {
  rewardText.textContent = text;
  rewardPopup.style.display = "block";

  setTimeout(() => {
    rewardPopup.style.display = "none";
  }, 4000);
}

function openClaimOverlay() {
  closeClaimPopup();
  claimSecondsLeft = 10;
  claimCountdown.textContent = claimSecondsLeft;
  claimOverlay.style.display = "flex";

  claimInterval = setInterval(() => {
    claimSecondsLeft -= 1;
    claimCountdown.textContent = claimSecondsLeft;

    if (claimSecondsLeft <= 0) {
      clearInterval(claimInterval);
      claimInterval = null;
      window.open(TELEGRAM_BOT_URL, "_blank");
      claimOverlay.style.display = "none";
    }
  }, 1000);
}

function closeClaimPopup() {
  if (claimInterval) {
    clearInterval(claimInterval);
    claimInterval = null;
  }
  claimOverlay.style.display = "none";
}

async function startMusic() {
  if (!runnerMusic || musicMuted) return;
  try {
    await runnerMusic.play();
  } catch (err) {
    console.error("Music play blocked:", err);
  }
}

function stopMusic() {
  if (!runnerMusic) return;
  runnerMusic.pause();
  runnerMusic.currentTime = 0;
}

function toggleMusic() {
  if (!runnerMusic) return;

  musicMuted = !musicMuted;

  if (musicMuted) {
    runnerMusic.pause();
    musicToggle.textContent = "Unmute Music";
  } else {
    if (gameRunning) {
      runnerMusic.play().catch(() => {});
    }
    musicToggle.textContent = "Mute Music";
  }
}

function clearGameObjects() {
  for (const obstacle of obstacles) scene.remove(obstacle);
  for (const coin of coins) scene.remove(coin);
  for (const missile of missiles) scene.remove(missile);
  for (const fire of fires) scene.remove(fire);
  for (const gift of dataGifts) scene.remove(gift);

  obstacles = [];
  coins = [];
  missiles = [];
  fires = [];
  dataGifts = [];
}

function updateGame(delta) {
  if (!gameRunning) return;

  difficultyTime += delta;
  speed = Math.min(0.55, 0.18 + difficultyTime * 0.006);

  score += Math.floor(65 * (1 + difficultyTime * 0.02) * delta);
  scoreEl.textContent = score;

  spawnTimer += delta;
  coinSpawnTimer += delta;
  missileSpawnTimer += delta;
  dataGiftSpawnTimer += delta;

  const obstacleInterval = Math.max(0.34, 0.82 - difficultyTime * 0.012);
  const coinInterval = Math.max(0.28, 0.58 - difficultyTime * 0.006);
  const missileInterval = Math.max(1.8, 4.8 - difficultyTime * 0.04);

  if (spawnTimer > obstacleInterval) {
    spawnObstacle();
    spawnTimer = 0;
  }

  if (coinSpawnTimer > coinInterval) {
    spawnCoin();
    coinSpawnTimer = 0;
  }

  if (difficultyTime > 12 && missileSpawnTimer > missileInterval) {
    if (Math.random() < 0.65) {
      spawnMissile();
    }
    missileSpawnTimer = 0;
  }

  if (difficultyTime > 35 && dataGiftSpawnTimer > 8) {
    if (Math.random() < 0.14) {
      spawnDataGift();
    }
    dataGiftSpawnTimer = 0;
  }

  updateRunnerAvatar(delta);
  updateObstacles(delta);
  updateCoins(delta);
  updateMissiles(delta);
  updateFires(delta);
  updateDataGifts(delta);
}

function startGame() {
  startPanel.style.display = "none";
  gameOverPanel.style.display = "none";

  clearGameObjects();

  score = 0;
  collectedCoins = 0;
  collectedDataGifts = 0;
  speed = 0.18;
  spawnTimer = 0;
  coinSpawnTimer = 0;
  missileSpawnTimer = 0;
  dataGiftSpawnTimer = 0;
  difficultyTime = 0;
  rewardMilestonesShown.clear();
  rewardPopup.style.display = "none";
  targetLane = 1;

  scoreEl.textContent = "0";
  coinsEl.textContent = "0";
  updateRewardValue();
  updateDataGiftValue();

  loadRunnerAvatar(() => {
    gameRunning = true;
    startMusic();
  });
}

function endGame() {
  gameRunning = false;

  finalScoreEl.textContent = score;
  finalCoinsEl.textContent = collectedCoins;
  finalRewardValueEl.textContent = `₵${getRewardValue(collectedCoins)}`;
  finalDataGiftsEl.textContent = String(collectedDataGifts);

  const storedBest = Number(localStorage.getItem("clrtes_best_score") || 0);
  if (score > storedBest) {
    localStorage.setItem("clrtes_best_score", String(score));
    bestScoreEl.textContent = score;
  }

  gameOverPanel.style.display = "flex";
  stopMusic();
}

function restartGame() {
  clearGameObjects();

  score = 0;
  collectedCoins = 0;
  collectedDataGifts = 0;
  speed = 0.18;
  spawnTimer = 0;
  coinSpawnTimer = 0;
  missileSpawnTimer = 0;
  dataGiftSpawnTimer = 0;
  difficultyTime = 0;
  gameRunning = false;
  targetLane = 1;
  rewardMilestonesShown.clear();
  rewardPopup.style.display = "none";

  scoreEl.textContent = "0";
  coinsEl.textContent = "0";
  updateRewardValue();
  updateDataGiftValue();
  gameOverPanel.style.display = "none";

  startGame();
}

function onResize() {
  const width = canvasHost.clientWidth;
  const height = 700;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  if (!gameRunning) {
    updatePreviewAvatar(delta);
  } else {
    updateGame(delta);
  }

  renderer.render(scene, camera);
}