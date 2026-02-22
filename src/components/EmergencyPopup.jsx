import { useState } from "react";
import { X, Info, ShoppingCart, Landmark, Camera } from "lucide-react";

export default function EmergencyPopup() {
  // Opens automatically every time the component mounts!
  const [isOpen, setIsOpen] = useState(true);

  const closePopup = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(15, 23, 42, 0.7)", // Slightly darker, premium overlay
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px", // Better mobile edge spacing
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          maxWidth: "450px",
          width: "100%",
          position: "relative",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden", // Prevents the whole modal from scrolling and hides default desktop scrollbar
        }}
      >
        {/* CLOSE BUTTON (Fixed to the top right) */}
        <button
          onClick={closePopup}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "#f1f5f9",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
            zIndex: 10,
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#e2e8f0")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#f1f5f9")}
        >
          <X size={18} />
        </button>

        {/* SCROLLABLE CONTENT AREA (Only scrolls on tiny mobile screens) */}
        <div
          style={{
            padding: "30px 24px 20px 24px",
            overflowY: "auto",
            flex: 1, // Takes up available space
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              backgroundColor: "#eff6ff",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
            }}
          >
            <Info size={28} color="#3b82f6" />
          </div>

          <h2
            style={{
              fontSize: "1.4rem",
              color: "#0f172a",
              marginBottom: "12px",
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            Checkout Update
          </h2>

          <p
            style={{
              color: "#475569",
              lineHeight: "1.5",
              marginBottom: "24px",
              textAlign: "center",
              fontSize: "0.95rem",
            }}
          >
            Card payments are temporarily paused while we upgrade our secure
            processor. All orders are currently being processed via{" "}
            <strong>Bank Transfer</strong>.
          </p>

          <div
            style={{
              backgroundColor: "#f8fafc",
              padding: "20px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <p
              style={{
                fontWeight: "700",
                color: "#0f172a",
                margin: "0 0 16px 0",
                fontSize: "1rem",
              }}
            >
              How to place your order:
            </p>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    background: "#e0e7ff",
                    padding: "8px",
                    borderRadius: "8px",
                    color: "#3b82f6",
                    flexShrink: 0,
                  }}
                >
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontWeight: "600",
                      color: "#1e293b",
                      fontSize: "0.95rem",
                    }}
                  >
                    1. Checkout
                  </span>
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: "0.85rem",
                      lineHeight: "1.4",
                      display: "block",
                      marginTop: "2px",
                    }}
                  >
                    Enter your shipping details.
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    background: "#e0e7ff",
                    padding: "8px",
                    borderRadius: "8px",
                    color: "#3b82f6",
                    flexShrink: 0,
                  }}
                >
                  <Landmark size={18} />
                </div>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontWeight: "600",
                      color: "#1e293b",
                      fontSize: "0.95rem",
                    }}
                  >
                    2. Transfer Funds
                  </span>
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: "0.85rem",
                      lineHeight: "1.4",
                      display: "block",
                      marginTop: "2px",
                    }}
                  >
                    Send your total to the Bank Details shown on the checkout
                    page.
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    background: "#e0e7ff",
                    padding: "8px",
                    borderRadius: "8px",
                    color: "#3b82f6",
                    flexShrink: 0,
                  }}
                >
                  <Camera size={18} />
                </div>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontWeight: "600",
                      color: "#1e293b",
                      fontSize: "0.95rem",
                    }}
                  >
                    3. Upload Receipt
                  </span>
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: "0.85rem",
                      lineHeight: "1.4",
                      display: "block",
                      marginTop: "2px",
                    }}
                  >
                    Attach a screenshot of your payment directly on the checkout
                    page to finalize your order!
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FIXED FOOTER AREA (Button will never scroll out of view) */}
        <div
          style={{
            padding: "0 24px 30px 24px",
            flexShrink: 0, // Prevents button area from being compressed
            background: "white",
          }}
        >
          <button
            onClick={closePopup}
            style={{
              width: "100%",
              padding: "16px",
              backgroundColor: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "1rem",
              cursor: "pointer",
              transition: "background 0.2s",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#1e293b")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#0f172a")}
          >
            Got it, Continue to Shop
          </button>
        </div>
      </div>
    </div>
  );
}
