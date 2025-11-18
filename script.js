// --- HTML Elementleri ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const infoDisplay = document.getElementById('infoDisplay');

// Giriş ekranı elementleri
const startScreen = document.getElementById('startScreen');
const gameUI = document.getElementById('gameUI');
const startButton = document.getElementById('startButton');
const playerNameInput = document.getElementById('playerNameInput');
const gameGuide = document.getElementById('gameGuide');

// Canvas boyutlarını dinamik olarak ayarla
function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight; 
}

// Başlangıçta ve pencere boyutu değiştiğinde boyutları ayarla
setCanvasSize(); 
window.addEventListener('resize', setCanvasSize); 

// W ve H değişkenlerini dinamik olarak canvas'tan al
let W = canvas.width;
let H = canvas.height;

function updateDimensions() {
    W = canvas.width;
    H = canvas.height;
}

let score = 0;
let projectiles = []; 
let enemies = [];     
let particles = [];   
let powerUps = [];    
let enemyProjectiles = []; 
let floatingTexts = []; 

// --- OYUN AYARLARI ---
let lives = 3; 
let isGameOver = false;
let level = 1; 
let playerHitFlash = 0; 
let playerName = 'ÖĞRENCİ'; 
let levelUpFlash = 0; 
let screenShake = 0; // Ekran titremesi miktarı

// Dinamik Zorluk
let shotsFired = 0; 
let shotsHit = 0;   
const projectileSpeed = 12; 
let baseEnemySpeed = 1;    
let enemySpeedMultiplier = 1; 
let fireRateMultiplier = 1; 
let lastShotTime = 0;
const minTimeBetweenShots = 100; 

// Alternatif Atış (Sağ Tık) ve Bomba (Orta Tuş)
let altFireInterval;
const altFireRate = 50; 

let bombCooldown = 10000; 
let lastBombTime = 0;

// Güncel fare pozisyonu
let currentMouseX = W / 2;
let currentMouseY = H / 2;

// Zorluk metni
let difficultyText = 'KOLAY';

// Yüksek Skor
let highestScore = localStorage.getItem('highestScore') || 0; 

// --- GÖRSELLER ---

// Kitap resmi (Oyuncu)
const playerBookImage = new Image();
playerBookImage.src = 'hiz_yay_kitap.png'; 
let playerBookImageLoaded = false; 

playerBookImage.onload = () => { playerBookImageLoaded = true; };
playerBookImage.onerror = () => { playerBookImageLoaded = false; };

// Bomba Resmi
const bombImage = new Image();
bombImage.src = 'bomb.png'; 
let bombImageLoaded = false;

bombImage.onload = () => { bombImageLoaded = true; };
bombImage.onerror = () => { bombImageLoaded = false; };


// Bilgi ekranını güncelleme
function updateInfoDisplay() {
    let accuracy = shotsFired > 0 ? ((shotsHit / shotsFired) * 100).toFixed(1) : 0;
    const remainingBombTime = Math.max(0, bombCooldown - (Date.now() - lastBombTime));
    const bombStatus = remainingBombTime > 0 ? `BOMBA: ${(remainingBombTime / 1000).toFixed(1)}s` : 'BOMBA: HAZIR';
    
    infoDisplay.innerHTML = `Can: ${lives} | Seviye: ${level} (${difficultyText}) | İsabet: ${accuracy}% | ${bombStatus} | Rekor: ${highestScore}`;
}


// --- OYUN BAŞLANGIÇ ---

function initGame() {
    lives = 3;
    score = 0;
    isGameOver = false;
    shotsFired = 0;
    shotsHit = 0;
    projectiles = [];
    enemies = [];
    particles = [];
    powerUps = [];
    enemyProjectiles = []; 
    floatingTexts = [];
    playerHitFlash = 0;
    levelUpFlash = 0;
    screenShake = 0;
    lastBombTime = 0;
    
    // İsim uzunluğuna göre zorluk
    const nameLength = playerName.length;
    if (nameLength <= 4) {
        enemySpeedMultiplier = 1.0; 
        difficultyText = 'KOLAY';
    } else if (nameLength <= 7) {
        enemySpeedMultiplier = 1.5; 
        difficultyText = 'ORTA';
    } else {
        enemySpeedMultiplier = 2.0; 
        difficultyText = 'ZOR';
    }

    level = 1; 

    centerX = W / 4; 
    centerY = H / 2; 
    
    scoreDisplay.innerHTML = `Puan: ${score}`;
    updateInfoDisplay();
    
    animate();
    spawnEnemies();
}


// --- SINIFLAR ---

// Uçan Yazı Sınıfı
class FloatingText {
    constructor(text, x, y, color, size = 20) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.life = 1.0; 
        this.velocityY = -1; 
    }
    update() {
        this.y += this.velocityY;
        this.life -= 0.02;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// Mermi / Bomba Sınıfı
class Projectile {
    constructor(x, y, radius, color, velocity, isBomb = false) { 
        this.x = x; this.y = y; this.radius = radius; this.color = color; this.velocity = velocity; 
        this.isBomb = isBomb;
        this.baseRadius = radius;
        this.explosionRadius = 250; 
        this.exploded = false;
        this.explosionTimer = 0; 
    }
    draw() {
        if (this.isBomb) {
            if (this.exploded) {
                // Patlama efekti
                ctx.save();
                ctx.globalAlpha = 1 - (this.explosionTimer / 60); 
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; 
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; 
                ctx.lineWidth = 5;
                ctx.stroke();
                ctx.restore();
            } else {
                // Bomba görünümü
                if (bombImageLoaded) {
                    const size = this.radius * 2;
                    ctx.drawImage(bombImage, this.x - this.radius, this.y - this.radius, size, size);
                } else {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                    ctx.fillStyle = 'gray'; 
                    ctx.fill();
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.fillStyle = 'white';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('BOMBA', this.x, this.y + 3);
                }
            }
        } else {
            // Normal mermi (Kalem çizimi kaldırıldı)
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }
    update() {
        this.draw();
        
        if (this.isBomb && this.exploded) {
            this.explosionTimer++;
            this.radius += 5; 
        } else if (!this.isBomb) {
            this.x = this.x + this.velocity.x;
            this.y = this.y + this.velocity.y;
        } else { 
             this.x = this.x + this.velocity.x;
             this.y = this.y + this.velocity.y;
        }
    }
    
    explode() {
        if (this.exploded) return;
        this.exploded = true;
        this.radius = this.baseRadius; 
        this.explosionTimer = 0; 
        
        // Ekranı salla
        screenShake = 20;
        
        let enemiesHit = [];
        
        enemies.forEach(enemy => {
            const dist = Math.hypot(this.x - enemy.x, this.y - enemy.y);
            if (dist - enemy.radius < this.explosionRadius) { 
                enemiesHit.push(enemy);
            }
        });
        
        enemiesHit.forEach(enemy => {
             for (let i = 0; i < enemy.radius * 3; i++) {
                 particles.push(new Particle(enemy.x, enemy.y, Math.random() * 3, 'gold', 
                     { x: (Math.random() - 0.5) * (Math.random() * 10), y: (Math.random() - 0.5) * (Math.random() * 10) }));
             }
             score += 100 * enemy.maxHp; 
             floatingTexts.push(new FloatingText("GÜM!", enemy.x, enemy.y, "#FF4500", 30));
        });

        enemies = enemies.filter(enemy => {
             const dist = Math.hypot(this.x - enemy.x, this.y - enemy.y);
             return dist - enemy.radius >= this.explosionRadius;
        });
        
        scoreDisplay.innerHTML = `Puan: ${score}`;
    }
}

class EnemyProjectile {
    constructor(x, y, radius, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = '#FF4500'; 
        this.velocity = velocity;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    update() {
        this.draw();
        this.x = this.x + this.velocity.x;
        this.y = this.y + this.velocity.y;
    }
}

class Enemy {
    constructor(x, y, radius, color, velocity) {
        this.x = x; 
        this.y = y; 
        this.radius = radius; 
        this.baseColor = color; 
        this.color = color; 
        this.velocity = velocity;
        this.hp = Math.floor(radius / 10); 
        this.maxHp = this.hp;
        this.isHit = false; 
        
        this.lastShotTime = Date.now();
        this.fireRate = 1500 + (this.radius * 30); 
    }
    
    takeHit() {
        this.hp--;
        this.isHit = true; 
        setTimeout(() => { this.isHit = false; }, 50); 
        return this.hp <= 0; 
    }

    draw() {
        ctx.save(); 
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.baseColor; 
        ctx.fill();
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = `bold ${this.radius * 0.8}px sans-serif`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.random() > 0.5 ? '?' : 'X', this.x, this.y);

        if (this.isHit) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; 
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            ctx.fill();
        }
        
        if (this.maxHp > 1) {
            const hpBarWidth = this.radius * 1.5;
            const hpBarHeight = 3;
            const hpBarX = this.x - hpBarWidth / 2;
            const hpBarY = this.y - this.radius - hpBarHeight - 5;
            ctx.fillStyle = 'red';
            ctx.fillRect(hpBarX, hpBarY, hpBarWidth * (this.hp / this.maxHp), hpBarHeight);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
        }

        ctx.restore(); 
    }
    
    fireAtPlayer(playerX, playerY) {
        const currentTime = Date.now();
        if (currentTime - this.lastShotTime < this.fireRate) {
            return null; 
        }
        
        this.lastShotTime = currentTime;
        
        const speed = 2.0; 
        const angle = Math.atan2(playerY - this.y, playerX - this.x);
        
        const velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        
        return new EnemyProjectile(this.x, this.y, 5, velocity); 
    }
    
    update() {
        this.draw();
        this.x = this.x + this.velocity.x;
        this.y = this.y + this.velocity.y;
    }
}

class Particle { 
    constructor(x, y, radius, color, velocity) {
        this.x = x; this.y = y; this.radius = radius; this.color = color; this.velocity = velocity;
        this.alpha = 1; 
    }
    draw() {
        ctx.save(); 
        ctx.globalAlpha = this.alpha; 
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore(); 
    }
    update() {
        this.draw();
        this.velocity.x *= 0.99; 
        this.velocity.y *= 0.99;
        this.x = this.x + this.velocity.x;
        this.y = this.y + this.velocity.y;
        this.alpha -= 0.02; 
    }
}
class PowerUp { 
    constructor(x, y, effect) {
        this.x = x; this.y = y; this.radius = 15; this.color = 'yellow';
        this.effect = effect; 
        this.velocity = { x: -0.5, y: 0 }; 
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.font = '10px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.fillText('HIZ', this.x, this.y + 3);
    }
    update() {
        this.draw();
        this.x += this.velocity.x;
    }
}


// --- Oyun Çalışma Mantığı ---

function spawnEnemies() {
    if (window.spawnInterval) clearInterval(window.spawnInterval);

    window.spawnInterval = setInterval(() => {
        if (isGameOver) return;
        const radius = Math.random() * (25 - 10) + 10; 
        const color = `hsl(${Math.random() * 360}, 100%, 50%)`; 
        const x = W + radius;
        const y = Math.random() * (H - radius * 2) + radius; 
        
        const baseSpeed = (Math.random() * (2 - 1) + 1); 
        const speed = (baseSpeed / (radius / 10)) * enemySpeedMultiplier; 
        
        const finalSpeed = Math.max(0.5, speed);

        const velocity = { x: -finalSpeed, y: 0 }; 
        enemies.push(new Enemy(x, y, radius, color, velocity));
    }, 1500); 
}

function adjustDifficulty() {
    let oldLevel = level;
    const newLevel = Math.floor(score / 5000) + 1;
    
    if (newLevel > oldLevel) {
        level = newLevel;
        levelUpFlash = 2.0; 
        enemySpeedMultiplier = 1.0 + (level * 0.3); 
        screenShake = 10;
    }

    const currentAccuracy = shotsFired > 0 ? (shotsHit / shotsFired) * 100 : 0;
    
    if (currentAccuracy < 35 && enemySpeedMultiplier > 1.0) {
        enemySpeedMultiplier -= 0.0005;
    }
    
    updateInfoDisplay();
}


let centerX = W / 4; 
let centerY = H / 2;
const playerRadius = 30;
const playerSpeed = 5;
let playerVelocityX = 0;
let playerVelocityY = 0;
let keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

function updatePlayerPosition() {
    playerVelocityX = 0;
    playerVelocityY = 0;

    const currentSpeed = playerSpeed * fireRateMultiplier; 

    if (keys['w'] || keys['arrowup']) playerVelocityY = -currentSpeed;
    if (keys['s'] || keys['arrowdown']) playerVelocityY = currentSpeed;
    if (keys['a'] || keys['arrowleft']) playerVelocityX = -currentSpeed;
    if (keys['d'] || keys['arrowright']) playerVelocityX = currentSpeed;

    if (playerVelocityX !== 0 && playerVelocityY !== 0) {
        const diagonalSpeed = currentSpeed / Math.sqrt(2);
        playerVelocityX = playerVelocityX > 0 ? diagonalSpeed : -diagonalSpeed;
        playerVelocityY = playerVelocityY > 0 ? diagonalSpeed : -diagonalSpeed;
    }

    centerX += playerVelocityX;
    centerY += playerVelocityY;

    if (centerX - playerRadius < 0) centerX = playerRadius;
    if (centerX + playerRadius > W) centerX = W - playerRadius;
    if (centerY - playerRadius < 0) centerY = playerRadius;
    if (centerY + playerRadius > H) centerY = H - playerRadius;
}


// Oyuncu Çizimi
function drawPlayer() {
    updatePlayerPosition();

    ctx.save();
    
    if (playerHitFlash > 0) {
        ctx.globalAlpha = playerHitFlash;
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(centerX, centerY, playerRadius + 5, 0, Math.PI * 2, false);
        ctx.fill();
        playerHitFlash -= 0.05;
    }

    if (levelUpFlash > 0) {
        ctx.globalAlpha = levelUpFlash;
        ctx.fillStyle = 'gold';
        ctx.beginPath();
        ctx.arc(centerX, centerY, playerRadius + 10, 0, Math.PI * 2, false);
        ctx.fill();
        levelUpFlash -= 0.01; 
    }

    ctx.globalAlpha = 1.0; 
    
    const angle = Math.atan2(currentMouseY - centerY, currentMouseX - centerX);
    
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + Math.PI / 2);

    if (playerBookImageLoaded) {
        const size = playerRadius * 2.5; 
        ctx.drawImage(playerBookImage, -size / 2, -size / 2, size, size);
    } else {
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius, 0, Math.PI * 2, false);
        ctx.fillStyle = '#1e88e5'; 
        ctx.fill();
        ctx.font = '12px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('KİTAP', 0, 4);
    }

    ctx.restore(); 
}

canvas.addEventListener('mousemove', (e) => {
    currentMouseX = e.clientX;
    currentMouseY = e.clientY;
});

// Normal Ateş
canvas.addEventListener('click', (e) => {
    if (isGameOver) return;
    
    const x = centerX;
    const y = centerY;
    const radius = 5;
    const angle = Math.atan2(e.clientY - y, e.clientX - x);
    const speed = projectileSpeed * fireRateMultiplier; 

    const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
    };

    projectiles.push(new Projectile(x, y, radius, '#ffeb3b', velocity)); 
    shotsFired++;
    updateInfoDisplay();
});

// Seri Ateş
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2 && !isGameOver) { 
        e.preventDefault();
        altFireInterval = setInterval(() => {
            const x = centerX;
            const y = centerY;
            const radius = 3; 
            const angle = Math.atan2(currentMouseY - y, currentMouseX - x);
            const speed = projectileSpeed * fireRateMultiplier * 1.5; 
            
            const velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            };

            projectiles.push(new Projectile(x, y, radius, '#FFC107', velocity)); 
            shotsFired++;
            updateInfoDisplay();
        }, altFireRate); 
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) { 
        clearInterval(altFireInterval);
    }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Bomba Atışı
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 && !isGameOver) { // Orta tık
        e.preventDefault();
        const currentTime = Date.now();
        if (currentTime - lastBombTime >= bombCooldown) {
            const x = centerX;
            const y = centerY;
            const radius = 10;
            const angle = Math.atan2(e.clientY - y, e.clientX - x);
            const speed = projectileSpeed / 2; 

            const velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            };

            projectiles.push(new Projectile(x, y, radius, 'gray', velocity, true));
            lastBombTime = currentTime;
            updateInfoDisplay();
        }
    }
});


// --- OYUN DÖNGÜSÜ ---

let animationId;
function animate() {
    if (isGameOver) {
        cancelAnimationFrame(animationId);
        showGameOverScreen();
        return;
    }
    
    animationId = requestAnimationFrame(animate);
    
    // Ekran titremesi
    ctx.save();
    if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
        screenShake *= 0.9; 
        if(screenShake < 0.5) screenShake = 0;
    }

    // Arka plan
    ctx.fillStyle = 'rgba(251, 251, 242, 0.3)';
    ctx.fillRect(0, 0, W, H);
    
    // Defter Çizgileri
    ctx.strokeStyle = '#ADD8E6'; 
    ctx.lineWidth = 1;
    for(let y = 0; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }

    // Arka Plan Yazısı (HIZ YAYINLARI)
    ctx.save();
    ctx.globalAlpha = 0.2; 
    ctx.font = 'bold 100px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FF8C00'; 
    ctx.fillText('HIZ YAYINLARI', W / 2, H / 2);
    ctx.restore();

    drawPlayer();
    adjustDifficulty();
    
    // Parçacıklar
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        if (particle.alpha <= 0) {
            particles.splice(i, 1);
        } else {
            particle.update();
        }
    }

    // Uçan Yazılar
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.update();
        ft.draw();
        if (ft.life <= 0) {
            floatingTexts.splice(i, 1);
        }
    }
    
    // Power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.update();
        
        const dist = Math.hypot(centerX - powerUp.x, centerY - powerUp.y);
        if (dist - powerUp.radius - playerRadius < 1) {
            fireRateMultiplier = 2.0; 
            setTimeout(() => { fireRateMultiplier = 1.0; }, 5000); 
            floatingTexts.push(new FloatingText("HIZLANDIN!", centerX, centerY - 30, "#00BFFF"));
            powerUps.splice(i, 1);
        }
    }
    
    // Mermiler
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.update();

        if (projectile.isBomb && projectile.exploded && projectile.explosionTimer > 60) {
            projectiles.splice(i, 1);
            continue;
        }

        // Bomba patlarsa (Sınır veya Düşman teması)
        if (projectile.isBomb && !projectile.exploded && (projectile.x - projectile.radius < 0 || projectile.x + projectile.radius > W || projectile.y - projectile.radius < 0 || projectile.y + projectile.radius > H)) {
            projectile.explode();
            continue; 
        }

        // Normal mermi sınır dışı
        if (!projectile.isBomb && (projectile.x - projectile.radius > W || projectile.x + projectile.radius < 0 || projectile.y - projectile.radius > H || projectile.y + projectile.radius < 0)) {
            projectiles.splice(i, 1);
            continue;
        }

        enemies.forEach((enemy, enemyIndex) => {
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);

            if (dist - enemy.radius - projectile.radius < 1) {
                
                if (projectile.isBomb && !projectile.exploded) {
                    projectile.explode(); // Düşmana çarptığında patlar
                    return; 
                } else if (projectile.isBomb && projectile.exploded) {
                    return;
                }
                
                shotsHit++; 
                updateInfoDisplay();
                
                for (let i = 0; i < enemy.radius * 2; i++) {
                    particles.push(new Particle(projectile.x, projectile.y, Math.random() * 2, enemy.baseColor, 
                        { x: (Math.random() - 0.5) * (Math.random() * 6), y: (Math.random() - 0.5) * (Math.random() * 6) }));
                }

                const isDead = enemy.takeHit();
                
                if (isDead) {
                    let pts = 100 * enemy.maxHp;
                    score += pts; 
                    floatingTexts.push(new FloatingText(`+${pts}`, enemy.x, enemy.y, "#32CD32", 16));
                    
                    if (Math.random() < 0.1) {
                        powerUps.push(new PowerUp(enemy.x, enemy.y, 'firerate'));
                    }
                    enemies.splice(enemyIndex, 1);
                }
                projectiles.splice(i, 1);
            }
        });
    }

    // Düşman Mermileri
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const enemyProj = enemyProjectiles[i];
        enemyProj.update();

        const dist = Math.hypot(centerX - enemyProj.x, centerY - enemyProj.y);
        if (dist - playerRadius - enemyProj.radius < 1) {
            lives--;
            playerHitFlash = 1.0; 
            screenShake = 10; 
            updateInfoDisplay();

            for (let j = 0; j < 15; j++) {
                particles.push(new Particle(enemyProj.x, enemyProj.y, Math.random() * 2, '#FF4500', 
                    { x: (Math.random() - 0.5) * (Math.random() * 4), y: (Math.random() - 0.5) * (Math.random() * 4) }));
            }
            
            enemyProjectiles.splice(i, 1);
            
            if (lives <= 0) {
                isGameOver = true;
                if (score > highestScore) {
                    localStorage.setItem('highestScore', score);
                    highestScore = score;
                }
            }
        }
        
        if (enemyProj.x - enemyProj.radius > W || enemyProj.x + enemyProj.radius < 0 || enemyProj.y - enemyProj.radius > H || enemyProj.y + enemyProj.radius < 0) {
            enemyProjectiles.splice(i, 1);
        }
    }

    // Düşmanlar
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        
        const newProj = enemy.fireAtPlayer(centerX, centerY);
        if (newProj) {
            enemyProjectiles.push(newProj);
        }

        if (enemy.x + enemy.radius < 0) {
            lives--;
            playerHitFlash = 1.0; 
            screenShake = 10; 
            updateInfoDisplay();
            enemies.splice(i, 1);
            
            if (lives <= 0) {
                isGameOver = true;
                if (score > highestScore) {
                    localStorage.setItem('highestScore', score);
                    highestScore = score;
                }
            }
        }
    }
    
    scoreDisplay.innerHTML = `Puan: ${score}`;
    updateInfoDisplay(); 
    
    ctx.restore(); 
}


function showGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';

    ctx.font = 'bold 48px Arial';
    ctx.fillText('OYUN BİTTİ!', W / 2, H / 2 - 80);

    ctx.font = '30px Arial';
    ctx.fillText(`${playerName}, Puanın: ${score}`, W / 2, H / 2 - 20);
    
    if (score == highestScore) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 36px Arial';
        ctx.fillText('YENİ REKOR!', W / 2, H / 2 + 40);
    } else {
        ctx.font = '24px Arial';
        ctx.fillText(`Rekor: ${highestScore}`, W / 2, H / 2 + 40);
    }
    
    const buttonX = W / 2 - 100;
    const buttonY = H / 2 + 100;
    const buttonWidth = 200;
    const buttonHeight = 50;

    ctx.fillStyle = '#007BFF';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('TEKRAR OYNA', W / 2, buttonY + 35);
    
    canvas.addEventListener('click', function restartHandler(e) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        if (clickX > buttonX && clickX < buttonX + buttonWidth &&
            clickY > buttonY && clickY < buttonY + buttonHeight) {
            
            canvas.removeEventListener('click', restartHandler);
            gameGuide.style.display = 'block'; 
            startScreen.style.display = 'flex';
            gameUI.style.display = 'none';
        }
    });
}

startButton.addEventListener('click', () => {
    let inputName = playerNameInput.value.trim();
    if (inputName === '') {
        inputName = 'Anonim Öğrenci';
    }
    playerName = inputName.charAt(0).toUpperCase() + inputName.slice(1).toLowerCase();

    gameGuide.style.display = 'none';
    startScreen.style.display = 'none';
    gameUI.style.display = 'block';

    initGame();
});

window.onload = function() {
    setCanvasSize(); 
    highestScore = localStorage.getItem('highestScore') || 0;
    updateInfoDisplay(); 
    gameGuide.style.display = 'block'; 
};