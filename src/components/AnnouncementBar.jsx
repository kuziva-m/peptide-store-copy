import "./AnnouncementBar.css";
import { Landmark, Truck, Zap } from "lucide-react";

export default function AnnouncementBar() {
  // Add as many messages here as you want!
  const announcements = [
    {
      icon: <Landmark size={14} color="#fbbf24" />,
      text: "Card payments paused — Checkout securely via Bank Transfer!",
    },
    {
      icon: <Truck size={14} color="#fbbf24" />,
      text: "Free Standard Shipping on orders over $150",
    },
    {
      icon: <Zap size={14} color="#fbbf24" />,
      text: "Free Express Shipping on orders over $250",
    },
  ];

  return (
    <div className="announcement-bar">
      <div className="marquee">
        <div className="marquee-content">
          {announcements.map((item, index) => (
            <span key={index} className="marquee-item">
              {item.icon} {item.text}
            </span>
          ))}
        </div>
        {/* Duplicated for infinite seamless scrolling */}
        <div className="marquee-content" aria-hidden="true">
          {announcements.map((item, index) => (
            <span key={`dup-${index}`} className="marquee-item">
              {item.icon} {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
