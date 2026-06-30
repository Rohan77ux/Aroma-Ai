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
  attachedFile?: { name: string; size: number; type: string; url?: string };
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

// ── Animated thinking bubble ───────────────────────────────────
function ThinkingBubble() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
        <span className="text-xs font-bold text-white">A</span>
      </div>
      <div className="bg-[#1a1a28] border border-white/[0.06] rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-xl">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-violet-300/50 font-medium tracking-widest uppercase mr-2">
            Thinking
          </span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-400"
              style={{
                animation: `dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
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
    <div className="flex items-center gap-1 px-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] bg-rose-400 rounded-full"
          style={{
            height: `${10 + (i % 3) * 6}px`,
            animation: `wave 0.7s ease-in-out ${i * 0.1}s infinite alternate`,
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
      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 relative overflow-hidden ${
        active
          ? "bg-violet-600/15 text-violet-100 border border-violet-500/25"
          : "hover:bg-white/[0.04] text-white/45 hover:text-white/75 border border-transparent"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-400 rounded-r-full" />
      )}
      <p className="text-[13px] font-medium truncate leading-tight">
        {session.title || "New conversation"}
      </p>
      <p
        className={`text-[11px] mt-0.5 ${active ? "text-violet-300/40" : "text-white/20"}`}
      >
        {formatted}
      </p>
    </button>
  );
}

// ── File attachment preview in chat ────────────────────────────
function FileAttachmentBubble({
  attachedFile,
}: {
  attachedFile: Message["attachedFile"];
}) {
  if (!attachedFile) return null;

  const isImage = attachedFile.type.startsWith("image/");
  const isPDF = attachedFile.type === "application/pdf";
  const sizeKB = (attachedFile.size / 1024).toFixed(0);

  const handleOpen = () => {
    if (attachedFile.url) {
      window.open(attachedFile.url, "_blank");
    }
  };

  if (isImage && attachedFile.url) {
    return (
      <div className="flex justify-end mb-1">
        <div
          className="max-w-[72%] rounded-2xl rounded-tr-sm overflow-hidden cursor-pointer border border-white/10 hover:border-violet-400/40 transition-all group relative"
          onClick={handleOpen}
        >
          <img
            src={attachedFile.url}
            alt={attachedFile.name}
            className="w-full max-h-64 object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-2">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </div>
          </div>
          <p className="text-white/60 text-[11px] px-3 py-1.5 bg-black/40 truncate">
            {attachedFile.name}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end mb-1">
      <button
        onClick={handleOpen}
        className="flex items-center gap-3 bg-gradient-to-br from-violet-600/90 to-indigo-700/90 hover:from-violet-500/90 hover:to-indigo-600/90 border border-violet-400/20 px-4 py-3 rounded-2xl rounded-tr-sm shadow-lg shadow-violet-500/10 transition-all group max-w-[72%]"
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/10 group-hover:bg-white/15 transition flex items-center justify-center">
          {isPDF ? (
            <svg
              className="w-5 h-5 text-white/80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-white/80"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-white text-[13px] font-medium truncate">
            {attachedFile.name}
          </p>
          <p className="text-white/45 text-[11px] mt-0.5 flex items-center gap-1">
            <span>
              {isPDF ? "PDF" : attachedFile.type.split("/")[1]?.toUpperCase()}
            </span>
            <span className="text-white/25">·</span>
            <span>{sizeKB} KB</span>
            {attachedFile.url && (
              <>
                <span className="text-white/25">·</span>
                <span className="text-violet-300/70 group-hover:text-violet-200 transition">
                  Click to view
                </span>
              </>
            )}
          </p>
        </div>
        {attachedFile.url && (
          <svg
            className="w-4 h-4 text-white/30 group-hover:text-white/60 flex-shrink-0 transition"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Chat message ───────────────────────────────────────────────
function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div>
        {msg.attachedFile && (
          <FileAttachmentBubble attachedFile={msg.attachedFile} />
        )}
        {msg.content && (
          <div className="flex justify-end">
            <div className="max-w-[72%] bg-gradient-to-br from-violet-600 to-indigo-700 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-lg shadow-violet-500/10 text-sm leading-relaxed">
              {msg.content}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 mt-0.5">
        <span className="text-xs font-bold text-white">A</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-[#1a1a28] border border-white/[0.06] rounded-2xl rounded-tl-sm px-5 py-4 shadow-xl">
          <div
            className="prose prose-invert prose-sm max-w-none leading-relaxed
              prose-p:text-white/75 prose-p:leading-relaxed
              prose-headings:text-white prose-headings:font-semibold
              prose-code:bg-white/[0.06] prose-code:text-violet-300 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
              prose-pre:bg-[#10101a] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl
              prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white prose-li:text-white/65
              prose-ul:space-y-1 prose-ol:space-y-1
              prose-blockquote:border-l-violet-500 prose-blockquote:text-white/45"
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

// ── File preview chip (input area) ────────────────────────────
function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith("image/");
  const isPDF = file.type === "application/pdf";
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  return (
    <div className="flex items-center gap-2 bg-[#1a1a28] border border-white/[0.08] px-2.5 py-1.5 rounded-xl max-w-[220px] group">
      {isImage && preview ? (
        <img
          src={preview}
          alt=""
          className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isPDF ? "bg-rose-500/15" : "bg-violet-500/15"}`}
        >
          {isPDF ? (
            <svg
              className="w-3.5 h-3.5 text-rose-400"
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
          ) : (
            <svg
              className="w-3.5 h-3.5 text-violet-400"
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
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-white/60 truncate leading-tight">
          {file.name}
        </p>
        <p className="text-[10px] text-white/25">
          {(file.size / 1024).toFixed(0)} KB
        </p>
      </div>
      <button
        onClick={onRemove}
        className="ml-1 text-white/20 hover:text-white/60 transition flex-shrink-0 opacity-0 group-hover:opacity-100"
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
  );
}

// ── Drag overlay ───────────────────────────────────────────────
function DragOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d14]/90 backdrop-blur-sm border-2 border-dashed border-violet-500/60 rounded-none pointer-events-none">
      <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-violet-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>
      <p className="text-white/80 font-semibold text-base">
        Drop your file here
      </p>
      <p className="text-white/35 text-sm mt-1">PDF or image</p>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  const suggestions = [
    { icon: "📄", text: "Summarize a document for me" },
    { icon: "💡", text: "Help me brainstorm ideas" },
    { icon: "🔍", text: "Explain a complex topic simply" },
    { icon: "💻", text: "Write and review my code" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center select-none">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30 mb-5">
        <span className="text-2xl font-black text-white">A</span>
      </div>
      <h2 className="text-[22px] font-bold text-white mb-1.5 tracking-tight">
        Aroma AI
      </h2>
      <p className="text-white/35 text-sm mb-8 max-w-xs leading-relaxed">
        Ask anything, upload a PDF or image, or speak your question.
      </p>
      <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => onSuggestion(s.text)}
            className="bg-[#1a1a28] border border-white/[0.06] hover:border-violet-500/35 hover:bg-violet-500/[0.06]
              text-white/55 hover:text-white/85 text-[12px] text-left px-3.5 py-3 rounded-xl
              transition-all duration-200 leading-snug flex items-start gap-2.5"
          >
            <span className="text-base leading-none mt-0.5">{s.icon}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
      <p className="text-white/20 text-[11px] mt-8 flex items-center gap-1.5">
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        Drag &amp; drop a PDF or image anywhere to upload
      </p>
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
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mainAreaRef = useRef<HTMLDivElement | null>(null);

  // Track object URLs so we can revoke them when messages are cleared
  const objectURLsRef = useRef<string[]>([]);

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

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // ── Drag-and-drop handlers ────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;

    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ];
    if (allowed.includes(dropped.type)) {
      setFile(dropped);
      inputRef.current?.focus();
    } else {
      alert("Only PDF and image files are supported.");
    }
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
    // Revoke old object URLs
    objectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectURLsRef.current = [];
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setFile(null);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Voice recording ───────────────────────────────────────────
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

      // Snapshot the file before clearing it
      const currentFile = file;

      // Create object URL for the file so it stays viewable after state clears
      let fileObjectURL: string | undefined;
      if (currentFile) {
        fileObjectURL = URL.createObjectURL(currentFile);
        objectURLsRef.current.push(fileObjectURL);
      }

      const newMessages: Message[] = [];

      // Single combined message carrying both the file attachment and text
      if (currentFile || text.trim()) {
        newMessages.push({
          role: "user",
          content: text.trim(),
          id: generateId(),
          attachedFile: currentFile
            ? {
                name: currentFile.name,
                size: currentFile.size,
                type: currentFile.type,
                url: fileObjectURL,
              }
            : undefined,
        });
      }

      setMessages((prev) => [...prev, ...newMessages]);
      setInput("");
      // ✅ Clear the file immediately so the chip disappears right away
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setLoading(true);

      try {
        if (currentFile) {
          const fd = new FormData();
          fd.append("file", currentFile);
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
        * { font-family: 'Geist', system-ui, sans-serif; }
        code, pre { font-family: 'Geist Mono', monospace; }

        @keyframes dot-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.75); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes wave {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1.6); }
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .msg-animate { animation: msg-in 0.22s ease forwards; }
        .sidebar-fade { animation: fade-in 0.18s ease forwards; }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.13); }
      `}</style>

      <div
        className="flex h-screen bg-[#0d0d14] text-white overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && <DragOverlay />}

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden sidebar-fade"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-40 w-[260px] bg-[#0f0f1a] border-r border-white/[0.04]
            flex flex-col transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        >
          <div className="px-3.5 pt-5 pb-4">
            <div className="flex items-center gap-2.5 mb-4 px-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <span className="text-[12px] font-black text-white">A</span>
              </div>
              <span className="font-semibold text-white/90 text-sm tracking-tight">
                Aroma AI
              </span>
            </div>

            <button
              onClick={newChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium
                transition-all duration-150 shadow-lg shadow-violet-500/20"
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
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New conversation
            </button>
          </div>

          <div className="px-3.5 mb-3">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20"
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
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.05] rounded-lg pl-7 pr-3 py-1.5
                  text-[12px] text-white/55 placeholder:text-white/18 focus:outline-none
                  focus:border-violet-500/35 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-4">
            {Object.entries(grouped).map(([group, items]) =>
              items.length > 0 ? (
                <div key={group}>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/18 font-semibold px-2 mb-1.5">
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
              <div className="text-center py-10 text-white/18 text-[12px]">
                {searchQuery
                  ? "No matching conversations"
                  : "No conversations yet"}
              </div>
            )}
          </div>

          <div className="px-3 py-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.04] cursor-pointer transition group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-[11px] font-bold">
                U
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white/60 truncate group-hover:text-white/80 transition">
                  My Account
                </p>
                <p className="text-[10px] text-white/25">Free plan</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div
          ref={mainAreaRef}
          className="flex-1 flex flex-col min-w-0 relative"
        >
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-[#0d0d14]/80 backdrop-blur-xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-white/[0.05] text-white/35 hover:text-white/70 transition"
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
                    strokeWidth={1.5}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-[13px] font-semibold text-white/85 leading-none">
                  {sessions.find((s) => s.id === sessionId)?.title ||
                    "New conversation"}
                </h1>
                {messages.length > 0 && (
                  <p className="text-[10px] text-white/25 mt-0.5">
                    {messages.filter((m) => m.role === "user").length} messages
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload file"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/30 hover:text-white/65 hover:bg-white/[0.05] transition text-[11px]"
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="hidden sm:inline">Upload</span>
              </button>

              <button className="p-1.5 rounded-lg hover:bg-white/[0.05] text-white/25 hover:text-white/65 transition">
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
              <div className="max-w-[680px] mx-auto px-4 py-6 space-y-5">
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

          {/* ── Input area ── */}
          <div className="px-4 pb-4 pt-2.5 bg-[#0d0d14] flex-shrink-0">
            <div className="max-w-[680px] mx-auto">
              {/* File preview chip — only shows when a file is staged */}
              {file && (
                <div className="mb-2">
                  <FileChip
                    file={file}
                    onRemove={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                </div>
              )}

              {!file && (
                <p className="text-[10px] text-white/15 mb-1.5 ml-1 flex items-center gap-1">
                  <svg
                    className="w-2.5 h-2.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Drop a PDF or image to attach
                </p>
              )}

              {/* Input box */}
              <div
                className={`flex items-end gap-1.5 bg-[#191924] border rounded-2xl px-2.5 py-2 shadow-2xl
                  transition-all duration-200
                  ${
                    recording
                      ? "border-rose-400/40 shadow-rose-500/5"
                      : isDragging
                        ? "border-violet-500/50 shadow-violet-500/10"
                        : "border-white/[0.06] hover:border-white/[0.10] focus-within:border-violet-500/35 focus-within:shadow-violet-500/8"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  className="flex-shrink-0 p-1.5 rounded-lg text-white/22 hover:text-white/55 hover:bg-white/[0.04] transition"
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

                <div className="flex-1 min-w-0">
                  {recording ? (
                    <div className="flex items-center h-9">
                      <RecordingIndicator />
                      <span className="text-[12px] text-rose-400 ml-1">
                        Recording…
                      </span>
                    </div>
                  ) : (
                    <input
                      ref={inputRef}
                      className="w-full bg-transparent outline-none text-[13.5px] text-white/80
                        placeholder:text-white/18 py-1.5 leading-relaxed"
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

                <button
                  onClick={recording ? stopRecording : startRecording}
                  title={recording ? "Stop recording" : "Voice input"}
                  className={`flex-shrink-0 p-1.5 rounded-lg transition-all duration-150
                    ${
                      recording
                        ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                        : "text-white/22 hover:text-white/55 hover:bg-white/[0.04]"
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

                <button
                  onClick={() => sendMessage()}
                  disabled={loading || (!input.trim() && !file)}
                  className={`flex-shrink-0 p-2 rounded-xl transition-all duration-150
                    ${
                      (!input.trim() && !file) || loading
                        ? "bg-white/[0.04] text-white/18 cursor-not-allowed"
                        : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20"
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

              <p className="text-center text-[10px] text-white/12 mt-2">
                Aroma AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
