import { useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';

interface AppLayoutProps {
  children?: ReactNode;
}

function AppLayout({ children }: AppLayoutProps) {
  const { isCollapsed } = useSidebarStore();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {isMobile ? (
        <MobileSidebar
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
      ) : (
        <Sidebar />
      )}

      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          isMobile ? 'ml-0' : isCollapsed ? 'ml-16' : 'ml-64',
        )}
      >
        <Topbar
          onMobileMenuToggle={() => setMobileSidebarOpen(true)}
        />

        <div className="container mx-auto animate-fade-in p-4 lg:p-6">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}

export { AppLayout };
