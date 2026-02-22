import { useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
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

  // --- Tracking & Status State ---
  const [quickTracking, setQuickTracking] = useState(
    order.tracking_number || "",
  );
  const [selectedStatus, setSelectedStatus] = useState("label_created");

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

  // 🛡️ SAFELY PARSE ITEMS 🛡️
  const displayItems = useMemo(() => {
    try {
      if (order.order_items && order.order_items.length > 0) {
        return order.order_items; // Old checkout format
      } else if (order.items) {
        // If it was saved as a string, parse it into a real array
        return typeof order.items === "string"
          ? JSON.parse(order.items)
          : order.items;
      }
      return [];
    } catch (e) {
      console.error("Error parsing order items:", e);
      return [];
    }
  }, [order.order_items, order.items]);

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

  const sendStatusEmail = async (tracking, statusType) => {
    try {
      const emailItems = displayItems.map((item) => {
        let name = item.product_name_snapshot || item.name || "Product";
        let size = "";

        if (item.variants && item.variants.products) {
          name = item.variants.products.name;
          size = item.variants.size_label;
        } else if (item.variant) {
          size =
            typeof item.variant === "string"
              ? item.variant
              : item.variant.size_label || "";
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

  const handleUpdateStatus = () => {
    if (!selectedStatus) return;

    let promptMsg = `Mark as ${selectedStatus.replace("_", " ")}?`;
    if (quickTracking) promptMsg += ` (Tracking: ${quickTracking})`;

    promptConfirm("Update Status", promptMsg, async () => {
      const { error } = await supabase
        .from("orders")
        .update({
          status: selectedStatus,
          tracking_number: quickTracking,
        })
        .eq("id", order.id);

      if (!error) {
        showToast(`Updated to ${selectedStatus}`);
        if (
          ["label_created", "shipped", "delivered"].includes(selectedStatus)
        ) {
          await sendStatusEmail(quickTracking, selectedStatus);
        }
        onUpdate();
      }
    });
  };

  const getStatusStyle = (s) => {
    switch (s) {
      case "pending": // NEW: Handle pending manual orders
      case "payment_reported":
        return {
          bg: "#fff7ed",
          color: "#c2410c",
          border: "#ffedd5",
          label: "Verify Payment",
        };
      case "pending_contact":
      case "pending_payment":
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

      {isExpanded && (
        <div style={styles.expandedPanel}>
          {/* VERIFY PAYMENT BOX FOR PENDING ORDERS */}
          {(order.status === "pending" ||
            order.status === "payment_reported" ||
            order.status === "pending_contact") && (
            <div
              style={{
                background: "#fff7ed",
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
                <AlertTriangle size={18} /> Review Payment Proof
              </h4>
              <div
                style={{
                  display: "flex",
                  gap: "15px",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
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
                {displayItems.length === 0 ? (
                  <div style={{ padding: "10px", color: "#64748b" }}>
                    No items recorded.
                  </div>
                ) : (
                  displayItems.map((item, i) => {
                    let sizeText = "";
                    if (item.variants?.size_label)
                      sizeText = item.variants.size_label;
                    else if (typeof item.variant === "string")
                      sizeText = item.variant;
                    else if (item.variant?.size_label)
                      sizeText = item.variant.size_label;

                    const price = item.price_at_purchase || item.price || 0;

                    return (
                      <div key={i} style={styles.itemRow}>
                        <span style={styles.itemQty}>{item.quantity}x</span>
                        <div style={styles.itemInfo}>
                          <span style={styles.itemName}>
                            {item.product_name_snapshot ||
                              item.name ||
                              "Product"}
                          </span>
                          {sizeText && (
                            <span style={styles.variantLabel}>{sizeText}</span>
                          )}
                        </div>
                        <span style={styles.itemPrice}>
                          ${price.toFixed(2)}
                        </span>
                      </div>
                    );
                  })
                )}
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

              <div
                style={{
                  marginTop: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      color: "#64748b",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Tracking Number
                  </label>
                  <input
                    placeholder="Paste AusPost tracking here..."
                    value={quickTracking}
                    onChange={(e) => setQuickTracking(e.target.value)}
                    style={{
                      ...styles.input,
                      width: "100%",
                      background: "white",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      color: "#64748b",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Update Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    style={{
                      ...styles.input,
                      width: "100%",
                      background: "white",
                    }}
                  >
                    <option value="paid">Paid (Processing)</option>
                    <option value="label_created">Label Created</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
                <button
                  onClick={handleUpdateStatus}
                  style={{
                    ...styles.actionBtn,
                    background: "#0f172a",
                    color: "white",
                    borderColor: "#0f172a",
                    width: "100%",
                    padding: "10px",
                    marginTop: "5px",
                  }}
                >
                  Update & Email Customer
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    ...styles.secondaryBtn,
                    width: "100%",
                    marginTop: "10px",
                  }}
                >
                  <Edit2 size={14} /> Edit Full Order Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
