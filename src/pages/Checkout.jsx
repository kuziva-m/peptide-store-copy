import { useState, useEffect } from "react";
import { useCart } from "../lib/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Lock, Loader, Tag, X } from "lucide-react";
import "../components/CartDrawer.css";

export default function Checkout() {
  const { cart, cartTotal } = useCart();
  const navigate = useNavigate();

  // --- FORM STATE ---
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- DISCOUNT STATE ---
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [discountLoading, setDiscountLoading] = useState(false);

  // --- SHIPPING TIER LOGIC ---
  const isFreeShippingTier = cartTotal >= 150;

  // Auto-select express shipping if they qualify for the free tier
  useEffect(() => {
    if (cartTotal >= 150) {
      setShippingMethod("express");
    }
  }, [cartTotal]);

  const baseShippingCost = isFreeShippingTier
    ? 0
    : shippingMethod === "express"
      ? 14.99
      : 9.99;

  let shippingCost = baseShippingCost;
  let discountAmount = 0;

  if (appliedDiscount) {
    if (appliedDiscount.type === "percentage") {
      discountAmount = cartTotal * (appliedDiscount.value / 100);
    } else if (appliedDiscount.type === "fixed") {
      discountAmount = appliedDiscount.value;
    }

    if (
      appliedDiscount.free_shipping ||
      appliedDiscount.type === "shipping_only"
    ) {
      shippingCost = 0;
    }
  }

  // Prevent negative totals
  const finalTotal = Math.max(0, cartTotal - discountAmount + shippingCost);

  // --- HANDLERS ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountLoading(true);
    setDiscountError("");

    try {
      const codeToApply = discountCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from("discounts")
        .select("*")
        .eq("code", codeToApply)
        .single();

      if (error || !data) throw new Error("Invalid discount code.");
      if (!data.active) throw new Error("This code is no longer active.");

      if (data.max_uses) {
        const { count } = await supabase
          .from("discount_usage")
          .select("*", { count: "exact", head: true })
          .eq("coupon_code", data.code);
        if (count >= data.max_uses)
          throw new Error("Discount usage limit reached.");
      }

      setAppliedDiscount(data);
      setDiscountCode("");
    } catch (err) {
      setDiscountError(err.message);
      setAppliedDiscount(null);
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError("");
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        cart,
        totals: {
          total: finalTotal,
          shipping: shippingCost,
          // Let the backend know if they triggered the free tier via total
          shippingMethod:
            isFreeShippingTier && shippingMethod === "express"
              ? "Free Express Shipping"
              : shippingMethod,
          discountUsed: appliedDiscount ? appliedDiscount.code : null,
        },
        customer: formData,
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
    <div
      style={{
        maxWidth: "1000px",
        margin: "40px auto",
        padding: "0 20px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "40px",
      }}
    >
      {/* LEFT SIDE: FORM */}
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
          }}
        >
          <ArrowLeft size={16} /> Back to Shop
        </button>

        <h2 style={{ marginBottom: "20px", fontSize: "24px" }}>
          Shipping Details
        </h2>

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

          <div style={{ marginTop: "20px" }}>
            <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>
              Shipping Method
            </h3>
            {isFreeShippingTier && (
              <p
                style={{
                  color: "#16a34a",
                  fontSize: "14px",
                  margin: "0 0 16px 0",
                  fontWeight: "500",
                }}
              >
                🎉 Your order is over $150! You qualify for Free Express
                Shipping.
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "16px" }}>
            <label
              style={{
                ...shippingBoxStyle,
                borderColor:
                  shippingMethod === "standard" ? "#0f172a" : "#e2e8f0",
              }}
            >
              <input
                type="radio"
                name="shipping"
                value="standard"
                checked={shippingMethod === "standard"}
                onChange={() => setShippingMethod("standard")}
                style={{ marginRight: "8px" }}
              />
              Standard (
              {isFreeShippingTier || appliedDiscount?.free_shipping
                ? "Free"
                : "$9.99"}
              )
            </label>
            <label
              style={{
                ...shippingBoxStyle,
                borderColor:
                  shippingMethod === "express" ? "#0f172a" : "#e2e8f0",
              }}
            >
              <input
                type="radio"
                name="shipping"
                value="express"
                checked={shippingMethod === "express"}
                onChange={() => setShippingMethod("express")}
                style={{ marginRight: "8px" }}
              />
              Express (
              {isFreeShippingTier || appliedDiscount?.free_shipping
                ? "Free"
                : "$14.99"}
              )
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="checkout-btn"
            style={{
              marginTop: "20px",
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
                <Lock size={18} /> Pay Securely (${finalTotal.toFixed(2)})
              </>
            )}
          </button>
        </form>
      </div>

      {/* RIGHT SIDE: ORDER SUMMARY */}
      <div
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
          {cart.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{
                    width: "50px",
                    height: "50px",
                    objectFit: "cover",
                    borderRadius: "8px",
                  }}
                />
                <div>
                  <p style={{ fontWeight: "600", fontSize: "14px", margin: 0 }}>
                    {item.name}
                  </p>
                  <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>
                    Qty: {item.quantity}
                  </p>
                </div>
              </div>
              <p style={{ fontWeight: "600" }}>
                ${(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* DISCOUNT INPUT */}
        <div style={{ marginBottom: "20px" }}>
          {!appliedDiscount ? (
            <div>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Discount code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: "10px" }}
                />
                <button
                  onClick={handleApplyDiscount}
                  disabled={discountLoading}
                  style={{
                    padding: "0 20px",
                    background: "#0f172a",
                    color: "white",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  {discountLoading ? "..." : "Apply"}
                </button>
              </div>
              {discountError && (
                <p
                  style={{
                    color: "#dc2626",
                    fontSize: "13px",
                    marginTop: "8px",
                  }}
                >
                  {discountError}
                </p>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#ecfdf5",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #a7f3d0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#065f46",
                  fontWeight: "600",
                }}
              >
                <Tag size={16} /> {appliedDiscount.code} applied!
              </div>
              <button
                onClick={handleRemoveDiscount}
                style={{
                  background: "none",
                  border: "none",
                  color: "#065f46",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
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

        {discountAmount > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
              color: "#16a34a",
              fontWeight: "500",
            }}
          >
            <span>Discount ({appliedDiscount.code})</span>
            <span>-${discountAmount.toFixed(2)}</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "20px",
            color: "#64748b",
          }}
        >
          <span>Shipping</span>
          <span>
            {shippingCost === 0 ? (
              <span style={{ color: "#16a34a", fontWeight: "600" }}>Free</span>
            ) : (
              `$${shippingCost.toFixed(2)}`
            )}
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
          <span>Total</span>
          <span>${finalTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
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

const shippingBoxStyle = {
  flex: 1,
  padding: "16px",
  border: "2px solid #e2e8f0",
  borderRadius: "8px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  fontWeight: "500",
  fontSize: "14px",
};
