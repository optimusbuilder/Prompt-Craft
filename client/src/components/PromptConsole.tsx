import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@promptcraft/shared";

type PromptConsoleProps = {
  disabled: boolean;
  visible: boolean;
  messages: ChatMessage[];
  onSubmit: (prompt: string) => void;
  onClose: () => void;
};

export function PromptConsole({ disabled, visible, messages, onSubmit, onClose }: PromptConsoleProps) {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [visible]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setPrompt("");
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className={`chat-overlay ${visible ? "chat-overlay--visible" : ""}`}>
      {/* Message log — always partially visible */}
      <div className="chat-messages" ref={messagesRef}>
        {messages.slice(-20).map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.isSystem ? "chat-msg--system" : ""}`}>
            {msg.isSystem ? (
              <span className="chat-msg-text chat-msg-text--system">{msg.text}</span>
            ) : (
              <>
                <span className="chat-msg-sender" style={{ color: msg.senderColor }}>
                  {msg.sender}
                </span>
                <span className="chat-msg-text">{msg.text}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Input bar */}
      {visible && (
        <form className="chat-input-bar" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <span className="chat-prompt-icon">&gt;</span>
          <input
            ref={inputRef}
            className="chat-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what to build..."
            autoComplete="off"
          />
          <button type="submit" className="chat-send" disabled={disabled}>
            Build
          </button>
        </form>
      )}
    </div>
  );
}
