import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock, Loader } from "lucide-react";
import { useCart } from "../lib/CartContext";

export default function Success() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [loading, setLoading] = useState(true);

  // Using cart and clearCart directly from the context
  const { cart, clearCart } = useCart();

  useEffect(() => {
    // Clear cart
    if (cart && cart.length > 0 && clearCart) {
      clearCart();
    }
    // Simulate verification
    setTimeout(() => setLoading(false), 1500);
  }, [cart, clearCart]);

  if (loading) {
    return (
      <div style={{ padding: "100px", textAlign: "center" }}>
        <Loader
          className="spin-anim"
          size={40}
          style={{ margin: "0 auto", color: "#3b82f6" }}
        />
        <h3 style={{ marginTop: "15px", color: "#475569" }}>
          Processing Request...
        </h3>
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
      <Clock
        size={80}
        color="#f59e0b" // A nice amber/orange to indicate pending/review
        style={{ margin: "0 auto 20px" }}
      />
      <h1 style={{ color: "#0f172a", marginBottom: "15px" }}>
        Order Under Review
      </h1>
      <p style={{ color: "#64748b", fontSize: "1.1rem", lineHeight: "1.6" }}>
        Thank you! Your order has been submitted and is currently under review.
        You will receive an email shortly with payment instructions and further
        details.
      </p>

      {orderId && (
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
            #{orderId.slice(0, 8).toUpperCase()}
          </h2>
          <p
            style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "10px" }}
          >
            Please keep this reference for your records.
          </p>
        </div>
      )}

      <Link
        to="/shop"
        style={{
          display: "inline-block",
          background: "#0f172a",
          color: "white",
          padding: "14px 28px",
          borderRadius: "8px",
          textDecoration: "none",
          fontWeight: "bold",
          marginTop: "20px",
        }}
      >
        Return to Shop
      </Link>
    </div>
  );
}
