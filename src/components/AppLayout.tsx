import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Plus, 
  Menu, 
  X, 
  LogOut, 
  Moon, 
  Sun,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Minhas Reuniões', icon: Calendar, path: '/' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className={cn(
          "relative flex flex-col border-r bg-card z-30 transition-all duration-300 ease-in-out",
          !isSidebarOpen && "items-center"
        )}
      >
        <div className="flex h-16 items-center px-6 border-b shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-lg tracking-tight whitespace-nowrap">
                Agenda<span className="text-primary">Pro</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                {isSidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t space-y-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDark(!isDark)}
            className="w-full justify-start gap-3 h-11 px-3 rounded-xl"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {isSidebarOpen && <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 h-11 px-3 rounded-xl text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-5 w-5" />
            {isSidebarOpen && <span>Sair</span>}
          </Button>

          <div className={cn(
            "pt-4 flex items-center gap-3 px-2 overflow-hidden",
            !isSidebarOpen && "justify-center"
          )}>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/50">
              <span className="text-xs font-bold text-primary">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">{user?.email?.split('@')[0]}</span>
                <span className="text-[10px] text-muted-foreground truncate italic">Premium Plan</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 h-6 w-6 bg-card border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors z-40"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8 lg:p-10 relative">
        <div className="max-w-6xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
