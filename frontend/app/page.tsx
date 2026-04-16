"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import axios from "axios";

type Message = {
  role: "user" | "ai";
  content: string;
  audio?: string;
};

const API = "http://127.0.0.1:8000";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Fetch sessions
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

  // Load session
  const loadSession = async (id: string) => {
    const res = await axios.get(`${API}/messages/${id}`);
    setMessages(
      res.data.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    );
    setSessionId(id);
    setSidebarOpen(false);
  };

  // New chat
  const newChat = () => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setSidebarOpen(false);
  };

  // =========================
  // 🎤 VOICE LOGIC (FIXED)
  // =========================
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    audioChunks.current = [];

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      sendVoice();

      // 🔴 Stop mic completely
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
    setRecording(true);

    // ⏱️ Auto stop (ChatGPT-like)
    setTimeout(() => {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        setRecording(false);
      }
    }, 4000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);

    // safety stop
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const sendVoice = async () => {
    const blob = new Blob(audioChunks.current, {
      type: "audio/webm",
    });

    const file = new File([blob], "voice.webm");

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    try {
      const res = await axios.post(`${API}/voice`, formData);

      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: `🎤 ${res.data.user_text}`,
        },
        {
          role: "ai",
          content: res.data.response,
          audio: res.data.audio_url,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Voice error" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // TEXT CHAT
  // =========================
  const uploadFile = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId);
    await axios.post(`${API}/upload`, formData);
  };

  const sendMessage = async () => {
    if (!input.trim() && !file) return;

    if (file) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `📄 ${file.name}` },
      ]);
    }

    if (input.trim()) {
      setMessages((prev) => [...prev, { role: "user", content: input }]);
    }

    setInput("");
    setLoading(true);

    try {
      if (file) await uploadFile();

      const res = await axios.post(`${API}/chat`, {
        message: input || "Summarize document",
        session_id: sessionId,
      });

      setMessages((prev) => [
        ...prev,
        { role: "ai", content: res.data.response },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "⚠️ Error" }]);
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#343541] text-white">
      {/* Sidebar */}
      <div
        className={`fixed md:static z-40 top-0 left-0 h-full w-64 bg-[#202123]
        transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
        md:translate-x-0 transition flex flex-col`}
      >
        <div className="p-3">
          <button
            onClick={newChat}
            className="w-full py-2 rounded border border-gray-600 hover:bg-gray-700"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => loadSession(s.id)}
              className={`p-2 rounded cursor-pointer text-sm truncate
              ${sessionId === s.id ? "bg-[#343541]" : "hover:bg-[#2a2b32]"}`}
            >
              {s.title}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center px-4 py-3 border-b border-gray-700 bg-[#343541]">
          <button
            className="text-xl md:hidden mr-3"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <span className="font-semibold">Aroma AI</span>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 space-y-6">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-[#444654] px-4 py-2 rounded-lg max-w-xs">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="prose prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {msg.audio && (
                      <audio controls className="mt-2">
                        <source src={`${API}${msg.audio}`} />
                      </audio>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-center text-gray-400">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-700 bg-[#343541]">
          <div className="max-w-3xl mx-auto">
            {file && (
              <div className="mb-2 bg-[#444654] p-2 rounded flex justify-between">
                📄 {file.name}
                <button onClick={() => setFile(null)}>✕</button>
              </div>
            )}

            <div className="flex items-center bg-[#40414f] rounded-lg px-3 py-2">
              {/* 🎤 MIC */}
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`mr-2 text-xl ${
                  recording
                    ? "text-red-500 animate-pulse"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                🎤
              </button>

              {/* FILE */}
              <input
                type="file"
                className="hidden"
                id="fileInput"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />

              <button
                onClick={() => document.getElementById("fileInput")?.click()}
                className="mr-2 text-gray-400"
              >
                +
              </button>

              {/* INPUT */}
              <input
                className="flex-1 bg-transparent outline-none text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={recording ? "Recording..." : "Send a message..."}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />

              {/* SEND */}
              <button
                onClick={sendMessage}
                className="ml-2 bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
