import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/app-layout';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/features/auth/ResetPasswordPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
import ProjectsPage from '@/features/projects/ProjectsPage';
import ProjectNewPage from '@/features/projects/ProjectNewPage';
import ProjectDetailPage from '@/features/projects/ProjectDetailPage';
import ProjectEditPage from '@/features/projects/ProjectEditPage';
import ProjectPartsPage from '@/features/projects/ProjectPartsPage';
import ProjectRisksPage from '@/features/projects/ProjectRisksPage';
import ProjectDocumentsPage from '@/features/projects/ProjectDocumentsPage';
import PartsPage from '@/features/parts/PartsPage';
import PartNewPage from '@/features/parts/PartNewPage';
import PartDetailPage from '@/features/parts/PartDetailPage';
import PartEditPage from '@/features/parts/PartEditPage';
import SuppliersPage from '@/features/suppliers/SuppliersPage';
import SupplierNewPage from '@/features/suppliers/SupplierNewPage';
import SupplierDetailPage from '@/features/suppliers/SupplierDetailPage';
import SupplierEditPage from '@/features/suppliers/SupplierEditPage';
import CapacityPage from '@/features/capacity/CapacityPage';
import CapacityNewPage from '@/features/capacity/CapacityNewPage';
import CapacityDetailPage from '@/features/capacity/CapacityDetailPage';
import RisksPage from '@/features/risks/RisksPage';
import RiskNewPage from '@/features/risks/RiskNewPage';
import RiskDetailPage from '@/features/risks/RiskDetailPage';
import DocumentsPage from '@/features/documents/DocumentsPage';
import NotificationsPage from '@/features/notifications/NotificationsPage';
import ActivityPage from '@/features/activity/ActivityPage';
import ProfilePage from '@/features/profile/ProfilePage';
import SettingsPage from '@/features/settings/SettingsPage';
import AdminPage from '@/features/admin/AdminPage';
import ReportsPage from '@/features/reports/ReportsPage';
import TemplateStudioPage from '@/features/templates/TemplateStudioPage';

import { TemplateProvider } from '@/context/TemplateContext';

import { LanguageProvider } from '@/context/LanguageContext';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B1220]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <LanguageProvider>
      <ThemeProvider>
        <TemplateProvider>
          <AppLayout />
        </TemplateProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<ProjectNewPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/edit" element={<ProjectEditPage />} />
        <Route path="/projects/:projectId/parts" element={<ProjectPartsPage />} />
        <Route path="/projects/:projectId/risks" element={<ProjectRisksPage />} />
        <Route path="/projects/:projectId/documents" element={<ProjectDocumentsPage />} />
        <Route path="/parts" element={<PartsPage />} />
        <Route path="/parts/new" element={<PartNewPage />} />
        <Route path="/parts/:id" element={<PartDetailPage />} />
        <Route path="/parts/:id/edit" element={<PartEditPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/new" element={<SupplierNewPage />} />
        <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="/suppliers/:id/edit" element={<SupplierEditPage />} />
        <Route path="/capacity" element={<CapacityPage />} />
        <Route path="/capacity/new" element={<CapacityNewPage />} />
        <Route path="/capacity/:assessmentId" element={<CapacityDetailPage />} />
        <Route path="/risks" element={<RisksPage />} />
        <Route path="/risks/new" element={<RiskNewPage />} />
        <Route path="/risks/:riskId" element={<RiskDetailPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/templates" element={<TemplateStudioPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
