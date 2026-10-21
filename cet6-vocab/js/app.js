/* ===== 六级词汇通 主逻辑 ===== */
(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));

  const KNOWN_KEY = 'cet6_known_v1';
  const QUIZ_KEY = 'cet6_quiz_v1';

  const load = function (k, d) {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v === null || v === undefined ? d : v;
    } catch (e) { return d; }
  };
  const save = function (k, v) { localStorage.setItem(k, JSON.stringify(v)); };

  let known = new Set(load(KNOWN_KEY, []));
  const saveKnown = function () { save(KNOWN_KEY, Array.from(known)); };

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  /* ===== 标签页切换 ===== */
  $$('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.nav-btn').forEach(function (x) { x.classList.toggle('active', x === btn); });
      $$('.tab').forEach(function (t) { t.classList.toggle('active', t.id === 'tab-' + btn.dataset.tab); });
      if (btn.dataset.tab === 'stats') renderStats();
    });
  });

  /* ===== 词汇浏览 ===== */
  let letterFilter = 'all';

  function buildLetterBar() {
    const bar = $('#letterBar');
    const letters = ['all'].concat('abcdefghijklmnopqrstuvwxyz'.split(''));
    bar.innerHTML = '';
    letters.forEach(function (l) {
      const chip = document.createElement('button');
      chip.className = 'letter-chip' + (l === 'all' ? ' active' : '');
      chip.textContent = l === 'all' ? '全部' : l.toUpperCase();
      chip.dataset.letter = l;
      chip.addEventListener('click', function () {
        letterFilter = l;
        $$('.letter-chip', bar).forEach(function (c) { c.classList.toggle('active', c === chip); });
        renderBrowse();
      });
      bar.appendChild(chip);
    });
  }

  function renderBrowse() {
    const q = $('#searchInput').value.trim().toLowerCase();
    const list = $('#wordList');
    const items = [];
    for (let i = 0; i < WORDS.length; i++) {
      const w = WORDS[i];
      if (letterFilter !== 'all' && w[0].charAt(0).toLowerCase() !== letterFilter) continue;
      if (q && w[0].toLowerCase().indexOf(q) === -1 && w[2].indexOf(q) === -1) continue;
      items.push(i);
    }
    $('#browseCount').textContent = '共 ' + items.length + ' 个单词';
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<div class="empty-tip">没有找到匹配的单词 😅</div>';
      return;
    }
    items.forEach(function (i) {
      const w = WORDS[i];
      const isKnown = known.has(w[0]);
      const card = document.createElement('div');
      card.className = 'word-card';
      const head = document.createElement('div');
      head.className = 'word-head';
      head.innerHTML =
        '<span class="word-title"></span>' +
        '<span class="word-phon"></span>' +
        '<button class="icon-btn known-btn" title="标记掌握"></button>' +
        '<button class="icon-btn speak-btn" title="朗读">🔊</button>';
      head.querySelector('.word-title').textContent = w[0];
      head.querySelector('.word-phon').textContent = w[1] || '';
      const kbtn = head.querySelector('.known-btn');
      kbtn.textContent = isKnown ? '✔ 已掌握' : '☆ 未掌握';
      if (isKnown) kbtn.classList.add('known');
      card.appendChild(head);

      const mean = document.createElement('div');
      mean.className = 'word-mean';
      mean.textContent = w[2];
      card.appendChild(mean);

      if (w[3]) {
        const ex = document.createElement('div');
        ex.className = 'word-ex';
        const en = document.createElement('span');
        en.className = 'ex-en';
        en.textContent = w[3];
        ex.appendChild(en);
        if (w[4]) {
          const zh = document.createElement('span');
          zh.className = 'ex-zh';
          zh.textContent = w[4];
          ex.appendChild(zh);
        }
        card.appendChild(ex);
      }
      list.appendChild(card);
    });
  }

  $('#wordList').addEventListener('click', function (e) {
    const btn = e.target.closest('.icon-btn');
    if (!btn) return;
    const card = btn.closest('.word-card');
    const word = card.querySelector('.word-title').textContent;
    if (btn.classList.contains('speak-btn')) {
      speak(word);
    } else if (btn.classList.contains('known-btn')) {
      if (known.has(word)) known.delete(word); else known.add(word);
      saveKnown();
      renderBrowse();
    }
  });
  $('#searchInput').addEventListener('input', renderBrowse);

  /* ===== 闪卡 ===== */
  let deck = [], deckIdx = 0, flipped = false, roundKnown = 0;

  function flashCurrent() { return deck.length && deckIdx < deck.length ? WORDS[deck[deckIdx]] : null; }

  function renderFlash() {
    const area = $('#flashArea');
    const cur = flashCurrent();
    if (!cur) {
      area.hidden = true;
      const res = $('#flashResult');
      res.hidden = false;
      res.innerHTML =
        '<h2>🎉 本轮完成！</h2>' +
        '<p>本轮共复习 <b>' + deck.length + '</b> 个单词，其中 <b>' + roundKnown + '</b> 个标记为认识。</p>' +
        '<p style="color:var(--text-light);margin:8px 0 18px;">累计已掌握 <b>' + known.size + '</b> / ' + WORDS.length + ' 个单词</p>';
      const back = document.createElement('button');
      back.className = 'btn primary';
      back.textContent = '返回设置';
      back.addEventListener('click', function () {
        res.hidden = true;
        $('#flashSetup').hidden = false;
      });
      res.appendChild(back);
      return;
    }
    flipped = false;
    $('#flashInner').classList.remove('flipped');
    $('#flashWord').textContent = cur[0];
    $('#flashPhon').textContent = cur[1] || '';
    $('#flashMean').textContent = cur[2];
    $('#flashEx').innerHTML = cur[3] ? ('<div>' + cur[3] + '</div>' + (cur[4] ? '<div>' + cur[4] + '</div>' : '')) : '';
    $('#flashText').textContent = '第 ' + (deckIdx + 1) + ' / ' + deck.length + ' 张 · 已掌握 ' + known.size + ' 词';
    $('#flashProgress').style.width = (deckIdx / deck.length * 100) + '%';
  }

  function flashNext(mark) {
    const cur = flashCurrent();
    if (!cur) return;
    if (mark === 'known') { known.add(cur[0]); roundKnown++; }
    if (mark === 'unknown') { known.delete(cur[0]); }
    saveKnown();
    deckIdx++;
    $('#flashProgress').style.width = (deckIdx / deck.length * 100) + '%';
    renderFlash();
  }

  $('#flashStart').addEventListener('click', function () {
    const mode = $('#flashMode').value;
    let pool = WORDS.map(function (_, i) { return i; });
    if (mode === 'unknown') pool = pool.filter(function (i) { return !known.has(WORDS[i][0]); });
    shuffle(pool);
    if (mode === 'random50') pool = pool.slice(0, 50);
    if (!pool.length) {
      alert('🎊 太棒了！该范围内没有需要学习的单词。');
      return;
    }
    deck = pool; deckIdx = 0; roundKnown = 0;
    $('#flashSetup').hidden = true;
    $('#flashResult').hidden = true;
    $('#flashArea').hidden = false;
    renderFlash();
  });
  $('#flashCard').addEventListener('click', function () {
    flipped = !flipped;
    $('#flashInner').classList.toggle('flipped', flipped);
  });
  $('#flashFlip').addEventListener('click', function () {
    flipped = !flipped;
    $('#flashInner').classList.toggle('flipped', flipped);
  });
  $('#flashSpeak').addEventListener('click', function () {
    const cur = flashCurrent();
    if (cur) speak(cur[0]);
  });
  $('#flashKnown').addEventListener('click', function () { flashNext('known'); });
  $('#flashUnknown').addEventListener('click', function () { flashNext('unknown'); });

  /* ===== 测验 ===== */
  let quiz = null;

  function pickDistractors(field, answer, n) {
    const set = new Set([answer]);
    const out = [];
    let guard = 0;
    while (out.length < n && guard < 500) {
      guard++;
      const cand = WORDS[Math.floor(Math.random() * WORDS.length)][field];
      if (!set.has(cand)) { set.add(cand); out.push(cand); }
    }
    while (out.length < n) out.push('（无）');
    return out;
  }

  function buildQuiz(mode, count) {
    const idxs = shuffle(WORDS.map(function (_, i) { return i; })).slice(0, count);
    return {
      mode: mode,
      idx: 0,
      correct: 0,
      wrong: [],
      questions: idxs.map(function (i) {
        const w = WORDS[i];
        if (mode === 'spell') {
          return { type: 'spell', word: w[0], phon: w[1], meaning: w[2], answered: false, ok: false };
        }
        const q = { type: mode, word: w[0], phon: w[1], meaning: w[2], answered: false, ok: false };
        if (mode === 'en2zh') {
          q.options = shuffle([w[2]].concat(pickDistractors(2, w[2], 3)));
        } else {
          q.options = shuffle([w[0]].concat(pickDistractors(0, w[0], 3)));
        }
        return q;
      })
    };
  }

  function modeName(m) {
    const map = { en2zh: '英译汉', zh2en: '汉译英', spell: '拼写', cloze: '选词填空', mcq: '语境辨词' };
    return map[m] || m;
  }

  function renderQuestion() {
    const area = $('#quizArea');
    const q = quiz.questions[quiz.idx];
    const total = quiz.questions.length;
    let html =
      '<div class="quiz-meta"><span>第 ' + (quiz.idx + 1) + ' / ' + total + ' 题</span>' +
      '<span>已答对 ' + quiz.correct + ' 题</span></div>';

    if (q.type === 'spell') {
      html += '<div class="quiz-question">根据释义写出英文单词</div>' +
        '<div class="quiz-options"><div class="word-mean" style="font-size:1.05rem;">' + q.meaning + '</div></div>' +
        '<div class="spell-row" style="margin-top:14px;">' +
        '<input type="text" id="spellInput" placeholder="输入英文单词后按回车" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<button class="btn primary" id="spellCheck">检查</button></div>' +
        '<div class="spell-feedback" id="spellFeedback" hidden></div>';
    } else {
      const qText = q.type === 'en2zh'
        ? '选出单词的正确释义：<span style="color:var(--primary-dark);">' + q.word + '</span>' + (q.phon ? '<span class="q-phon">' + q.phon + '</span>' : '')
        : '选出释义对应的英文单词：<span style="color:var(--primary-dark);">' + q.meaning + '</span>';
      html += '<div class="quiz-question">' + qText + '</div><div class="quiz-options">';
      q.options.forEach(function (opt) {
        html += '<button class="quiz-option" data-opt=""></button>';
      });
      html += '</div>';
    }
    html += '<div class="quiz-nav"><button class="btn primary" id="quizNext" hidden>' +
      (quiz.idx === total - 1 ? '查看结果' : '下一题') + '</button></div>';
    area.innerHTML = html;

    if (q.type === 'spell') {
      const input = $('#spellInput');
      input.focus();
      const check = function () {
        if (q.answered) return;
        const val = input.value.trim().toLowerCase();
        if (!val) return;
        q.answered = true;
        q.ok = (val === q.word.toLowerCase());
        if (q.ok) quiz.correct++; else quiz.wrong.push(q);
        const fb = $('#spellFeedback');
        fb.hidden = false;
        fb.className = 'spell-feedback ' + (q.ok ? 'ok' : 'bad');
        fb.textContent = q.ok
          ? '✓ 回答正确！'
          : '✗ 正确答案：' + q.word;
        input.disabled = true;
        $('#spellCheck').hidden = true;
        $('#quizNext').hidden = false;
      };
      $('#spellCheck').addEventListener('click', check);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
    } else {
      const buttons = $$('.quiz-option', area);
      buttons.forEach(function (btn, i) {
        btn.textContent = q.options[i];
        btn.addEventListener('click', function () {
          if (q.answered) return;
          q.answered = true;
          const answer = q.type === 'en2zh' ? q.meaning : q.word;
          q.ok = (q.options[i] === answer);
          if (q.ok) quiz.correct++; else quiz.wrong.push(q);
          buttons.forEach(function (b, j) {
            b.disabled = true;
            if (q.options[j] === answer) b.classList.add('correct');
            else if (j === i) b.classList.add('wrong');
          });
          $('#quizNext').hidden = false;
        });
      });
    }
    $('#quizNext').addEventListener('click', function () {
      quiz.idx++;
      if (quiz.idx >= quiz.questions.length) renderQuizResult();
      else renderQuestion();
    });
  }

  function renderQuizResult() {
    $('#quizArea').hidden = true;
    const res = $('#quizResult');
    res.hidden = false;
    const total = quiz.questions.length;
    const pct = Math.round(quiz.correct / total * 100);

    const history = load(QUIZ_KEY, []);
    history.unshift({ date: new Date().toISOString(), mode: quiz.mode, correct: quiz.correct, total: total });
    save(QUIZ_KEY, history.slice(0, 50));

    let html =
      '<div style="text-align:center;">' +
      '<div class="score-big">' + pct + '<span style="font-size:1.4rem;"> 分</span></div>' +
      '<p>答对 <b>' + quiz.correct + '</b> / ' + total + ' 题 · ' + modeName(quiz.mode) + '</p></div>';
    if (quiz.wrong.length) {
      html += '<div class="wrong-list"><h3>❌ 答错的题（点击单词听发音）</h3>';
      quiz.wrong.forEach(function (q) {
        html += '<div class="wrong-item"><span class="w" data-word="' + q.word + '" style="cursor:pointer;">' + q.word + '</span><span class="m">' + q.meaning + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<p style="text-align:center;margin:16px 0;color:var(--success);font-weight:600;">🎯 满分！全部答对！</p>';
    }
    res.innerHTML = html;

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    const again = document.createElement('button');
    again.className = 'btn primary';
    again.textContent = '🔄 再来一轮';
    again.addEventListener('click', startQuiz);
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = '返回设置';
    back.addEventListener('click', function () {
      res.hidden = true;
      $('#quizSetup').hidden = false;
    });
    btnRow.appendChild(again);
    btnRow.appendChild(back);
    res.appendChild(btnRow);

    res.addEventListener('click', function (e) {
      const t = e.target.closest('[data-word]');
      if (t) speak(t.dataset.word);
    });
  }

  function startQuiz() {
    const mode = $('#quizMode').value;
    const count = parseInt($('#quizCount').value, 10);
    quiz = buildQuiz(mode, count);
    $('#quizSetup').hidden = true;
    $('#quizResult').hidden = true;
    $('#quizArea').hidden = false;
    renderQuestion();
  }
  $('#quizStart').addEventListener('click', startQuiz);

  /* ===== 统计 ===== */
  function renderStats() {
    const grid = $('#statsGrid');
    const history = load(QUIZ_KEY, []);
    const answered = history.reduce(function (s, h) { return s + h.total; }, 0);
    const correct = history.reduce(function (s, h) { return s + h.correct; }, 0);
    const acc = answered ? Math.round(correct / answered * 100) : 0;
    const pct = Math.round(known.size / WORDS.length * 100);

    grid.innerHTML =
      '<div class="stat-card"><div class="stat-num">' + WORDS.length + '</div><div class="stat-label">词汇总量</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + known.size + '</div><div class="stat-label">已掌握</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (WORDS.length - known.size) + '</div><div class="stat-label">未掌握</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + history.length + '</div><div class="stat-label">测验次数</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (history.length ? acc + '%' : '—') + '</div><div class="stat-label">平均正确率</div></div>' +
      '<div class="mastery-bar"><b>掌握进度</b> ' + pct + '%' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="progress-text">已掌握 ' + known.size + ' / ' + WORDS.length + ' 个六级核心词汇</div></div>';

    const hist = $('#quizHistory');
    if (!history.length) {
      hist.innerHTML = '<div class="empty-tip">还没有测验记录，去「测验」页做一组题吧！</div>';
    } else {
      hist.innerHTML = history.slice(0, 10).map(function (h) {
        const d = new Date(h.date);
        const ds = d.getMonth() + 1 + '月' + d.getDate() + '日 ' +
          ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
        return '<div class="history-item"><span>' + ds + ' · ' + modeName(h.mode) + '</span>' +
          '<span>答对 <b>' + h.correct + '</b> / ' + h.total + '</span></div>';
      }).join('');
    }
  }

  $('#resetBtn').addEventListener('click', function () {
    if (!confirm('确定要清空所有学习数据吗？\n（掌握的单词标记和测验记录都会被删除）')) return;
    known = new Set();
    saveKnown();
    save(QUIZ_KEY, []);
    renderStats();
    renderBrowse();
  });

  /* ===== 真题演练 ===== */
  function recordExam(mode, correct, total) {
    const history = load(QUIZ_KEY, []);
    history.unshift({ date: new Date().toISOString(), mode: mode, correct: correct, total: total });
    save(QUIZ_KEY, history.slice(0, 50));
  }

  function examReturnBtn() {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '返回选题';
    btn.addEventListener('click', function () {
      $('#examArea').hidden = true;
      $('#examArea').innerHTML = '';
      $('#examSetup').hidden = false;
    });
    return btn;
  }

  /* ----- 选词填空 ----- */
  function renderCloze(testIdx) {
    const test = CLOZE_TESTS[testIdx];
    const area = $('#examArea');
    area.hidden = false;
    let html = '<div class="quiz-area" style="margin-bottom:14px;">' +
      '<h3 style="margin-bottom:8px;">' + test.title + '</h3>' +
      '<p class="hint" style="margin-bottom:12px;">从下方词库中选 10 个单词填入空格，每词限用一次、无需变形。</p>' +
      '<div class="bank-box">';
    test.bank.forEach(function (w) { html += '<span class="bank-chip" data-w="' + w + '">' + w + '</span>'; });
    html += '</div>';
    test.paragraphs.forEach(function (p) {
      html += '<p class="cloze-passage">' + p.replace(/\[(\d+)\]/g, function (_, n) {
        let opts = '<option value="">[' + n + ']</option>';
        test.bank.forEach(function (w) { opts += '<option value="' + w + '">' + w + '</option>'; });
        return '<select class="cloze-blank" data-n="' + n + '">' + opts + '</select>';
      }) + '</p>';
    });
    html += '<div class="quiz-nav"><span id="clozeScore" style="margin-right:auto;align-self:center;font-weight:600;"></span>' +
      '<button class="btn primary" id="clozeCheck">交卷检查</button></div></div>';
    area.innerHTML = html;

    function refreshChips() {
      const used = {};
      $$('.cloze-blank', area).forEach(function (s) { if (s.value) used[s.value] = (used[s.value] || 0) + 1; });
      $$('.bank-chip', area).forEach(function (chip) {
        const c = used[chip.dataset.w] || 0;
        chip.classList.toggle('used', c > 0);
        chip.classList.toggle('dup', c > 1);
      });
    }
    area.addEventListener('change', refreshChips);

    $('#clozeCheck').addEventListener('click', function () {
      const count = {};
      $$('.cloze-blank', area).forEach(function (s) { if (s.value) count[s.value] = (count[s.value] || 0) + 1; });
      let correct = 0;
      const total = Object.keys(test.answers).length;
      $$('.cloze-blank', area).forEach(function (s) {
        const dup = s.value && count[s.value] > 1;
        const ok = s.value === test.answers[s.dataset.n] && !dup;
        s.disabled = true;
        s.classList.add(ok ? 'cloze-ok' : 'cloze-bad');
        if (ok) correct++;
      });
      const hasDup = Object.keys(count).some(function (k) { return count[k] > 1; });
      $('#clozeScore').textContent = '得分：' + correct + ' / ' + total + (hasDup ? '（有单词被重复使用，相关空判错）' : '');
      recordExam('cloze', correct, total);
      this.disabled = true;
      const nav = this.parentElement;
      const redo = document.createElement('button');
      redo.className = 'btn';
      redo.textContent = '🔄 重新作答';
      redo.addEventListener('click', function () { renderCloze(testIdx); });
      nav.insertBefore(redo, this);
      nav.appendChild(examReturnBtn());
    });
  }

  /* ----- 词汇单选（语境辨词） ----- */
  function buildMcq(count) {
    const pool = shuffle(WORDS.map(function (_, i) { return i; }));
    const qs = [];
    for (const i of pool) {
      if (qs.length >= count) break;
      const w = WORDS[i];
      if (!w[3]) continue;
      const re = new RegExp('\\b' + w[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (!re.test(w[3])) continue;
      qs.push({
        word: w[0], phon: w[1], meaning: w[2],
        sentence: w[3].replace(re, '______'),
        options: shuffle([w[2]].concat(pickDistractors(2, w[2], 3))),
        ok: false
      });
    }
    return qs;
  }

  function renderMcq() {
    const qs = buildMcq(10);
    const area = $('#examArea');
    area.hidden = false;
    let idx = 0, correct = 0;

    function renderQ() {
      const q = qs[idx];
      let html = '<div class="quiz-area">' +
        '<div class="quiz-meta"><span>第 ' + (idx + 1) + ' / ' + qs.length + ' 题</span><span>已答对 ' + correct + ' 题</span></div>' +
        '<div class="quiz-question">选出与划线部分意思相符的选项</div>' +
        '<p class="cloze-passage" style="font-size:1.05rem;">' + q.sentence + '</p>' +
        '<div class="quiz-options">';
      q.options.forEach(function () { html += '<button class="quiz-option"></button>'; });
      html += '</div><div class="quiz-nav"><button class="btn primary" id="mcqNext" hidden>' +
        (idx === qs.length - 1 ? '查看结果' : '下一题') + '</button></div></div>';
      area.innerHTML = html;

      $$('.quiz-option', area).forEach(function (btn, i) {
        btn.textContent = q.options[i];
        btn.addEventListener('click', function () {
          $$('.quiz-option', area).forEach(function (b, j) {
            b.disabled = true;
            if (q.options[j] === q.meaning) b.classList.add('correct');
            else if (j === i) b.classList.add('wrong');
          });
          q.ok = (q.options[i] === q.meaning);
          if (q.ok) correct++;
          $('#mcqNext').hidden = false;
        });
      });
      $('#mcqNext').addEventListener('click', function () {
        idx++;
        if (idx >= qs.length) renderMcqResult();
        else renderQ();
      });
    }

    function renderMcqResult() {
      const pct = Math.round(correct / qs.length * 100);
      recordExam('mcq', correct, qs.length);
      let html = '<div class="quiz-area" style="text-align:center;">' +
        '<div class="score-big">' + pct + '<span style="font-size:1.4rem;"> 分</span></div>' +
        '<p>答对 <b>' + correct + '</b> / ' + qs.length + ' 题 · 语境辨词</p></div>';
      const wrong = qs.filter(function (q) { return !q.ok; });
      if (wrong.length) {
        html += '<div class="quiz-area wrong-list" style="margin-top:14px;"><h3>❌ 错题回顾（点击单词听发音）</h3>';
        wrong.forEach(function (q) {
          html += '<div class="wrong-item"><span class="w" data-word="' + q.word + '" style="cursor:pointer;">' + q.word + '</span>' +
            '<span class="m">' + q.meaning + ' —— ' + q.sentence + '</span></div>';
        });
        html += '</div>';
      } else {
        html += '<p style="text-align:center;margin:14px;color:var(--success);font-weight:600;">🎯 满分！全部答对！</p>';
      }
      area.innerHTML = html;
      const row = document.createElement('div');
      row.className = 'btn-row';
      row.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap;';
      const again = document.createElement('button');
      again.className = 'btn primary';
      again.textContent = '🔄 再来一组';
      again.addEventListener('click', renderMcq);
      row.appendChild(again);
      row.appendChild(examReturnBtn());
      area.appendChild(row);
      area.addEventListener('click', function (e) {
        const t = e.target.closest('[data-word]');
        if (t) speak(t.dataset.word);
      });
    }

    renderQ();
  }

  $('#examStart').addEventListener('click', function () {
    const mode = $('#examMode').value;
    $('#examSetup').hidden = true;
    if (mode === 'mcq') renderMcq();
    else renderCloze(parseInt(mode.replace('cloze', ''), 10));
  });

  /* ===== 初始化 ===== */
  buildLetterBar();
  renderBrowse();
})();
