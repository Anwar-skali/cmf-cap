import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Moon,
  Sun,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useThemeStore } from '@/stores/themeStore';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationDropdown } from '@/components/layout/notification-dropdown';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TopbarProps {
  onMobileMenuToggle?: () => void;
  className?: string;
}

function Topbar({ onMobileMenuToggle, className }: TopbarProps) {
  const navigate = useNavigate();
  const { toggle } = useSidebarStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
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
        'sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 shadow-soft lg:px-6',
        className,
      )}
    >
      <button
        onClick={onMobileMenuToggle}
        className="rounded-lg p-2 transition-colors hover:bg-accent lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={toggle}
        className="hidden rounded-lg p-2 transition-colors hover:bg-accent lg:block"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1">
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-0.5">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/search')}
                className="rounded-lg p-2 transition-colors hover:bg-accent"
              >
                <Search className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Search (Ctrl+K)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="rounded-lg p-2 transition-colors hover:bg-accent"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleFullscreen}
                className="rounded-lg p-2 transition-colors hover:bg-accent"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <NotificationDropdown unreadCount={3} />

        <div className="ml-2">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export { Topbar };
