/* ── Marked.js (markdown parser) – loaded from CDN in index.html ─────── */
/* ── This file handles all UI logic ─────────────────────────────────── */

const SESSION_KEY = "aroma_session_id";

// ── State ──────────────────────────────────────────────────────────────
let sessionId = localStorage.getItem(SESSION_KEY) || generateId();
localStorage.setItem(SESSION_KEY, sessionId);

let pendingPdfFile = null;
let isRecording = false;
let recognition = null;
let isWaiting = false;

// ── DOM refs ───────────────────────────────────────────────────────────
const messagesWrapper = document.getElementById("messagesWrapper");
const emptyState      = document.getElementById("emptyState");
const messageInput    = document.getElementById("messageInput");
const sendBtn         = document.getElementById("sendBtn");
const voiceBtn        = document.getElementById("voiceBtn");
const pdfBtn          = document.getElementById("pdfBtn");
const pdfInput        = document.getElementById("pdfInput");
const pdfStatus       = document.getElementById("pdfStatus");
const pdfFilename     = document.getElementById("pdfFilename");
const removePdfBtn    = document.getElementById("removePdfBtn");
const newChatBtn      = document.getElementById("newChatBtn");

// ── Utilities ──────────────────────────────────────────────────────────
function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseMarkdown(text) {
  if (typeof marked !== "undefined") {
    return marked.parse(text, { breaks: true, gfm: true });
  }
  // Fallback: escape HTML and linkify
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function scrollToBottom(smooth = true) {
  messagesWrapper.scrollTo({ top: messagesWrapper.scrollHeight, behavior: smooth ? "smooth" : "instant" });
}

// ── Message rendering ──────────────────────────────────────────────────
function appendMessage(role, content, isTyping = false) {
  // Hide empty state
  emptyState.style.display = "none";

  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role === "user" ? "user-avatar" : "ai-avatar"}`;
  avatar.textContent = role === "user" ? "You" : "AI";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";

  if (isTyping) {
    contentDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    row.dataset.typing = "true";
  } else {
    contentDiv.innerHTML = role === "assistant" ? parseMarkdown(content) : escapeHtml(content);
  }

  row.appendChild(avatar);
  row.appendChild(contentDiv);
  messagesWrapper.appendChild(row);
  scrollToBottom();
  return row;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function removeTypingIndicator() {
  const typingRow = messagesWrapper.querySelector('[data-typing="true"]');
  if (typingRow) typingRow.remove();
}

// ── API calls ──────────────────────────────────────────────────────────
async function sendMessage(text) {
  if (isWaiting || !text.trim()) return;
  isWaiting = true;
  updateSendBtn();

  appendMessage("user", text);
  const typingRow = appendMessage("assistant", "", true);

  try {
    let response, data;

    if (pendingPdfFile) {
      const formData = new FormData();
      formData.append("file", pendingPdfFile);
      formData.append("question", text);
      formData.append("session_id", sessionId);

      response = await fetch("/api/upload-pdf", { method: "POST", body: formData });
      clearPdf();
    } else {
      response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
    }

    data = await response.json();
    removeTypingIndicator();

    if (response.ok) {
      appendMessage("assistant", data.reply);
      if (data.session_id) {
        sessionId = data.session_id;
        localStorage.setItem(SESSION_KEY, sessionId);
      }
    } else {
      appendMessage("assistant", `⚠️ Error: ${data.error || "Something went wrong."}`);
    }
  } catch (err) {
    removeTypingIndicator();
    appendMessage("assistant", `⚠️ Network error: ${err.message}`);
  } finally {
    isWaiting = false;
    updateSendBtn();
  }
}

// ── Send button state ──────────────────────────────────────────────────
function updateSendBtn() {
  sendBtn.disabled = isWaiting || !messageInput.value.trim();
}

// ── Event listeners ────────────────────────────────────────────────────
sendBtn.addEventListener("click", () => {
  const text = messageInput.value.trim();
  if (!text) return;
  messageInput.value = "";
  messageInput.style.height = "auto";
  updateSendBtn();
  sendMessage(text);
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + "px";
  updateSendBtn();
});

// ── Voice input ────────────────────────────────────────────────────────
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.title = "Voice input not supported in this browser";
    voiceBtn.style.opacity = "0.4";
    voiceBtn.style.cursor = "not-allowed";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (e) => {
    let transcript = "";
    for (const result of e.results) {
      transcript += result[0].transcript;
    }
    messageInput.value = transcript;
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + "px";
    updateSendBtn();
  };

  recognition.onend = () => {
    isRecording = false;
    voiceBtn.classList.remove("recording");
    voiceBtn.title = "Voice input";
  };

  recognition.onerror = (e) => {
    isRecording = false;
    voiceBtn.classList.remove("recording");
    if (e.error !== "aborted") {
      appendMessage("assistant", `⚠️ Voice recognition error: ${e.error}`);
    }
  };
}

voiceBtn.addEventListener("click", () => {
  if (!recognition) {
    appendMessage("assistant", "⚠️ Voice input is not supported in your browser. Please use Chrome or Edge.");
    return;
  }
  if (isRecording) {
    recognition.stop();
    isRecording = false;
    voiceBtn.classList.remove("recording");
  } else {
    recognition.start();
    isRecording = true;
    voiceBtn.classList.add("recording");
    voiceBtn.title = "Recording… click to stop";
  }
});

// ── PDF upload ─────────────────────────────────────────────────────────
pdfBtn.addEventListener("click", () => pdfInput.click());

pdfInput.addEventListener("change", () => {
  const file = pdfInput.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    alert("Please select a PDF file.");
    pdfInput.value = "";
    return;
  }
  pendingPdfFile = file;
  pdfFilename.textContent = file.name;
  pdfStatus.style.display = "flex";
  messageInput.placeholder = "Ask a question about the PDF…";
  messageInput.focus();
});

removePdfBtn.addEventListener("click", clearPdf);

function clearPdf() {
  pendingPdfFile = null;
  pdfInput.value = "";
  pdfStatus.style.display = "none";
  messageInput.placeholder = "Message Aroma AI…";
}

// ── New chat ───────────────────────────────────────────────────────────
newChatBtn.addEventListener("click", async () => {
  await fetch("/api/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  sessionId = generateId();
  localStorage.setItem(SESSION_KEY, sessionId);
  messagesWrapper.innerHTML = "";
  emptyState.style.display = "flex";
  clearPdf();
  messageInput.value = "";
  messageInput.style.height = "auto";
  updateSendBtn();
});

// ── Suggestion chips ───────────────────────────────────────────────────
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    messageInput.value = chip.textContent;
    messageInput.dispatchEvent(new Event("input"));
    messageInput.focus();
  });
});

// ── Init ───────────────────────────────────────────────────────────────
setupSpeechRecognition();
updateSendBtn();
