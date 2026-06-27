/**
 * src/components/HomeScreen.jsx
 * HomeScreen: today's words studied in Anki + the grammar topics list
 */

import { useState, useEffect } from 'react';
import { fetchTodayWords, fetchGrammarTopics } from '../lib/api.js';

export default function HomeScreen({ onSelectWord, onSelectGrammar }) {
  const [words, setWords] = useState([]);
  const [grammar, setGrammar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, g] = await Promise.all([fetchTodayWords(), fetchGrammarTopics()]);
      setWords(w);
      setGrammar(g);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const doneCount = words.filter(w => w.practiced).length;
  const allDone = words.length > 0 && doneCount === words.length;

  if (loading) {
    return (
      <div className="dd-empty">
        <div className="dd-loading">
          <div className="dd-loading__dot" />
          <div className="dd-loading__dot" />
          <div className="dd-loading__dot" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dd-empty">
        <div className="dd-error">
          <p>{error}</p>
          <button className="dd-error__btn" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="dd-celebrate">
        <div className="dd-celebrate__emoji">🎉</div>
        <div className="dd-celebrate__title">Congratulations!</div>
        <div className="dd-celebrate__sub">
          You completed {words.length} words today
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="dd-empty">
        <div className="dd-empty__icon">📚</div>
        <div className="dd-empty__text">
          You haven't studied any cards in Anki today.<br />
          Open Anki, flip a few cards, then come back here.
        </div>
        <button className="dd-error__btn" onClick={loadData} style={{ marginTop: 16 }}>
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="dd-home">
      <div className="dd-home__subtitle">
        Today · {doneCount}/{words.length} done
      </div>

      <div className="dd-word-list">
        {words.map((w) => (
          <div
            key={w.word}
            className={`dd-word-item ${w.practiced ? 'dd-word-item--done' : ''}`}
            onClick={() => onSelectWord(w)}
          >
            <div>
              <div className="dd-word-item__word">{w.word}</div>
              <div className="dd-word-item__meta">
                {w.schema} · {w.level}
              </div>
            </div>
            {w.practiced ? (
              <span className="dd-word-item__check">✓</span>
            ) : (
              <span className="dd-word-item__arrow">›</span>
            )}
          </div>
        ))}
      </div>

      {grammar.length > 0 && (
        <>
          <div className="dd-home__subtitle" style={{ marginTop: 24 }}>
            Grammar Topics
          </div>
          <div className="dd-word-list">
            {grammar.map((g) => (
              <div
                key={g.topic}
                className="dd-word-item"
                onClick={() => onSelectGrammar(g)}
              >
                <div>
                  <div className="dd-word-item__word">{g.topic}</div>
                  <div className="dd-word-item__meta">{g.category} · {g.level}</div>
                </div>
                <span className="dd-word-item__arrow">›</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
