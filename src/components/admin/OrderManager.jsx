import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { downloadAusPostCSV } from "../../utils/exportToAusPost";
import { styles } from "./OrderManagerStyles";
import { OrderRow } from "./OrderRow";
import { Search, Download, CheckCircle, AlertTriangle } from "lucide-react";

export default function OrderManager() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Default to "unpaid" (includes New + Payment Reported)
  const [statusFilter, setStatusFilter] = useState("unpaid");
  const [notification, setNotification] = useState(null);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isDestructive: false,
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(
        `*, order_items (quantity, price_at_purchase, product_name_snapshot, variants (size_label, products (name, image_url)))`,
      )
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching orders:", error);
    else setOrders(data || []);
    setLoading(false);
  };

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const promptConfirm = (title, message, onConfirm, isDestructive = false) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isDestructive,
      onConfirm: async () => {
        await onConfirm();
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // --- FILTERING LOGIC ---
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const s = search.toLowerCase();
      const matchesSearch =
        order.id.toLowerCase().includes(s) ||
        order.customer_email?.toLowerCase().includes(s) ||
        order.customer_name?.toLowerCase().includes(s);

      let matchesStatus = false;

      if (statusFilter === "all") {
        matchesStatus = true;
      } else if (statusFilter === "unpaid") {
        // Unpaid = New Orders OR Orders where customer clicked "Paid" but you haven't approved yet
        matchesStatus =
          order.status === "pending_contact" ||
          order.status === "payment_reported";
      } else if (statusFilter === "paid") {
        // Paid = Approved Orders
        matchesStatus =
          order.status === "paid" || order.status === "processing";
      } else {
        // label_created, shipped, delivered, cancelled
        matchesStatus = order.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  // --- STATS LOGIC (Revenue Fixed) ---
  const stats = useMemo(() => {
    // Only count ACTUAL REVENUE (Approved/Paid/Shipped orders)
    // EXCLUDES "payment_reported" until you click Approve
    const confirmedPaidOrders = orders.filter(
      (o) =>
        o.status === "paid" ||
        o.status === "processing" ||
        o.status === "label_created" ||
        o.status === "shipped" ||
        o.status === "delivered",
    );

    const totalRevenue = confirmedPaidOrders.reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0,
    );

    // Count Action Items (Unpaid/Reported)
    const unpaidCount = orders.filter(
      (o) => o.status === "pending_contact" || o.status === "payment_reported",
    ).length;

    return {
      totalRevenue,
      unpaidCount,
      totalOrders: confirmedPaidOrders.length,
    };
  }, [orders]);

  const handleBulkExport = () => {
    if (filteredOrders.length === 0) return showToast("No orders to export");
    downloadAusPostCSV(filteredOrders);
    showToast(`Exported ${filteredOrders.length} orders`);
  };

  const FilterTab = ({ id, label, count, color }) => (
    <button
      onClick={() => setStatusFilter(id)}
      style={{
        ...styles.filterBtn,
        background: statusFilter === id ? color || "#0f172a" : "white",
        color: statusFilter === id ? "white" : "#64748b",
        borderColor: statusFilter === id ? color || "#0f172a" : "#e2e8f0",
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            marginLeft: "8px",
            background: "rgba(255,255,255,0.2)",
            padding: "2px 6px",
            borderRadius: "10px",
            fontSize: "0.7rem",
            color: statusFilter === id ? "white" : "inherit",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div style={{ position: "relative" }}>
      {/* STATS BAR */}
      <div style={styles.statsContainer}>
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Action Needed (Unpaid)</span>
          <span style={{ ...styles.statValue, color: "#d97706" }}>
            {stats.unpaidCount}
          </span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Total Paid Orders</span>
          <span style={styles.statValue}>{stats.totalOrders}</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <span style={styles.statLabel}>Verified Revenue</span>
          <span style={styles.statValue}>${stats.totalRevenue.toFixed(0)}</span>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.filterGroup}>
          <FilterTab
            id="unpaid"
            label="Unpaid"
            count={stats.unpaidCount}
            color="#d97706"
          />
          <FilterTab id="paid" label="Paid" color="#16a34a" />
          <FilterTab id="label_created" label="Label Created" />
          <FilterTab id="shipped" label="Shipped" />
          <FilterTab id="all" label="All" />
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={handleBulkExport} style={styles.exportBtn}>
            <Download size={16} /> Export
          </button>
          <div style={styles.searchWrapper}>
            <Search size={16} color="#94a3b8" style={{ marginRight: "8px" }} />
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.inputReset}
            />
          </div>
        </div>
      </div>

      <div style={styles.tableContainer}>
        {loading ? (
          <div style={styles.emptyState}>Loading...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={styles.emptyState}>No orders found.</div>
        ) : (
          filteredOrders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onUpdate={fetchOrders}
              showToast={showToast}
              promptConfirm={promptConfirm}
            />
          ))
        )}
      </div>

      {notification && (
        <div style={styles.toast}>
          <CheckCircle size={16} /> {notification}
        </div>
      )}
      {modalConfig.isOpen && (
        <ConfirmationModal
          config={modalConfig}
          onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}

function ConfirmationModal({ config, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          {config.isDestructive && <AlertTriangle size={20} color="#ef4444" />}
          <h3 style={styles.modalTitle}>{config.title}</h3>
        </div>
        <p style={styles.modalMessage}>{config.message}</p>
        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.modalCancel}>
            Cancel
          </button>
          <button
            onClick={config.onConfirm}
            style={
              config.isDestructive ? styles.modalDelete : styles.modalConfirm
            }
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
