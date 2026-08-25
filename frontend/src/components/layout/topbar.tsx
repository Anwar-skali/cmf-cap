import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useThemeStore } from '@/stores/themeStore';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationDropdown } from '@/components/layout/notification-dropdown';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/context/LanguageContext';

interface TopbarProps {
  onMobileMenuToggle?: () => void;
  className?: string;
}

function Topbar({ onMobileMenuToggle, className }: TopbarProps) {
  const navigate = useNavigate();
  const { toggle } = useSidebarStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const { t } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/95 backdrop-blur-md px-4 shadow-sm lg:px-6 text-foreground',
        className,
      )}
    >
      <button
        onClick={onMobileMenuToggle}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden cursor-pointer"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={toggle}
        className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:block cursor-pointer"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0 overflow-hidden mr-2">
        <Breadcrumb />
      </div>

      {/* Global Search Bar Input */}
      <div className="hidden md:flex items-center gap-2 bg-muted/40 border border-border px-3 py-1.5 rounded-xl w-64 lg:w-80 shadow-inner">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder={t('header.search_placeholder', 'Search projects, parts, suppliers...')}
          onClick={() => navigate('/search')}
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none cursor-pointer"
          readOnly
        />
        <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        {/* Language Switcher Widget (FR / EN) */}
        <LanguageToggle />

        {/* Light / Dark Mode Toggle Button */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border-border text-popover-foreground text-xs">
              {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleFullscreen}
                className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border-border text-popover-foreground text-xs">
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <NotificationDropdown unreadCount={3} />

        <div className="ml-1 pl-2 border-l border-border">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export { Topbar };
