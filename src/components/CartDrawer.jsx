import { useEffect } from "react";
import { X, Minus, Plus, ShoppingBag, Mail, Trash2 } from "lucide-react";
import { useCart } from "../lib/CartContext";
import { useNavigate } from "react-router-dom";
import "./CartDrawer.css";

export default function CartDrawer() {
  const {
    cart = [],
    isCartOpen,
    toggleCart,
    updateQuantity,
    removeFromCart,
    cartTotal = 0,
  } = useCart();
  const navigate = useNavigate();

  // Helper
  const getVariantLabel = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.size_label || "Option";
    return String(v);
  };

  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isCartOpen]);

  // --- CHANGED: Dynamically build the email body with cart items ---
  const handleEmailOrderClick = () => {
    const subject = encodeURIComponent("New Order Request");

    // Build a text list of all items in the cart
    let cartDetails = "";
    cart.forEach((item) => {
      const variantText = getVariantLabel(item.variant);
      const itemTotal = (item.price * item.quantity).toFixed(2);
      cartDetails += `- ${item.quantity}x ${item.name} ${variantText ? `(${variantText})` : ""} = $${itemTotal}\n`;
    });

    // Add the grand total
    cartDetails += `\nOrder Total: $${cartTotal.toFixed(2)}`;

    // Create the final email body
    const rawBody = `Hi Melbourne Peptides team,\n\nI would like to place an order for the following items:\n\n${cartDetails}\n\nPlease let me know how to proceed with payment and shipping.\n\nThank you!`;

    const body = encodeURIComponent(rawBody);
    window.location.href = `mailto:info@melbournepeptides.com.au?subject=${subject}&body=${body}`;
  };

  if (!isCartOpen) return null;
  const itemCount = cart ? cart.length : 0;

  return (
    <>
      <div className="cart-overlay" onClick={toggleCart}></div>
      <div className="cart-drawer">
        <div className="cart-header">
          <h3>Your Cart ({itemCount})</h3>
          <button onClick={toggleCart} className="close-cart-btn">
            <X size={24} />
          </button>
        </div>

        {itemCount === 0 ? (
          <div className="empty-cart">
            <ShoppingBag size={48} color="#e2e8f0" />
            <p>Your cart is empty.</p>
            <button
              onClick={() => {
                toggleCart();
                navigate("/shop");
              }}
              className="continue-shopping-btn"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="cart-scroll-area">
              <div className="cart-items-list">
                {cart.map((item, index) => {
                  const safeVariant = getVariantLabel(item.variant);
                  const itemKey = `${item.id}-${safeVariant}-${index}`;
                  return (
                    <div key={itemKey} className="cart-item">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="cart-item-img"
                      />
                      <div className="cart-item-details">
                        <div>
                          <h4>{item.name}</h4>
                          <p className="cart-item-variant">{safeVariant}</p>
                        </div>
                        <div className="cart-item-controls">
                          <div className="qty-selector">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  item.quantity - 1,
                                  item.variant,
                                )
                              }
                            >
                              <Minus size={14} />
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  item.quantity + 1,
                                  item.variant,
                                )
                              }
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p className="cart-item-price">
                              ${(item.price * item.quantity).toFixed(2)}
                            </p>
                            <button
                              onClick={() =>
                                removeFromCart(item.id, item.variant)
                              }
                              className="remove-btn"
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="cart-sticky-footer">
              <div className="footer-total">
                <span>Subtotal</span>
                <span className="big-price">${cartTotal.toFixed(2)}</span>
              </div>
              <p
                className="shipping-note"
                style={{ color: "#ef4444", fontWeight: "600" }}
              >
                Online checkout is temporarily disabled.
              </p>

              <button
                disabled
                className="checkout-btn"
                style={{
                  backgroundColor: "#94a3b8",
                  cursor: "not-allowed",
                  opacity: 0.7,
                }}
              >
                Checkout Closed
              </button>

              <button
                onClick={handleEmailOrderClick}
                className="checkout-btn"
                style={{
                  backgroundColor: "#d97706",
                  display: "flex",
                  justifyContent: "center",
                  gap: "8px",
                  marginTop: "10px",
                }}
              >
                <Mail size={18} /> Email Us to Order
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
