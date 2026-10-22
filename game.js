const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 600;

// Configuração de Áudio (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let lastTicTime = 0;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
}

function playTicSound(volume = 0.1) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
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

// Estado de Vitória/Finais
let gameState = "PLAYING"; // "PLAYING", "VICTORY_IMPERFECT", "VICTORY_TRUE"

// Zona do Servidor Central da SynapSys Corporation (Objetivo Final)
const synapsysTower = {
  x: 680,
  y: 40,
  width: 80,
  height: 80
};

// Paredes / Obstáculos do Cenário
const walls = [
  { x: 180, y: 100, width: 20, height: 250 },
  { x: 350, y: 200, width: 200, height: 20 },
  { x: 500, y: 380, width: 20, height: 180 },
  { x: 250, y: 450, width: 180, height: 20 }
];

let isCraftingOpen = false;

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 12,
  speed: 2.5,
  maxLightRadius: 130,
  lightRadius: 130,
  noiseRadius: 0,
  integrity: 100,
  battery: 100,
  hunger: 100,
  thirst: 100,
  hasMemoryBackup: false, // Inicia sem o módulo de memória de backup
  inventory: { scrap: 4, food: 1, water: 1, battery: 1 }
};

const enemies = [
  { x: 100, y: 100, radius: 14, speed: 1.8, state: "IDLE", hearRadius: 180, targetX: 100, targetY: 100 },
  { x: 700, y: 500, radius: 14, speed: 1.8, state: "IDLE", hearRadius: 180, targetX: 700, targetY: 500 },
  { x: 600, y: 150, radius: 14, speed: 2.0, state: "IDLE", hearRadius: 200, targetX: 600, targetY: 150 }
];

let lootBoxes = [
  { x: 120, y: 150, radius: 10, content: "scrap", looted: false },
  { x: 650, y: 220, radius: 10, content: "water", looted: false },
  { x: 80, y: 520, radius: 12, content: "memory_backup", looted: false } // Servidor de Backup
];

const keys = {};

window.addEventListener("keydown", (e) => {
  initAudio();
  keys[e.key] = true;

  if (e.key === "c" || e.key === "C") isCraftingOpen = !isCraftingOpen;

  // Tecla 'E' para fazer o deploy do patch na Torre da SynapSys
  if ((e.key === "e" || e.key === "E") && gameState === "PLAYING") {
    const isAtTower = player.x > synapsysTower.x && player.x < synapsysTower.x + synapsysTower.width &&
                      player.y > synapsysTower.y && player.y < synapsysTower.y + synapsysTower.height;

    if (isAtTower) {
      if (player.hasMemoryBackup) {
        gameState = "VICTORY_TRUE";
      } else {
        gameState = "VICTORY_IMPERFECT";
      }
    }
  }

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
    else if (type === "battery") { player.battery = Math.min(100, player.battery + 40); player.inventory.battery--; }
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

function update() {
  if (player.integrity <= 0 || isCraftingOpen || gameState !== "PLAYING") return;

  player.battery = Math.max(0, player.battery - 0.04);
  player.hunger = Math.max(0, player.hunger - 0.02);
  player.thirst = Math.max(0, player.thirst - 0.035);

  if (player.hunger <= 0 || player.thirst <= 0) player.integrity -= 0.1;

  player.lightRadius = Math.max(35, (player.battery / 100) * player.maxLightRadius);

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

  // Saque de Itens
  lootBoxes.forEach((box) => {
    if (!box.looted && getDistance(player.x, player.y, box.x, box.y) < player.radius + box.radius) {
      box.looted = true;
      if (box.content === "memory_backup") {
        player.hasMemoryBackup = true;
      } else if (box.content === "scrap") {
        player.inventory.scrap++;
      } else {
        player.inventory[box.content]++;
      }
    }
  });

  const now = Date.now();

  enemies.forEach((enemy) => {
    const distToPlayer = getDistance(enemy.x, enemy.y, player.x, player.y);

    if (distToPlayer < 350) {
      const ticInterval = Math.max(150, distToPlayer * 2.5);
      if (now - lastTicTime > ticInterval) {
        const volume = Math.min(0.25, (350 - distToPlayer) / 350 * 0.25);
        playTicSound(volume);
        lastTicTime = now;
      }
    }

    if (player.noiseRadius > 0 && distToPlayer <= enemy.hearRadius + player.noiseRadius) {
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

      if (getDistance(enemy.x, enemy.y, enemy.targetX, enemy.targetY) < 5 && player.noiseRadius === 0) {
        enemy.state = "IDLE";
      }
    }

    if (distToPlayer < player.radius + enemy.radius + 15) {
      player.integrity -= 0.3;
    }
  });

  // Checa se está próximo da Torre para aviso visual
  const isAtTower = player.x > synapsysTower.x && player.x < synapsysTower.x + synapsysTower.width &&
                    player.y > synapsysTower.y && player.y < synapsysTower.y + synapsysTower.height;

  document.getElementById("ui").innerHTML = `
    <p>
      Estabilidade: <strong>${Math.max(0, Math.round(player.integrity))}%</strong> | 
      Energia: <strong>${Math.round(player.battery)}%</strong> | 
      Backup de Memória: <strong>${player.hasMemoryBackup ? "COLETADO (OK)" : "NÃO POSSUI"}</strong>
    </p>
    <p><small>${isAtTower ? "<strong>[Pressione E para fazer o DEPLOY da Atualização]</strong>" : "Alcance a Torre da SynapSys (Canto superior direito)"}</small></p>
  `;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Desenha a Torre da SynapSys Corporation (Zona do Servidor)
  ctx.fillStyle = "#16a085";
  ctx.fillRect(synapsysTower.x, synapsysTower.y, synapsysTower.width, synapsysTower.height);
  ctx.strokeStyle = "#1abc9c";
  ctx.lineWidth = 3;
  ctx.strokeRect(synapsysTower.x, synapsysTower.y, synapsysTower.width, synapsysTower.height);

  // Paredes
  ctx.fillStyle = "#2c3e50";
  walls.forEach((wall) => {
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  });

  // Loot
  lootBoxes.forEach((box) => {
    if (!box.looted) {
      if (box.content === "memory_backup") {
        ctx.fillStyle = "#9b59b6"; // Roxo brilhante para a Memória
        ctx.beginPath();
        ctx.arc(box.x, box.y, box.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
      } else {
        ctx.fillStyle = box.content === "scrap" ? "#bdc3c7" : (box.content === "food" ? "#e67e22" : "#3498db");
        ctx.fillRect(box.x - 8, box.y - 8, 16, 16);
      }
    }
  });

  // Ecos
  enemies.forEach((enemy) => {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fillStyle = enemy.state === "CHASE" ? "#e74c3c" : "#8e44ad";
    ctx.fill();
    ctx.closePath();
  });

  // Jogador
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#2ecc71";
  ctx.fill();
  ctx.closePath();

  if (player.noiseRadius > 0) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.noiseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
  }

  // Escuridão / Lanterna
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

  // Crafting Menu
  if (isCraftingOpen) {
    ctx.fillStyle = "rgba(10, 15, 25, 0.92)";
    ctx.fillRect(150, 100, 500, 400);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 2;
    ctx.strokeRect(150, 100, 500, 400);

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("--- BANCADA DE CRAFTING DO MIND-LINK ---", canvas.width / 2, 140);
    ctx.font = "14px monospace";
    ctx.fillStyle = "#bdc3c7";
    ctx.fillText(`Sua Sucata Atual: ${player.inventory.scrap}`, canvas.width / 2, 170);

    ctx.textAlign = "left";
    ctx.fillStyle = "#3498db";
    ctx.fillText("[4] Criar Célula de Bateria (Custo: 2 Sucatas)", 180, 230);
    ctx.fillText("[5] Fabricar Ração Compacta (Custo: 2 Sucatas)", 180, 270);
    ctx.fillText("[6] Purificar Garrafa de Água (Custo: 2 Sucatas)", 180, 310);
    ctx.fillText("[7] Injetar Inibidor Neural (+30% Integridade | Custo: 3 Sucatas)", 180, 350);

    ctx.fillStyle = "#e74c3c";
    ctx.textAlign = "center";
    ctx.fillText("Pressione [C] para fechar o menu", canvas.width / 2, 450);
  }

  // TELA DE VITÓRIA: FINAL IMPERFEITO (AMNÉSIA)
  if (gameState === "VICTORY_IMPERFECT") {
    ctx.fillStyle = "rgba(5, 10, 20, 0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f39c12";
    ctx.font = "22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("DEPLOY CONCLUÍDO - PATCH APLICADO", canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = "#ecf0f1";
    ctx.font = "14px monospace";
    ctx.fillText("Os Ecos recuperaram o controle de seus corpos e os 'tics' cessaram.", canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText("Porém, sem o Backup de Memória, uma amnésia global ocorreu.", canvas.width / 2, canvas.height / 2 + 35);
    ctx.fillText("A humanidade está livre do Mind-Link, mas esqueceu quem era.", canvas.width / 2, canvas.height / 2 + 60);
  }

  // TELA DE VITÓRIA: FINAL VERDADEIRO (SALVAÇÃO TOTAL)
  if (gameState === "VICTORY_TRUE") {
    ctx.fillStyle = "rgba(5, 20, 15, 0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#2ecc71";
    ctx.font = "22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("RESTAURAÇÃO COMPLETA DA SYNAPSYS", canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = "#ecf0f1";
    ctx.font = "14px monospace";
    ctx.fillText("Deploy do Patch + Módulo de Memória executados com sucesso!", canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText("As pessoas recuperaram o controle e suas memórias voltaram.", canvas.width / 2, canvas.height / 2 + 35);
    ctx.fillText("Você salvou a humanidade da Synapsys Corporation!", canvas.width / 2, canvas.height / 2 + 60);
  }

  // Game Over
  if (player.integrity <= 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e74c3c";
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MIND-LINK CORROMPIDO", canvas.width / 2, canvas.height / 2);
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();