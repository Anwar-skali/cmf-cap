import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { useLanguage, type Language } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { Sun, Moon, Globe, Bell, Shield, KeyRound, CheckCircle2, User, Sparkles } from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const { language, setLanguage, t } = useLanguage();
  const toast = useToast();

  const [emailNotifications, setEmailNotifications] = useState(true);

  const handleLanguageChange = (val: string) => {
    const newLang = val as Language;
    setLanguage(newLang);
    toast.success(
      newLang === 'fr'
        ? 'Langue changée avec succès (Français)'
        : 'Language updated successfully (English)',
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title={t('settings.title', 'Settings & Preferences')}
        description={t('settings.description', 'Manage your application preferences, language, appearance, and notifications')}
      />

      {/* ── Language & Regional Preferences ── */}
      <Card className="border-border/60 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Globe className="h-4 w-4 text-primary" />
              {t('settings.preferences', 'Regional Preferences & Language')}
            </CardTitle>
            <Badge variant="outline" className="font-mono text-xs uppercase bg-primary/10 text-primary border-primary/20">
              {language.toUpperCase()}
            </Badge>
          </div>
          <CardDescription className="text-xs pt-1">
            {t('settings.preferences_desc', 'Set your primary interface language and regional settings')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">{t('settings.language', 'Preferred Language')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.language_desc', 'Select the language for interface titles, menus, and reports')}
              </p>
            </div>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-48 bg-background/80 font-medium">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr" className="cursor-pointer font-medium">
                  🇫🇷 Français (French)
                </SelectItem>
                <SelectItem value="en" className="cursor-pointer font-medium">
                  🇬🇧 English (US/UK)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Appearance & Theme ── */}
      <Card className="border-border/60 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            {isDark ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
            {t('settings.appearance', 'Appearance & Theme')}
          </CardTitle>
          <CardDescription className="text-xs pt-1">
            {t('settings.appearance_desc', 'Customize the visual presentation of the platform')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">{t('settings.dark_mode', 'Dark Mode')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.dark_mode_desc', 'Switch between light and dark theme interface')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground">{isDark ? 'Dark Theme' : 'Light Theme'}</span>
              <Switch checked={isDark} onCheckedChange={toggleTheme} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Notification Preferences ── */}
      <Card className="border-border/60 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Bell className="h-4 w-4 text-emerald-500" />
            {t('settings.notifications', 'Notification Preferences')}
          </CardTitle>
          <CardDescription className="text-xs pt-1">
            {t('settings.notifications_desc', 'Configure alert frequencies and system email notifications')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">{t('settings.email_notifications', 'Email Notifications')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.email_notifications_desc', 'Receive automated email alerts for platform updates and risk assignments')}
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={(checked) => {
                setEmailNotifications(checked);
                toast.success(checked ? 'Email notifications enabled' : 'Email notifications disabled');
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Account Security ── */}
      <Card className="border-border/60 shadow-soft overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Shield className="h-4 w-4 text-rose-500" />
            {t('settings.security', 'Account Security & Password')}
          </CardTitle>
          <CardDescription className="text-xs pt-1">
            {t('settings.security_desc', 'Manage your account password, authentication credentials, and session privacy')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Password Security Active
            </p>
            <p className="text-xs text-muted-foreground">
              Update password or view role capability permissions in your Profile Center
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2 text-xs font-semibold">
            <Link to="/profile">
              <User className="h-4 w-4 text-primary" />
              {t('settings.go_to_profile', 'Manage Profile & Security')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
