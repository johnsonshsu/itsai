// js/app.js

let questions = [];
let quizQuestions = [];
let current = 0;
let correctCount = 0;
let wrongList = [];
let timer = null;
let elapsed = 0;

function $(id) { return document.getElementById(id); }

async function loadQuestions() {
  const res = await fetch('data/questions.json');
  questions = await res.json();
}

function weightedRandomSample(arr, count) {
  // 依權重加權隨機抽取 count 個不重複題目
  let pool = [];
  arr.forEach(q => {
    let w = q.weight || 1;
    for (let i = 0; i < w; i++) pool.push(q);
  });
  let result = [];
  let used = new Set();
  while (result.length < count && pool.length > 0) {
    let idx = Math.floor(Math.random() * pool.length);
    let q = pool[idx];
    if (!used.has(q.id)) {
      result.push(q);
      used.add(q.id);
    }
    pool = pool.filter(x => x.id !== q.id);
  }
  return result;
}

function renderHighWeightList() {
  const list = questions.filter(q => (q.weight || 1) > 1)
    .sort((a, b) => (b.weight || 1) - (a.weight || 1));
  if (!list.length) {
    $('high-weight-list').style.display = 'none';
    return;
  }
  let html = '<table><tr><th>編號</th><th>權重</th><th>題目</th></tr>';
  for (const q of list) {
    html += `<tr><td>${q.id}</td><td>${q.weight}</td><td>${q.question}</td></tr>`;
  }
  html += '</table>';
  $('high-weight-list').innerHTML = html;
  $('high-weight-list').style.display = '';
}

function renderHome() {
  $('main').innerHTML = `
    <div class="select-row">
      <label>題號範圍：</label>
      <select id="range-select">
        <option value="1">1</option>
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="50">50</option>
        <option value="100">100</option>
        <option value="200">200</option>
        <option value="300">300</option>
        <option value="all">全部</option>
      </select>
      <label>題數：</label>
      <select id="count-select">
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="30">30</option>
        <option value="50" selected>50</option>
      </select>
      <button class="btn btn-blue" onclick="startQuiz()">開始測驗</button>
      <button class="btn btn-blue" onclick="downloadQuestions()">下載題庫</button>
    </div>
    <div id="high-weight-list"></div>
  `;
  renderHighWeightList();
}

function downloadQuestions() {
  const data = JSON.stringify(questions, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'questions.json';
  a.click();
  URL.revokeObjectURL(url);
}

function startQuiz() {
  let range = $('range-select').value;
  let count = parseInt($('count-select').value);
  let pool = questions;
  if (range !== 'all') {
    let max = parseInt(range);
    pool = questions.filter(q => q.id <= max);
  }
  quizQuestions = weightedRandomSample(pool, Math.min(count, pool.length));
  current = 0;
  correctCount = 0;
  wrongList = [];
  elapsed = 0;
  $('high-weight-list').style.display = 'none';
  renderQuiz();
  timer = setInterval(() => {
    elapsed++;
    updateProgress();
  }, 1000);
}

function updateProgress() {
  const percent = Math.round((current+1) / quizQuestions.length * 100);
  $('progress-info').innerHTML = `第${current+1}/${quizQuestions.length}題 (${percent}%)`;
  $('timer').innerHTML = `已用時間：${formatTime(elapsed)}`;
  $('progress-bar-inner').style.width = percent + '%';
}

function formatTime(sec) {
  let m = Math.floor(sec/60);
  let s = sec%60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

function renderQuiz() {
  const q = quizQuestions[current];
  let html = `<div class="progress-row">
    <span id="progress-info"></span>
    <div class="progress-bar"><div id="progress-bar-inner" class="progress" style="width:0"></div></div>
    <span id="timer"></span>
  </div>`;
  html += `<div class="question-block">
    <div class="question-text">${q.question}</div>`;
  if (q.image) {
    html += `<div style="margin:10px 0"><img src="${q.image}" alt="題目圖片" style="max-width:100%;max-height:180px;"></div>`;
  }
  html += `<form id="answer-form"><div class="options">`;
  for (let i = 0; i < q.options.length; i++) {
    let type = q.type === 'single' ? 'radio' : 'checkbox';
    html += `<div class="option-row"><input type="${type}" name="opt" value="${i+1}" id="opt${i}"><label for="opt${i}">${q.options[i]}</label></div>`;
  }
  html += `</div><button type="submit" class="btn btn-green">提交答案</button></form></div>`;
  $('main').innerHTML = html;
  updateProgress();
  $('answer-form').onsubmit = checkAnswer;
}

function checkAnswer(e) {
  e.preventDefault();
  playSound('submit'); // 提交時播放
  const q = quizQuestions[current];
  let selected = [];
  const inputs = document.querySelectorAll('input[name="opt"]');
  inputs.forEach(inp => { if (inp.checked) selected.push(parseInt(inp.value)); });
  selected.sort();
  let correct = q.answer.slice().sort((a,b)=>a-b);
  let isCorrect = JSON.stringify(selected) === JSON.stringify(correct);
  if (isCorrect) {
    playSound('correct'); // 答對音效
    correctCount++;
  } else {
    playSound('wrong'); // 答錯音效
    wrongList.push({q, selected});
  }
  showExplanation(isCorrect, q, selected);
}

function showExplanation(isCorrect, q, selected) {
  let html = `<div class="question-block">
    <div class="question-text">${q.question}</div>`;
  if (q.image) {
    html += `<div style="margin:10px 0"><img src="${q.image}" alt="題目圖片" style="max-width:100%;max-height:180px;"></div>`;
  }
  html += `<div class="options">`;
  for (let i = 0; i < q.options.length; i++) {
    let checked = selected.includes(i+1) ? 'checked' : '';
    let type = q.type === 'single' ? 'radio' : 'checkbox';
    html += `<div class="option-row"><input type="${type}" disabled ${checked}>${q.options[i]}</div>`;
  }
  html += `</div>`;
  html += `<div class="explanation">${isCorrect ? '✔️ 恭喜答對！' : '❌ 答錯了！'}\n${q.explanation.replace(/\n/g,'<br>')}</div>`;
  html += `<button class="btn btn-blue" onclick="nextQuestion()">繼續下一題</button></div>`;
  $('main').innerHTML = html;
}

function nextQuestion() {
  current++;
  if (current >= quizQuestions.length) {
    clearInterval(timer);
    playSound('finish'); // 完成測驗音效
    renderResult();
  } else {
    renderQuiz();
  }
}

function renderResult() {
  let percent = Math.round(correctCount / quizQuestions.length * 100);
  let html = `<div class="result-block">
    <div class="result-circle">${percent}%</div>
    <div class="result-score">分數：${correctCount} / ${quizQuestions.length}</div>
    <div>正確率：${percent}%</div>
    <div>總作答時間：${formatTime(elapsed)}</div>
    <button class="btn btn-blue" onclick="renderHome()">繼續測驗</button>
  </div>`;
  if (wrongList.length) {
    html += `<div class="wrong-list"><h3>答錯題目：</h3>`;
    for (const item of wrongList) {
      let q = item.q;
      let your = item.selected.map(i=>q.options[i-1]).join('、') || '未作答';
      let ans = q.answer.map(i=>q.options[i-1]).join('、');
      html += `<div class="wrong-item">
        <div><b>題目：</b>${q.question}</div>
        <div class="your-answer"><b>你的答案：</b>${your}</div>
        <div class="correct-answer"><b>正確答案：</b>${ans}</div>
        <div class="explanation">${q.explanation.replace(/\n/g,'<br>')}</div>
      </div>`;
    }
    html += `</div>`;
  }
  $('main').innerHTML = html;
}

// 音效物件
const sounds = {
    correct: new Audio('audio/correct.mp3'),
    wrong: new Audio('audio/wrong.mp3'),
    submit: new Audio('audio/submit.mp3'),
    finish: new Audio('audio/finish.mp3')
};
function playSound(type) {
    if (sounds[type]) {
        sounds[type].currentTime = 0;
        sounds[type].play();
    }
}

window.onload = async function() {
  await loadQuestions();
  renderHome();
};
