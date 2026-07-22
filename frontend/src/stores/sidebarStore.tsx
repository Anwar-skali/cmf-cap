import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const SIDEBAR_KEY = 'cmf_sidebar_collapsed';

interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function getInitialCollapsed(): boolean {
  const stored = localStorage.getItem(SIDEBAR_KEY);
  if (stored !== null) {
    return stored === 'true';
  }
  return false;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(getInitialCollapsed);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? 'true' : 'false');
      return next;
    });
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem(SIDEBAR_KEY, collapsed ? 'true' : 'false');
  }, []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarStore() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarStore must be used within a SidebarProvider');
  }
  return context;
}
