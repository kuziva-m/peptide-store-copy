import { useState, useEffect } from "react";
import { X, AlertTriangle, Mail } from "lucide-react";

export default function EmergencyPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show immediately on load
    setIsOpen(true);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.7)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "16px",
          maxWidth: "500px",
          width: "100%",
          position: "relative",
          textAlign: "center",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        <button
          onClick={() => setIsOpen(false)}
          style={{
            position: "absolute",
            top: "15px",
            right: "15px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
          }}
        >
          <X size={24} />
        </button>

        <div
          style={{
            width: "60px",
            height: "60px",
            backgroundColor: "#fee2e2",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <AlertTriangle size={32} color="#ef4444" />
        </div>

        <h2
          style={{ fontSize: "1.5rem", color: "#0f172a", marginBottom: "10px" }}
        >
          Technical Difficulties
        </h2>

        <p
          style={{ color: "#475569", lineHeight: "1.6", marginBottom: "20px" }}
        >
          We’re currently going through technical difficulties with our payment
          processor.
        </p>

        <div
          style={{
            backgroundColor: "#f8fafc",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              fontWeight: "600",
              color: "#0f172a",
              marginBottom: "10px",
              fontSize: "1.1rem",
            }}
          >
            Please email us to place an order:
          </p>
          <a
            href="mailto:info@melbournepeptides.com.au"
            style={{
              color: "white",
              backgroundColor: "#0f172a",
              fontWeight: "bold",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            <Mail size={18} /> info@melbournepeptides.com.au
          </a>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#e2e8f0",
            color: "#475569",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          I Understand
        </button>
      </div>
    </div>
  );
}
