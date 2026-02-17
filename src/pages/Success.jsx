import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader } from "lucide-react";
import { useCart } from "../lib/CartContext";

export default function Success() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [loading, setLoading] = useState(true);
  const { cartItems, removeFromCart } = useCart();

  useEffect(() => {
    // Clear cart
    if (cartItems && cartItems.length > 0) {
      cartItems.forEach((i) => removeFromCart(i.id, i.variant));
    }
    // Simulate verification
    setTimeout(() => setLoading(false), 1500);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "100px", textAlign: "center" }}>
        <Loader
          className="spin-anim"
          size={40}
          style={{ margin: "0 auto", color: "#3b82f6" }}
        />
        <h3>Verifying Payment...</h3>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "80px 24px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <CheckCircle
        size={80}
        color="#10b981"
        style={{ margin: "0 auto 20px" }}
      />
      <h1 style={{ color: "#0f172a" }}>Order Confirmed!</h1>
      <p style={{ color: "#64748b", fontSize: "1.1rem" }}>
        Thank you! Your payment has been received and your order is being
        processed.
      </p>

      <div
        style={{
          background: "#f8fafc",
          padding: "20px",
          borderRadius: "12px",
          margin: "30px 0",
          border: "1px solid #e2e8f0",
        }}
      >
        <p style={{ margin: 0, fontWeight: "600", color: "#64748b" }}>
          Order Reference
        </p>
        <h2 style={{ margin: "5px 0", color: "#3b82f6" }}>
          #{orderId?.slice(0, 8).toUpperCase() || "..."}
        </h2>
        <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
          You will receive an email confirmation shortly.
        </p>
      </div>

      <Link
        to="/"
        style={{
          display: "inline-block",
          background: "#0f172a",
          color: "white",
          padding: "12px 24px",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: "bold",
        }}
      >
        Return to Shop
      </Link>
    </div>
  );
}
