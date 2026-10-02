/**
 * 网页版 Mastermind —— 规则对齐 CSSE7030 Assignment 1
 * 黑(B)=数字对且位置对；白(W)=数字对但位置不对
 */
(function () {
  const NUM = 5;
  const MAX_ATTEMPTS = 10;
  const MIN_HINT_ATTEMPTS = 3;
  const MAX_HINTS = 3;

  function generateKey() {
    return Array.from({ length: NUM }, () => String(1 + Math.floor(Math.random() * 5)));
  }

  function provideFeedback(key, guess) {
    const black = [];
    const usedKey = Array(NUM).fill(false);
    const usedGuess = Array(NUM).fill(false);

    for (let i = 0; i < NUM; i += 1) {
      if (guess[i] === key[i]) {
        black.push('B');
        usedKey[i] = true;
        usedGuess[i] = true;
      }
    }

    const white = [];
    for (let i = 0; i < NUM; i += 1) {
      if (usedGuess[i]) continue;
      for (let j = 0; j < NUM; j += 1) {
        if (!usedKey[j] && guess[i] === key[j]) {
          white.push('W');
          usedKey[j] = true;
          break;
        }
      }
    }
    return black.concat(white);
  }

  function parseGuess(raw) {
    const cleaned = raw.trim().replace(/\s+/g, '');
    if (!cleaned) return { ok: false, message: '请输入 5 个数字，用逗号分隔，例如 1,2,3,4,5' };

    const parts = cleaned.includes(',')
      ? cleaned.split(',')
      : cleaned.length === NUM
        ? cleaned.split('')
        : null;

    if (!parts || parts.length !== NUM) {
      return { ok: false, message: '格式不对：需要正好 5 个数字（1–5），例如 1,2,3,4,5' };
    }
    if (parts.some((p) => !['1', '2', '3', '4', '5'].includes(p))) {
      return { ok: false, message: '只能使用数字 1、2、3、4、5' };
    }
    return { ok: true, guess: parts };
  }

  function init(root) {
    const boardEl = root.querySelector('[data-mm-board]');
    const keyEl = root.querySelector('[data-mm-key]');
    const msgEl = root.querySelector('[data-mm-msg]');
    const form = root.querySelector('[data-mm-form]');
    const input = root.querySelector('[data-mm-input]');
    const metaEl = root.querySelector('[data-mm-meta]');

    let key = [];
    let attempt = 0;
    let usedHints = 0;
    let rows = [];
    let over = false;

    const setMsg = (text, tone = '') => {
      msgEl.textContent = text;
      msgEl.dataset.tone = tone;
    };

    const renderKey = () => {
      const cells = key.map((n, i) => (i < usedHints ? n : '?'));
      keyEl.innerHTML = cells
        .map((c) => `<span class="mm-pill${c === '?' ? ' is-hidden' : ' is-revealed'}">${c}</span>`)
        .join('');
    };

    const renderBoard = () => {
      const visible = rows
        .map((row, i) => ({ row, i }))
        .filter(({ row, i }) => row.guess || row.active || i === 0);

      boardEl.innerHTML = visible
        .map(({ row, i }) => {
          const guesses = row.guess
            ? row.guess.map((n) => `<span class="mm-pill">${n}</span>`).join('')
            : Array(NUM).fill('<span class="mm-pill is-empty">·</span>').join('');
          const feedback = row.feedback
            ? row.feedback
                .map((f) => `<span class="mm-fb mm-fb--${f.toLowerCase()}">${f}</span>`)
                .join('')
            : Array(NUM).fill('<span class="mm-fb is-empty">·</span>').join('');
          return `
            <div class="mm-row${row.active ? ' is-active' : ''}">
              <span class="mm-row__n">${i + 1}</span>
              <div class="mm-row__guess">${guesses}</div>
              <div class="mm-row__fb">${feedback}</div>
            </div>`;
        })
        .join('');
    };

    const renderMeta = () => {
      metaEl.textContent = `第 ${Math.min(attempt + 1, MAX_ATTEMPTS)} / ${MAX_ATTEMPTS} 次 · 提示 ${usedHints} / ${MAX_HINTS}`;
    };

    const startGame = () => {
      key = generateKey();
      attempt = 0;
      usedHints = 0;
      over = false;
      rows = Array.from({ length: MAX_ATTEMPTS }, (_, i) => ({
        guess: null,
        feedback: null,
        active: i === 0,
      }));
      input.disabled = false;
      form.querySelector('[data-mm-submit]').disabled = false;
      setMsg('猜一组 5 个数字（每个是 1–5）。B = 数字和位置都对，W = 数字对但位置不对。');
      renderKey();
      renderBoard();
      renderMeta();
      input.value = '';
      // 不在开局时 focus：否则打开文章会自动滚到小游戏
    };

    const endGame = (won) => {
      over = true;
      input.disabled = true;
      form.querySelector('[data-mm-submit]').disabled = true;
      rows.forEach((r) => {
        r.active = false;
      });
      usedHints = NUM;
      renderKey();
      renderBoard();
      if (won) {
        setMsg(`恭喜！你用了 ${attempt} 次猜中了密钥 ${key.join(' ')}。`, 'win');
      } else {
        setMsg(`本局结束。密钥是 ${key.join(' ')}。点「再来一局」继续。`, 'lose');
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (over) return;

      const parsed = parseGuess(input.value);
      if (!parsed.ok) {
        setMsg(parsed.message, 'error');
        return;
      }

      const feedback = provideFeedback(key, parsed.guess);
      rows[attempt].guess = parsed.guess;
      rows[attempt].feedback = feedback;
      rows[attempt].active = false;
      attempt += 1;

      if (feedback.length === NUM && feedback.every((f) => f === 'B')) {
        renderBoard();
        renderMeta();
        endGame(true);
        return;
      }

      if (attempt >= MAX_ATTEMPTS) {
        renderBoard();
        renderMeta();
        endGame(false);
        return;
      }

      rows[attempt].active = true;
      input.value = '';
      setMsg('继续猜。需要提示的话，点右上角的「提示」。');
      renderBoard();
      renderMeta();
      input.focus();
    });

    root.querySelector('[data-mm-hint]').addEventListener('click', () => {
      if (over) return;
      if (attempt < MIN_HINT_ATTEMPTS) {
        setMsg(`至少先猜 ${MIN_HINT_ATTEMPTS} 次，才能使用提示。`, 'error');
        return;
      }
      if (usedHints >= MAX_HINTS) {
        setMsg('提示已经用完了。', 'error');
        return;
      }
      usedHints += 1;
      renderKey();
      renderMeta();
      setMsg(`提示：密钥的前 ${usedHints} 位已经揭开。`);
    });

    root.querySelector('[data-mm-help]').addEventListener('click', () => {
      setMsg(
        '输入 5 个 1–5 的数字，可用逗号（1,2,3,4,5）或连写（12345）。B=位置正确，W=数字正确但位置不对。猜满 3 次后可要提示，最多 3 次提示。'
      );
    });

    root.querySelector('[data-mm-restart]').addEventListener('click', startGame);

    startGame();
  }

  document.querySelectorAll('[data-mastermind]').forEach((root) => {
    if (root.dataset.mmReady === '1') return;
    root.dataset.mmReady = '1';
    init(root);
  });
})();
