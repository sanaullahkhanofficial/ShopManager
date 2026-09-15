import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

// Live Pakistan-time clock (Section 64: Asia/Karachi throughout).
export function DateTimePill() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const date = now.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const time = now.toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  return (
    <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-sm">
      <Calendar size={13} className="text-brand-green-600" />
      <span className="font-medium text-stone-700">{date}</span>
      <span className="text-stone-400">{time}</span>
    </div>
  );
}
