import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CheckCircle,
  Loader,
  AlertCircle,
  Upload,
  FileText,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCart } from "../lib/CartContext";

export default function Success() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Payment Reporting State
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  // File Upload State
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { cartItems, removeFromCart } = useCart();

  useEffect(() => {
    if (cartItems && cartItems.length > 0) {
      cartItems.forEach((i) => removeFromCart(i.id, i.variant));
    }
  }, []);

  // --- NEW: PASTE EVENT LISTENER ---
  useEffect(() => {
    const handlePaste = (e) => {
      // Don't interrupt if reporting is in progress
      if (reporting || reported) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          // Create a named file from the blob
          const file = new File([blob], "pasted-screenshot.png", {
            type: blob.type,
          });
          setProofFile(file);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [reporting, reported]);

  useEffect(() => {
    async function fetchOrder() {
      try {
        let data = null;
        if (orderId) {
          const { data: dbOrder, error } = await supabase
            .from("orders")
            .select("*, items:order_items(*)")
            .eq("id", orderId)
            .single();
          if (error) throw error;
          data = dbOrder;
        } else if (sessionId) {
          const { data: dbOrder, error } = await supabase
            .from("orders")
            .select("*")
            .eq("stripe_session_id", sessionId)
            .single();
          if (error) throw error;
          data = dbOrder;
        }

        if (data) {
          setOrder(data);
          // If they already reported payment previously
          if (
            data.status === "payment_reported" ||
            data.status === "processing"
          ) {
            setReported(true);
          }
        }
      } catch (err) {
        console.error("Error fetching order:", err);
      } finally {
        setLoading(false);
      }
    }

    if (sessionId || orderId) fetchOrder();
    else setLoading(false);
  }, [sessionId, orderId]);

  // --- HANDLER: Upload File & Notify ---
  const handlePaymentMade = async () => {
    if (!order) return;

    // REQUIRE PROOF? (Optional validation)
    if (!proofFile) {
      alert(
        "Please upload or paste a screenshot of your payment confirmation first.",
      );
      return;
    }

    setReporting(true);
    try {
      let proofUrl = null;

      // 1. Upload File if selected
      if (proofFile) {
        setUploading(true);
        const fileExt = proofFile.name.split(".").pop();
        const fileName = `${order.id}-proof.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(filePath, proofFile, {
            upsert: true, // Allow overwriting if they retry
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(filePath);

        proofUrl = data.publicUrl;
      }

      // 2. Notify Backend (Send Email + Update DB)
      const { error } = await supabase.functions.invoke("notify-payment", {
        body: {
          orderId: order.id,
          customerName: order.customer_name,
          amount: order.total_amount,
          proofUrl: proofUrl, // Pass the URL to backend
        },
      });

      if (error) throw error;
      setReported(true);
    } catch (err) {
      console.error(err);
      alert("Error uploading proof: " + err.message);
    } finally {
      setReporting(false);
      setUploading(false);
    }
  };

  if (loading)
    return (
      <div style={{ padding: "100px", textAlign: "center" }}>Loading...</div>
    );

  if (!order)
    return (
      <div style={{ padding: "100px", textAlign: "center" }}>
        Order Not Found
      </div>
    );

  const shortOrderId = order.id.slice(0, 8).toUpperCase();

  return (
    <div style={{ padding: "80px 24px", maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <CheckCircle
          size={60}
          color="#10b981"
          style={{ margin: "0 auto 15px" }}
        />
        <h1 style={{ color: "#0f172a", margin: "0 0 10px 0" }}>
          Order Confirmed!
        </h1>
        <p style={{ color: "#64748b", fontSize: "1.1rem", margin: 0 }}>
          Thank you, {order.customer_name}. We have received your request.
        </p>
      </div>

      <div
        style={{
          background: "#eff6ff",
          padding: "30px",
          borderRadius: "16px",
          border: "2px solid #bfdbfe",
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
        }}
      >
        <h2
          style={{
            color: "#1e40af",
            marginTop: 0,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "1.4rem",
          }}
        >
          <AlertCircle size={24} /> Action Required: Complete Payment
        </h2>
        <p style={{ color: "#1e3a8a", fontSize: "1.05rem", lineHeight: "1.5" }}>
          To finalize your order, please send exactly{" "}
          <strong>${Number(order.total_amount).toFixed(2)} AUD</strong> using
          PayID.
        </p>

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px dashed #93c5fd",
            margin: "25px 0",
          }}
        >
          <p
            style={{
              margin: "0 0 10px 0",
              color: "#64748b",
              textTransform: "uppercase",
              fontSize: "0.85rem",
              fontWeight: "700",
            }}
          >
            Payment Details
          </p>
          <p
            style={{
              fontSize: "1.1rem",
              margin: "0 0 8px 0",
              color: "#0f172a",
            }}
          >
            <strong>PayID Email:</strong>{" "}
            <span style={{ color: "#3b82f6" }}>
              info@melbournepeptides.com.au
            </span>
          </p>
          <p style={{ fontSize: "1.1rem", margin: 0, color: "#0f172a" }}>
            <strong>Reference:</strong>{" "}
            <span style={{ color: "#e11d48", fontWeight: "800" }}>
              #{shortOrderId}
            </span>
          </p>
        </div>

        {/* --- UPLOAD SECTION --- */}
        {!reported ? (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="proof-upload"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "30px",
                  background: "white",
                  border: proofFile
                    ? "2px solid #10b981"
                    : "2px dashed #cbd5e1",
                  borderRadius: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#3b82f6";
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (!proofFile) e.currentTarget.style.borderColor = "#cbd5e1";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  if (e.dataTransfer.files?.[0])
                    setProofFile(e.dataTransfer.files[0]);
                }}
              >
                {proofFile ? (
                  <div style={{ textAlign: "center", color: "#10b981" }}>
                    <FileText size={40} style={{ marginBottom: "10px" }} />
                    <p style={{ fontWeight: "600", margin: 0 }}>
                      {proofFile.name}
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Click or Paste (Ctrl+V) to change
                    </p>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: "#64748b" }}>
                    <Upload
                      size={40}
                      style={{ marginBottom: "10px", color: "#94a3b8" }}
                    />
                    <p
                      style={{
                        fontWeight: "600",
                        margin: "0 0 5px 0",
                        color: "#0f172a",
                      }}
                    >
                      Upload Payment Proof
                    </p>
                    <p style={{ fontSize: "0.85rem", margin: 0 }}>
                      Click to Browse or <strong>Paste (Ctrl+V)</strong>{" "}
                      Screenshot
                    </p>
                  </div>
                )}
                <input
                  id="proof-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) setProofFile(e.target.files[0]);
                  }}
                />
              </label>
            </div>

            <button
              onClick={handlePaymentMade}
              disabled={reporting || !proofFile}
              style={{
                width: "100%",
                background: proofFile ? "#10b981" : "#94a3b8",
                color: "white",
                padding: "16px",
                borderRadius: "8px",
                fontSize: "1.1rem",
                fontWeight: "bold",
                border: "none",
                cursor: proofFile && !reporting ? "pointer" : "not-allowed",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {reporting ? (
                <>
                  <Loader className="spin-anim" />
                  {uploading ? "Uploading Proof..." : "Notifying Team..."}
                </>
              ) : (
                "I Have Made The Payment"
              )}
            </button>
          </div>
        ) : (
          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center",
              border: "1px solid #bbf7d0",
            }}
          >
            <CheckCircle size={32} style={{ margin: "0 auto 10px" }} />
            <h3 style={{ margin: "0 0 5px 0" }}>Proof Received!</h3>
            <p style={{ margin: 0, fontSize: "0.95rem" }}>
              We are verifying your payment now. You will receive a shipping
              confirmation email shortly.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <Link
          to="/"
          style={{
            color: "#64748b",
            fontWeight: "600",
            textDecoration: "none",
          }}
        >
          &larr; Return to Home
        </Link>
      </div>
    </div>
  );
}
