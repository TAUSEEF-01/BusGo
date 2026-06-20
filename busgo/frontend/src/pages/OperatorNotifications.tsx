import { useState } from "react";
import { Inbox, Send } from "lucide-react";
import { NotificationsPage } from "../notifications/NotificationsPage";
import { OperatorSendNotification } from "./OperatorSendNotification";

/**
 * OperatorNotifications
 * ─────────────────────
 * Operator-facing notification hub rendered INSIDE the operator portal shell.
 *  • Inbox — operator's own received notifications (booking alerts, summaries…)
 *  • Send  — compose & send notifications to passengers
 */
export function OperatorNotifications() {
  const [view, setView] = useState<"inbox" | "send">("inbox");

  return (
    <div className="animate-fade-in">
      {/* Sub-tab switch */}
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
          <Send className="w-4 h-4" />
          Send to Passengers
        </button>
      </div>

      {view === "inbox" ? <NotificationsPage embedded /> : <OperatorSendNotification />}
    </div>
  );
}
