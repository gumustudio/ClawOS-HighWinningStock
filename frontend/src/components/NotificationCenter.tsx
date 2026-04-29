import { useState, useRef, useEffect } from 'react'
import { Bell, Check, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotificationStore, type Notification } from '../store/useNotificationStore'
import { format, isToday, isYesterday } from 'date-fns'
import { DashboardIcon, MonitorIcon, FilesIcon, VideoIcon, LocalMusicIcon, DownloadsIcon, NotesIcon, ReaderIcon, QuarkIcon, NeteaseIcon, OpenClawIcon, OpenCodeIcon, DidaIcon } from './Icons'
import AIQuantIcon from './AIQuantIcon'

const APP_ICONS: Record<string, React.ElementType> = {
  aiquant: AIQuantIcon,
  dashboard: DashboardIcon,
  monitor: MonitorIcon,
  openclaw: OpenClawIcon,
  opencode: OpenCodeIcon,
  files: FilesIcon,
  video: VideoIcon,
  music: NeteaseIcon,
  localmusic: LocalMusicIcon,
  downloads: DownloadsIcon,
  notes: NotesIcon,
  quark: QuarkIcon,
  reader: ReaderIcon,
  dida: DidaIcon,
}

// Group notifications by time
const groupNotifications = (notifications: Notification[]) => {
  const groups: { label: string; items: Notification[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '更早', items: [] },
  ]

  notifications.forEach((n) => {
    const date = new Date(n.timestamp)
    if (isToday(date)) {
      groups[0].items.push(n)
    } else if (isYesterday(date)) {
      groups[1].items.push(n)
    } else {
      groups[2].items.push(n)
    }
  })

  return groups.filter((g) => g.items.length > 0)
}

const NotificationItem = ({ notification, onClosePanel }: { notification: Notification; onClosePanel: () => void }) => {
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const removeNotification = useNotificationStore((state) => state.removeNotification)
  const AppIcon = APP_ICONS[notification.appId] || OpenClawIcon

  const handleClick = () => {
    void markAsRead(notification.id)
    onClosePanel()
  }

  return (
    <div
      onClick={handleClick}
      className={`relative p-3 rounded-xl transition-all cursor-pointer flex gap-3 group ${
        notification.isRead 
          ? 'bg-transparent hover:bg-slate-100/50' 
          : 'bg-white hover:bg-slate-50 shadow-sm border border-slate-100'
      }`}
    >
      {!notification.isRead && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
      )}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/50 flex items-center justify-center">
        <AppIcon className="w-4 h-4 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h5 className={`text-sm font-medium truncate ${notification.isRead ? 'text-slate-600' : 'text-slate-800'}`}>{notification.title}</h5>
          <span className="text-[10px] text-slate-400">{format(notification.timestamp, 'HH:mm')}</span>
        </div>
        <p className={`text-xs line-clamp-2 leading-relaxed ${notification.isRead ? 'text-slate-400' : 'text-slate-500'}`}>
          {notification.message}
        </p>
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation()
          void removeNotification(notification.id)
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 text-xs px-1"
        title="删除通知"
      >
        ×
      </button>
    </div>
  )
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const { notifications, unreadCount, markAllAsRead, clearAll, init, hydrated } = useNotificationStore()
  const groupedNotifications = groupNotifications(notifications)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hydrated) {
      void init()
    }
  }, [hydrated, init])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative flex items-center h-full" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-1 rounded-md transition-colors flex items-center justify-center ${
          isOpen ? 'bg-slate-200' : 'hover:bg-white/70'
        }`}
      >
        <Bell className="w-3.5 h-3.5 text-slate-700 drop-shadow-sm" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 border border-white rounded-full flex items-center justify-center">
            {/* Optional: Add number inside badge if needed */}
          </span>
        )}
      </button>

      {/* Popover Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute top-full right-0 mt-2 w-80 h-[400px] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-[0_18px_48px_rgba(15,23,42,0.16)] overflow-hidden z-[1000] text-slate-800"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between p-4 border-b border-slate-200 bg-white">
              <h3 className="text-sm font-semibold text-slate-800">通知中心</h3>
              {notifications.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      void markAllAsRead()
                    }}
                    title="全部标为已读"
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      void clearAll()
                    }}
                    title="清除全部"
                    className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                </div>
              )}
            </div>

            {/* Content List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 pb-3 space-y-4 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="flex h-full items-center justify-center px-2 py-3">
                  <div className="flex w-full max-w-[288px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-400">
                    <Bell className="mb-3 h-10 w-10 opacity-25" />
                    <p className="text-sm font-medium text-slate-500">暂无新通知</p>
                    <p className="mt-1 text-xs text-slate-400">新的系统提醒会显示在这里</p>
                  </div>
                </div>
              ) : (
                groupedNotifications.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <h4 className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {group.label}
                    </h4>
                    <div className="space-y-1">
                      {group.items.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onClosePanel={() => setIsOpen(false)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
