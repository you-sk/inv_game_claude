class SpaceInvaders {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // ゲーム状態
        this.gameState = 'title'; // 'title', 'playing', 'gameOver'
        this.score = 0;
        this.highScore = localStorage.getItem('highScore') || 0;
        this.lives = 3;
        
        // ゲーム要素
        this.player = null;
        this.invaders = [];
        this.bullets = [];
        this.invaderBullets = [];
        this.barriers = [];
        this.ufo = null;
        
        // ボーナスライフ
        this.nextBonusScore = 1000;
        
        // キー入力
        this.keys = {};
        
        // タイミング
        this.lastTime = 0;
        this.invaderMoveTimer = 0;
        this.invaderShootTimer = 0;
        this.ufoTimer = 0;
        
        // サウンド
        this.audioContext = null;
        this.sounds = {};
        this.invaderSoundStep = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupAudio();
        this.setupPlayer();
        this.setupInvaders();
        this.setupBarriers();
        this.gameLoop();
    }
    
    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playSound(type) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        switch (type) {
            case 'shoot':
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.1);
                break;
                
            case 'invaderHit':
                oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.2);
                break;
                
            case 'playerHit':
                oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);
                gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.5);
                break;
                
            case 'ufoHit':
                oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.3);
                break;
                
            case 'invaderMove':
                const frequencies = [220, 196, 174, 155]; // 4段階のピッチ
                const freq = frequencies[this.invaderSoundStep % 4];
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.1);
                this.invaderSoundStep++;
                break;
                
            case 'gameOver':
                oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 1);
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 1);
                break;
        }
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // ゲーム開始
            if (e.code === 'Enter' && this.gameState === 'title') {
                // Audio Contextを再初期化（ユーザージェスチャが必要）
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                this.startGame();
            }
            
            // リトライ
            if (e.code === 'Enter' && this.gameState === 'gameOver') {
                this.resetGame();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    
    setupPlayer() {
        this.player = {
            x: this.canvas.width / 2 - 16,
            y: this.canvas.height - 80,
            width: 32,
            height: 16,
            speed: 4,
            canShoot: true
        };
    }
    
    setupInvaders() {
        this.invaders = [];
        const rows = 5;
        const cols = 11;
        const invaderWidth = 32;
        const invaderHeight = 24;
        const spacing = 40;
        const startX = 100;
        const startY = 100;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                let type;
                let points;
                
                if (row === 0) {
                    type = 'squid';
                    points = 30;
                } else if (row <= 2) {
                    type = 'crab';
                    points = 20;
                } else {
                    type = 'octopus';
                    points = 10;
                }
                
                this.invaders.push({
                    x: startX + col * spacing,
                    y: startY + row * spacing,
                    width: invaderWidth,
                    height: invaderHeight,
                    type: type,
                    points: points,
                    alive: true,
                    animFrame: 0
                });
            }
        }
        
        this.invaderDirection = 1;
        this.invaderDropDistance = 20;
    }
    
    setupBarriers() {
        this.barriers = [];
        const barrierWidth = 80;
        const barrierHeight = 60;
        const barrierY = this.canvas.height - 200;
        
        for (let i = 0; i < 4; i++) {
            const barrierX = 120 + i * 140;
            const blocks = this.createBarrierBlocks(barrierX, barrierY);
            this.barriers.push({
                x: barrierX,
                y: barrierY,
                width: barrierWidth,
                height: barrierHeight,
                blocks: blocks
            });
        }
    }
    
    createBarrierBlocks(x, y) {
        // スペースインベーダーのバリア形状
        const blocks = [];
        const blockSize = 4; // サイズを大きくして衝突しやすくする
        
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 20; col++) {
                // バリアの形状を定義
                if (this.isBarrierBlock(row, col)) {
                    blocks.push({
                        x: x + col * blockSize,
                        y: y + row * blockSize,
                        size: blockSize,
                        exists: true
                    });
                }
            }
        }
        
        return blocks;
    }
    
    isBarrierBlock(row, col) {
        // より正確なスペースインベーダーのバリア形状
        // 上部の平らな部分
        if (row < 2) return true;
        
        // 中央上部のくぼみ
        if (row >= 2 && row < 4 && col >= 7 && col <= 12) return false;
        
        // 中央部分
        if (row >= 2 && row < 8) return true;
        
        // 下部の脚部分
        if (row >= 8 && row < 12) {
            // 外側の脚
            if ((col >= 0 && col <= 4) || (col >= 15 && col <= 19)) return true;
            // 中央のくぼみ（プレイヤーが隠れる場所）
            if (col >= 6 && col <= 13) return false;
            return true;
        }
        
        // 脚の下部をより細く
        if (row >= 12 && row < 15) {
            if ((col >= 0 && col <= 2) || (col >= 17 && col <= 19)) return true;
        }
        
        return false;
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.nextBonusScore = 1000;
        this.setupPlayer();
        this.setupInvaders();
        this.setupBarriers();
        this.bullets = [];
        this.invaderBullets = [];
        this.ufo = null;
    }
    
    resetGame() {
        this.gameState = 'title';
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        this.updatePlayer();
        this.updateBullets();
        this.updateInvaders(deltaTime);
        this.updateInvaderBullets();
        this.updateUFO(deltaTime);
        this.checkCollisions();
        
        // ゲームオーバー条件
        if (this.lives <= 0) {
            this.gameOver();
        }
        
        // 勝利条件
        if (this.invaders.filter(inv => inv.alive).length === 0) {
            this.nextWave();
        }
    }
    
    updatePlayer() {
        // 左右移動
        if ((this.keys['ArrowLeft'] || this.keys['KeyA']) && this.player.x > 0) {
            this.player.x -= this.player.speed;
        }
        if ((this.keys['ArrowRight'] || this.keys['KeyD']) && this.player.x < this.canvas.width - this.player.width) {
            this.player.x += this.player.speed;
        }
        
        // 弾発射
        if ((this.keys['Space'] || this.keys['KeyJ']) && this.player.canShoot) {
            this.shootBullet();
            this.player.canShoot = false;
        }
        
        // 弾が画面外に出たら再発射可能
        if (this.bullets.length === 0) {
            this.player.canShoot = true;
        }
    }
    
    shootBullet() {
        this.bullets.push({
            x: this.player.x + this.player.width / 2 - 2,
            y: this.player.y,
            width: 4,
            height: 8,
            speed: 8
        });
        this.playSound('shoot');
    }
    
    updateBullets() {
        // プレイヤーの弾
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.y -= bullet.speed;
            
            if (bullet.y < 0) {
                this.bullets.splice(i, 1);
                this.player.canShoot = true;
            }
        }
    }
    
    updateInvaders(deltaTime) {
        this.invaderMoveTimer += deltaTime;
        
        // インベーダーの移動速度（残り数に応じて変化）
        const aliveInvaders = this.invaders.filter(inv => inv.alive);
        const moveInterval = Math.max(200, 1000 - (55 - aliveInvaders.length) * 15);
        
        if (this.invaderMoveTimer >= moveInterval) {
            this.moveInvaders();
            this.invaderMoveTimer = 0;
        }
        
        // インベーダーの弾発射
        this.invaderShootTimer += deltaTime;
        if (this.invaderShootTimer >= 800) {
            this.invaderShoot();
            this.invaderShootTimer = 0;
        }
    }
    
    moveInvaders() {
        let shouldDrop = false;
        
        // 端に到達したかチェック
        for (const invader of this.invaders) {
            if (!invader.alive) continue;
            
            if ((this.invaderDirection > 0 && invader.x >= this.canvas.width - 50) ||
                (this.invaderDirection < 0 && invader.x <= 10)) {
                shouldDrop = true;
                break;
            }
        }
        
        if (shouldDrop) {
            // 下に移動して方向転換
            for (const invader of this.invaders) {
                if (invader.alive) {
                    invader.y += this.invaderDropDistance;
                }
            }
            this.invaderDirection *= -1;
        } else {
            // 横移動
            for (const invader of this.invaders) {
                if (invader.alive) {
                    invader.x += this.invaderDirection * 20;
                    invader.animFrame = (invader.animFrame + 1) % 2;
                }
            }
        }
        
        // インベーダー移動音
        this.playSound('invaderMove');
        
        // インベーダーがプレイヤーラインに到達
        for (const invader of this.invaders) {
            if (invader.alive && invader.y >= this.player.y - 20) {
                this.gameOver();
                break;
            }
        }
    }
    
    invaderShoot() {
        const aliveInvaders = this.invaders.filter(inv => inv.alive);
        if (aliveInvaders.length === 0) return;
        
        // ランダムなインベーダーから弾発射
        const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
        
        this.invaderBullets.push({
            x: shooter.x + shooter.width / 2 - 2,
            y: shooter.y + shooter.height,
            width: 4,
            height: 8,
            speed: 3,
            type: Math.floor(Math.random() * 3) // 3種類の弾
        });
    }
    
    updateInvaderBullets() {
        for (let i = this.invaderBullets.length - 1; i >= 0; i--) {
            const bullet = this.invaderBullets[i];
            bullet.y += bullet.speed;
            
            if (bullet.y > this.canvas.height) {
                this.invaderBullets.splice(i, 1);
            }
        }
    }
    
    updateUFO(deltaTime) {
        this.ufoTimer += deltaTime;
        
        // UFO出現のタイミング（15-25秒間隔でランダム）
        if (!this.ufo && this.ufoTimer >= 15000 + Math.random() * 10000) {
            this.spawnUFO();
            this.ufoTimer = 0;
        }
        
        // UFO移動
        if (this.ufo) {
            this.ufo.x += this.ufo.direction * this.ufo.speed;
            
            // 画面外に出たら削除
            if (this.ufo.x < -50 || this.ufo.x > this.canvas.width + 50) {
                this.ufo = null;
            }
        }
    }
    
    spawnUFO() {
        const direction = Math.random() < 0.5 ? 1 : -1;
        const startX = direction > 0 ? -40 : this.canvas.width + 40;
        
        this.ufo = {
            x: startX,
            y: 50,
            width: 40,
            height: 20,
            speed: 2,
            direction: direction,
            points: [50, 100, 150, 300][Math.floor(Math.random() * 4)]
        };
    }
    
    checkCollisions() {
        // プレイヤーの弾 vs インベーダー
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            let bulletHit = false;
            
            for (const invader of this.invaders) {
                if (!invader.alive) continue;
                
                if (this.isColliding(bullet, invader)) {
                    this.bullets.splice(i, 1);
                    invader.alive = false;
                    this.score += invader.points;
                    this.checkBonusLife();
                    this.player.canShoot = true;
                    this.playSound('invaderHit');
                    bulletHit = true;
                    break;
                }
            }
            
            // プレイヤーの弾 vs UFO
            if (!bulletHit && this.ufo) {
                if (this.isColliding(bullet, this.ufo)) {
                    this.bullets.splice(i, 1);
                    this.score += this.ufo.points;
                    this.checkBonusLife();
                    this.ufo = null;
                    this.player.canShoot = true;
                    this.playSound('ufoHit');
                    bulletHit = true;
                }
            }
            
            // プレイヤーの弾 vs バリア
            if (!bulletHit) {
                for (const barrier of this.barriers) {
                    for (const block of barrier.blocks) {
                        if (block.exists && this.isColliding(bullet, block)) {
                            this.bullets.splice(i, 1);
                            block.exists = false; // まず命中したブロックを削除
                            // 周囲のブロックも削除
                            this.destroyBarrierBlocks(barrier, block.x + block.size/2, block.y + block.size/2, 2);
                            this.player.canShoot = true;
                            bulletHit = true;
                            break;
                        }
                    }
                    if (bulletHit) break;
                }
            }
        }
        
        // インベーダーの弾 vs プレイヤー
        for (let i = this.invaderBullets.length - 1; i >= 0; i--) {
            const bullet = this.invaderBullets[i];
            let bulletHit = false;
            
            if (this.isColliding(bullet, this.player)) {
                this.invaderBullets.splice(i, 1);
                this.lives--;
                this.playSound('playerHit');
                bulletHit = true;
                // プレイヤー爆発エフェクト（後で実装）
            }
            
            // インベーダーの弾 vs バリア
            if (!bulletHit) {
                for (const barrier of this.barriers) {
                    for (const block of barrier.blocks) {
                        if (block.exists && this.isColliding(bullet, block)) {
                            this.invaderBullets.splice(i, 1);
                            block.exists = false; // まず命中したブロックを削除
                            // 周囲のブロックも削除
                            this.destroyBarrierBlocks(barrier, block.x + block.size/2, block.y + block.size/2, 3);
                            bulletHit = true;
                            break;
                        }
                    }
                    if (bulletHit) break;
                }
            }
        }
    }
    
    destroyBarrierBlocks(barrier, hitX, hitY, radius) {
        // 破壊される範囲のブロックを削除
        for (const block of barrier.blocks) {
            if (block.exists) {
                const distance = Math.sqrt(
                    Math.pow(block.x - hitX, 2) + Math.pow(block.y - hitY, 2)
                );
                if (distance <= radius * block.size) {
                    block.exists = false;
                }
            }
        }
    }
    
    isColliding(rect1, rect2) {
        const rect1Width = rect1.width || rect1.size || 0;
        const rect1Height = rect1.height || rect1.size || 0;
        const rect2Width = rect2.width || rect2.size || 0;
        const rect2Height = rect2.height || rect2.size || 0;
        
        return rect1.x < rect2.x + rect2Width &&
               rect1.x + rect1Width > rect2.x &&
               rect1.y < rect2.y + rect2Height &&
               rect1.y + rect1Height > rect2.y;
    }
    
    checkBonusLife() {
        if (this.score >= this.nextBonusScore) {
            this.lives++;
            this.nextBonusScore += 1000; // 次のボーナスは1000点後
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.playSound('gameOver');
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
        }
    }
    
    nextWave() {
        // 新しいウェーブを開始
        this.setupInvaders();
        this.bullets = [];
        this.invaderBullets = [];
    }
    
    render() {
        // 画面クリア
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        switch (this.gameState) {
            case 'title':
                this.renderTitle();
                break;
            case 'playing':
                this.renderGame();
                break;
            case 'gameOver':
                this.renderGameOver();
                break;
        }
    }
    
    renderTitle() {
        this.ctx.fillStyle = '#00FF00';
        this.ctx.font = '48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SPACE INVADERS', this.canvas.width / 2, 200);
        
        this.ctx.font = '24px monospace';
        this.ctx.fillText('PRESS ENTER TO START', this.canvas.width / 2, 300);
        
        this.ctx.font = '16px monospace';
        this.ctx.fillText('© 1978 TAITO CORPORATION', this.canvas.width / 2, 500);
        
        this.ctx.fillText(`HIGH SCORE: ${this.highScore}`, this.canvas.width / 2, 400);
    }
    
    renderGame() {
        // UI表示
        this.renderUI();
        
        // プレイヤー
        this.renderPlayer();
        
        // インベーダー
        this.renderInvaders();
        
        // 弾
        this.renderBullets();
        
        // バリア
        this.renderBarriers();
        
        // UFO
        if (this.ufo) {
            this.renderUFO();
        }
    }
    
    renderUI() {
        this.ctx.fillStyle = '#00FF00';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`SCORE: ${this.score}`, 20, 30);
        this.ctx.fillText(`HIGH SCORE: ${this.highScore}`, 300, 30);
        this.ctx.fillText(`LIVES: ${this.lives}`, 600, 30);
    }
    
    renderPlayer() {
        this.ctx.fillStyle = '#00FF00';
        this.drawPlayer(this.player.x, this.player.y);
    }
    
    drawPlayer(x, y) {
        // 簡単なプレイヤー形状
        this.ctx.fillRect(x + 12, y, 8, 4);
        this.ctx.fillRect(x + 8, y + 4, 16, 4);
        this.ctx.fillRect(x + 4, y + 8, 24, 4);
        this.ctx.fillRect(x, y + 12, 32, 4);
    }
    
    renderInvaders() {
        for (const invader of this.invaders) {
            if (!invader.alive) continue;
            
            this.ctx.fillStyle = '#00FF00';
            this.drawInvader(invader.x, invader.y, invader.type, invader.animFrame);
        }
    }
    
    drawInvader(x, y, type, frame) {
        // 簡単なインベーダー形状（タイプとフレームに応じて変更）
        this.ctx.fillRect(x + 8, y, 16, 8);
        this.ctx.fillRect(x + 4, y + 8, 24, 8);
        this.ctx.fillRect(x, y + 16, 32, 8);
        
        if (frame === 0) {
            this.ctx.fillRect(x, y + 24, 8, 4);
            this.ctx.fillRect(x + 24, y + 24, 8, 4);
        } else {
            this.ctx.fillRect(x + 4, y + 24, 8, 4);
            this.ctx.fillRect(x + 20, y + 24, 8, 4);
        }
    }
    
    renderBullets() {
        this.ctx.fillStyle = '#00FF00';
        
        // プレイヤーの弾
        for (const bullet of this.bullets) {
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        }
        
        // インベーダーの弾
        for (const bullet of this.invaderBullets) {
            this.drawInvaderBullet(bullet.x, bullet.y, bullet.type);
        }
    }
    
    drawInvaderBullet(x, y, type) {
        // 弾のタイプに応じて形状を変える
        switch (type) {
            case 0: // 通常の弾
                this.ctx.fillRect(x, y, 4, 8);
                break;
            case 1: // 太い弾
                this.ctx.fillRect(x - 1, y, 6, 8);
                break;
            case 2: // 斜めの弾
                this.ctx.fillRect(x, y, 4, 2);
                this.ctx.fillRect(x + 1, y + 2, 2, 2);
                this.ctx.fillRect(x, y + 4, 4, 2);
                this.ctx.fillRect(x + 1, y + 6, 2, 2);
                break;
        }
    }
    
    renderBarriers() {
        this.ctx.fillStyle = '#00FF00';
        
        for (const barrier of this.barriers) {
            for (const block of barrier.blocks) {
                if (block.exists) {
                    this.ctx.fillRect(block.x, block.y, block.size, block.size);
                }
            }
        }
    }
    
    renderUFO() {
        this.ctx.fillStyle = '#FF0000';
        this.drawUFO(this.ufo.x, this.ufo.y);
    }
    
    drawUFO(x, y) {
        // UFOの形状
        this.ctx.fillRect(x + 8, y, 24, 8);
        this.ctx.fillRect(x + 4, y + 8, 32, 4);
        this.ctx.fillRect(x, y + 12, 40, 8);
        this.ctx.fillRect(x + 6, y + 16, 28, 4);
    }
    
    renderGameOver() {
        this.ctx.fillStyle = '#00FF00';
        this.ctx.font = '48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, 200);
        
        this.ctx.font = '24px monospace';
        this.ctx.fillText(`FINAL SCORE: ${this.score}`, this.canvas.width / 2, 300);
        
        if (this.score === this.highScore) {
            this.ctx.fillText('NEW HIGH SCORE!', this.canvas.width / 2, 350);
        }
        
        this.ctx.fillText('PRESS ENTER TO RESTART', this.canvas.width / 2, 450);
    }
    
    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// ゲーム開始
window.addEventListener('load', () => {
    new SpaceInvaders();
});