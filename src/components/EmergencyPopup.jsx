import { useState } from "react";

export default function EmergencyPopup() {
  // Set to false to keep it hidden
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) return null;

  return null;
}
