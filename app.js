// ============================================================
// 软考系规助手 - 核心应用逻辑
// ============================================================

// ===== 全局状态 =====
const STATE = {
  currentPage: 'home',
  todayQuiz: [],
  currentAnswers: {},
  learningData: null,
  mockExam: null,
  currentVideoSlide: 0,
  currentVideoScript: null
};

// ===== 存储 Key =====
const STORAGE_KEY = 'ruankao_xigui_data';

// ===== 考试日期（2026年5月）=====
const EXAM_DATE = new Date('2026-05-23');

// ============================================================
// 存储管理
// ============================================================
function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ return JSON.parse(raw); }catch(e){ return initEmptyData(); }
  }
  return initEmptyData();
}

function initEmptyData(){
  return {
    records: [],           // 答题记录 [{date, questionId, category, correct, yourAnswer, timestamp}]
    wrongBook: [],         // 错题本 [{questionId, date, yourAnswer}]
    videos: [],             // 每日视频记录 [{date, title, category, slides}]
    dailyQuizDates: {},     // 每日习题的题目ID {date: [questionIds]}
    chatHistory: [],        // 聊天历史
    streak: 0,             // 连续打卡天数
    lastStudyDate: null     // 最后学习日期
  };
}

function saveData(){
  if(!STATE.learningData) STATE.learningData = loadData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.learningData));
}

// ============================================================
// 工具函数
// ============================================================
function getTodayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDateStr(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function getDayOfYear(date){
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000*60*60*24));
}

function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// ============================================================
// 导航
// ============================================================
function navigateTo(page){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  STATE.currentPage = page;
  document.getElementById('navMenu').classList.remove('show');

  // 按页面加载对应数据
  if(page==='home') loadHomeData();
  if(page==='progress') loadProgressData();
  if(page==='video') loadVideoHistory();
  if(page==='companion') loadCompanionData();
}

document.addEventListener('DOMContentLoaded', function(){
  STATE.learningData = loadData();
  // 导航绑定
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });
  // 移动端菜单
  document.getElementById('navToggle').addEventListener('click', function(){
    document.getElementById('navMenu').classList.toggle('show');
  });
  // 初始加载
  loadHomeData();
  loadTodayQuiz();
});

// ============================================================
// 首页数据
// ============================================================
function loadHomeData(){
  if(!STATE.learningData) STATE.learningData = loadData();
  const data = STATE.learningData;

  // 倒计时
  const today = new Date();
  const diff = Math.ceil((EXAM_DATE - today) / (1000*60*60*24));
  document.getElementById('examCountdown').textContent = diff > 0 ? diff : '已开考';

  // 今日已做题
  const todayStr = getTodayStr();
  const todayRecords = data.records.filter(r => r.date === todayStr);
  document.getElementById('todayQuestions').textContent = new Set(todayRecords.map(r=>r.questionId)).size;

  // 累计正确率
  const totalQ = data.records.length;
  const correctQ = data.records.filter(r=>r.correct).length;
  const accuracy = totalQ > 0 ? Math.round(correctQ/totalQ*100) : 0;
  document.getElementById('totalAccuracy').textContent = accuracy + '%';
  document.getElementById('totalQuestions').textContent = totalQ;

  // 连续打卡
  updateStreak();
  document.getElementById('streakDays').textContent = data.streak;

  // 进度环
  drawProgressRings();
}

function updateStreak(){
  const data = STATE.learningData;
  const todayStr = getTodayStr();
  const todayRecords = data.records.filter(r => r.date === todayStr);

  if(todayRecords.length > 0 && data.lastStudyDate !== todayStr){
    // 今天第一次做题
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate()-1);
    const yStr = getDateStr(yesterday);
    if(data.lastStudyDate === yStr || data.lastStudyDate === todayStr){
      data.streak = (data.streak || 0) + 1;
    } else {
      data.streak = 1;
    }
    data.lastStudyDate = todayStr;
    saveData();
  }
}

function drawProgressRings(){
  const data = STATE.learningData;
  const categories = ['综合知识','案例分析','论文写作','历年真题'];
  const canvases = ['ringComprehensive','ringCase','ringEssay','ringPast'];

  // 按类型统计完成度
  const allRecords = data.records.length;
  const caseRecords = data.records.filter(r => {
    const q = QUESTION_BANK.find(qq => qq.id === r.questionId);
    return q && q.type === 'case';
  }).length;
  const singleRecords = allRecords - caseRecords;

  // 简化计算：已做题数占总题库比例
  const totalQ = QUESTION_BANK.length;
  const answeredIds = new Set(data.records.map(r => r.questionId)).size;

  const progressValues = [
    Math.min(100, Math.round(answeredIds/totalQ*100)),  // 综合
    Math.min(100, Math.round(caseRecords/10*100)),      // 案例
    0,                                                    // 论文（无题目）
    Math.min(100, Math.round(answeredIds/totalQ*100))    // 真题
  ];

  canvases.forEach((id, i) => {
    drawRing(id, progressValues[i]);
  });
}

function drawRing(canvasId, percent){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 60, cy = 60, r = 45;
  ctx.clearRect(0,0,120,120);
  // 背景圆
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2*Math.PI);
  ctx.strokeStyle = '#e0e6ed';
  ctx.lineWidth = 8;
  ctx.stroke();
  // 进度圆
  if(percent > 0){
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + 2*Math.PI * percent/100);
    ctx.strokeStyle = '#1a5fb4';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // 文字
  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(percent + '%', cx, cy);
}

// ============================================================
// 每日习题
// ============================================================
function loadTodayQuiz(){
  const data = STATE.learningData;
  const todayStr = getTodayStr();

  // 如果今天还没选题，选5道
  if(!data.dailyQuizDates[todayStr]){
    // 按日期确定随机种子，确保同一天题目一致
    const seed = getDayOfYear(new Date());
    const shuffled = [...QUESTION_BANK].sort((a,b) => {
      return ((a.id * (seed+1)) % 7) - ((b.id * (seed+3)) % 7);
    });
    data.dailyQuizDates[todayStr] = shuffled.slice(0, 5).map(q => q.id);
    saveData();
  }

  STATE.todayQuiz = data.dailyQuizDates[todayStr].map(id =>
    QUESTION_BANK.find(q => q.id === id)
  ).filter(q => q);

  STATE.currentAnswers = {};
  renderQuiz();
}

function renderQuiz(){
  const container = document.getElementById('quizContainer');
  container.innerHTML = '';

  STATE.todayQuiz.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'quiz-item';
    div.id = `quiz-item-${q.id}`;

    // 检查是否已答过
    const data = STATE.learningData;
    const todayStr = getTodayStr();
    const answered = data.records.find(r => r.date === todayStr && r.questionId === q.id);

    div.innerHTML = `
      <span class="quiz-tag">${q.category}</span>
      <div class="quiz-question">${idx+1}. ${q.question}</div>
      <div class="quiz-options" id="options-${q.id}">
        ${q.options.map((opt, i) => `
          <div class="quiz-option ${answered ? (i===q.answer ? 'correct' : (i===answered.yourAnswer ? 'wrong' : '')) : ''}"
               onclick="selectOption(${q.id}, ${i})" data-idx="${i}">
            <div class="quiz-option-letter">${String.fromCharCode(65+i)}</div>
            <span>${opt}</span>
          </div>
        `).join('')}
      </div>
      <div class="quiz-explanation ${answered ? 'show' : ''}" id="explanation-${q.id}">
        <strong>正确答案：${String.fromCharCode(65+q.answer)}</strong><br>${q.explanation}
      </div>
    `;

    // 如果已答，禁用点击
    if(answered){
      div.querySelectorAll('.quiz-option').forEach(opt => opt.style.cursor = 'default');
    }

    container.appendChild(div);
  });
}

function selectOption(questionId, optionIdx){
  // 检查是否已答过
  const data = STATE.learningData;
  const todayStr = getTodayStr();
  const alreadyAnswered = data.records.find(r => r.date === todayStr && r.questionId === questionId);
  if(alreadyAnswered) return;

  const q = QUESTION_BANK.find(qq => qq.id === questionId);
  if(!q) return;

  // 记录答案
  const isCorrect = optionIdx === q.answer;
  data.records.push({
    date: todayStr,
    questionId: questionId,
    category: q.category,
    correct: isCorrect,
    yourAnswer: optionIdx,
    timestamp: Date.now()
  });

  // 错题本
  if(!isCorrect){
    data.wrongBook.push({
      questionId: questionId,
      date: todayStr,
      yourAnswer: optionIdx
    });
  }

  saveData();

  // 更新 UI
  const optionsContainer = document.getElementById(`options-${questionId}`);
  optionsContainer.querySelectorAll('.quiz-option').forEach((opt, i) => {
    opt.style.cursor = 'default';
    opt.onclick = null;
    if(i === q.answer) opt.classList.add('correct');
    else if(i === optionIdx) opt.classList.add('wrong');
  });

  // 显示解析
  document.getElementById(`explanation-${questionId}`).classList.add('show');

  // 检查是否全部答完
  const allAnswered = STATE.todayQuiz.every(qq =>
    data.records.find(r => r.date === todayStr && r.questionId === qq.id)
  );
  if(allAnswered){
    showQuizResult();
    loadHomeData(); // 更新首页数据
  }
}

function showQuizResult(){
  const data = STATE.learningData;
  const todayStr = getTodayStr();
  const todayRecords = data.records.filter(r => r.date === todayStr);
  const correct = todayRecords.filter(r => r.correct).length;
  const total = todayRecords.length;
  const rate = total > 0 ? Math.round(correct/total*100) : 0;

  const resultDiv = document.getElementById('quizResult');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `
    <div class="quiz-result">
      <div class="quiz-result-score ${rate>=60 ? 'pass' : 'fail'}">${correct}/${total}</div>
      <p>正确率：${rate}% ${rate>=60 ? '🎉 不错！继续保持！' : '💪 还需努力，看看错题解析吧！'}</p>
    </div>
  `;
}

function showWrongBook(){
  const panel = document.getElementById('wrongBookPanel');
  const data = STATE.learningData;

  if(panel.style.display === 'block'){
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  if(data.wrongBook.length === 0){
    panel.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:20px;">暂无错题，继续保持！🎉</p>';
    return;
  }

  // 按知识点分类
  const categoryMap = {};
  data.wrongBook.forEach(w => {
    const q = QUESTION_BANK.find(qq => qq.id === w.questionId);
    if(!q) return;
    if(!categoryMap[q.category]) categoryMap[q.category] = [];
    categoryMap[q.category].push({q, w});
  });

  let html = '<h3>错题本（' + data.wrongBook.length + '题）</h3>';
  Object.entries(categoryMap).forEach(([cat, items]) => {
    html += `<h4 style="margin:16px 0 8px;color:#1a5fb4;">${cat}（${items.length}题）</h4>`;
    items.forEach(({q, w}) => {
      html += `
        <div class="wrong-book-item">
          <div class="wrong-book-q">${q.question}</div>
          <div class="wrong-book-ans">
            正确答案：<span class="correct-ans">${String.fromCharCode(65+q.answer)}. ${q.options[q.answer]}</span><br>
            你的答案：<span class="your-ans">${String.fromCharCode(65+w.yourAnswer)}. ${q.options[w.yourAnswer]}</span>
          </div>
        </div>
      `;
    });
  });

  panel.innerHTML = html;
}

// ============================================================
// 模拟考试
// ============================================================
function startMockExam(){
  const modal = document.getElementById('mockExamModal');
  modal.style.display = 'flex';

  // 随机抽20题
  const questions = shuffle(QUESTION_BANK).slice(0, 20);
  const userAnswers = {};
  let timeLeft = 30 * 60; // 30分钟

  const content = document.getElementById('mockExamContent');
  const timerDiv = document.getElementById('mockExamTimer');
  const resultDiv = document.getElementById('mockExamResult');

  resultDiv.style.display = 'none';
  content.style.display = 'block';

  content.innerHTML = questions.map((q, i) => `
    <div class="quiz-item" id="mock-${q.id}">
      <span class="quiz-tag">${q.category}</span>
      <div class="quiz-question">${i+1}. ${q.question}</div>
      <div class="quiz-options">
        ${q.options.map((opt, j) => `
          <div class="quiz-option" onclick="selectMockOption(${q.id}, ${j})" data-idx="${j}">
            <div class="quiz-option-letter">${String.fromCharCode(65+j)}</div>
            <span>${opt}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('') + `
    <div style="text-align:center;margin-top:20px;">
      <button class="btn-primary" onclick="submitMockExam()" style="padding:12px 40px;font-size:16px;">交卷</button>
    </div>
  `;

  window.selectMockOption = function(qid, idx){
    userAnswers[qid] = idx;
    const item = document.getElementById('mock-'+qid);
    item.querySelectorAll('.quiz-option').forEach((opt, i) => {
      opt.classList.toggle('selected', i === idx);
    });
  };

  window.submitMockExam = function(){
    clearInterval(timer);
    let correct = 0;
    let unanswered = 0;

    questions.forEach(q => {
      const userAns = userAnswers[q.id];
      if(userAns === undefined){
        unanswered++;
      } else if(userAns === q.answer){
        correct++;
      }
      // 显示正确答案
      const item = document.getElementById('mock-'+q.id);
      item.querySelectorAll('.quiz-option').forEach((opt, i) => {
        opt.style.cursor = 'default';
        opt.onclick = null;
        if(i === q.answer) opt.classList.add('correct');
        else if(i === userAns && userAns !== q.answer) opt.classList.add('wrong');
      });
      // 添加解析
      let exp = item.querySelector('.quiz-explanation');
      if(!exp){
        exp = document.createElement('div');
        exp.className = 'quiz-explanation show';
        exp.innerHTML = `<strong>正确答案：${String.fromCharCode(65+q.answer)}</strong><br>${q.explanation}`;
        item.appendChild(exp);
      }
    });

    const total = questions.length;
    const rate = Math.round(correct/total*100);

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div class="quiz-result">
        <div class="quiz-result-score ${rate>=60?'pass':'fail'}">${correct}/${total}</div>
        <p>正确率：${rate}% ${rate>=60 ? '🎉 恭喜通过！' : '💪 继续加油！'}</p>
        ${unanswered > 0 ? `<p style="color:#e74c3c;">未答题数：${unanswered}</p>` : ''}
        <p style="margin-top:12px;color:#7f8c8d;">模拟考试分数：${Math.round(correct/total*75)}分（满分75分）</p>
      </div>
    `;
    content.querySelector('button').style.display = 'none';
    content.style.display = 'block'; // 保持显示，让用户看答案
  };

  // 计时器
  const timer = setInterval(() => {
    timeLeft--;
    const min = Math.floor(timeLeft/60);
    const sec = timeLeft % 60;
    timerDiv.textContent = `⏱ 剩余时间：${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    if(timeLeft <= 0){
      clearInterval(timer);
      window.submitMockExam();
    }
  }, 1000);
}

function closeMockExam(){
  document.getElementById('mockExamModal').style.display = 'none';
}

// ============================================================
// 学情档案
// ============================================================
function loadProgressData(){
  const data = STATE.learningData;
  drawRadarChart();
  drawTrendChart();
  drawCalendar();
  showWeakPoints();
}

function drawRadarChart(){
  const data = STATE.learningData;
  const ctx = document.getElementById('radarChart').getContext('2d');

  // 按知识点统计正确率
  const areas = KNOWLEDGE_AREAS;
  const stats = areas.map(area => {
    const records = data.records.filter(r => r.category === area);
    if(records.length === 0) return 0;
    const correct = records.filter(r => r.correct).length;
    return Math.round(correct/records.length*100);
  });

  // 销毁已有图表
  if(window.radarChartInstance) window.radarChartInstance.destroy();

  window.radarChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: areas,
      datasets: [{
        label: '知识点掌握度(%)',
        data: stats,
        backgroundColor: 'rgba(26,95,180,0.2)',
        borderColor: 'rgba(26,95,180,1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(26,95,180,1)',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        r: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } }
      }
    }
  });
}

function drawTrendChart(){
  const data = STATE.learningData;
  const ctx = document.getElementById('trendChart').getContext('2d');

  // 按日期统计正确率趋势（最近14天）
  const dates = [];
  const rates = [];
  const today = new Date();
  for(let i=13; i>=0; i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    const dStr = getDateStr(d);
    const dayRecords = data.records.filter(r => r.date === dStr);
    if(dayRecords.length > 0){
      const correct = dayRecords.filter(r => r.correct).length;
      dates.push((d.getMonth()+1)+'/'+d.getDate());
      rates.push(Math.round(correct/dayRecords.length*100));
    } else if(i <= 3) {
      // 最近几天如果没做也显示
      dates.push((d.getMonth()+1)+'/'+d.getDate());
      rates.push(null);
    }
  }

  if(window.trendChartInstance) window.trendChartInstance.destroy();

  window.trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: '每日正确率(%)',
        data: rates,
        borderColor: 'rgba(26,95,180,1)',
        backgroundColor: 'rgba(26,95,180,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

function drawCalendar(){
  const container = document.getElementById('calendarHeatmap');
  const data = STATE.learningData;

  // 统计每日做题数
  const dayCounts = {};
  data.records.forEach(r => {
    dayCounts[r.date] = (dayCounts[r.date] || 0) + 1;
  });

  // 生成最近 53 周的热力图（7行 x 53列，按天→周排列）
  const today = new Date();
  let html = '';
  // 找到 53 周前的那个周日作为起点
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 52*7 - startDate.getDay());
  for(let day=0; day<7; day++){
    for(let week=0; week<53; week++){
      const d = new Date(startDate);
      d.setDate(d.getDate() + week*7 + day);
      const dStr = getDateStr(d);
      const count = dayCounts[dStr] || 0;
      let level = 0;
      if(count >= 10) level = 4;
      else if(count >= 5) level = 3;
      else if(count >= 3) level = 2;
      else if(count >= 1) level = 1;
      const isFuture = d > today;
      html += `<div class="heatmap-cell level-${level}" title="${dStr}: ${count}题" style="${isFuture?'visibility:hidden;':''}"></div>`;
    }
  }
  container.innerHTML = html;
}

function showWeakPoints(){
  const data = STATE.learningData;
  const container = document.getElementById('weakPoints');
  const areas = KNOWLEDGE_AREAS;

  const weakPoints = areas.map(area => {
    const records = data.records.filter(r => r.category === area);
    const wrong = records.filter(r => !r.correct);
    if(records.length === 0) return { area, rate: 0, total: 0, wrong: 0, hasData: false };
    const rate = Math.round((records.length - wrong.length)/records.length*100);
    return { area, rate, total: records.length, wrong: wrong.length, hasData: true };
  }).filter(w => w.hasData).sort((a,b) => a.rate - b.rate);

  if(weakPoints.length === 0){
    container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:20px;">暂无学情数据，去做几道题吧！</p>';
    return;
  }

  container.innerHTML = weakPoints.map(w => {
    const color = w.rate >= 80 ? '#27ae60' : w.rate >= 60 ? '#f5a623' : '#e74c3c';
    return `
      <div class="weak-point-item">
        <div class="weak-point-name">${w.area}</div>
        <div class="weak-point-bar">
          <div class="weak-point-fill" style="width:${w.rate}%;background:${color};"></div>
        </div>
        <div class="weak-point-rate" style="color:${color};">${w.rate}%</div>
      </div>
    `;
  }).join('');
}

// ============================================================
// 每日视频（知识点幻灯片）
// ============================================================
function generateTodayVideo(){
  const data = STATE.learningData;
  const todayStr = getTodayStr();

  // 检查今天是否已生成
  let todayVideo = data.videos.find(v => v.date === todayStr);
  if(todayVideo){
    playVideoScript(todayVideo);
    return;
  }

  // 根据学情选主题：错题最多的知识点
  let targetCategory = null;
  const wrongByCategory = {};
  data.wrongBook.forEach(w => {
    const q = QUESTION_BANK.find(qq => qq.id === w.questionId);
    if(q){
      wrongByCategory[q.category] = (wrongByCategory[q.category] || 0) + 1;
    }
  });

  const sortedWrong = Object.entries(wrongByCategory).sort((a,b) => b[1] - a[1]);
  if(sortedWrong.length > 0 && sortedWrong[0][1] > 0){
    targetCategory = sortedWrong[0][0];
  } else {
    // 没有错题，选今天习题涉及的知识点
    const todayQuiz = data.dailyQuizDates[todayStr] || [];
    if(todayQuiz.length > 0){
      const q = QUESTION_BANK.find(qq => qq.id === todayQuiz[0]);
      if(q) targetCategory = q.category;
    }
    if(!targetCategory) targetCategory = KNOWLEDGE_AREAS[Math.floor(Math.random()*KNOWLEDGE_AREAS.length)];
  }

  // 从素材库选视频脚本
  const scripts = VIDEO_SCRIPTS[targetCategory] || VIDEO_SCRIPTS['ITIL服务管理'];
  const script = scripts[Math.floor(Math.random()*scripts.length)];

  const videoRecord = {
    date: todayStr,
    title: script.title,
    category: targetCategory,
    slides: script.slides
  };
  data.videos.push(videoRecord);
  saveData();

  playVideoScript(videoRecord);
  loadVideoHistory();
}

function playVideoScript(video){
  STATE.currentVideoScript = video;
  STATE.currentVideoSlide = 0;

  const playerArea = document.getElementById('videoPlayerArea');
  const videoInfo = document.getElementById('videoInfo');
  videoInfo.style.display = 'block';
  document.getElementById('videoTitle').textContent = video.title;
  document.getElementById('videoSummary').textContent = `知识点：${video.category} · ${video.slides.length}页`;

  renderVideoSlide();
}

function renderVideoSlide(){
  const video = STATE.currentVideoScript;
  if(!video) return;
  const slide = video.slides[STATE.currentVideoSlide];
  const playerArea = document.getElementById('videoPlayerArea');

  playerArea.innerHTML = `
    <div class="kp-slides">
      <div class="kp-slide">
        <div class="kp-slide-title">${slide.title}</div>
        <div class="kp-slide-content">${slide.content}</div>
      </div>
      <div class="kp-controls">
        <button class="btn-secondary" onclick="prevSlide()" ${STATE.currentVideoSlide===0?'disabled':''}>上一页</button>
        <span style="color:rgba(255,255,255,0.5);">${STATE.currentVideoSlide+1} / ${video.slides.length}</span>
        <button class="btn-secondary" onclick="nextSlide()" ${STATE.currentVideoSlide===video.slides.length-1?'disabled':''}>下一页</button>
      </div>
      <div class="kp-progress">
        ${video.slides.map((_,i) => `<div class="kp-dot ${i===STATE.currentVideoSlide?'active':''}" onclick="goToSlide(${i})"></div>`).join('')}
      </div>
    </div>
  `;
}

function prevSlide(){
  if(STATE.currentVideoSlide > 0){
    STATE.currentVideoSlide--;
    renderVideoSlide();
  }
}
function nextSlide(){
  const video = STATE.currentVideoScript;
  if(video && STATE.currentVideoSlide < video.slides.length-1){
    STATE.currentVideoSlide++;
    renderVideoSlide();
  }
}
function goToSlide(idx){
  STATE.currentVideoSlide = idx;
  renderVideoSlide();
}

function loadVideoHistory(){
  const data = STATE.learningData;
  const container = document.getElementById('videoHistoryList');
  if(data.videos.length === 0){
    container.innerHTML = '<p style="color:#7f8c8d;text-align:center;">暂无历史视频</p>';
    return;
  }
  const reversed = data.videos.slice().reverse();
  container.innerHTML = reversed.map((v, i) => `
    <div class="video-history-item" onclick="playVideoByIndex(${i})">
      <div class="vh-date">${v.date}</div>
      <div class="vh-title">${v.title}</div>
      <div style="font-size:12px;color:#7f8c8d;margin-top:4px;">${v.category}</div>
    </div>
  `).join('');

  // 存储反向索引供点击使用
  STATE._reversedVideos = reversed;
}

function playVideoByIndex(idx){
  if(STATE._reversedVideos && STATE._reversedVideos[idx]){
    playVideoScript(STATE._reversedVideos[idx]);
  }
}

function closeVideoModal(){
  document.getElementById('videoModal').style.display = 'none';
}

// ============================================================
// 学习陪伴 / AI 问答
// ============================================================
function loadCompanionData(){
  // 学习计划
  const data = STATE.learningData;
  const planDiv = document.getElementById('studyPlan');
  const todayStr = getTodayStr();
  const todayRecords = data.records.filter(r => r.date === todayStr);
  const done = new Set(todayRecords.map(r=>r.questionId)).size;
  const total = 5;

  // 薄弱知识点
  const wrongByCategory = {};
  data.wrongBook.forEach(w => {
    const q = QUESTION_BANK.find(qq => qq.id === w.questionId);
    if(q) wrongByCategory[q.category] = (wrongByCategory[q.category]||0)+1;
  });
  const weakest = Object.entries(wrongByCategory).sort((a,b)=>b[1]-a[1])[0];

  let plan = '<ul>';
  plan += `<li>✅ 每日习题：${done}/${total} ${done>=total?'已完成':'进行中'}</li>`;
  if(weakest){
    plan += `<li>📌 薄弱环节：${weakest[0]}（${weakest[1]}道错题）</li>`;
    plan += `<li>📖 建议复习：${weakest[0]}相关知识点</li>`;
  }
  if(data.wrongBook.length > 0){
    plan += `<li>🔄 错题复习：还有 ${data.wrongBook.length} 道错题待巩固</li>`;
  }
  plan += `<li>🎬 观看今日短视频</li>`;
  plan += '</ul>';
  planDiv.innerHTML = plan;

  // 激励语
  const motiv = MOTIVATIONS[Math.floor(Math.random()*MOTIVATIONS.length)];
  document.getElementById('motivationText').innerHTML = `<p style="font-size:16px;line-height:1.8;">${motiv}</p>`;

  // 恢复聊天历史
  const chatDiv = document.getElementById('chatMessages');
  if(data.chatHistory.length > 0){
    chatDiv.innerHTML = data.chatHistory.map(msg =>
      `<div class="chat-msg ${msg.role}"><div class="msg-avatar">${msg.role==='bot'?'🤖':'👤'}</div><div class="msg-content">${msg.content}</div></div>`
    ).join('');
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }
}

function sendMessage(){
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if(!msg) return;

  const chatDiv = document.getElementById('chatMessages');

  // 显示用户消息
  chatDiv.innerHTML += `<div class="chat-msg user"><div class="msg-avatar">👤</div><div class="msg-content">${msg}</div></div>`;
  chatDiv.scrollTop = chatDiv.scrollHeight;

  // 保存到历史
  STATE.learningData.chatHistory.push({role:'user', content:msg});

  // 生成回复
  const reply = generateReply(msg);

  // 显示机器人回复（模拟打字延迟）
  setTimeout(() => {
    chatDiv.innerHTML += `<div class="chat-msg bot"><div class="msg-avatar">🤖</div><div class="msg-content">${reply}</div></div>`;
    chatDiv.scrollTop = chatDiv.scrollHeight;
    STATE.learningData.chatHistory.push({role:'bot', content:reply});
    saveData();
  }, 500);

  input.value = '';
}

function generateReply(msg){
  msg = msg.toLowerCase();

  // 关键词匹配
  for(const [keyword, answer] of Object.entries(QA_KNOWLEDGE)){
    if(msg.includes(keyword.toLowerCase())){
      return answer;
    }
  }

  // 特殊问题匹配
  if(msg.includes('倒计时') || msg.includes('还有多久') || msg.includes('什么时候')){
    const diff = Math.ceil((EXAM_DATE - new Date()) / (1000*60*60*24));
    return `距离2026年5月系规考试还有约 ${diff} 天。建议现在开始系统复习，先攻克综合知识，再练案例分析，最后准备论文。`;
  }

  if(msg.includes('怎么复习') || msg.includes('备考计划') || msg.includes('怎么准备') || msg.includes('如何备考')){
    return `备考建议：\n1. 综合知识：刷题+精读教材，覆盖ITIL、项目管理、IT治理、信息安全等考点\n2. 案例分析：理解答题模板，重点掌握IT服务管理场景\n3. 论文写作：选熟悉领域，准备项目经验素材，练习3-5篇完整论文\n建议备考周期3-6个月，每天保证1-2小时学习时间。`;
  }

  if(msg.includes('你好') || msg.includes('在吗') || msg.includes('hi') || msg.includes('hello')){
    return `你好！我是系规备考助手。你可以问我关于ITIL、项目管理、IT治理、信息安全、论文写作等任何系规考试相关问题。`;
  }

  if(msg.includes('谢谢') || msg.includes('感谢')){
    return `不客气！坚持每天学习，考试一定能过。加油💪`;
  }

  // 默认回复
  return `这是一个很好的问题。系规考试涉及的知识面很广，建议你从以下角度思考：\n1. 这个知识点属于哪个模块（ITIL/项目管理/IT治理/信息安全等）？\n2. 核心概念是什么？\n3. 在实际项目中如何应用？\n\n你可以尝试问我更具体的问题，比如：\n- "ITIL有哪些核心流程？"\n- "项目管理十大知识领域是什么？"\n- "论文怎么写？"\n- "距考试还有多久？"`;
}
