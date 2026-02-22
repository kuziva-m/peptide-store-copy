import { useState, useEffect } from "react";
import { useCart } from "../lib/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  Loader,
  Truck,
  Copy,
  Upload,
  CheckCircle,
  Landmark,
} from "lucide-react";
import "../components/CartDrawer.css";

export default function Checkout() {
  const { cart, cartTotal } = useCart(); // Removed clearCart here to prevent the redirect bug!
  const navigate = useNavigate();

  // --- PRE-GENERATE ORDER ID ---
  const [orderId] = useState(() => crypto.randomUUID());
  const shortRef = orderId.slice(0, 8).toUpperCase();

  // --- STATE ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState("");

  // File Upload State
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    postcode: "",
  });

  const [shippingMethod, setShippingMethod] = useState("standard");

  // Redirect if cart is empty
  useEffect(() => {
    if (!cart || cart.length === 0) {
      navigate("/shop");
    }
  }, [cart, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const getVariantLabel = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.size_label || "Option";
    return String(v);
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 2000);
  };

  // --- SHIPPING CALCULATIONS ---
  const isStandardFree = cartTotal >= 150;
  const isExpressFree = cartTotal >= 250;

  let shippingCost = 0;
  let shippingLabel = "Free";

  if (shippingMethod === "express") {
    shippingCost = isExpressFree ? 0 : 14.99;
    shippingLabel = isExpressFree ? "Free" : "$14.99";
  } else {
    shippingCost = isStandardFree ? 0 : 9.99;
    shippingLabel = isStandardFree ? "Free" : "$9.99";
  }

  const estimatedTotal = cartTotal + shippingCost;

  // --- FINAL SUBMIT ---
  const submitOrder = async (e) => {
    e.preventDefault();

    if (!receiptFile) {
      setError(
        "Please upload a screenshot of your payment receipt to complete your order.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Upload the Receipt Image to Supabase Storage
      const fileExt = receiptFile.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, receiptFile);

      if (uploadError)
        throw new Error(
          "Failed to upload receipt. Please ensure the file is valid and try again.",
        );

      const { data: publicUrlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(fileName);

      const receiptUrl = publicUrlData.publicUrl;

      // 2. Insert Order directly into Supabase Database using our pre-generated ID
      const orderPayload = {
        id: orderId,
        customer_name: formData.name,
        customer_email: formData.email,
        total_amount: estimatedTotal,
        shipping_cost: shippingCost,
        shipping_method: shippingMethod === "express" ? "Express" : "Standard",
        shipping_address: formData,
        items: cart,
        receipt_url: receiptUrl,
        status: "pending",
      };

      // NO .select() or .single() here! This allows guest inserts without triggering RLS read errors.
      const { error: orderError } = await supabase
        .from("orders")
        .insert(orderPayload);

      if (orderError) throw orderError;

      // 3. SEND EMAIL NOTIFICATIONS (To Customer & Admin)
      try {
        // Format items specifically for the email template
        const emailItems = cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          size: getVariantLabel(item.variant),
        }));

        // A. Email to Customer
        await supabase.functions.invoke("send-email", {
          body: {
            email: formData.email,
            name: formData.name,
            orderId: orderId,
            status: "custom",
            message:
              "Thank you for your order! We have received your payment proof. Your order is currently under review and we will notify you as soon as your payment is confirmed and your package is ready to ship.",
            items: emailItems,
            address: formData,
          },
        });

        // B. Email to Store Admin
        const adminHtml = `
          <div style="text-align: left;">
            <p><strong>Order ID:</strong> #${shortRef}</p>
            <p><strong>Customer:</strong> ${formData.name} (<a href="mailto:${formData.email}">${formData.email}</a>)</p>
            <p><strong>Order Total:</strong> $${estimatedTotal.toFixed(2)}</p>
            <p><strong>Shipping Speed:</strong> ${shippingMethod === "express" ? "Express" : "Standard"}</p>
            <br/>
            <p><strong>Payment Screenshot:</strong></p>
            <a href="${receiptUrl}" target="_blank" style="display: inline-block; background: #16a34a; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Receipt</a>
            <br/><br/>
            <p>Log in to your admin panel to review and approve this order.</p>
          </div>
        `;

        await supabase.functions.invoke("send-email", {
          body: {
            to: "info@melbournepeptides.com.au", // Change if you want it sent somewhere else!
            subject: `🚨 New Order Received! - #${shortRef}`,
            html: adminHtml,
          },
        });
      } catch (emailErr) {
        console.error("Failed to send notification emails:", emailErr);
        // We catch this silently so the customer still gets sent to the success page even if Resend glitches!
      }

      // 4. Redirect to Success (Using the pre-generated orderId!)
      navigate(`/success?order_id=${orderId}`);
    } catch (err) {
      console.error("Checkout Error:", err);
      setError(err.message || "Failed to submit order. Please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!cart || cart.length === 0) return null;

  return (
    <>
      <style>{`
        .checkout-wrapper {
          max-width: 1000px;
          margin: 40px auto;
          padding: 0 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }
        @media (max-width: 768px) {
          .checkout-wrapper {
            grid-template-columns: 1fr;
            margin: 20px auto;
            gap: 24px;
          }
          .checkout-summary { order: -1; }
        }
      `}</style>

      <div className="checkout-wrapper">
        {/* LEFT SIDE: COMBINED FORM & PAYMENT INFO */}
        <div>
          <button onClick={() => navigate("/shop")} style={backBtnStyle}>
            <ArrowLeft size={16} /> Back to Shop
          </button>

          <h2 style={{ marginBottom: "15px", fontSize: "24px" }}>
            Secure Checkout
          </h2>
          <p
            style={{
              color: "#64748b",
              marginBottom: "24px",
              lineHeight: "1.5",
            }}
          >
            Please fill out your shipping details, complete the bank transfer,
            and upload your payment proof to submit your order.
          </p>

          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#b91c1c",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={submitOrder}
            style={{ display: "flex", flexDirection: "column", gap: "24px" }}
          >
            {/* SECTION 1: SHIPPING */}
            <div>
              <h3
                style={{
                  fontSize: "18px",
                  marginBottom: "12px",
                  color: "#0f172a",
                }}
              >
                1. Shipping Details
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <input
                    required
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                  <input
                    required
                    type="email"
                    name="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
                <input
                  required
                  type="tel"
                  name="phone"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={handleChange}
                  style={inputStyle}
                />
                <input
                  required
                  type="text"
                  name="line1"
                  placeholder="Street Address"
                  value={formData.line1}
                  onChange={handleChange}
                  style={inputStyle}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <input
                    required
                    type="text"
                    name="city"
                    placeholder="City / Suburb"
                    value={formData.city}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                  <input
                    required
                    type="text"
                    name="state"
                    placeholder="State (e.g. VIC)"
                    value={formData.state}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                  <input
                    required
                    type="text"
                    name="postcode"
                    placeholder="Postcode"
                    value={formData.postcode}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: SHIPPING SPEED */}
            <div
              style={{
                padding: "20px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#0f172a",
                }}
              >
                <Truck size={18} color="#0f172a" /> Select Shipping Speed
              </h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <div
                  onClick={() => setShippingMethod("standard")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border:
                      shippingMethod === "standard"
                        ? "2px solid #3b82f6"
                        : "1px solid #cbd5e1",
                    background:
                      shippingMethod === "standard" ? "#eff6ff" : "white",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontWeight: "600",
                      color: "#0f172a",
                      marginBottom: "4px",
                    }}
                  >
                    Standard
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: isStandardFree ? "#16a34a" : "#64748b",
                      fontWeight: isStandardFree ? "bold" : "normal",
                    }}
                  >
                    {isStandardFree ? "Free (Orders over $150)" : "$9.99"}
                  </span>
                </div>
                <div
                  onClick={() => setShippingMethod("express")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border:
                      shippingMethod === "express"
                        ? "2px solid #3b82f6"
                        : "1px solid #cbd5e1",
                    background:
                      shippingMethod === "express" ? "#eff6ff" : "white",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontWeight: "600",
                      color: "#0f172a",
                      marginBottom: "4px",
                    }}
                  >
                    Express
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: isExpressFree ? "#16a34a" : "#64748b",
                      fontWeight: isExpressFree ? "bold" : "normal",
                    }}
                  >
                    {isExpressFree ? "Free (Orders over $250)" : "$14.99"}
                  </span>
                </div>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #e2e8f0" }} />

            {/* SECTION 3: BANK DETAILS */}
            <div>
              <h3
                style={{
                  fontSize: "18px",
                  marginBottom: "12px",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Landmark size={20} /> 2. Complete Payment
              </h3>
              <p
                style={{
                  color: "#475569",
                  marginBottom: "16px",
                  fontSize: "14px",
                }}
              >
                Transfer exactly{" "}
                <strong style={{ color: "#0f172a" }}>
                  ${estimatedTotal.toFixed(2)}
                </strong>{" "}
                to the account below.
              </p>

              <div
                style={{
                  background: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                }}
              >
                {/* UPDATED: Copyable Account Name */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    Account Name
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "600",
                        color: "#0f172a",
                        fontSize: "15px",
                      }}
                    >
                      Melbourne Peptides
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy("Melbourne Peptides", "name")}
                      style={copyBtnStyle}
                    >
                      {copied === "name" ? "Copied!" : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    BSB
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "600",
                        color: "#0f172a",
                        fontSize: "16px",
                      }}
                    >
                      013 226
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy("013226", "bsb")}
                      style={copyBtnStyle}
                    >
                      {copied === "bsb" ? "Copied!" : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    Account Number
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "600",
                        color: "#0f172a",
                        fontSize: "16px",
                      }}
                    >
                      806 890 436
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy("806890436", "acc")}
                      style={copyBtnStyle}
                    >
                      {copied === "acc" ? "Copied!" : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* DYNAMIC REFERENCE NUMBER */}
                <div
                  style={{
                    padding: "12px",
                    background: "#eff6ff",
                    borderRadius: "6px",
                    fontSize: "14px",
                    color: "#1e3a8a",
                    border: "1px solid #bfdbfe",
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    <strong>Reference:</strong> Please use{" "}
                    <strong>#{shortRef}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(shortRef, "ref")}
                    style={{
                      ...copyBtnStyle,
                      background: "white",
                      padding: "4px 8px",
                    }}
                  >
                    {copied === "ref" ? "Copied!" : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 4: FILE UPLOAD */}
            <div>
              <h3
                style={{
                  fontSize: "18px",
                  marginBottom: "12px",
                  color: "#0f172a",
                }}
              >
                3. Upload Proof
              </h3>
              <div
                style={{
                  border: previewUrl
                    ? "2px solid #16a34a"
                    : "2px dashed #cbd5e1",
                  borderRadius: "12px",
                  padding: "30px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  position: "relative",
                  backgroundColor: previewUrl ? "#f0fdf4" : "#f8fafc",
                  transition: "all 0.2s",
                }}
              >
                <input
                  type="file"
                  required
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                    zIndex: 10,
                  }}
                />
                {previewUrl ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <CheckCircle
                      size={32}
                      color="#16a34a"
                      style={{ marginBottom: "10px" }}
                    />
                    <p
                      style={{
                        margin: "0 0 10px 0",
                        fontWeight: "600",
                        color: "#16a34a",
                      }}
                    >
                      Receipt Attached!
                    </p>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{
                        maxHeight: "120px",
                        borderRadius: "8px",
                        border: "1px solid #bbf7d0",
                      }}
                    />
                    <p
                      style={{
                        margin: "10px 0 0 0",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Click or drag to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload
                      size={32}
                      color="#64748b"
                      style={{ margin: "0 auto 10px auto" }}
                    />
                    <p
                      style={{
                        margin: 0,
                        color: "#0f172a",
                        fontWeight: "600",
                        fontSize: "16px",
                      }}
                    >
                      Upload Payment Screenshot
                    </p>
                    <p
                      style={{
                        margin: "5px 0 0 0",
                        color: "#64748b",
                        fontSize: "13px",
                      }}
                    >
                      We need this to verify and ship your order
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !receiptFile}
              className="checkout-btn"
              style={{
                marginTop: "10px",
                padding: "18px",
                fontSize: "18px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
                opacity: !receiptFile || isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? (
                <>
                  <Loader className="spin-anim" size={20} /> Processing...
                </>
              ) : (
                "Submit Order"
              )}
            </button>
          </form>
        </div>

        {/* RIGHT SIDE: ORDER SUMMARY */}
        <div className="checkout-summary">
          <div
            style={{
              background: "#f8fafc",
              padding: "30px",
              borderRadius: "12px",
              height: "fit-content",
              border: "1px solid #e2e8f0",
              position: "sticky",
              top: "20px",
            }}
          >
            <h3 style={{ marginBottom: "20px", fontSize: "18px" }}>
              Order Summary
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              {cart.map((item, i) => {
                const safeVariant = getVariantLabel(item.variant);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: "50px",
                          height: "50px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            margin: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.name}{" "}
                          {safeVariant && (
                            <span
                              style={{ fontWeight: "normal", color: "#64748b" }}
                            >
                              ({safeVariant})
                            </span>
                          )}
                        </p>
                        <p
                          style={{
                            color: "#64748b",
                            fontSize: "12px",
                            margin: 0,
                          }}
                        >
                          Qty: {item.quantity}
                        </p>
                      </div>
                    </div>
                    <p style={{ fontWeight: "600", flexShrink: 0, margin: 0 }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>

            <hr
              style={{
                border: "none",
                borderTop: "1px solid #e2e8f0",
                margin: "20px 0",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "12px",
                color: "#64748b",
              }}
            >
              <span>Subtotal</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
                color: "#64748b",
              }}
            >
              <span>
                Shipping (
                {shippingMethod === "express" ? "Express" : "Standard"})
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: shippingCost === 0 ? "600" : "500",
                  color: shippingCost === 0 ? "#16a34a" : "inherit",
                }}
              >
                {shippingLabel}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "20px",
                fontWeight: "bold",
                color: "#0f172a",
              }}
            >
              <span>Total to Pay</span>
              <span>${estimatedTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const inputStyle = {
  padding: "14px 16px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "15px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const backBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "none",
  border: "none",
  color: "#64748b",
  cursor: "pointer",
  marginBottom: "20px",
  padding: 0,
  fontWeight: "500",
};

const copyBtnStyle = {
  background: "#f1f5f9",
  border: "1px solid #cbd5e1",
  color: "#334155",
  fontSize: "12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  fontWeight: "600",
  padding: "6px 10px",
  borderRadius: "6px",
  transition: "all 0.2s",
};
