const state = {
  cash: 0.0,
  coins: 50,
  currentQuestionIndex: 0,
  score: 0,
  timeLeft: 15,
  timerInterval: null,
  sessionTimes: [0, 4, 8, 12, 16, 20] // 6 daily sessions (every 4 hours)
};

const sampleQuestions = [
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1 },
  { q: "What is the capital city of Kenya?", options: ["Mombasa", "Kisumu", "Nairobi", "Nakuru"], answer: 2 },
  { q: "Which element has the chemical symbol 'O'?", options: ["Gold", "Oxygen", "Osmium", "Silver"], answer: 1 }
];

const balanceCashEl = document.getElementById('balance-cash');
const balanceCoinsEl = document.getElementById('balance-coins');
const countdownEl = document.getElementById('countdown');
const lockedScreen = document.getElementById('locked-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const demoPlayBtn = document.getElementById('start-practice-btn');
const backHomeBtn = document.getElementById('back-home-btn');
const shopModal = document.getElementById('shop-modal');
const openShopBtn = document.getElementById('open-shop-btn');
const closeShopBtn = document.getElementById('close-shop-btn');

function init() {
  updateUI();
  startSessionClock();
  attachEventListeners();
}

function updateUI() {
  balanceCashEl.textContent = state.cash.toFixed(2);
  balanceCoinsEl.textContent = state.coins;
}

function startSessionClock() {
  function updateTimer() {
    const now = new Date();
    const currentHour = now.getHours();
    let nextHour = state.sessionTimes.find(h => h > currentHour);
    if (nextHour === undefined) nextHour = state.sessionTimes[0];

    const target = new Date(now);
    if (nextHour <= currentHour) target.setDate(target.getDate() + 1);
    target.setHours(nextHour, 0, 0, 0);

    const diff = target - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    countdownEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  updateTimer();
  setInterval(updateTimer, 1000);
}

function startQuiz() {
  state.currentQuestionIndex = 0;
  state.score = 0;
  lockedScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');
  loadQuestion();
}

function loadQuestion() {
  clearInterval(state.timerInterval);
  state.timeLeft = 15;
  document.getElementById('question-timer').textContent = state.timeLeft;

  const currentQ = sampleQuestions[state.currentQuestionIndex];
  document.getElementById('question-number').textContent = `Question ${state.currentQuestionIndex + 1}/${sampleQuestions.length}`;
  document.getElementById('question-text').textContent = currentQ.q;

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  currentQ.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.onclick = () => selectOption(idx);
    optionsContainer.appendChild(btn);
  });

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    document.getElementById('question-timer').textContent = state.timeLeft;
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      selectOption(-1);
    }
  }, 1000);
}

function selectOption(selectedIdx) {
  clearInterval(state.timerInterval);
  const currentQ = sampleQuestions[state.currentQuestionIndex];
  if (selectedIdx === currentQ.answer) state.score++;

  state.currentQuestionIndex++;
  if (state.currentQuestionIndex < sampleQuestions.length) {
    loadQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  quizScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  const reward = state.score === sampleQuestions.length ? 5.0 : 0.0;
  state.cash += reward;

  document.getElementById('result-msg').textContent = `Score: ${state.score}/${sampleQuestions.length}`;
  document.getElementById('result-reward').textContent = `+$${reward.toFixed(2)}`;
  updateUI();
}

function attachEventListeners() {
  demoPlayBtn.onclick = startQuiz;
  backHomeBtn.onclick = () => {
    resultScreen.classList.add('hidden');
    lockedScreen.classList.remove('hidden');
  };

  openShopBtn.onclick = () => shopModal.classList.remove('hidden');
  closeShopBtn.onclick = () => shopModal.classList.add('hidden');

  // M-Pesa STK Push Trigger
  document.querySelectorAll('.btn-buy').forEach(button => {
    button.onclick = async (e) => {
      const packageId = e.target.dataset.package;
      const phone = prompt("Enter your M-Pesa phone number (Format: 2547XXXXXXXX):");

      if (!phone) return;

      try {
        const response = await fetch('/api/mpesa-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, packageId })
        });
        const data = await response.json();

        if (data.success) {
          alert('STK Push sent! Please enter your M-Pesa PIN on your phone.');
          shopModal.classList.add('hidden');
          if (data.coins) {
            state.coins += data.coins;
            updateUI();
          }
        } else {
          alert('Error: ' + (data.error || 'Payment failed.'));
        }
      } catch (err) {
        console.error('Network Error:', err);
        alert('Could not connect to payment server.');
      }
    };
  });

  // Hints
  document.getElementById('hint-5050').onclick = () => {
    if (state.coins < 20) return alert("Not enough coins!");
    state.coins -= 20;
    updateUI();

    const currentQ = sampleQuestions[state.currentQuestionIndex];
    let removed = 0;
    document.querySelectorAll('.option-btn').forEach((btn, idx) => {
      if (idx !== currentQ.answer && removed < 2) {
        btn.style.opacity = '0.3';
        btn.disabled = true;
        removed++;
      }
    });
  };

  document.getElementById('hint-time').onclick = () => {
    if (state.coins < 15) return alert("Not enough coins!");
    state.coins -= 15;
    state.timeLeft += 10;
    document.getElementById('question-timer').textContent = state.timeLeft;
    updateUI();
  };
}

document.addEventListener('DOMContentLoaded', init);
