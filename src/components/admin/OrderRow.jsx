import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { downloadAusPostCSV } from "../../utils/exportToAusPost";
import { styles } from "./OrderManagerStyles";
import {
  ExternalLink,
  Edit2,
  Save,
  ChevronDown,
  ChevronUp,
  Truck,
  MapPin,
  Package,
  Phone,
  Mail,
  User,
  Zap,
  Download,
  MessageCircle,
  Send,
  Tag,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
  XCircle,
} from "lucide-react";

export function OrderRow({
  order,
  onUpdate,
  showToast,
  promptConfirm,
  onDelete,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(order.notes || "");
  const [emailMode, setEmailMode] = useState(false);
  const [customEmailText, setCustomEmailText] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const [formData, setFormData] = useState({
    status: order.status,
    tracking: order.tracking_number || "",
    name: order.customer_name || "",
    email: order.customer_email || "",
    phone: order.shipping_address?.phone || "",
    line1: order.shipping_address?.line1 || "",
    line2: order.shipping_address?.line2 || "",
    city: order.shipping_address?.city || "",
    state: order.shipping_address?.state || "",
    postal_code: order.shipping_address?.postal_code || "",
    country: order.shipping_address?.country || "AU",
  });

  const formatAUSDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-AU", {
      timeZone: "Australia/Melbourne",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // --- MISSING FUNCTION RESTORED ---
  const sendStatusEmail = async (tracking, statusType) => {
    try {
      const rawItems =
        order.order_items && order.order_items.length > 0
          ? order.order_items
          : order.items;
      const emailItems = rawItems.map((item) => {
        let name =
          item.product_name_snapshot ||
          item.description ||
          item.name ||
          "Unknown Product";
        let size = "";
        if (item.variants && item.variants.products) {
          name = item.variants.products.name;
          size = item.variants.size_label;
        }
        return { name, quantity: item.quantity, size };
      });

      const { error } = await supabase.functions.invoke("send-order-update", {
        body: {
          orderId: order.id,
          email: formData.email,
          name: formData.name,
          trackingNumber: tracking || "N/A",
          items: emailItems,
          address: {
            line1: formData.line1,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
          },
          status: statusType,
        },
      });

      if (error) throw error;
      showToast("Email notification sent!");
    } catch (err) {
      console.error(err);
      showToast("Error sending email");
    }
  };

  const handleApprovePayment = async () => {
    promptConfirm(
      "Confirm Payment",
      "Mark as Paid? This will move it to the Paid tab.",
      async () => {
        const { error } = await supabase
          .from("orders")
          .update({ status: "paid" })
          .eq("id", order.id);

        if (!error) {
          showToast("Payment Approved");
          onUpdate();
        }
      },
    );
  };

  const handleRejectPayment = async () => {
    promptConfirm(
      "Reject",
      "Cancel this order? This cannot be undone.",
      async () => {
        const { error } = await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", order.id);

        if (!error) {
          showToast("Order Cancelled");
          onUpdate();
        }
      },
      true,
    );
  };

  const handleSaveNote = async () => {
    const { error } = await supabase
      .from("orders")
      .update({ notes: noteText })
      .eq("id", order.id);

    if (error) showToast("Failed to save note");
    else {
      showToast("Note saved!");
      onUpdate();
    }
  };

  const handleQuickStatus = (newStatus) => {
    let promptMsg = `Mark as ${newStatus}?`;
    promptConfirm("Update Status", promptMsg, async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", order.id);

      if (!error) {
        showToast(`Updated to ${newStatus}`);

        // Send email notification for shipping updates
        if (["label_created", "shipped", "delivered"].includes(newStatus)) {
          await sendStatusEmail(order.tracking_number, newStatus);
        }

        onUpdate();
      }
    });
  };

  const getStatusStyle = (s) => {
    switch (s) {
      case "payment_reported":
        return {
          bg: "#fff7ed",
          color: "#c2410c",
          border: "#ffedd5",
          label: "Verify Payment",
        };
      case "pending_contact":
        return {
          bg: "#fefce8",
          color: "#854d0e",
          border: "#fef9c3",
          label: "Unpaid",
        };
      case "paid":
      case "processing":
        return {
          bg: "#dcfce7",
          color: "#166534",
          border: "#bbf7d0",
          label: "Paid",
        };
      case "label_created":
        return {
          bg: "#f3e8ff",
          color: "#7e22ce",
          border: "#e9d5ff",
          label: "Label Created",
        };
      case "shipped":
        return {
          bg: "#eff6ff",
          color: "#1d4ed8",
          border: "#dbeafe",
          label: "Shipped",
        };
      case "delivered":
        return {
          bg: "#f0fdf4",
          color: "#15803d",
          border: "#dcfce7",
          label: "Delivered",
        };
      case "cancelled":
        return {
          bg: "#fef2f2",
          color: "#b91c1c",
          border: "#fecaca",
          label: "Cancelled",
        };
      default:
        return { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", label: s };
    }
  };

  const sStyle = getStatusStyle(order.status);

  return (
    <div style={styles.orderRow}>
      {/* HEADER */}
      <div
        style={styles.rowHeader}
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div style={styles.colInfo}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={styles.primaryText}>
              {order.customer_name || "Guest"}
            </div>
            {order.receipt_url && <ImageIcon size={14} color="#d97706" />}
          </div>
          <div style={styles.metaText}>
            #{order.id.slice(0, 8)} • {formatAUSDate(order.created_at)}
          </div>
        </div>
        <div style={styles.colStatus}>
          <span
            style={{
              ...styles.badge,
              backgroundColor: sStyle.bg,
              color: sStyle.color,
              borderColor: sStyle.border,
            }}
          >
            {sStyle.label}
          </span>
        </div>
        <div style={styles.colTotal}>${order.total_amount}</div>
        <button style={styles.iconBtn}>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* EXPANDED PANEL */}
      {isExpanded && (
        <div style={styles.expandedPanel}>
          {/* --- PAYMENT PROOF / APPROVAL SECTION --- */}
          {(order.status === "payment_reported" ||
            order.status === "pending_contact") && (
            <div
              style={{
                background:
                  order.status === "payment_reported" ? "#fff7ed" : "white",
                border: "1px solid #fed7aa",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px 0",
                  color: "#9a3412",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {order.status === "payment_reported" ? (
                  <AlertTriangle size={18} />
                ) : (
                  <CheckCircle size={18} />
                )}
                {order.status === "payment_reported"
                  ? "Payment Reported - Verify Now"
                  : "Mark as Paid"}
              </h4>

              <div
                style={{
                  display: "flex",
                  gap: "15px",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {/* VIEW SCREENSHOT BUTTON */}
                {order.receipt_url ? (
                  <a
                    href={order.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "white",
                      padding: "10px 16px",
                      borderRadius: "6px",
                      border: "1px solid #fdba74",
                      color: "#c2410c",
                      fontWeight: "bold",
                      textDecoration: "none",
                    }}
                  >
                    <ImageIcon size={18} /> View Payment Screenshot
                  </a>
                ) : (
                  <span
                    style={{
                      color: "#ef4444",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <XCircle size={18} /> No Screenshot Sent
                  </span>
                )}

                <div
                  style={{ display: "flex", gap: "8px", marginLeft: "auto" }}
                >
                  <button
                    onClick={handleRejectPayment}
                    style={{
                      background: "#fee2e2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    Cancel Order
                  </button>
                  <button
                    onClick={handleApprovePayment}
                    style={{
                      background: "#16a34a",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <CheckCircle size={16} /> Approve & Move to Paid
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={styles.panelGrid}>
            <div style={{ gridColumn: "span 2" }}>
              <div style={styles.sectionTitle}>
                <Package size={14} /> Items
              </div>
              <div style={styles.itemsTable}>
                {(order.order_items || order.items || []).map((item, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={styles.itemQty}>{item.quantity}x</span>
                    <div style={styles.itemInfo}>
                      <span style={styles.itemName}>
                        {item.product_name_snapshot || item.name || "Product"}
                      </span>
                      {item.variants && (
                        <span style={styles.variantLabel}>
                          {item.variants.size_label}
                        </span>
                      )}
                    </div>
                    <span style={styles.itemPrice}>
                      ${(item.price_at_purchase || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "20px" }}>
                <div style={styles.sectionTitle}>
                  <MessageCircle size={14} /> Private Notes
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Details about payment, customer..."
                    style={styles.noteInput}
                    rows={2}
                  />
                  <button onClick={handleSaveNote} style={styles.saveNoteBtn}>
                    Save
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.detailCol}>
              <div style={styles.sectionTitle}>
                <User size={14} /> Customer
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "#334155",
                  lineHeight: "1.6",
                }}
              >
                <div style={{ fontWeight: "bold" }}>{order.customer_name}</div>
                <div>{order.customer_email}</div>
                <div>{order.shipping_address?.phone}</div>
                <hr
                  style={{
                    margin: "10px 0",
                    border: "0",
                    borderTop: "1px solid #e2e8f0",
                  }}
                />
                <div>{order.shipping_address?.line1}</div>
                <div>
                  {order.shipping_address?.city},{" "}
                  {order.shipping_address?.state}{" "}
                  {order.shipping_address?.postal_code}
                </div>
              </div>

              {/* --- ACTION BUTTONS (At Bottom of Customer Column) --- */}
              <div
                style={{
                  marginTop: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {/* 1. Mark Label Created (Only if Paid) */}
                {(order.status === "paid" || order.status === "processing") && (
                  <button
                    onClick={() => handleQuickStatus("label_created")}
                    style={{
                      ...styles.actionBtn,
                      background: "#f0fdf4",
                      color: "#15803d",
                      borderColor: "#bbf7d0",
                      width: "100%",
                      padding: "12px",
                    }}
                  >
                    Mark Label Created
                  </button>
                )}

                {/* 2. Mark Shipped (Only if Label Created) */}
                {order.status === "label_created" && (
                  <button
                    onClick={() => handleQuickStatus("shipped")}
                    style={{
                      ...styles.actionBtn,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderColor: "#dbeafe",
                      width: "100%",
                      padding: "12px",
                    }}
                  >
                    Mark Shipped
                  </button>
                )}

                <button
                  onClick={() => setIsEditing(true)}
                  style={styles.secondaryBtn}
                >
                  <Edit2 size={14} /> Edit Order Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
