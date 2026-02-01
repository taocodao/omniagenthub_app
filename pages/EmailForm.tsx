// File: components/EmailForm.tsx

import { useState } from "react";

export default function EmailForm() {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [html, setHtml] = useState("");
  const [sender, setSender] = useState("");
  const [status, setStatus] = useState("");
  const [useHtml, setUseHtml] = useState(false);
  const [fromDisplay, setFromDisplay] = useState("");
const [replyTo, setReplyTo] = useState("");


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Sending...");

    try {
      const response = await fetch("/api/sendEmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient,
          subject,
          message,
          sender,
          fromDisplay,
          replyTo,
          html: useHtml ? html : undefined,
        }),
      });

      if (response.ok) {
        setStatus("Email sent successfully!");
      } else {
        const errorData = await response.json();
        setStatus(`Error: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Error sending email:", error);
      setStatus("Failed to send email.");
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h1>Send Email</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label>
            Recipient:
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
              style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>
            Sender:
            <input
              type="email"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              required
              style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            />

<input
  type="text"
  value={fromDisplay}
  onChange={(e) => setFromDisplay(e.target.value)}
  placeholder="From Display Name"
/>
<input
  type="email"
  value={replyTo}
  onChange={(e) => setReplyTo(e.target.value)}
  placeholder="Reply-to Email Address"
/>

          </label>
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>
            Subject:
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label>
            <input
              type="checkbox"
              checked={useHtml}
              onChange={(e) => setUseHtml(e.target.checked)}
            />
            Use HTML Content
          </label>
        </div>
        {useHtml ? (
          <div style={{ marginBottom: "10px" }}>
            <label>
              HTML Content:
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  marginTop: "5px",
                  height: "150px",
                }}
              />
            </label>
          </div>
        ) : (
          <div style={{ marginBottom: "10px" }}>
            <label>
              Plain Text Message:
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  marginTop: "5px",
                  height: "150px",
                }}
              />
            </label>
          </div>
        )}
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#0070f3",
            color: "#fff",
            borderRadius: "5px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Send Email
        </button>
      </form>
      {status && (
        <p style={{ marginTop: "20px", color: status.startsWith("Error") ? "red" : "green" }}>
          {status}
        </p>
      )}
    </div>
  );
}
