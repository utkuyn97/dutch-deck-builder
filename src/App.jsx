/**
 * src/App.jsx
 * 3-screen routing — Home → WordChat → GrammarChat
 */

import { useState, useCallback } from 'react';
import PinGate from './components/PinGate.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import WordChat from './components/WordChat.jsx';
import GrammarChat from './components/GrammarChat.jsx';
import './styles/tokens.css';

export default function App() {
  const [screen, setScreen] = useState('home'); // home | word | grammar
  const [selectedWord, setSelectedWord] = useState(null);
  const [selectedGrammar, setSelectedGrammar] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectWord = useCallback((wordInfo) => {
    setSelectedWord(wordInfo);
    setScreen('word');
  }, []);

  const handleSelectGrammar = useCallback((topic) => {
    setSelectedGrammar(topic);
    setScreen('grammar');
  }, []);

  const handleBack = useCallback(() => {
    setScreen('home');
    setSelectedWord(null);
    setSelectedGrammar(null);
    setRefreshKey(k => k + 1);
  }, []);

  const handleWordDone = useCallback((word) => {
    setScreen('home');
    setSelectedWord(null);
    setRefreshKey(k => k + 1);
  }, []);

  if (screen === 'word' && selectedWord) {
    return (
      <PinGate>
        <WordChat
          wordInfo={selectedWord}
          onBack={handleBack}
          onDone={handleWordDone}
        />
      </PinGate>
    );
  }

  if (screen === 'grammar' && selectedGrammar) {
    return (
      <PinGate>
        <GrammarChat
          topic={selectedGrammar}
          onBack={handleBack}
        />
      </PinGate>
    );
  }

  return (
    <PinGate>
      <div className="dd-app">
        <div className="dd-header">
          <div className="dd-header__title">🇳🇱 DutchDeck</div>
          <span className="dd-header__badge">Practice</span>
        </div>
        <HomeScreen
          key={refreshKey}
          onSelectWord={handleSelectWord}
          onSelectGrammar={handleSelectGrammar}
        />
      </div>
    </PinGate>
  );
}
