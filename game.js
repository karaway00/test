// 게임 상태
const gameState = {
    health: 100,
    gold: 500,
    wave: 1,
    enemies: [],
    towers: [],
    projectiles: [],
    selectedTower: null,
    placingTower: false,
    gameRunning: false,
    paused: false,
    enemiesInWave: 0,
    enemiesSpawned: 0,
    path: []
};

// 타워 타입 정의
const towerTypes = {
    guanyu: {
        name: '관우',
        cost: 100,
        damage: 30,
        range: 120,
        fireRate: 1000,
        color: '#8B0000',
        icon: '⚔️'
    },
    zhangfei: {
        name: '장비',
        cost: 80,
        damage: 20,
        range: 150,
        fireRate: 800,
        color: '#00008B',
        icon: '🗡️'
    },
    zhaoyun: {
        name: '조운',
        cost: 120,
        damage: 40,
        range: 140,
        fireRate: 1200,
        color: '#006400',
        icon: '🏹'
    },
    zhugeliang: {
        name: '제갈량',
        cost: 150,
        damage: 35,
        range: 200,
        fireRate: 1500,
        color: '#4B0082',
        icon: '🔮'
    }
};

// 캔버스 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 경로 정의 (적이 따라갈 경로)
function initializePath() {
    gameState.path = [
        { x: 0, y: 300 },
        { x: 200, y: 300 },
        { x: 200, y: 150 },
        { x: 400, y: 150 },
        { x: 400, y: 450 },
        { x: 600, y: 450 },
        { x: 600, y: 200 },
        { x: 800, y: 200 },
        { x: 800, y: 400 },
        { x: 1000, y: 400 }
    ];
}

// 적 클래스
class Enemy {
    constructor(type = 'normal') {
        this.pathIndex = 0;
        this.x = gameState.path[0].x;
        this.y = gameState.path[0].y;
        this.type = type;
        this.maxHealth = type === 'boss' ? 200 : 50;
        this.health = this.maxHealth;
        this.speed = type === 'boss' ? 0.5 : 1;
        this.reward = type === 'boss' ? 50 : 10;
        this.size = type === 'boss' ? 25 : 15;
        this.color = type === 'boss' ? '#8B0000' : '#FF4500';
    }

    update() {
        if (this.pathIndex < gameState.path.length - 1) {
            const target = gameState.path[this.pathIndex + 1];
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.speed) {
                this.pathIndex++;
                if (this.pathIndex >= gameState.path.length - 1) {
                    // 목표지점 도달
                    gameState.health -= this.type === 'boss' ? 20 : 5;
                    updateUI();
                    return false;
                }
            } else {
                this.x += (dx / distance) * this.speed;
                this.y += (dy / distance) * this.speed;
            }
        }
        return this.health > 0;
    }

    draw() {
        // 적 그리기
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // 체력바
        const barWidth = this.size * 2;
        const barHeight = 4;
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.size - 10, barWidth, barHeight);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.size - 10, barWidth * (this.health / this.maxHealth), barHeight);
        
        // 적 아이콘
        ctx.fillStyle = '#FFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.type === 'boss' ? '👑' : '⚔️', this.x, this.y + 4);
    }

    takeDamage(damage) {
        this.health -= damage;
        return this.health <= 0;
    }
}

// 타워 클래스
class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.stats = towerTypes[type];
        this.lastFire = 0;
        this.target = null;
    }

    update() {
        // 가장 가까운 적 찾기
        let closestEnemy = null;
        let closestDistance = this.stats.range;

        for (let enemy of gameState.enemies) {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        }

        this.target = closestEnemy;

        // 공격
        const now = Date.now();
        if (this.target && now - this.lastFire > this.stats.fireRate) {
            this.fire();
            this.lastFire = now;
        }
    }

    fire() {
        if (this.target) {
            gameState.projectiles.push({
                x: this.x,
                y: this.y,
                target: this.target,
                damage: this.stats.damage,
                speed: 5,
                color: this.stats.color
            });
        }
    }

    draw() {
        // 타워 그리기
        ctx.fillStyle = this.stats.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // 타워 아이콘
        ctx.fillStyle = '#FFF';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.stats.icon, this.x, this.y + 6);
        
        // 사거리 표시 (선택된 경우)
        if (gameState.selectedTower === this) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.stats.range, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // 타겟 라인
        if (this.target) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.stroke();
        }
    }
}

// 투사체 업데이트
function updateProjectiles() {
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        const proj = gameState.projectiles[i];
        
        if (!proj.target || proj.target.health <= 0) {
            gameState.projectiles.splice(i, 1);
            continue;
        }

        const dx = proj.target.x - proj.x;
        const dy = proj.target.y - proj.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < proj.speed) {
            // 적에게 데미지
            if (proj.target.takeDamage(proj.damage)) {
                // 적 처치
                gameState.gold += proj.target.reward;
                const index = gameState.enemies.indexOf(proj.target);
                if (index > -1) {
                    gameState.enemies.splice(index, 1);
                }
            }
            gameState.projectiles.splice(i, 1);
        } else {
            proj.x += (dx / distance) * proj.speed;
            proj.y += (dy / distance) * proj.speed;
        }
    }
}

// 투사체 그리기
function drawProjectiles() {
    for (let proj of gameState.projectiles) {
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 경로 그리기
function drawPath() {
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 40;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(gameState.path[0].x, gameState.path[0].y);
    for (let i = 1; i < gameState.path.length; i++) {
        ctx.lineTo(gameState.path[i].x, gameState.path[i].y);
    }
    ctx.stroke();
    
    // 경로 중앙선
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(gameState.path[0].x, gameState.path[0].y);
    for (let i = 1; i < gameState.path.length; i++) {
        ctx.lineTo(gameState.path[i].x, gameState.path[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

// UI 업데이트
function updateUI() {
    document.getElementById('health').textContent = gameState.health;
    document.getElementById('gold').textContent = gameState.gold;
    document.getElementById('wave').textContent = gameState.wave;
    document.getElementById('enemies-left').textContent = gameState.enemies.length;
    
    // 골드에 따라 타워 구매 가능 여부 표시
    document.querySelectorAll('.tower-item').forEach(item => {
        const towerType = item.dataset.tower;
        const cost = towerTypes[towerType].cost;
        if (gameState.gold < cost) {
            item.style.opacity = '0.5';
            item.style.cursor = 'not-allowed';
        } else {
            item.style.opacity = '1';
            item.style.cursor = 'pointer';
        }
    });
    
    // 게임 오버 체크
    if (gameState.health <= 0) {
        gameState.gameRunning = false;
        showGameOver(false);
    }
}

// 웨이브 시작
function startWave() {
    if (gameState.gameRunning) return;
    
    gameState.gameRunning = true;
    gameState.enemiesInWave = 5 + gameState.wave * 3;
    gameState.enemiesSpawned = 0;
    
    const spawnInterval = setInterval(() => {
        if (gameState.enemiesSpawned < gameState.enemiesInWave) {
            const isBoss = gameState.enemiesSpawned === gameState.enemiesInWave - 1 && gameState.wave % 3 === 0;
            gameState.enemies.push(new Enemy(isBoss ? 'boss' : 'normal'));
            gameState.enemiesSpawned++;
        } else {
            clearInterval(spawnInterval);
        }
    }, 2000);
}

// 웨이브 완료 체크
function checkWaveComplete() {
    if (gameState.enemies.length === 0 && 
        gameState.enemiesSpawned >= gameState.enemiesInWave && 
        gameState.gameRunning) {
        gameState.gameRunning = false;
        gameState.wave++;
        gameState.gold += 100 + gameState.wave * 20;
        updateUI();
        alert(`웨이브 ${gameState.wave - 1} 완료! 보너스 골드를 획득했습니다!`);
    }
}

// 게임 루프
function gameLoop() {
    if (gameState.paused) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // 화면 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 배경 그리기
    ctx.fillStyle = '#2d5016';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 경로 그리기
    drawPath();
    
    // 적 업데이트 및 그리기
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        if (!enemy.update()) {
            gameState.enemies.splice(i, 1);
        } else {
            enemy.draw();
        }
    }
    
    // 타워 업데이트 및 그리기
    for (let tower of gameState.towers) {
        tower.update();
        tower.draw();
    }
    
    // 투사체 업데이트 및 그리기
    updateProjectiles();
    drawProjectiles();
    
    // 웨이브 완료 체크
    checkWaveComplete();
    
    updateUI();
    requestAnimationFrame(gameLoop);
}

// 타워 배치 가능 여부 체크
function canPlaceTower(x, y) {
    // 경로와 너무 가까운지 체크
    for (let point of gameState.path) {
        const dx = point.x - x;
        const dy = point.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 50) return false;
    }
    
    // 다른 타워와 너무 가까운지 체크
    for (let tower of gameState.towers) {
        const dx = tower.x - x;
        const dy = tower.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 60) return false;
    }
    
    return true;
}

// 게임 오버 모달
function showGameOver(won) {
    const modal = document.getElementById('gameOverModal');
    const title = document.getElementById('gameOverTitle');
    const message = document.getElementById('gameOverMessage');
    
    if (won) {
        title.textContent = '승리!';
        message.textContent = `축하합니다! 웨이브 ${gameState.wave}까지 완료했습니다!`;
    } else {
        title.textContent = '게임 오버';
        message.textContent = `웨이브 ${gameState.wave}에서 패배했습니다. 다시 도전해보세요!`;
    }
    
    modal.classList.add('show');
}

// 이벤트 리스너
canvas.addEventListener('click', (e) => {
    if (gameState.placingTower && gameState.selectedTower) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (canPlaceTower(x, y)) {
            const towerType = gameState.selectedTower;
            const cost = towerTypes[towerType].cost;
            
            if (gameState.gold >= cost) {
                gameState.towers.push(new Tower(x, y, towerType));
                gameState.gold -= cost;
                gameState.placingTower = false;
                gameState.selectedTower = null;
                document.querySelectorAll('.tower-item').forEach(item => {
                    item.classList.remove('selected');
                });
                updateUI();
            } else {
                alert('골드가 부족합니다!');
            }
        } else {
            alert('여기에 타워를 배치할 수 없습니다!');
        }
    } else {
        // 타워 선택
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        let clickedTower = null;
        for (let tower of gameState.towers) {
            const dx = tower.x - x;
            const dy = tower.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 20) {
                clickedTower = tower;
                break;
            }
        }
        
        gameState.selectedTower = clickedTower;
    }
});

// 타워 상점 클릭
document.querySelectorAll('.tower-item').forEach(item => {
    item.addEventListener('click', () => {
        const towerType = item.dataset.tower;
        const cost = towerTypes[towerType].cost;
        
        if (gameState.gold >= cost) {
            document.querySelectorAll('.tower-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            gameState.selectedTower = towerType;
            gameState.placingTower = true;
        } else {
            alert('골드가 부족합니다!');
        }
    });
});

// 웨이브 시작 버튼
document.getElementById('startWave').addEventListener('click', startWave);

// 일시정지 버튼
document.getElementById('pauseBtn').addEventListener('click', () => {
    gameState.paused = !gameState.paused;
    document.getElementById('pauseBtn').textContent = gameState.paused ? '재개' : '일시정지';
});

// 다시 시작 버튼
document.getElementById('restartBtn').addEventListener('click', () => {
    location.reload();
});

// 초기화
initializePath();
updateUI();
gameLoop();

