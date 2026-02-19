import "./AnnouncementBar.css";
import { Mail } from "lucide-react";

export default function AnnouncementBar() {
  return (
    <div
      className="announcement-bar"
      style={{
        backgroundColor: "#0f172a",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <Mail size={16} color="#fbbf24" />
      <p
        style={{
          margin: 0,
          color: "white",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Our online checkout is temporarily closed. For all orders, please email{" "}
        <a
          href="mailto:info@melbournepeptides.com.au"
          style={{ color: "#fbbf24", textDecoration: "underline" }}
        >
          info@melbournepeptides.com.au
        </a>
      </p>
    </div>
  );
}
