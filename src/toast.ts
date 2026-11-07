import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, tone = "info") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), tone === "error" ? 6000 : 2800);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const showToast = (message: string, tone?: Toast["tone"]) =>
  useToasts.getState().show(message, tone);
