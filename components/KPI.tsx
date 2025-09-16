"use client";
import React from "react";

export default function KPI({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4 bg-white/40 dark:bg-black/20">
      <div className="text-xs uppercase tracking-wide opacity-70">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
