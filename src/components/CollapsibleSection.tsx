"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="section-header w-full cursor-pointer py-1"
        aria-expanded={open}
      >
        <span className="section-accent" />
        <h2 className="section-title flex-1 text-left">{title}</h2>
        <svg
          className={`w-4 h-4 text-muted transition-transform duration-300 ease-out ${
            open ? "rotate-180" : "rotate-0"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {/* Animated content */}
      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          open ? "max-h-[5000px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"
        }`}
      >
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
