/**
 * ミニだるまスクラッチ (Mini Daruma Scratch)
 * 縁日風4マススクラッチゲーム
 * 確率等倍設定・カスタム設定パネル対応
 */

// ==========================================
// デフォルト設定（等倍: 1等〜ハズレまで各25%）
// ==========================================
const DEFAULT_SETTINGS = {
  probabilities: {
    4: 25, // 1等 (4体): 25%
    3: 25, // 2等 (3体): 25%
    2: 25, // 3等 (2体): 25%
    1: 25, // ハズレ (1体): 25%
  },
  prizes: {
    4: {
      grade: '🥇 1等！',
      tierClass: 'tier-1',
      message: '奇跡のだるま揃い！最高の福が舞い込みました！',
    },
    3: {
      grade: '🥈 2等！',
      tierClass: 'tier-2',
      message: '素晴らしい！たっぷりの福を引き寄せました！',
    },
    2: {
      grade: '🥉 3等！',
      tierClass: 'tier-3',
      message: 'お見事！嬉しいだるまのご縁がありました！',
    },
    1: {
      grade: '😭 ハズレ！',
      tierClass: 'tier-miss',
      message: 'だるま1体見つかりました！次はきっと大吉！',
    },
  },
};

const STORAGE_KEY = 'daruma_scratch_custom_settings';

// ==========================================
// Web Audio API サウンド効果（外部ファイル不要）
// ==========================================
class SoundController {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // スクラッチ音（短く柔らかな擦れ音）
  playScratch() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.03);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400 + Math.random() * 400, now);
      filter.Q.setValueAtTime(3, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.035);
    } catch {
      // Audio play ignore
    }
  }

  // だるま出現時の「ポンッ！」音
  playPop() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Audio play ignore
    }
  }

  // 何もなし（はずれスタンプ）の控えめなトントン音
  playEmpty() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio play ignore
    }
  }

  // ファンファーレ音（等級に応じたお祝いメロディ）
  playFanfare(darumaCount) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = {
        4: [523.25, 659.25, 783.99, 1046.50, 1318.51], // C5, E5, G5, C6, E6
        3: [523.25, 659.25, 783.99, 1046.50],
        2: [440.00, 554.37, 659.25],
        1: [392.00, 349.23, 329.63], // G4, F4, E4
      }[darumaCount] || [523.25];

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteStart = now + idx * 0.12;

        osc.type = darumaCount === 1 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.25, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.32);
      });
    } catch {
      // Audio play ignore
    }
  }
}

const sounds = new SoundController();

// ==========================================
// ゲーム本体クラス
// ==========================================
class DarumaScratchGame {
  constructor() {
    this.settings = this.loadSettings();

    this.darumaCount = 1;
    this.cardsData = [false, false, false, false];
    this.revealed = [false, false, false, false];
    this.canvases = [];
    this.ctxs = [];
    this.isDrawing = [false, false, false, false];
    this.lastPoints = [null, null, null, null];
    this.scratchStrokeCount = [0, 0, 0, 0];
    this.revealedCount = 0;
    this.isGameOver = false;

    // DOM キャッシュ
    this.scratchCountEl = document.getElementById('scratchCount');
    this.scratchAllBtn = document.getElementById('scratchAllBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.soundIcon = document.getElementById('soundIcon');
    this.resultModal = document.getElementById('resultModal');
    this.darumaCountNum = document.getElementById('darumaCountNum');
    this.resultTitle = document.getElementById('resultTitle');
    this.resultMessage = document.getElementById('resultMessage');
    this.resultDarumaDisplay = document.getElementById('resultDarumaDisplay');
    this.playAgainBtn = document.getElementById('playAgainBtn');
    this.confettiCanvas = document.getElementById('confettiCanvas');

    // 設定モーダル DOM
    this.settingsModal = document.getElementById('settingsModal');
    this.openSettingsBtn = document.getElementById('openSettingsBtn');
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    this.settingsBackdrop = document.getElementById('settingsBackdrop');
    this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
    this.resetDefaultsBtn = document.getElementById('resetDefaultsBtn');

    this.inputTier1Title = document.getElementById('inputTier1Title');
    this.inputTier1Message = document.getElementById('inputTier1Message');
    this.inputTier2Title = document.getElementById('inputTier2Title');
    this.inputTier3Title = document.getElementById('inputTier3Title');
    this.inputTier1MissTitle = document.getElementById('inputTier1MissTitle');

    this.rangeTier4 = document.getElementById('rangeTier4');
    this.numTier4 = document.getElementById('numTier4');
    this.rangeTier3 = document.getElementById('rangeTier3');
    this.numTier3 = document.getElementById('numTier3');
    this.rangeTier2 = document.getElementById('rangeTier2');
    this.numTier2 = document.getElementById('numTier2');
    this.rangeTier1 = document.getElementById('rangeTier1');
    this.numTier1 = document.getElementById('numTier1');

    this.totalRateNum = document.getElementById('totalRateNum');
    this.rateStatusText = document.getElementById('rateStatusText');

    this.presetEqualBtn = document.getElementById('presetEqualBtn');
    this.presetDefaultBtn = document.getElementById('presetDefaultBtn');
    this.presetAllWinBtn = document.getElementById('presetAllWinBtn');

    this.confettiAnimId = null;
    this.confettiParticles = [];

    this.init();
  }

  // ==========================================
  // 設定のロード・保存
  // ==========================================
  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          probabilities: { ...DEFAULT_SETTINGS.probabilities, ...parsed.probabilities },
          prizes: {
            4: { ...DEFAULT_SETTINGS.prizes[4], ...(parsed.prizes && parsed.prizes[4]) },
            3: { ...DEFAULT_SETTINGS.prizes[3], ...(parsed.prizes && parsed.prizes[3]) },
            2: { ...DEFAULT_SETTINGS.prizes[2], ...(parsed.prizes && parsed.prizes[2]) },
            1: { ...DEFAULT_SETTINGS.prizes[1], ...(parsed.prizes && parsed.prizes[1]) },
          },
        };
      }
    } catch {
      // LocalStorage parse error fallback
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  saveSettings(newSettings) {
    this.settings = newSettings;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch {
      // ignore storage error
    }
    this.updatePrizeTableDisplay();
  }

  // 等級早見表の表示を現在の設定に更新
  updatePrizeTableDisplay() {
    const p = this.settings.probabilities;
    const total = (p[4] || 0) + (p[3] || 0) + (p[2] || 0) + (p[1] || 0);

    const calcPercent = (val) => {
      if (total <= 0) return '0%';
      const pct = Math.round((val / total) * 100);
      return `${pct}%`;
    };

    const disp4 = document.getElementById('dispGrade4');
    const disp3 = document.getElementById('dispGrade3');
    const disp2 = document.getElementById('dispGrade2');
    const disp1 = document.getElementById('dispGrade1');

    if (disp4) disp4.textContent = this.settings.prizes[4].grade;
    if (disp3) disp3.textContent = this.settings.prizes[3].grade;
    if (disp2) disp2.textContent = this.settings.prizes[2].grade;
    if (disp1) disp1.textContent = this.settings.prizes[1].grade;

    const rate4 = document.getElementById('dispRate4');
    const rate3 = document.getElementById('dispRate3');
    const rate2 = document.getElementById('dispRate2');
    const rate1 = document.getElementById('dispRate1');

    if (rate4) rate4.textContent = `出現率 ${calcPercent(p[4])}`;
    if (rate3) rate3.textContent = `出現率 ${calcPercent(p[3])}`;
    if (rate2) rate2.textContent = `出現率 ${calcPercent(p[2])}`;
    if (rate1) rate1.textContent = `出現率 ${calcPercent(p[1])}`;
  }

  // ==========================================
  // 初期化
  // ==========================================
  init() {
    // 4枚のキャンバスを取得
    for (let i = 0; i < 4; i++) {
      const canvas = document.getElementById(`canvas-${i}`);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.canvases.push(canvas);
      this.ctxs.push(ctx);
      this.setupCanvasEvents(i);
    }

    // イベントリスナー設定
    this.playAgainBtn.addEventListener('click', () => {
      this.resetGame();
    });

    this.scratchAllBtn.addEventListener('click', () => {
      this.revealAll();
    });

    this.soundToggleBtn.addEventListener('click', () => {
      const isOn = sounds.toggle();
      this.soundIcon.textContent = isOn ? '🔊' : '🔇';
    });

    // 設定パネルのイベント
    this.setupSettingsUI();

    // 等級表の初期更新
    this.updatePrizeTableDisplay();

    // 初回ゲーム開始
    this.resetGame();
  }

  // ==========================================
  // 設定UIイベント
  // ==========================================
  setupSettingsUI() {
    // 開く
    this.openSettingsBtn.addEventListener('click', () => {
      sounds.initContext();
      this.populateSettingsForm();
      this.settingsModal.classList.remove('hidden');
    });

    // 閉じる
    const closeSettings = () => {
      this.settingsModal.classList.add('hidden');
    };
    this.closeSettingsBtn.addEventListener('click', closeSettings);
    this.settingsBackdrop.addEventListener('click', closeSettings);

    // スライダーと数値入力の双方向連動
    const syncPair = (slider, numberInput) => {
      slider.addEventListener('input', () => {
        numberInput.value = slider.value;
        this.updateTotalRateDisplay();
      });
      numberInput.addEventListener('input', () => {
        let val = parseInt(numberInput.value, 10);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(100, val));
        slider.value = val;
        this.updateTotalRateDisplay();
      });
    };

    syncPair(this.rangeTier4, this.numTier4);
    syncPair(this.rangeTier3, this.numTier3);
    syncPair(this.rangeTier2, this.numTier2);
    syncPair(this.rangeTier1, this.numTier1);

    // プリセットボタン
    this.presetEqualBtn.addEventListener('click', () => {
      this.setRates(25, 25, 25, 25);
    });

    this.presetDefaultBtn.addEventListener('click', () => {
      this.setRates(5, 15, 30, 50);
    });

    this.presetAllWinBtn.addEventListener('click', () => {
      this.setRates(100, 0, 0, 0);
    });

    // 保存ボタン
    this.saveSettingsBtn.addEventListener('click', () => {
      const t1Title = this.inputTier1Title.value.trim() || '🥇 1等！';
      const t1Msg = this.inputTier1Message.value.trim() || '奇跡のだるま揃い！最高の福が舞い込みました！';
      const t2Title = this.inputTier2Title.value.trim() || '🥈 2等！';
      const t3Title = this.inputTier3Title.value.trim() || '🥉 3等！';
      const t1MissTitle = this.inputTier1MissTitle.value.trim() || '😭 ハズレ！';

      const p4 = parseInt(this.numTier4.value, 10) || 0;
      const p3 = parseInt(this.numTier3.value, 10) || 0;
      const p2 = parseInt(this.numTier2.value, 10) || 0;
      const p1 = parseInt(this.numTier1.value, 10) || 0;

      // すべて0の場合は25%等倍に補正
      let finalProb = { 4: p4, 3: p3, 2: p2, 1: p1 };
      if (p4 + p3 + p2 + p1 === 0) {
        finalProb = { 4: 25, 3: 25, 2: 25, 1: 25 };
      }

      const updated = {
        probabilities: finalProb,
        prizes: {
          4: { ...this.settings.prizes[4], grade: t1Title, message: t1Msg },
          3: { ...this.settings.prizes[3], grade: t2Title },
          2: { ...this.settings.prizes[2], grade: t3Title },
          1: { ...this.settings.prizes[1], grade: t1MissTitle },
        },
      };

      this.saveSettings(updated);
      closeSettings();
      this.resetGame(); // 新しい設定で即座にプレイ
    });

    // 初期化ボタン
    this.resetDefaultsBtn.addEventListener('click', () => {
      this.saveSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
      this.populateSettingsForm();
      this.resetGame();
    });
  }

  setRates(r4, r3, r2, r1) {
    this.rangeTier4.value = r4;
    this.numTier4.value = r4;

    this.rangeTier3.value = r3;
    this.numTier3.value = r3;

    this.rangeTier2.value = r2;
    this.numTier2.value = r2;

    this.rangeTier1.value = r1;
    this.numTier1.value = r1;

    this.updateTotalRateDisplay();
  }

  populateSettingsForm() {
    this.inputTier1Title.value = this.settings.prizes[4].grade;
    this.inputTier1Message.value = this.settings.prizes[4].message;
    this.inputTier2Title.value = this.settings.prizes[3].grade;
    this.inputTier3Title.value = this.settings.prizes[2].grade;
    this.inputTier1MissTitle.value = this.settings.prizes[1].grade;

    const p = this.settings.probabilities;
    this.setRates(p[4] ?? 25, p[3] ?? 25, p[2] ?? 25, p[1] ?? 25);
  }

  updateTotalRateDisplay() {
    const p4 = parseInt(this.numTier4.value, 10) || 0;
    const p3 = parseInt(this.numTier3.value, 10) || 0;
    const p2 = parseInt(this.numTier2.value, 10) || 0;
    const p1 = parseInt(this.numTier1.value, 10) || 0;
    const sum = p4 + p3 + p2 + p1;

    this.totalRateNum.textContent = `${sum}%`;
    if (sum === 100) {
      this.rateStatusText.textContent = '（適正: 100%）';
      this.rateStatusText.className = 'rate-status-ok';
    } else {
      this.rateStatusText.textContent = `（自動で比率計算されます）`;
      this.rateStatusText.className = 'rate-status-warn';
    }
  }

  // ==========================================
  // だるま抽選ロジック（設定確率に基づく重み付き抽選）
  // ==========================================
  drawDarumaCount() {
    const p = this.settings.probabilities;
    const w4 = Math.max(0, p[4] || 0);
    const w3 = Math.max(0, p[3] || 0);
    const w2 = Math.max(0, p[2] || 0);
    const w1 = Math.max(0, p[1] || 0);
    const total = w4 + w3 + w2 + w1;

    if (total <= 0) return 1; // 最低1体

    const rand = Math.random() * total;
    if (rand < w4) return 4;
    if (rand < w4 + w3) return 3;
    if (rand < w4 + w3 + w2) return 2;
    return 1; // 最低1体保証（0体は禁止）
  }

  // だるまを4つのマスへランダム配置
  shuffleDarumaPositions(count) {
    const validCount = Math.max(1, Math.min(4, count));
    const indices = [0, 1, 2, 3];

    // Fisher-Yates シャッフル
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const result = [false, false, false, false];
    for (let k = 0; k < validCount; k++) {
      result[indices[k]] = true;
    }
    return result;
  }

  // ==========================================
  // ゲームリセット
  // ==========================================
  resetGame() {
    this.closeModal();
    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
      this.confettiAnimId = null;
    }

    this.isGameOver = false;
    this.revealedCount = 0;
    this.scratchCountEl.textContent = '0';

    // 1. 確率設定に従ってだるま数を抽選
    this.darumaCount = this.drawDarumaCount();
    // 2. マスへの配置をランダム化
    this.cardsData = this.shuffleDarumaPositions(this.darumaCount);
    this.revealed = [false, false, false, false];
    this.isDrawing = [false, false, false, false];
    this.lastPoints = [null, null, null, null];
    this.scratchStrokeCount = [0, 0, 0, 0];

    // 各カードの下層コンテンツを生成 & キャンバスを再描画
    for (let i = 0; i < 4; i++) {
      const cardEl = document.getElementById(`card-${i}`);
      cardEl.classList.remove('is-revealed');

      const contentEl = document.getElementById(`content-${i}`);
      contentEl.innerHTML = '';

      const isDaruma = this.cardsData[i];
      if (isDaruma) {
        contentEl.innerHTML = `
          <div class="revealed-daruma-wrap" id="item-${i}">
            <img class="revealed-daruma-img" src="daruma.jpg" alt="ビールだるま" draggable="false" onerror="this.src='daruma.svg'" />
            <span class="revealed-daruma-tag">だるま発見！</span>
          </div>
        `;
      } else {
        contentEl.innerHTML = `
          <div class="revealed-empty-wrap" id="item-${i}">
            <div class="stamp-box">
              <span class="stamp-text">スカ</span>
            </div>
            <span class="revealed-empty-tag">ザンネン！</span>
          </div>
        `;
      }

      this.drawScratchCover(i);
    }
  }

  // ==========================================
  // スクラッチ表面の描画 (Canvas)
  // ==========================================
  drawScratchCover(index) {
    const canvas = this.canvases[index];
    const ctx = this.ctxs[index];
    const w = canvas.width;
    const h = canvas.height;

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    canvas.style.opacity = '1';
    canvas.style.pointerEvents = 'auto';

    // 1. メタリックゴールド風グラデーション
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#E6C875');
    grad.addColorStop(0.3, '#FDF3CD');
    grad.addColorStop(0.5, '#DDB448');
    grad.addColorStop(0.8, '#F3E099');
    grad.addColorStop(1, '#C79A30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. 和柄サークル模様
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    const step = 28;
    for (let x = 0; x <= w + step; x += step) {
      for (let y = 0; y <= h + step; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 3. 飾り枠
    ctx.strokeStyle = '#B38218';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(9, 9, w - 18, h - 18);

    // 4. 中央のスクラッチ案内ラベル
    ctx.fillStyle = '#C52222';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 4, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFE082';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 4, 34, 0, Math.PI * 2);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 224, 130, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px "Zen Maru Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('けずってね', w / 2, h / 2 - 8);

    ctx.fillStyle = '#FFE082';
    ctx.font = '13px sans-serif';
    ctx.fillText('✨ 🪙 ✨', w / 2, h / 2 + 12);

    ctx.fillStyle = '#7A5200';
    ctx.font = 'bold 10px "Zen Maru Gothic", sans-serif';
    ctx.fillText('ここをこする', w / 2, h - 18);
  }

  // ==========================================
  // スクラッチ操作イベント設定
  // ==========================================
  setupCanvasEvents(index) {
    const canvas = this.canvases[index];

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const startDraw = (e) => {
      if (this.revealed[index]) return;
      sounds.initContext();
      this.isDrawing[index] = true;
      this.lastPoints[index] = getPos(e);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      this.scratchAt(index, this.lastPoints[index].x, this.lastPoints[index].y);
    };

    const draw = (e) => {
      if (!this.isDrawing[index] || this.revealed[index]) return;
      const currentPoint = getPos(e);
      this.scratchLine(index, this.lastPoints[index], currentPoint);
      this.lastPoints[index] = currentPoint;

      this.scratchStrokeCount[index]++;
      if (this.scratchStrokeCount[index] % 5 === 0) {
        sounds.playScratch();
      }

      if (this.scratchStrokeCount[index] % 10 === 0) {
        this.checkScratchProgress(index);
      }
    };

    const stopDraw = (e) => {
      if (!this.isDrawing[index]) return;
      this.isDrawing[index] = false;
      this.lastPoints[index] = null;
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      this.checkScratchProgress(index);
    };

    canvas.addEventListener('pointerdown', startDraw);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDraw);
    canvas.addEventListener('pointercancel', stopDraw);
    canvas.addEventListener('pointerleave', stopDraw);
  }

  scratchAt(index, x, y) {
    const ctx = this.ctxs[index];
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  scratchLine(index, p1, p2) {
    const ctx = this.ctxs[index];
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 36;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // ==========================================
  // 50%以上削られたかの判定
  // ==========================================
  checkScratchProgress(index) {
    if (this.revealed[index]) return;

    const canvas = this.canvases[index];
    const ctx = this.ctxs[index];
    const w = canvas.width;
    const h = canvas.height;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    let transparentCount = 0;
    let totalSampled = 0;
    const stride = 4;

    for (let i = 3; i < data.length; i += 4 * stride) {
      totalSampled++;
      if (data[i] < 128) {
        transparentCount++;
      }
    }

    const ratio = transparentCount / totalSampled;
    // 45%以上削られたら自動で完全に開く
    if (ratio >= 0.45) {
      this.revealCard(index);
    }
  }

  // ==========================================
  // マスを開く処理
  // ==========================================
  revealCard(index) {
    if (this.revealed[index]) return;
    this.revealed[index] = true;

    const canvas = this.canvases[index];
    const cardEl = document.getElementById(`card-${index}`);
    const itemEl = document.getElementById(`item-${index}`);
    const isDaruma = this.cardsData[index];

    canvas.style.opacity = '0';
    canvas.style.pointerEvents = 'none';
    cardEl.classList.add('is-revealed');

    if (isDaruma) {
      itemEl.classList.add('pop-anim');
      sounds.playPop();
    } else {
      itemEl.classList.add('stamp-anim');
      sounds.playEmpty();
    }

    this.revealedCount++;
    this.scratchCountEl.textContent = this.revealedCount.toString();

    // 4枚すべてが開くまで最終結果は出さない
    if (this.revealedCount === 4) {
      this.handleGameComplete();
    }
  }

  revealAll() {
    for (let i = 0; i < 4; i++) {
      if (!this.revealed[i]) {
        this.revealCard(i);
      }
    }
  }

  // ==========================================
  // 4つすべて開いた後の最終結果表示
  // ==========================================
  handleGameComplete() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    setTimeout(() => {
      this.showResultModal();
    }, 550);
  }

  showResultModal() {
    const count = this.darumaCount;
    const prize = this.settings.prizes[count] || DEFAULT_SETTINGS.prizes[count];

    // だるま総数表示
    this.darumaCountNum.textContent = count.toString();

    // 等級タイトル表示（設定した文言が反映）
    this.resultTitle.textContent = prize.grade;
    this.resultTitle.className = `result-title ${prize.tierClass || 'tier-1'}`;

    // メッセージ表示（設定したメッセージの改行を反映）
    const msg = (prize.message || '').replace(/<br\s*\/?>/gi, '\n');
    this.resultMessage.textContent = msg;

    // 出現しただるまのミニアイコン
    this.resultDarumaDisplay.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const img = document.createElement('img');
      img.src = 'daruma.jpg';
      img.alt = 'ビールだるま';
      img.className = 'mini-result-daruma';
      img.onerror = function() { this.src = 'daruma.svg'; };
      this.resultDarumaDisplay.appendChild(img);
    }

    sounds.playFanfare(count);
    this.resultModal.classList.remove('hidden');

    if (count >= 2) {
      this.startConfetti(count === 4 ? 60 : 35);
    }
  }

  closeModal() {
    this.resultModal.classList.add('hidden');
    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
      this.confettiAnimId = null;
    }
  }

  // ==========================================
  // 紙吹雪アニメーション (Canvas)
  // ==========================================
  startConfetti(count = 40) {
    const canvas = this.confettiCanvas;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 360;
    canvas.height = rect.height || 420;

    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#FBBF24'];
    this.confettiParticles = [];

    for (let i = 0; i < count; i++) {
      this.confettiParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 8,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of this.confettiParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;

        if (p.y > canvas.height + 20) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      this.confettiAnimId = requestAnimationFrame(animate);
    };

    animate();
  }
}

// ページロード時にゲーム起動
window.addEventListener('DOMContentLoaded', () => {
  new DarumaScratchGame();
});
