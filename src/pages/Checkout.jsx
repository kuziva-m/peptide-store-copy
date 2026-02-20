import { useState } from "react";
import { useCart } from "../lib/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Lock, Loader, Truck } from "lucide-react";
import "../components/CartDrawer.css";

export default function Checkout() {
  const { cart, cartTotal } = useCart();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getVariantLabel = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.size_label || "Option";
    return String(v);
  };

  let shippingMessage = "";
  let shippingColor = "#d97706";
  let defaultShippingCost = 0;
  let shippingLabel = "";

  if (cartTotal < 150) {
    shippingMessage = `Add $${(150 - cartTotal).toFixed(2)} more to unlock Free Shipping.`;
    defaultShippingCost = 9.99;
    shippingLabel = "$9.99";
  } else if (cartTotal >= 150 && cartTotal < 250) {
    shippingMessage = `Free Shipping!`;
    shippingColor = "#16a34a";
    defaultShippingCost = 0;
    shippingLabel = "Free";
  } else {
    shippingMessage = `Free Shipping`;
    shippingColor = "#16a34a";
    defaultShippingCost = 0;
    shippingLabel = "Free";
  }

  const estimatedTotal = cartTotal + defaultShippingCost;

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        cart,
        totals: {
          total: cartTotal,
          shipping: 0,
          shippingMethod: "Calculated by Tagada",
          discountUsed: null,
        },
        customer: { email },
      };

      const { data, error: functionError } = await supabase.functions.invoke(
        "create-tagada-session",
        { body: payload },
      );

      if (functionError) throw new Error(functionError.message);

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Could not retrieve payment link.");
      }
    } catch (err) {
      console.error("Checkout Error:", err);
      setError("Failed to start secure checkout. Please try again.");
      setIsLoading(false);
    }
  };

  if (!cart || cart.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2>Your cart is empty</h2>
        <button
          onClick={() => navigate("/shop")}
          className="checkout-btn"
          style={{ maxWidth: "200px", margin: "20px auto" }}
        >
          Go to Shop
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Inject responsive styles */}
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

          .checkout-summary {
            order: -1;
          }

          .checkout-summary-inner {
            padding: 20px !important;
          }

          .checkout-shipping-grid {
            flex-direction: column !important;
            gap: 8px !important;
          }

          .checkout-shipping-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 2px !important;
          }
        }

        @media (max-width: 480px) {
          .checkout-wrapper {
            padding: 0 12px;
            margin: 12px auto;
          }

          .checkout-title {
            font-size: 20px !important;
          }

          .checkout-submit-btn {
            font-size: 15px !important;
            padding: 14px !important;
          }

          .cart-item-row {
            gap: 8px !important;
          }

          .cart-item-img {
            width: 42px !important;
            height: 42px !important;
          }
        }
      `}</style>

      <div className="checkout-wrapper">
        {/* LEFT SIDE */}
        <div>
          <button
            onClick={() => navigate("/shop")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              marginBottom: "20px",
              padding: 0,
            }}
          >
            <ArrowLeft size={16} /> Back to Shop
          </button>

          <h2
            className="checkout-title"
            style={{ marginBottom: "20px", fontSize: "24px" }}
          >
            Express Checkout
          </h2>
          <p
            style={{
              color: "#64748b",
              marginBottom: "24px",
              lineHeight: "1.5",
            }}
          >
            Enter your email below to proceed. You will enter your secure
            shipping details, choose your delivery speed, and apply any promo
            codes on the next page.
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
            onSubmit={handlePaymentSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <input
              required
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...inputStyle, padding: "16px", fontSize: "16px" }}
            />

            {/* SHIPPING PANEL */}
            <div
              style={{
                marginTop: "10px",
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
                <Truck size={18} color="#0f172a" /> Shipping Rates
              </h3>

              <div
                className="checkout-shipping-grid"
                style={{
                  fontSize: "14px",
                  color: "#475569",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div
                  className="checkout-shipping-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Standard Shipping</span>
                  <span style={{ fontWeight: "600", color: "#0f172a" }}>
                    $9.99{" "}
                    <span
                      style={{
                        color: "#64748b",
                        fontWeight: "normal",
                        fontSize: "12px",
                      }}
                    >
                      (Free over $150)
                    </span>
                  </span>
                </div>
                <div
                  className="checkout-shipping-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Express Shipping</span>
                  <span style={{ fontWeight: "600", color: "#0f172a" }}>
                    $14.99{" "}
                    <span
                      style={{
                        color: "#64748b",
                        fontWeight: "normal",
                        fontSize: "12px",
                      }}
                    >
                      (Free over $250)
                    </span>
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: "1px solid #cbd5e1",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: shippingColor,
                  textAlign: "center",
                }}
              >
                {shippingMessage}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="checkout-btn checkout-submit-btn"
              style={{
                marginTop: "10px",
                padding: "16px",
                fontSize: "16px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {isLoading ? (
                <>
                  <Loader className="spin-anim" size={18} /> Secure Redirect...
                </>
              ) : (
                <>
                  <Lock size={18} /> Proceed to Secure Payment
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT SIDE: ORDER SUMMARY */}
        <div className="checkout-summary">
          <div
            className="checkout-summary-inner"
            style={{
              background: "#f8fafc",
              padding: "30px",
              borderRadius: "12px",
              height: "fit-content",
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
                    className="cart-item-row"
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
                        className="cart-item-img"
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
              <span>Shipping</span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: defaultShippingCost === 0 ? "600" : "500",
                  color: defaultShippingCost === 0 ? "#16a34a" : "inherit",
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
              }}
            >
              <span>Estimated Total</span>
              <span>${estimatedTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const inputStyle = {
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "15px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
