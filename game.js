const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- 1. TELA RESPONSIVA ---
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false; // Mantém o Pixel Art bem nítido
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- 2. ÁUDIO SINTETIZADO (WEB AUDIO API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let lastTicTime = 0;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
}

function playTicSound(volume = 0.1, pitch = 1200) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function playAlertSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

// --- 3. CARREGAMENTO DE SPRITES ---
const images = {
  player: new Image(),
  echo: new Image(),
  scrap: new Image(),
  memory: new Image()
};

images.player.src = "assets/player.png";
images.echo.src = "assets/echo.png";
images.scrap.src = "assets/scrap.png";
images.memory.src = "assets/memory.png";

// --- 4. SISTEMA DE FASES / NÍVEIS ENCADEADOS ---
let currentLevelIndex = 0;

const LEVELS = [
  {
    name: "Setor 01: Subsolo da SynapSys",
    spawnPlayer: { x: 80, y: 300 },
    synapsysTower: { x: 700, y: 40, width: 90, height: 90 },
    walls: [
      { x: 180, y: 100, width: 20, height: 250 },
      { x: 350, y: 200, width: 200, height: 20 },
      { x: 500, y: 380, width: 20, height: 180 }
    ],
    enemies: [
      { x: 250, y: 150, radius: 14, speed: 1.4, state: "IDLE", hearRadius: 140, targetX: 250, targetY: 150, pitch: 1200 }
    ],
    lootBoxes: [
      { x: 120, y: 150, radius: 10, content: "scrap", looted: false },
      { x: 400, y: 100, radius: 10, content: "water", looted: false },
      { x: 300, y: 500, radius: 10, content: "food", looted: false }
    ]
  },
  {
    name: "Setor 02: Corredores de Dados",
    spawnPlayer: { x: 60, y: 60 },
    synapsysTower: { x: 700, y: 500, width: 90, height: 90 },
    walls: [
      { x: 150, y: 0, width: 20, height: 400 },
      { x: 300, y: 200, width: 200, height: 20 },
      { x: 500, y: 100, width: 20, height: 400 }
    ],
    enemies: [
      { x: 250, y: 300, radius: 14, speed: 1.6, state: "IDLE", hearRadius: 160, targetX: 250, targetY: 300, pitch: 1100 },
      { x: 600, y: 200, radius: 16, speed: 2.1, state: "PATROL", hearRadius: 220, targetX: 600, targetY: 200, pitch: 1500 }
    ],
    lootBoxes: [
      { x: 80, y: 520, radius: 12, content: "memory_backup", looted: false },
      { x: 350, y: 150, radius: 10, content: "battery", looted: false },
      { x: 600, y: 400, radius: 10, content: "scrap", looted: false }
    ]
  }
];

// Instâncias ativas do nível atual
let currentLevel = LEVELS[currentLevelIndex];
let walls = currentLevel.walls;
let enemies = currentLevel.enemies;
let lootBoxes = currentLevel.lootBoxes;
let synapsysTower = currentLevel.synapsysTower;

// --- 5. ESTADO DO JOGO E JOGADOR ---
let gameState = "PLAYING"; // "PLAYING", "VICTORY_IMPERFECT", "VICTORY_TRUE"
let isCraftingOpen = false;

const player = {
  x: currentLevel.spawnPlayer.x,
  y: currentLevel.spawnPlayer.y,
  radius: 12,
  speed: 2.5,
  maxLightRadius: 140,
  lightRadius: 140,
  noiseRadius: 0,
  integrity: 100,
  sanity: 100,
  battery: 100,
  hunger: 100,
  thirst: 100,
  hasMemoryBackup: false,
  inventory: { scrap: 5, food: 1, water: 1, battery: 1, noiseMakers: 2 }
};

let activeNoiseMakers = [];

function loadLevel(levelIndex) {
  if (levelIndex >= LEVELS.length) return;

  currentLevelIndex = levelIndex;
  currentLevel = LEVELS[currentLevelIndex];

  walls = currentLevel.walls;
  enemies = currentLevel.enemies;
  lootBoxes = currentLevel.lootBoxes;
  synapsysTower = currentLevel.synapsysTower;

  player.x = currentLevel.spawnPlayer.x;
  player.y = currentLevel.spawnPlayer.y;

  activeNoiseMakers = [];
}

// --- 6. CONTROLES DE TECLADO ---
const keys = {};

window.addEventListener("keydown", (e) => {
  initAudio();
  keys[e.key] = true;

  if (e.key === "c" || e.key === "C") isCraftingOpen = !isCraftingOpen;

  // Arremessar Isca Sonora com [Q]
  if ((e.key === "q" || e.key === "Q") && player.inventory.noiseMakers > 0 && gameState === "PLAYING") {
    player.inventory.noiseMakers--;
    activeNoiseMakers.push({
      x: player.x,
      y: player.y,
      timer: 180,
      radius: 200
    });
  }

  // Interação na Portal/Servidor com [E]
  if ((e.key === "e" || e.key === "E") && gameState === "PLAYING") {
    const isAtTower = player.x > synapsysTower.x && player.x < synapsysTower.x + synapsysTower.width &&
                      player.y > synapsysTower.y && player.y < synapsysTower.y + synapsysTower.height;

    if (isAtTower) {
      if (currentLevelIndex === LEVELS.length - 1) {
        gameState = player.hasMemoryBackup ? "VICTORY_TRUE" : "VICTORY_IMPERFECT";
      } else {
        loadLevel(currentLevelIndex + 1);
      }
    }
  }

  // Uso de Itens e Crafting
  if (!isCraftingOpen && gameState === "PLAYING") {
    if (e.key === "1") useItem("food");
    if (e.key === "2") useItem("water");
    if (e.key === "3") useItem("battery");
  } else if (isCraftingOpen) {
    if (e.key === "4") craftItem("battery", 2);
    if (e.key === "5") craftItem("food", 2);
    if (e.key === "6") craftItem("water", 2);
    if (e.key === "7") craftRepairKit(3);
  }
});

window.addEventListener("keyup", (e) => { keys[e.key] = false; });

// --- 7. LÓGICA E AUXILIARES ---
function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function checkWallCollision(entity) {
  walls.forEach((wall) => {
    let closestX = Math.max(wall.x, Math.min(entity.x, wall.x + wall.width));
    let closestY = Math.max(wall.y, Math.min(entity.y, wall.y + wall.height));

    let distX = entity.x - closestX;
    let distY = entity.y - closestY;
    let distance = Math.hypot(distX, distY);

    if (distance < entity.radius) {
      let overlap = entity.radius - distance;
      if (distance === 0) return;
      entity.x += (distX / distance) * overlap;
      entity.y += (distY / distance) * overlap;
    }
  });
}

function useItem(type) {
  if (player.inventory[type] > 0) {
    if (type === "food") { player.hunger = Math.min(100, player.hunger + 40); player.inventory.food--; }
    else if (type === "water") { player.thirst = Math.min(100, player.thirst + 50); player.inventory.water--; }
    else if (type === "battery") { player.battery = Math.min(100, player.battery + 50); player.inventory.battery--; }
  }
}

function craftItem(itemType, scrapCost) {
  if (player.inventory.scrap >= scrapCost) {
    player.inventory.scrap -= scrapCost;
    player.inventory[itemType]++;
  }
}

function craftRepairKit(scrapCost) {
  if (player.inventory.scrap >= scrapCost) {
    player.inventory.scrap -= scrapCost;
    player.integrity = Math.min(100, player.integrity + 30);
  }
}

// --- 8. UPDATE ---
function update() {
  if (player.integrity <= 0 || isCraftingOpen || gameState !== "PLAYING") return;

  // Consumo Contínuo
  player.battery = Math.max(0, player.battery - 0.02);
  player.hunger = Math.max(0, player.hunger - 0.01);
  player.thirst = Math.max(0, player.thirst - 0.015);

  // Perda de Sanidade na Escuridão
  if (player.battery < 20) {
    player.sanity = Math.max(0, player.sanity - 0.05);
  } else {
    player.sanity = Math.min(100, player.sanity + 0.02);
  }

  if (player.hunger <= 0 || player.thirst <= 0 || player.sanity <= 0) player.integrity -= 0.1;

  player.lightRadius = Math.max(35, (player.battery / 100) * player.maxLightRadius);

  // Movimentação
  let isRunning = keys["Shift"];
  let currentSpeed = isRunning ? player.speed * 1.6 : player.speed;
  let isMoving = false;

  if (keys["w"] || keys["W"] || keys["ArrowUp"]) { player.y -= currentSpeed; isMoving = true; }
  if (keys["s"] || keys["S"] || keys["ArrowDown"]) { player.y += currentSpeed; isMoving = true; }
  if (keys["a"] || keys["A"] || keys["ArrowLeft"]) { player.x -= currentSpeed; isMoving = true; }
  if (keys["d"] || keys["D"] || keys["ArrowRight"]) { player.x += currentSpeed; isMoving = true; }

  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
  checkWallCollision(player);

  player.noiseRadius = isMoving ? (isRunning ? 160 : 70) : 0;

  // Iscas Sonoras
  activeNoiseMakers.forEach((nm, index) => {
    nm.timer--;
    if (nm.timer <= 0) activeNoiseMakers.splice(index, 1);
  });

  // Coleta de Suprimentos
  lootBoxes.forEach((box) => {
    if (!box.looted && getDistance(player.x, player.y, box.x, box.y) < player.radius + box.radius) {
      box.looted = true;
      if (box.content === "memory_backup") player.hasMemoryBackup = true;
      else if (box.content === "scrap") player.inventory.scrap++;
      else player.inventory[box.content]++;
    }
  });

  // IA dos Ecos
  const now = Date.now();
  enemies.forEach((enemy) => {
    const distToPlayer = getDistance(enemy.x, enemy.y, player.x, player.y);

    if (distToPlayer < 300) {
      const ticInterval = Math.max(150, distToPlayer * 2.5);
      if (now - lastTicTime > ticInterval) {
        const volume = Math.min(0.25, (300 - distToPlayer) / 300 * 0.25);
        playTicSound(volume, enemy.pitch);
        lastTicTime = now;
      }
    }

    let attractedByNoiseMaker = false;
    activeNoiseMakers.forEach((nm) => {
      if (getDistance(enemy.x, enemy.y, nm.x, nm.y) < nm.radius) {
        enemy.state = "CHASE";
        enemy.targetX = nm.x;
        enemy.targetY = nm.y;
        attractedByNoiseMaker = true;
      }
    });

    if (!attractedByNoiseMaker && player.noiseRadius > 0 && distToPlayer <= enemy.hearRadius + player.noiseRadius) {
      if (enemy.state !== "CHASE") playAlertSound();
      enemy.state = "CHASE";
      enemy.targetX = player.x;
      enemy.targetY = player.y;
    }

    if (enemy.state === "CHASE") {
      const angle = Math.atan2(enemy.targetY - enemy.y, enemy.targetX - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed;
      enemy.y += Math.sin(angle) * enemy.speed;
      checkWallCollision(enemy);

      if (getDistance(enemy.x, enemy.y, enemy.targetX, enemy.targetY) < 5 && player.noiseRadius === 0 && !attractedByNoiseMaker) {
        enemy.state = "IDLE";
      }
    }

    if (distToPlayer < player.radius + enemy.radius + 10) {
      player.integrity -= 0.3;
    }
  });

  // Atualizar HUD
  const isAtTower = player.x > synapsysTower.x && player.x < synapsysTower.x + synapsysTower.width &&
                    player.y > synapsysTower.y && player.y < synapsysTower.y + synapsysTower.height;

  const uiElement = document.getElementById("ui");
  if (uiElement) {
    uiElement.innerHTML = `
      <p><strong>${currentLevel.name}</strong></p>
      <p>
        Estabilidade: <strong>${Math.max(0, Math.round(player.integrity))}%</strong> | 
        Sanidade: <strong>${Math.round(player.sanity)}%</strong> | 
        Energia: <strong>${Math.round(player.battery)}%</strong>
      </p>
      <p><small>Sucata: <strong>${player.inventory.scrap}</strong> | [Q] Isca: ${player.inventory.noiseMakers} | [1] Comida | [2] Água | [3] Bateria | [C] Crafting</small></p>
      <p><small>${isAtTower ? "<strong>[Pressione E para " + (currentLevelIndex < LEVELS.length - 1 ? "AVANÇAR DE FASE" : "FAZER DEPLOY") + "]</strong>" : "Alcance o Portal da Fase (Zona Verde)"}</small></p>
    `;
  }
}

// --- 9. RENDERIZAÇÃO (DRAW) ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Portal / Servidor SynapSys
  ctx.fillStyle = "#16a085";
  ctx.fillRect(synapsysTower.x, synapsysTower.y, synapsysTower.width, synapsysTower.height);
  ctx.strokeStyle = "#1abc9c";
  ctx.lineWidth = 3;
  ctx.strokeRect(synapsysTower.x, synapsysTower.y, synapsysTower.width, synapsysTower.height);

  // Paredes
  ctx.fillStyle = "#2c3e50";
  walls.forEach((wall) => { ctx.fillRect(wall.x, wall.y, wall.width, wall.height); });

  // Iscas Sonoras
  activeNoiseMakers.forEach((nm) => {
    ctx.beginPath();
    ctx.arc(nm.x, nm.y, (180 - nm.timer) % 40, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(241, 196, 15, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Loot
  lootBoxes.forEach((box) => {
    if (!box.looted) {
      if (box.content === "memory_backup") {
        if (images.memory.complete && images.memory.naturalWidth !== 0) {
          ctx.drawImage(images.memory, box.x - 12, box.y - 12, 24, 24);
        } else {
          ctx.fillStyle = "#9b59b6";
          ctx.beginPath(); ctx.arc(box.x, box.y, box.radius, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = box.content === "scrap" ? "#bdc3c7" : (box.content === "food" ? "#e67e22" : "#3498db");
        ctx.fillRect(box.x - 8, box.y - 8, 16, 16);
      }
    }
  });

  // Ecos
  enemies.forEach((enemy) => {
    if (images.echo.complete && images.echo.naturalWidth !== 0) {
      ctx.drawImage(images.echo, enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = enemy.state === "CHASE" ? "#e74c3c" : "#8e44ad";
      ctx.fill();
    }
  });

  // Jogador
  if (images.player.complete && images.player.naturalWidth !== 0) {
    ctx.drawImage(images.player, player.x - player.radius, player.y - player.radius, player.radius * 2, player.radius * 2);
  } else {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#2ecc71";
    ctx.fill();
  }

  // Ruído
  if (player.noiseRadius > 0) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.noiseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Máscara de Iluminação
  const lightCanvas = document.createElement("canvas");
  lightCanvas.width = canvas.width;
  lightCanvas.height = canvas.height;
  const lightCtx = lightCanvas.getContext("2d");

  lightCtx.fillStyle = "rgba(5, 5, 8, 0.97)";
  lightCtx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = lightCtx.createRadialGradient(
    player.x, player.y, 5,
    player.x, player.y, player.lightRadius
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.5)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  lightCtx.globalCompositeOperation = "destination-out";
  lightCtx.beginPath();
  lightCtx.arc(player.x, player.y, player.lightRadius, 0, Math.PI * 2);
  lightCtx.fillStyle = gradient;
  lightCtx.fill();

  ctx.drawImage(lightCanvas, 0, 0);

  // Efeito Glitch de Sanidade
  if (player.sanity < 50) {
    ctx.fillStyle = `rgba(255, 0, 0, ${0.15 * (1 - player.sanity / 50)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Crafting
  if (isCraftingOpen) {
    ctx.fillStyle = "rgba(10, 15, 25, 0.92)";
    ctx.fillRect(canvas.width / 2 - 250, canvas.height / 2 - 200, 500, 400);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 2;
    ctx.strokeRect(canvas.width / 2 - 250, canvas.height / 2 - 200, 500, 400);

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("--- BANCADA DE CRAFTING ---", canvas.width / 2, canvas.height / 2 - 160);
    ctx.font = "14px monospace";
    ctx.fillStyle = "#bdc3c7";
    ctx.fillText(`Sua Sucata: ${player.inventory.scrap}`, canvas.width / 2, canvas.height / 2 - 130);

    ctx.textAlign = "left";
    ctx.fillStyle = "#3498db";
    const startX = canvas.width / 2 - 220;
    ctx.fillText("[4] Bateria (2 Sucatas)", startX, canvas.height / 2 - 70);
    ctx.fillText("[5] Ração Compacta (2 Sucatas)", startX, canvas.height / 2 - 30);
    ctx.fillText("[6] Garrafa de Água (2 Sucatas)", startX, canvas.height / 2 + 10);
    ctx.fillText("[7] Inibidor Neural (+30% Integridade | 3 Sucatas)", startX, canvas.height / 2 + 50);

    ctx.fillStyle = "#e74c3c";
    ctx.textAlign = "center";
    ctx.fillText("Pressione [C] para fechar", canvas.width / 2, canvas.height / 2 + 150);
  }

  // Telas Finais
  if (gameState === "VICTORY_IMPERFECT" || gameState === "VICTORY_TRUE" || player.integrity <= 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "22px monospace";
    ctx.textAlign = "center";

    if (player.integrity <= 0) {
      ctx.fillStyle = "#e74c3c";
      ctx.fillText("MIND-LINK CORROMPIDO", canvas.width / 2, canvas.height / 2);
    } else if (gameState === "VICTORY_IMPERFECT") {
      ctx.fillStyle = "#f39c12";
      ctx.fillText("DEPLOY CONCLUÍDO - AMNÉSIA GLOBAL", canvas.width / 2, canvas.height / 2);
    } else {
      ctx.fillStyle = "#2ecc71";
      ctx.fillText("RESTAURAÇÃO COMPLETA DA SYNAPSYS", canvas.width / 2, canvas.height / 2);
    }
  }
}

// --- 10. LOOP PRINCIPAL ---
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();