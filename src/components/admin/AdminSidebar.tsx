import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Tags, Layers, Newspaper } from 'lucide-react';

interface AdminNavItem {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
  enabled: boolean;
}

/** Collections and Blog management are still deferred. */
const navItems: AdminNavItem[] = [
  { name: 'Overview', path: '/admin', icon: LayoutDashboard, enabled: true },
  { name: 'Products', path: '/admin/products', icon: Package, enabled: true },
  { name: 'Categories', path: '/admin/categories', icon: Tags, enabled: true },
  { name: 'Collections', path: '/admin/collections', icon: Layers, enabled: false },
  { name: 'Blog', path: '/admin/blog', icon: Newspaper, enabled: false },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;

        if (!item.enabled) {
          return (
            <div
              key={item.name}
              aria-disabled="true"
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm text-ghana-black/40 dark:text-white/40 cursor-not-allowed select-none"
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4" aria-hidden="true" />
                {item.name}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em]">Soon</span>
            </div>
          );
        }

        return (
          <NavLink
            key={item.name}
            to={item.path}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors duration-200',
                isActive
                  ? 'bg-ghana-green/10 text-ghana-green font-semibold'
                  : 'text-ghana-black/70 dark:text-white/70 hover:bg-ghana-green/10 hover:text-ghana-green',
              ].join(' ')
            }
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {item.name}
          </NavLink>
        );
      })}
    </nav>
  );
}
