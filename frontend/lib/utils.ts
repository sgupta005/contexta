import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getGradient(id: string) {
  switch (id) {
    case "calling-agent":
      return "from-blue-500 to-cyan-400";
    case "customer-support":
      return "from-purple-500 to-rose-400";
    case "technical-assistant":
      return "from-emerald-500 to-teal-400";
    default:
      return "from-slate-600 to-slate-400";
  }
}
