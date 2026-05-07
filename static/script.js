const synth = window.speechSynthesis;
function stopSpeaking() {
  synth.cancel();
}
let recognition = null;

const msg = document.getElementById("msg");
const chatWindow = document.getElementById("chatWindow");

let thinkingEl = null;
let micBars = [];
let micInterval = null;
let currentController = null;
let isProcessing = false;

/* ================= VOICE ================= */

function initRecognition() {

  recognition = new webkitSpeechRecognition();

  recognition.lang = "en-US";

  recognition.continuous = false;

  recognition.onstart = startMicAnimation;

  recognition.onresult = e => {

    msg.value = e.results[0][0].transcript;

    stopMicAnimation();

    send();

  };

  recognition.onend = stopMicAnimation;
}

function startVoice() {

  /* STOP OLD AI REQUEST */
  if (currentController) {
    currentController.abort();
  }

  removeThinking();

  stopMicAnimation();

  synth.cancel();

  if (!recognition) {
    initRecognition();
  }

  msg.value = "";

  recognition.start();
}

function stopVoice() {

  if (recognition) recognition.abort();

  synth.cancel();

  stopMicAnimation();
}

/* ================= CHAT ================= */

async function send() {
  stopSpeaking();

  const text = msg.value.trim();

  if (!text) return;

  /* STOP PREVIOUS REQUEST */
  if (currentController) {
    currentController.abort();
  }

  currentController = new AbortController();

  isProcessing = true;
  const hero = document.getElementById("heroSection");

if (hero) {
  hero.style.display = "none";
}
  appendUser(text);

  msg.value = "";

  showThinking();

  scrollDown();

  try {

    const res = await fetch("/chat", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message: text
      }),

      signal: currentController.signal

    });

    const data = await res.json();

    removeThinking();

    isProcessing = false;

    if (!data.response || data.error) {

      appendBot("⚠️ AI service unavailable.");

      return;
    }

    appendBot(data.response);

    speak(data.response);

    scrollDown();

  }

  catch(err) {

    removeThinking();

    isProcessing = false;

    if (err.name === "AbortError") {

      console.log("Previous request aborted");

      return;
    }

    appendBot("⚠️ Request interrupted.");

  }
}

/* ================= BUBBLES ================= */

function appendUser(text) {

  const div = document.createElement("div");

  div.className = "user-msg";

  div.innerText = text;

  chatWindow.appendChild(div);
}

function appendBot(text) {

  const div = document.createElement("div");

  div.className = "bot-msg";

  div.innerText = text;

  chatWindow.appendChild(div);
}

/* ================= THINKING ================= */

function showThinking() {

  thinkingEl = document.createElement("div");

  thinkingEl.className = "thinking-bubble";

  thinkingEl.innerHTML = `
    <div class="thinking-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  chatWindow.appendChild(thinkingEl);
}

function removeThinking() {

  if (thinkingEl) {

    thinkingEl.remove();

    thinkingEl = null;

  }
}

/* ================= MIC ANIMATION ================= */

function startMicAnimation() {

  let mic = document.getElementById("micWave");

  mic.classList.remove("hidden");

  micBars = mic.querySelectorAll("span");

  micInterval = setInterval(() => {

    micBars.forEach(bar => {

      bar.style.height = `${8 + Math.random() * 24}px`;

    });

  }, 120);
}

function stopMicAnimation() {

  const mic = document.getElementById("voiceVisualizer");

  mic.classList.add("hidden");

  clearInterval(micInterval);
}

/* ================= UTILS ================= */

function scrollDown() {

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function speak(text) {

  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);

  synth.speak(utter);
}

function handleKey(e) {

  if (e.key === "Enter") send();
}

/* ================= NEW CHAT ================= */

async function newChat() {

  stopSpeaking();

  await fetch("/clear-chat", {
    method: "POST"
  });

  chatWindow.innerHTML = `
    <div class="bot-msg">
      Hello 👋 I’m your AI assistant. Ask me anything.
    </div>
  `;

  scrollDown();
}
/* ================= LOAD HISTORY ================= */

function loadHistory(message, response){
  stopSpeaking();

  // HIDE HERO WHEN OPENING HISTORY
  const hero = document.querySelector(".hero");

  if(hero){
    hero.style.display = "none";
  }

  chatWindow.innerHTML = `
    <div class="bot-msg">
      Hello 👋 I’m your AI assistant. Ask me anything.
    </div>
  `;

  setTimeout(() => {

    appendUser(message);

    appendBot(response);

    scrollDown();

  }, 150);
}

function startMicAnimation() {

  const mic = document.getElementById("voiceVisualizer");

  mic.classList.remove("hidden");

  micBars = mic.querySelectorAll("span");

  micInterval = setInterval(() => {

    micBars.forEach(bar => {

      const height = 10 + Math.random() * 28;

      bar.style.height = `${height}px`;

    });

  }, 90);
}

window.addEventListener("beforeunload", () => {
  speechSynthesis.cancel();
});