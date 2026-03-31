import { useState, useRef, useEffect } from 'react';
import styles from '../styles/App.module.css';

export default function Chat({ messages, onSend, username }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <div className={styles.chat}>
      <h3>Chat</h3>
      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.message} ${m.username === username ? styles.ownMessage : ''}`}>
            <span className={styles.msgUser}>{m.username}</span>
            <span className={styles.msgText}>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className={styles.chatInput}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message..."
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
