import { useState, useEffect } from "react";
import { AlertTriangle, Mail, ArrowRight } from "lucide-react";
import "./AnnouncementBar.css";

export default function AnnouncementBar() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Split the long message into short, mobile-friendly slides
  const messages = [
    {
      id: 1,
      text: "SYSTEM NOTICE: Payment gateway currently offline",
      icon: <AlertTriangle size={18} className="announcement-icon" />,
    },
    {
      id: 2,
      text: "Please Checkout using 'Manual Order' option",
      icon: <ArrowRight size={18} className="announcement-icon" />,
    },
    {
      id: 3,
      text: "Questions? Email info@melbournepeptides.com.au",
      icon: <Mail size={18} className="announcement-icon" />,
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 3500); // Change every 3.5 seconds

    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div
      className="announcement-bar"
      style={{ backgroundColor: "#ef4444", color: "white" }} // Forced Red
    >
      {messages.map((msg, index) => (
        <div
          key={msg.id}
          className={`announcement-content ${
            index === currentIndex ? "active" : ""
          }`}
          style={{ justifyContent: "center" }}
        >
          {msg.icon}
          <span
            style={{
              fontWeight: "bold",
              textAlign: "center",
              fontSize: "0.85rem",
            }}
          >
            {msg.text}
          </span>
        </div>
      ))}
    </div>
  );
}
