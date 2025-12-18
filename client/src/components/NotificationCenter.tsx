import { useState } from "react";
import { Bell, Check, AlertTriangle, Clock, Shield, X, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface Notification {
  id: string;
  type: "decision" | "alert" | "system" | "success";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  href?: string;
}

// Mock notifications - in production, these would come from tRPC/WebSocket
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "decision",
    title: "Pending Decision",
    message: "Limit increase request for Sarah Chen requires review",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    read: false,
    href: "/ops",
  },
  {
    id: "2",
    type: "alert",
    title: "SLA Warning",
    message: "3 decisions approaching SLA breach (< 15 min remaining)",
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    read: false,
    href: "/ops/health",
  },
  {
    id: "3",
    type: "system",
    title: "Model Update",
    message: "fraud-detection-v2 model retrained with new data",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: false,
    href: "/ml-models",
  },
  {
    id: "4",
    type: "success",
    title: "Decision Approved",
    message: "Payment PAY-2847 approved and executed",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    read: true,
  },
  {
    id: "5",
    type: "decision",
    title: "High Priority",
    message: "Large transaction ($50,000) flagged for manual review",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    read: true,
    href: "/ops",
  },
];

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationIcon({ type }: { type: Notification["type"] }) {
  switch (type) {
    case "decision":
      return <Shield className="h-4 w-4 text-blue-400" />;
    case "alert":
      return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    case "system":
      return <Clock className="h-4 w-4 text-slate-400" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;
  const pendingDecisions = notifications.filter(n => n.type === "decision" && !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9 text-slate-400 hover:text-white"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80 p-0 bg-slate-900 border-slate-700"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Notifications</span>
            {pendingDecisions > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {pendingDecisions} pending
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                onClick={markAllAsRead}
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "px-4 py-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer",
                  !notification.read && "bg-slate-800/30"
                )}
                onClick={() => {
                  markAsRead(notification.id);
                  if (notification.href) {
                    setOpen(false);
                  }
                }}
              >
                {notification.href ? (
                  <Link href={notification.href} className="block">
                    <NotificationContent notification={notification} />
                  </Link>
                ) : (
                  <NotificationContent notification={notification} />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-700 flex justify-between items-center">
            <Link 
              href="/ops" 
              className="text-xs text-blue-400 hover:text-blue-300"
              onClick={() => setOpen(false)}
            >
              View all decisions
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs text-slate-500 hover:text-slate-300"
              onClick={clearAll}
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationContent({ notification }: { notification: Notification }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <NotificationIcon type={notification.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-sm font-medium truncate",
            notification.read ? "text-slate-400" : "text-white"
          )}>
            {notification.title}
          </span>
          <span className="text-xs text-slate-500 flex-shrink-0">
            {formatTimeAgo(notification.timestamp)}
          </span>
        </div>
        <p className={cn(
          "text-xs mt-0.5 line-clamp-2",
          notification.read ? "text-slate-500" : "text-slate-400"
        )}>
          {notification.message}
        </p>
      </div>
      {!notification.read && (
        <div className="flex-shrink-0">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
      )}
    </div>
  );
}
