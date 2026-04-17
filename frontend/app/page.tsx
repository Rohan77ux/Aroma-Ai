"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import axios from "axios";

type Message = {
  role: "user" | "ai";
  content: string;
  audio?: string;
  id: string;
  thinking?: boolean;
};

type Session = {
  id: string;
  title: string;
  created_at: string;
};

const API = "http://127.0.0.1:8000";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Animated dots ──────────────────────────────────────────────
function ThinkingBubble() {
  return (
    <div className="flex items-start gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
        <span className="text-xs font-bold text-white">A</span>
      </div>
      <div className="bg-[#1e1e2e] border border-white/5 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-xl">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-violet-300/60 font-medium tracking-widest uppercase mr-2">
            Thinking
          </span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-400"
              style={{
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Recording waveform ─────────────────────────────────────────
function RecordingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-0.5 bg-rose-400 rounded-full"
          style={{
            height: `${12 + Math.random() * 12}px`,
            animation: `wave 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ── Sidebar session item ───────────────────────────────────────
function SessionItem({
  session,
  active,
  onClick,
}: {
  session: Session;
  active: boolean;
  onClick: () => void;
}) {
  const date = new Date(session.created_at);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 group relative overflow-hidden ${
        active
          ? "bg-violet-600/20 text-violet-100 border border-violet-500/30"
          : "hover:bg-white/5 text-white/50 hover:text-white/80 border border-transparent"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-400 rounded-r-full" />
      )}
      <p className="text-sm font-medium truncate leading-tight">
        {session.title || "New conversation"}
      </p>
      <p
        className={`text-xs mt-0.5 ${active ? "text-violet-300/50" : "text-white/25"}`}
      >
        {formatted}
      </p>
    </button>
  );
}

// ── Chat message ───────────────────────────────────────────────
function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] bg-gradient-to-br from-violet-600 to-indigo-700 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-lg shadow-violet-500/10 text-sm leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 mt-0.5">
        <span className="text-xs font-bold text-white">A</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-[#1e1e2e] border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4 shadow-xl">
          <div
            className="prose prose-invert prose-sm max-w-none leading-relaxed
            prose-p:text-white/80 prose-p:leading-relaxed
            prose-headings:text-white prose-headings:font-semibold
            prose-code:bg-white/5 prose-code:text-violet-300 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
            prose-pre:bg-[#13131f] prose-pre:border prose-pre:border-white/5 prose-pre:rounded-xl
            prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white
            prose-li:text-white/70
            prose-ul:space-y-1 prose-ol:space-y-1
            prose-blockquote:border-l-violet-500 prose-blockquote:text-white/50"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
        {msg.audio && (
          <div className="mt-2 ml-1">
            <audio
              controls
              className="h-8 w-full max-w-xs rounded-full"
              style={{ filter: "invert(1) hue-rotate(200deg) brightness(0.8)" }}
            >
              <source src={`${API}${msg.audio}`} />
            </audio>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  const suggestions = [
    "Summarize a document for me",
    "Help me brainstorm ideas",
    "Explain a complex topic simply",
    "Write and review my code",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center shadow-2xl shadow-violet-500/30 mb-6">
        <span className="text-2xl font-black text-white">A</span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-1">Aroma AI</h2>
      <p className="text-white/40 text-sm mb-10 max-w-xs">
        Your intelligent assistant — ask anything, upload files, or speak your
        question.
      </p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="bg-[#1e1e2e] border border-white/5 hover:border-violet-500/40 hover:bg-violet-500/5
              text-white/60 hover:text-white/90 text-xs text-left px-4 py-3 rounded-xl
              transition-all duration-200 leading-snug"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    axios.get(`${API}/sessions`).then((res) => {
      if (Array.isArray(res.data)) {
        const sorted = res.data.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setSessions(sorted);
      }
    });
  }, []);

  const loadSession = async (id: string) => {
    const res = await axios.get(`${API}/messages/${id}`);
    setMessages(
      res.data.map((m: any) => ({
        role: m.role,
        content: m.content,
        id: generateId(),
      })),
    );
    setSessionId(id);
    setSidebarOpen(false);
  };

  const newChat = () => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Voice recording
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunks.current = [];

    mediaRecorder.ondataavailable = (e) => audioChunks.current.push(e.data);
    mediaRecorder.onstop = () => {
      sendVoice();
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorder.start();
    setRecording(true);

    setTimeout(() => {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        setRecording(false);
      }
    }, 10000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const sendVoice = async () => {
    const blob = new Blob(audioChunks.current, { type: "audio/webm" });
    const voiceFile = new File([blob], "voice.webm");
    const formData = new FormData();
    formData.append("file", voiceFile);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/voice`, formData);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `🎤 ${res.data.user_text}`, id: generateId() },
        {
          role: "ai",
          content: res.data.response,
          audio: res.data.audio_url,
          id: generateId(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "⚠️ Voice processing failed. Please try again.",
          id: generateId(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = useCallback(
    async (overrideInput?: string) => {
      const text = overrideInput ?? input;
      if (!text.trim() && !file) return;

      const newMessages: Message[] = [];
      if (file)
        newMessages.push({
          role: "user",
          content: `📄 ${file.name}`,
          id: generateId(),
        });
      if (text.trim())
        newMessages.push({ role: "user", content: text, id: generateId() });

      setMessages((prev) => [...prev, ...newMessages]);
      setInput("");
      setLoading(true);

      try {
        if (file) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("session_id", sessionId);
          await axios.post(`${API}/upload`, fd);
        }

        const res = await axios.post(`${API}/chat`, {
          message: text || "Summarize document",
          session_id: sessionId,
        });

        setMessages((prev) => [
          ...prev,
          { role: "ai", content: res.data.response, id: generateId() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: "⚠️ Something went wrong. Please try again.",
            id: generateId(),
          },
        ]);
      } finally {
        setLoading(false);
        setFile(null);
      }
    },
    [input, file, sessionId],
  );

  const filteredSessions = sessions.filter((s) =>
    (s.title || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Group sessions by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const grouped: Record<string, Session[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Older: [],
  };

  filteredSessions.forEach((s) => {
    const d = new Date(s.created_at);
    if (d >= today) grouped["Today"].push(s);
    else if (d >= yesterday) grouped["Yesterday"].push(s);
    else if (d >= weekAgo) grouped["This week"].push(s);
    else grouped["Older"].push(s);
  });

  return (
    <>
      {/* Global keyframe styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
        * { font-family: 'Geist', system-ui, sans-serif; }
        code, pre { font-family: 'Geist Mono', monospace; }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes wave {
          0% { transform: scaleY(0.5); }
          100% { transform: scaleY(1.5); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .msg-animate {
          animation: slideIn 0.25s ease forwards;
        }
        .sidebar-backdrop {
          animation: fadeIn 0.2s ease forwards;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      <div className="flex h-screen bg-[#0d0d14] text-white overflow-hidden">
        {/* ── Sidebar overlay (mobile) ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-[#111118] border-r border-white/[0.04]
            flex flex-col transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        >
          {/* Logo */}
          <div className="px-4 pt-5 pb-4">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <span className="text-sm font-black text-white">A</span>
              </div>
              <span className="font-semibold text-white tracking-tight">
                Aroma AI
              </span>
            </div>

            <button
              onClick={newChat}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                bg-blue-400 hover:bg-violet-500 text-shadow-white text-sm font-medium
                transition-all duration-150 shadow-lg shadow-violet-500/20"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New conversation
            </button>
          </div>

          {/* Search */}
          <div className="px-4 mb-3">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"
                />
              </svg>
              <input
                type="text"
                placeholder="Search conversations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-xl pl-8 pr-3 py-2
                  text-xs text-white/60 placeholder:text-white/20 focus:outline-none
                  focus:border-violet-500/40 focus:bg-violet-500/5 transition-all"
              />
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
            {Object.entries(grouped).map(([group, items]) =>
              items.length > 0 ? (
                <div key={group}>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 font-semibold px-2 mb-1.5">
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((s) => (
                      <SessionItem
                        key={s.id}
                        session={s}
                        active={s.id === sessionId}
                        onClick={() => loadSession(s.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            {filteredSessions.length === 0 && (
              <div className="text-center py-8 text-white/20 text-xs">
                {searchQuery
                  ? "No matching conversations"
                  : "No conversations yet"}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-xs font-bold">
                U
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/70 truncate">
                  My Account
                </p>
                <p className="text-[10px] text-white/30">Free plan</p>
              </div>
              <svg
                className="w-3.5 h-3.5 text-white/20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0..."
                />
              </svg>
            </div>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.04] bg-[#0d0d14]/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition"
                onClick={() => setSidebarOpen(true)}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-sm font-semibold text-white/90 leading-none">
                  {sessions.find((s) => s.id === sessionId)?.title ||
                    "New conversation"}
                </h1>
                {messages.length > 0 && (
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {messages.filter((m) => m.role === "user").length} messages
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/70 transition">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </button>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 && !loading ? (
              <EmptyState onSuggestion={(s) => sendMessage(s)} />
            ) : (
              <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className="msg-animate">
                    <ChatMessage msg={msg} />
                  </div>
                ))}
                {loading && <ThinkingBubble />}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="px-4 pb-5 pt-3 bg-[#0d0d14]">
            <div className="max-w-2xl mx-auto">
              {/* File chip */}
              {file && (
                <div
                  className="mb-2 flex items-center gap-2 bg-[#2d2d43] border border-white/5
                  px-3 py-2 rounded-xl w-fit max-w-full"
                >
                  <svg
                    className="w-3.5 h-3.5 text-violet-300 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-xs text-white/60 truncate max-w-[200px]">
                    {file.name}
                  </span>
                  <button
                    onClick={() => setFile(null)}
                    className="ml-1 text-white/25 hover:text-white/70 transition flex-shrink-0"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {/* Input box */}
              <div
                className={`flex items-end gap-2 bg-[#1c1c27] border rounded-2xl px-3 py-2.5 shadow-2xl
                transition-all duration-200
                ${
                  recording
                    ? "border-rose-300/50 shadow-rose-500/10"
                    : "border-white/[0.07] hover:border-white/[0.12] focus-within:border-violet-500/40 focus-within:shadow-violet-500/10"
                }`}
              >
                {/* Attach */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  className="flex-shrink-0 p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                </button>

                {/* Text input */}
                <div className="flex-1 min-w-0">
                  {recording ? (
                    <div className="flex items-center h-9">
                      <RecordingIndicator />
                      <span className="text-xs text-rose-400 ml-1">
                        Recording…
                      </span>
                    </div>
                  ) : (
                    <input
                      ref={inputRef}
                      className="w-full bg-transparent outline-none text-sm text-white/85
                        placeholder:text-white/20 py-1.5 leading-relaxed"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask anything…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={loading}
                    />
                  )}
                </div>

                {/* Mic */}
                <button
                  onClick={recording ? stopRecording : startRecording}
                  title={recording ? "Stop recording" : "Voice input"}
                  className={`flex-shrink-0 p-1.5 rounded-lg transition-all duration-150
                    ${
                      recording
                        ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                        : "text-white/25 hover:text-white/60 hover:bg-white/5"
                    }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>

                {/* Send */}
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || (!input.trim() && !file)}
                  className={`flex-shrink-0 p-2 rounded-xl transition-all duration-150
                    ${
                      (!input.trim() && !file) || loading
                        ? "bg-white/5 text-white/20 cursor-not-allowed"
                        : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                    }`}
                >
                  {loading ? (
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <p className="text-center text-[10px] text-white/15 mt-2.5">
                Aroma AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
