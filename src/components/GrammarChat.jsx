/**
 * src/components/GrammarChat.jsx
 * GrammarChat: grammar chatbox — multi-turn AI exercise pack + free-form Q&A
 */

import { useState, useEffect, useRef } from 'react';
import { aiChat } from '../lib/api.js';

export default function GrammarChat({ topic, onBack }) {
  const [messages, setMessages] = useState([]); // UI messages
  const [aiMessages, setAiMessages] = useState([]); // API conversation history
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const chatRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Start exercises on mount
  useEffect(() => {
    startExercises();
  }, []);

  async function startExercises() {
    setLoading(true);
    try {
      const res = await aiChat({
        type: 'grammar_start',
        topic: topic.topic,
        level: topic.level,
        rule_summary: topic.rule || '',
      });

      const text = res.content || '';
      setMessages([{ role: 'ai', text }]);
      setAiMessages([
        { role: 'user', content: 'Start.' },
        { role: 'assistant', content: text },
      ]);
      setStarted(true);
    } catch (err) {
      setMessages([{ role: 'system', text: '⚠️ ' + err.message }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text }]);

    const newAiMessages = [
      ...aiMessages,
      { role: 'user', content: text },
    ];

    setLoading(true);
    try {
      const res = await aiChat({
        type: 'grammar_continue',
        topic: topic.topic,
        level: topic.level,
        rule_summary: topic.rule || '',
        messages: newAiMessages,
      });

      const aiText = res.content || '...';
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
      setAiMessages([
        ...newAiMessages,
        { role: 'assistant', content: aiText },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'system', text: '⚠️ ' + err.message },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="dd-app">
      {/* Header */}
      <div className="dd-header">
        <button className="dd-header__back" onClick={onBack}>←</button>
        <div className="dd-header__title">{topic.topic}</div>
        <span className="dd-header__badge">{topic.level}</span>
      </div>

      {/* Topic card */}
      <div className="dd-word-card">
        <div className="dd-word-card__word">{topic.topic}</div>
        <div className="dd-word-card__meta">
          <span className="dd-word-card__tag dd-word-card__tag--schema">{topic.category}</span>
          <span className="dd-word-card__tag dd-word-card__tag--level">{topic.level}</span>
        </div>
        {topic.rule && (
          <div className="dd-word-card__translation" style={{ marginTop: 8, fontSize: 13 }}>
            📐 {topic.rule}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="dd-chat" ref={chatRef}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`dd-bubble dd-bubble--${msg.role}`}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {msg.text}
          </div>
        ))}

        {loading && (
          <div className="dd-bubble dd-bubble--ai">
            <div className="dd-loading">
              <div className="dd-loading__dot" />
              <div className="dd-loading__dot" />
              <div className="dd-loading__dot" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="dd-input-bar">
        <textarea
          className="dd-input-bar__input"
          placeholder="Write your answer or ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="dd-input-bar__send"
          onClick={handleSend}
          disabled={!input.trim() || loading}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
