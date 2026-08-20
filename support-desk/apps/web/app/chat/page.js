'use client';

import { useEffect, useRef, useState } from 'react';

const SESSION_STORAGE_KEY = 'zeybek-chat-session-id';

function getOrCreateSessionId() {
  if (typeof window === 'undefined') return null;
  let id = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', content: string }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  // Mesajlar değiştikçe otomatik sona scroll
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    // Önce kullanıcı mesajını listeye ekle
    const newUserMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionIdRef.current || '',
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Something went wrong');
      }

      const data = await res.json();

      const assistantMessage = {
        role: 'assistant',
        content: data.reply || '',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col max-w-2xl mx-auto h-[80vh] border rounded-lg shadow-sm bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h1 className="font-semibold text-lg">Zeybek Hukuk Bürosu — AI Assistant</h1>
        {loading && (
          <span className="text-sm text-gray-500 animate-pulse">
            AI is typing...
          </span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            Ask a question about Zeybek Hukuk Bürosu — practice areas, hours, or how to book a consultation.
          </p>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t px-3 py-2 flex gap-2">
        <input
          type="text"
          className="flex-1 border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
