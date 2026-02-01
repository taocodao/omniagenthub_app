import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useActiveAccount } from '../hooks/useWalletAddress';
import ReactMarkdown from "react-markdown"; // ensure you have installed react-markdown
import styles from "../styles/ChatBotModal.module.css";
import { LocalizedText } from "../util/LocalizedText";
import { toast } from "react-toastify";

interface Message {
  sender: "user" | "bot";
  text: string;
}

const ChatBotModal: React.FC = () => {
  const router = useRouter();
  const { userId: userIdFromUrl } = router.query;
  const { account, isLoading: isAccountLoading, error } = useActiveAccount();
  const userId = typeof userIdFromUrl === "string" ? userIdFromUrl : (account?.address || "anonymous");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [faqs, setFaqs] = useState<string[]>([]);

  // Fetch FAQs from the backend endpoint /api/faqs
  const fetchFaqs = useCallback(async () => {
    try {
      const res = await fetch("/api/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.questions || []);
      } else {
        toast.error("Failed to fetch FAQs.");
      }
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      toast.error("Error fetching FAQs.");
    }
  }, [userId]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const sendMessage = async (question: string) => {
    if (!question.trim()) return;
    const userMessage: Message = { sender: "user", text: question.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat_bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, question: question.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const botMessage: Message = { sender: "bot", text: data.answer };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        toast.error("Failed to get answer from the bot.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("An error occurred while contacting the bot.");
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  // When clicking "Ask" on an FAQ, send that question.
  const handleAskFaq = (faq: string) => {
    sendMessage(faq);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.container}>
          {/* Left Panel: Split into top (FAQ) and bottom (Input) sections */}
          <div className={styles.leftPanel}>
            <div className={styles.faqSection}>
              <h3 className={styles.faqTitle}>
                <LocalizedText name="Frequently Asked Questions" />
              </h3>
              <div className={styles.faqList}>
                {faqs.length > 0 ? (
                  faqs.slice(0, 8).map((faq, idx) => (
                    <div key={idx} className={styles.faqItem}>
                      <span>{faq}</span>
                      <button className={styles.askButton} onClick={() => handleAskFaq(faq)}>
                        <LocalizedText name="Ask" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p>No FAQs available.</p>
                )}
              </div>
            </div>
            <div className={styles.inputSection}>
              <textarea
                className={styles.inputBox}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
              />
              <button className={styles.sendButton} onClick={() => sendMessage(input)} disabled={loading}>
                <LocalizedText name="Send" />
              </button>
            </div>
          </div>
          {/* Right Panel: Chat Window */}
          <div className={styles.rightPanel}>
            <div className={styles.chatWindow}>
              {messages.map((msg, idx) => (
                <div key={idx} className={msg.sender === "user" ? styles.userMessage : styles.botMessage}>
                  {msg.sender === "bot" ? (
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  ) : (
                    <p>{msg.text}</p>
                  )}
                </div>
              ))}
              {loading && (
                <div className={styles.botMessage}>
                  <p>
                    <LocalizedText name="Bot is typing..." />
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBotModal;
