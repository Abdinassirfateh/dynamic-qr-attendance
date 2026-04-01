import { useState, useEffect } from 'react';

export default function SpeechReader({ targetId = 'main-content' }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('speechSynthesis' in window);
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const handleRead = () => {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const target = document.getElementById(targetId);
    if (!target) return;
    const text = target.innerText || target.textContent || '';
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  if (!supported) return null;

  return (
    <button
      onClick={handleRead}
      aria-label={speaking ? 'Stop reading page aloud' : 'Read page aloud'}
      aria-pressed={speaking}
      title={speaking ? 'Stop reading' : 'Read page aloud'}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: 'none',
        background: speaking ? '#d32f2f' : '#1a237e',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        transition: 'background 0.2s',
      }}
    >
      {speaking ? (
        // Stop icon
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
        </svg>
      ) : (
        // Speaker icon
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      )}
    </button>
  );
}