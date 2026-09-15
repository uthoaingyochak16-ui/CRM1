import { useEffect, useRef, useState } from "react";
import AdCard from "./AdCard.jsx";

export default function AdCarousel({ ads = [], currentUser, interval = 4000 }) {
  const active = (ads || []).filter((a) => a.is_active && a.placement === "first");
  const [index, setIndex] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (active.length <= 1) return undefined;
    timer.current = setInterval(() => {
      setIndex((i) => (i + 1) % active.length);
    }, interval);
    return () => clearInterval(timer.current);
  }, [active.length, interval]);

  if (active.length === 0) return null;

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl">
        <div className="transition-all duration-400">
          <AdCard key={active[index].id} ad={active[index]} currentUser={currentUser} />
        </div>
      </div>
      {active.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2">
          {active.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full ${i === index ? "bg-[#2554C7]" : "bg-[#DCE6F9]"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
