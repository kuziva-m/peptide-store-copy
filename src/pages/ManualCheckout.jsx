import { useState } from "react";
import { useCart } from "../lib/CartContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Lock,
  Loader,
  CreditCard,
  Tag,
  X,
  Truck,
  Zap,
} from "lucide-react";

export default function ManualCheckout() {
  const { cart, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    postcode: "",
  });

  // --- DISCOUNT & SHIPPING STATE ---
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [shippingMethod, setShippingMethod] = useState("standard");

  // --- CALCULATIONS ---
  let discountAmount = 0;
  if (appliedDiscount) {
    if (appliedDiscount.type === "percentage") {
      discountAmount = cartTotal * (appliedDiscount.value / 100);
    } else if (appliedDiscount.type === "fixed") {
      discountAmount = appliedDiscount.value;
    }
  }
  const subtotalAfterDiscount = Math.max(0, cartTotal - discountAmount);

  const codeGrantsFreeShip = appliedDiscount?.free_shipping === true;
  const isStandardFree = subtotalAfterDiscount >= 150 || codeGrantsFreeShip;
  const isExpressFree = subtotalAfterDiscount >= 250 || codeGrantsFreeShip;

  const shippingCost = (() => {
    if (shippingMethod === "express") return isExpressFree ? 0 : 14.99;
    return isStandardFree ? 0 : 9.99;
  })();

  const grandTotal = subtotalAfterDiscount + shippingCost;

  // --- HANDLERS ---
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    setDiscountError("");
    if (!discountCode.trim()) return;

    try {
      const { data, error } = await supabase
        .from("discounts")
        .select("*")
        .ilike("code", discountCode.trim())
        .eq("active", true)
        .maybeSingle();

      if (error || !data) {
        setDiscountError("Invalid code");
        setAppliedDiscount(null);
      } else {
        setAppliedDiscount(data);
      }
    } catch (err) {
      console.error(err);
      setDiscountError("Error checking code");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Call Backend to Create Order & Get Payment Link
      const { data, error } = await supabase.functions.invoke(
        "create-tagada-session",
        {
          body: {
            customer: formData,
            cart: cart,
            totals: {
              subtotal: subtotalAfterDiscount,
              shipping: shippingCost,
              total: grandTotal,
              discountUsed: appliedDiscount?.code || null,
              shippingMethod:
                shippingMethod === "express" ? "Express" : "Standard",
            },
          },
        },
      );

      if (error) throw error;

      // 2. Redirect User to Tagada Payment Page
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Payment URL not found");
      }
    } catch (err) {
      console.error(err);
      alert("Checkout Error: " + err.message);
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Cart is empty</h2>
        <button onClick={() => navigate("/shop")}>Return to Shop</button>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px 20px 60px 20px",
      }}
    >
      <button
        onClick={() => navigate("/shop")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          background: "none",
          border: "none",
          marginBottom: "20px",
          cursor: "pointer",
          color: "#64748b",
        }}
      >
        <ArrowLeft size={18} /> Back to Shop
      </button>

      <div
        style={{
          background: "#f8fafc",
          padding: "15px",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          marginBottom: "30px",
        }}
      >
        <h3
          style={{
            margin: "0 0 5px 0",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Lock size={16} /> Secure Checkout
        </h3>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b" }}>
          Complete your purchase securely. You will be redirected to our payment
          partner.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        {/* 1. CONTACT */}
        <section>
          <h3 style={styles.heading}>Contact Info</h3>
          <div style={{ display: "grid", gap: "15px" }}>
            <input
              required
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              style={styles.input}
            />
            <input
              required
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
            />
            <input
              required
              name="phone"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={handleChange}
              style={styles.input}
            />
          </div>
        </section>

        {/* 2. SHIPPING ADDRESS */}
        <section>
          <h3 style={styles.heading}>Shipping Address</h3>
          <div style={{ display: "grid", gap: "15px" }}>
            <input
              required
              name="line1"
              placeholder="Address Line 1"
              value={formData.line1}
              onChange={handleChange}
              style={styles.input}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px",
              }}
            >
              <input
                required
                name="city"
                placeholder="City"
                value={formData.city}
                onChange={handleChange}
                style={styles.input}
              />
              <input
                required
                name="state"
                placeholder="State"
                value={formData.state}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
            <input
              required
              name="postcode"
              placeholder="Postcode"
              value={formData.postcode}
              onChange={handleChange}
              style={styles.input}
            />
          </div>
        </section>

        {/* 3. ORDER OPTIONS */}
        <section
          style={{
            background: "#f8fafc",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Order Options</h3>

          {/* Discount */}
          <div style={{ marginBottom: "20px" }}>
            <label style={styles.label}>Discount Code</label>
            {!appliedDiscount ? (
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  placeholder="Enter code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  style={{ ...styles.input, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  style={styles.applyBtn}
                >
                  Apply
                </button>
              </div>
            ) : (
              <div style={styles.appliedTag}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: "600",
                  }}
                >
                  <Tag size={16} /> {appliedDiscount.code} applied
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedDiscount(null);
                    setDiscountCode("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#15803d",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {discountError && (
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "0.85rem",
                  marginTop: "5px",
                }}
              >
                {discountError}
              </p>
            )}
          </div>

          {/* Shipping */}
          <div>
            <label style={styles.label}>Shipping Method</label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <div
                onClick={() => setShippingMethod("standard")}
                style={{
                  ...styles.shipOption,
                  borderColor:
                    shippingMethod === "standard" ? "#3b82f6" : "#cbd5e1",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <Truck size={20} color="#64748b" />
                  <div>
                    <div style={{ fontWeight: "600", color: "#0f172a" }}>
                      Standard
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      2-6 Business Days
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: "600",
                    color: isStandardFree ? "#16a34a" : "#0f172a",
                  }}
                >
                  {isStandardFree ? "FREE" : "$9.99"}
                </div>
              </div>

              <div
                onClick={() => setShippingMethod("express")}
                style={{
                  ...styles.shipOption,
                  borderColor:
                    shippingMethod === "express" ? "#3b82f6" : "#cbd5e1",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <Zap size={20} color="#f59e0b" />
                  <div>
                    <div style={{ fontWeight: "600", color: "#0f172a" }}>
                      Express
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      1-3 Business Days
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: "600",
                    color: isExpressFree ? "#16a34a" : "#0f172a",
                  }}
                >
                  {isExpressFree ? "FREE" : "$14.99"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. TOTALS */}
        <section
          style={{
            background: "#f8fafc",
            padding: "20px",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Summary</h3>
          {cart.map((item) => (
            <div key={item.id + item.variant} style={styles.summaryItem}>
              <span>
                {item.name} x {item.quantity}
              </span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div
            style={{ borderTop: "1px solid #e2e8f0", margin: "15px 0" }}
          ></div>
          <div style={styles.row}>
            <span>Subtotal</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          {appliedDiscount && (
            <div style={{ ...styles.row, color: "#16a34a" }}>
              <span>Discount</span>
              <span>-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={styles.row}>
            <span>Shipping</span>
            <span>
              {shippingCost === 0 ? "Free" : `$${shippingCost.toFixed(2)}`}
            </span>
          </div>
          <div
            style={{
              ...styles.row,
              marginTop: "15px",
              fontWeight: "bold",
              fontSize: "1.2rem",
              color: "#0f172a",
            }}
          >
            <span>Total</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
        </section>

        <button type="submit" disabled={loading} style={styles.payBtn}>
          {loading ? (
            <Loader className="spin-anim" />
          ) : (
            <>
              <CreditCard /> Pay Now
            </>
          )}
        </button>
      </form>
    </div>
  );
}

const styles = {
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
    background: "white",
  },
  heading: {
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "10px",
    marginBottom: "15px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "5px",
  },
  label: {
    fontSize: "0.9rem",
    fontWeight: "600",
    color: "#64748b",
    marginBottom: "8px",
    display: "block",
  },
  applyBtn: {
    padding: "0 20px",
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
  },
  appliedTag: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#dcfce7",
    padding: "10px",
    borderRadius: "6px",
    color: "#166534",
  },
  shipOption: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    background: "white",
    cursor: "pointer",
  },
  summaryItem: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
    fontSize: "0.9rem",
  },
  payBtn: {
    background: "#0f172a",
    color: "white",
    padding: "16px",
    borderRadius: "8px",
    fontSize: "1.1rem",
    fontWeight: "bold",
    border: "none",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
  },
};
