"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", content: input };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMsg.content }),
      });

      const data = await res.json();

      const aiMsg: Message = {
        role: "ai",
        content: data.response,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Error connecting to backend" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`h-screen flex flex-col transition-colors duration-300 ${
        darkMode ? "bg-[#0b0f19] text-white" : "bg-gray-100 text-black"
      }`}
    >
      {/* Header */}
      <div
        className={`flex justify-between items-center px-6 py-3 border-b ${
          darkMode ? "border-gray-800" : "border-gray-300"
        }`}
      >
        <div className="font-semibold text-lg">Aroma AI</div>

        {/* Toggle Button */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="text-sm px-3 py-1 rounded-md border"
        >
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center mt-20 opacity-70">
              <h1 className="text-2xl font-semibold mb-2">
                How can I help you today?
              </h1>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div
                    className={`px-4 py-2 rounded-2xl max-w-[75%] text-sm ${
                      darkMode
                        ? "bg-blue-500 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  {/* AI Avatar */}
                  <div
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm ${
                      darkMode ? "bg-green-500" : "bg-green-600 text-white"
                    }`}
                  >
                    🤖
                  </div>

                  {/* AI Message */}
                  <div
                    className={`prose max-w-none text-sm ${
                      darkMode ? "prose-invert" : ""
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500">
                🤖
              </div>
              <div className="text-sm opacity-60 animate-pulse">
                Thinking...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Area */}
      <div
        className={`border-t p-4 ${
          darkMode ? "bg-[#0b0f19] border-gray-800" : "bg-white border-gray-300"
        }`}
      >
        <div
          className={`max-w-3xl mx-auto flex items-center gap-2 rounded-full px-4 py-2 ${
            darkMode ? "bg-[#111827]" : "bg-gray-200"
          }`}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Aroma AI..."
            className={`flex-1 bg-transparent outline-none text-sm ${
              darkMode
                ? "text-white placeholder-gray-400"
                : "text-black placeholder-gray-500"
            }`}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />

          <button
            onClick={sendMessage}
            className={`px-4 py-1 rounded-full text-sm font-medium ${
              darkMode ? "bg-white text-black" : "bg-black text-white"
            }`}
          >
            Send
          </button>
        </div>

        <p className="text-xs text-center mt-2 opacity-50">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
