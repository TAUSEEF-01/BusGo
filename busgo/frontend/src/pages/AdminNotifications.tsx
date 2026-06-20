import { useState } from "react";
import { Inbox, Megaphone } from "lucide-react";
import { NotificationsPage } from "../notifications/NotificationsPage";
import { AdminNotificationPanel } from "./AdminNotificationPanel";

interface Person {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  role: string;
}

/**
 * AdminNotifications
 * ──────────────────
 * Admin notification hub rendered inside the admin portal.
 *  • Inbox — admin's own received notifications (platform summaries, new users…)
 *  • Send  — broadcast notifications to users or operators
 */
export function AdminNotifications({ allUsers }: { allUsers: Person[] }) {
  const [view, setView] = useState<"inbox" | "send">("inbox");

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 p-1 bg-surface-100 rounded-xl w-fit mb-6">
        <button
          onClick={() => setView("inbox")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            view === "inbox" ? "bg-white text-brand-700 shadow-sm" : "text-surface-500 hover:text-surface-700"
          }`}
        >
          <Inbox className="w-4 h-4" />
          Inbox
        </button>
        <button
          onClick={() => setView("send")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            view === "send" ? "bg-white text-brand-700 shadow-sm" : "text-surface-500 hover:text-surface-700"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Send Notifications
        </button>
      </div>

      {view === "inbox" ? <NotificationsPage embedded /> : <AdminNotificationPanel allUsers={allUsers} />}
    </div>
  );
}
