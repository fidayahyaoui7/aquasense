import { useNavigate, useLocation } from 'react-router';
import { LayoutDashboard, History, AlertTriangle, User } from 'lucide-react';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/history', icon: History, label: 'Historique' },
    { path: '/alerts', icon: AlertTriangle, label: 'Alertes' },
    { path: '/profile', icon: User, label: 'Profil' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1A2B3C] border-t border-[#2A3B4C] max-w-[390px] mx-auto">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? 'text-[#00B4D8]' : 'text-[#90A4AE]'
                }`}
              />
              <span
                className={`text-xs ${
                  isActive ? 'text-[#00B4D8]' : 'text-[#90A4AE]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
