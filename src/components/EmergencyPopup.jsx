import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

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
          We are currently experiencing issues with our payment processor. This
          matter should be resolved within the next 24 hours.
        </p>

        <div
          style={{
            backgroundColor: "#f8fafc",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginBottom: "20px",
          }}
        >
          <p
            style={{ fontWeight: "600", color: "#0f172a", marginBottom: "5px" }}
          >
            How to place an order now:
          </p>
          <p style={{ fontSize: "0.9rem", color: "#334155" }}>
            Please proceed to checkout as normal. You will be able to submit
            your order manually and receive bank transfer details via email.
          </p>
          <p
            style={{ marginTop: "10px", fontSize: "0.9rem", color: "#334155" }}
          >
            Or email us at: <br />
            <a
              href="mailto:info@melbournepeptides.com.au"
              style={{ color: "#3b82f6", fontWeight: "bold" }}
            >
              info@melbournepeptides.com.au
            </a>
          </p>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#0f172a",
            color: "white",
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
