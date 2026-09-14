type IconName = 'clipboard' | 'game' | 'trophy' | 'user' | 'plus' | 'dashboard' | 'shift' | 'logout' | 'users' | 'clock' | 'calendar' | 'check' | 'chevron' | 'lock' | 'image'

export default function Icon({ name, size = 22, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth }
  const paths: Record<IconName, React.ReactNode> = {
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" {...common}/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" {...common}/></>,
    game: <><path d="M8.5 8h7a5 5 0 0 1 4.7 6.7l-1.1 3.1a2.4 2.4 0 0 1-4.1.7L13.7 17h-3.4L9 18.5a2.4 2.4 0 0 1-4.1-.7l-1.1-3.1A5 5 0 0 1 8.5 8Z" {...common}/><path d="M8 11v4M6 13h4M16.5 11.5h.01M18.5 14h.01" {...common}/></>,
    trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM10 14h4M12 12v6M8 20h8" {...common}/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4" {...common}/></>,
    user: <><circle cx="12" cy="8" r="4" {...common}/><path d="M4.5 21a7.5 7.5 0 0 1 15 0" {...common}/></>,
    plus: <><path d="M12 5v14M5 12h14" {...common}/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" {...common}/><rect x="14" y="3" width="7" height="7" rx="1" {...common}/><rect x="3" y="14" width="7" height="7" rx="1" {...common}/><rect x="14" y="14" width="7" height="7" rx="1" {...common}/></>,
    shift: <><circle cx="12" cy="12" r="9" {...common}/><path d="M12 7v5l3 2" {...common}/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" {...common}/></>,
    users: <><circle cx="9" cy="8" r="3" {...common}/><path d="M3 19a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" {...common}/></>,
    clock: <><circle cx="12" cy="12" r="9" {...common}/><path d="M12 7v5l3 2" {...common}/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" {...common}/><path d="M7 3v4M17 3v4M3 10h18" {...common}/></>,
    check: <path d="m5 12 4 4L19 6" {...common}/>,
    chevron: <path d="m9 6 6 6-6 6" {...common}/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" {...common}/><path d="M8 10V7a4 4 0 0 1 8 0v3" {...common}/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" {...common}/><circle cx="8.5" cy="9" r="1.5" {...common}/><path d="m3 17 5-5 4 4 3-3 6 6" {...common}/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">{paths[name]}</svg>
}
