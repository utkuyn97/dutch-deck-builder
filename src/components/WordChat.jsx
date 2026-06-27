/**
 * src/components/WordChat.jsx
 * WordChat: word chatbox — AI assignment + feedback + free-form Q&A
 */

import { useState, useEffect, useRef } from 'react';
import {
  fetchWordDetails,
  fetchContextHistory,
  saveContextHistory,
  markPracticed,
  aiChat,
} from '../lib/api.js';

export default function WordChat({ wordInfo, onBack, onDone }) {
  const cacheKey = `dd_chat_${wordInfo.word}_${new Date().toISOString().split('T')[0]}`;
  const [details, setDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [apiMessages, setApiMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scenario, setScenario] = useState(null);
  const [phase, setPhase] = useState('loading');
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  // Save to cache whenever state changes
  function saveCache(msgs, scen, ph, apiMsgs) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        messages: msgs, scenario: scen, phase: ph, apiMessages: apiMsgs
      }));
    } catch {}
  }

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Load word details + check cache or generate assignment
  useEffect(() => {
    async function init() {
      try {
        const det = await fetchWordDetails(wordInfo.word);
        setDetails(det);

        // Check cache first
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const c = JSON.parse(cached);
          setMessages(c.messages || []);
          setScenario(c.scenario || null);
          setPhase(c.phase || 'free');
          setApiMessages(c.apiMessages || []);
          return;
        }

        // No cache — generate new assignment
        const history = await fetchContextHistory(wordInfo.word);
        const res = await aiChat({
          type: 'word_assignment',
          word: wordInfo.word,
          level: wordInfo.level || det.level,
          schema: wordInfo.schema || det.schema,
          english: det.english || '',
          turkish: det.turkish || '',
          context_history: history,
        });

        if (res.type === 'assignment' && res.data) {
          setScenario(res.data);
          setPhase('scenario');
          saveCache([], res.data, 'scenario', []);
        } else {
          const initMsgs = [{ role: 'ai', text: res.content || 'Scenario generated.' }];
          setMessages(initMsgs);
          setPhase('free');
          saveCache(initMsgs, null, 'free', []);
        }
      } catch (err) {
        const errMsgs = [{ role: 'system', text: '⚠️ ' + err.message }];
        setMessages(errMsgs);
        setPhase('free');
      }
    }
    init();
  }, []);

  function addAI(text) {
    setMessages(prev => [...prev, { role: 'ai', text }]);
  }

  function addUser(text) {
    setMessages(prev => [...prev, { role: 'user', text }]);
  }

  function addSystem(text) {
    setMessages(prev => [...prev, { role: 'system', text }]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    if (phase === 'scenario') {
      const userMsg = { role: 'user', text };
      setMessages(prev => [...prev, userMsg]);
      setLoading(true);
      try {
        const res = await aiChat({
          type: 'word_feedback',
          word: wordInfo.word,
          level: wordInfo.level || details?.level || '',
          schema: wordInfo.schema || details?.schema || '',
          scenario: scenario?.scenario || '',
          user_message: text,
        });

        const feedbackText = res.content || 'Could not get feedback.';
        const newMsgs = [...messages, { role: 'user', text }, { role: 'ai', text: feedbackText }];
        setMessages(newMsgs);

        const newApi = [
          { role: 'user', content: `Scenario: ${scenario?.scenario || ''}\nMy answer: ${text}` },
          { role: 'assistant', content: feedbackText },
        ];
        setApiMessages(newApi);
        setPhase('feedback');
        saveCache(newMsgs, scenario, 'feedback', newApi);

        // Save context
        if (scenario?.context) {
          await saveContextHistory(wordInfo.word, scenario.context, text, feedbackText);
        }
      } catch (err) {
        addSystem('⚠️ ' + err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Multi-turn free chat — AI sees full history
      const userMsg = { role: 'user', text };
      const msgsWithUser = [...messages, userMsg];
      setMessages(msgsWithUser);
      setLoading(true);

      const newApiMessages = [...apiMessages, { role: 'user', content: text }];

      try {
        const res = await aiChat({
          type: 'word_chat',
          word: wordInfo.word,
          level: wordInfo.level || details?.level || '',
          schema: wordInfo.schema || details?.schema || '',
          english: details?.english || '',
          turkish: details?.turkish || '',
          scenario: scenario?.scenario || '',
          messages: newApiMessages,
        });

        const aiText = res.content || '...';
        const finalMsgs = [...msgsWithUser, { role: 'ai', text: aiText }];
        setMessages(finalMsgs);
        const finalApi = [...newApiMessages, { role: 'assistant', content: aiText }];
        setApiMessages(finalApi);
        saveCache(finalMsgs, scenario, phase, finalApi);
      } catch (err) {
        setMessages(prev => [...prev, { role: 'system', text: '⚠️ ' + err.message }]);
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleComplete() {
    await markPracticed(wordInfo.word);
    onDone(wordInfo.word);
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
        <div className="dd-header__title">{wordInfo.word}</div>
        <span className="dd-header__badge">{wordInfo.level}</span>
      </div>

      {/* Word info card */}
      {details && (
        <div className="dd-word-card">
          <div className="dd-word-card__word">{details.dutch || wordInfo.word}</div>
          <div className="dd-word-card__meta">
            <span className="dd-word-card__tag dd-word-card__tag--schema">
              {details.schema || wordInfo.schema}
            </span>
            <span className="dd-word-card__tag dd-word-card__tag--level">
              {details.level || wordInfo.level}
            </span>
          </div>
          {(details.turkish || details.english) && (
            <div className="dd-word-card__translation">
              {details.turkish && <span>🇹🇷 {details.turkish}</span>}
              {details.turkish && details.english && <span> · </span>}
              {details.english && <span>🇬🇧 {details.english}</span>}
            </div>
          )}
        </div>
      )}

      {/* Chat */}
      <div className="dd-chat" ref={chatRef}>
        {/* Scenario card */}
        {scenario && phase !== 'loading' && (
          <div className="dd-scenario">
            <div className="dd-scenario__label">📝 Scenario</div>
            <div className="dd-scenario__text">{scenario.scenario}</div>
            {scenario.hint_words && (
              <div className="dd-hint-words">
                {scenario.hint_words.map((h, i) => (
                  <span key={i} className="dd-hint-word">
                    {h.nl} <span>({h.tr})</span>
                  </span>
                ))}
              </div>
            )}
            {scenario.instruction && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--dd-text-dim)' }}>
                {scenario.instruction}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`dd-bubble dd-bubble--${msg.role}`}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {msg.text}
          </div>
        ))}

        {/* Loading */}
        {(loading || phase === 'loading') && (
          <div className="dd-bubble dd-bubble--ai">
            <div className="dd-loading">
              <div className="dd-loading__dot" />
              <div className="dd-loading__dot" />
              <div className="dd-loading__dot" />
            </div>
          </div>
        )}
      </div>

      {/* Done button */}
      {(phase === 'feedback' || phase === 'free') && (
        <div style={{ padding: '0 16px' }}>
          <button className="dd-done-btn" onClick={handleComplete}>
            ✅ Done — Next Word
          </button>
        </div>
      )}

      {/* Input */}
      {phase !== 'loading' && phase !== 'done' && (
        <div className="dd-input-bar">
          <textarea
            ref={inputRef}
            className="dd-input-bar__input"
            placeholder={
              phase === 'scenario'
                ? 'Write your Dutch sentence...'
                : 'Ask a free-form question...'
            }
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
      )}
    </div>
  );
}
