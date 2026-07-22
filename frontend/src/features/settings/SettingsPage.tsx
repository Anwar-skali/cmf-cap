import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { Sun, Moon, Globe, Bell, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { isDark, toggle } = useThemeStore();
  const toast = useToast();
  const [language, setLanguage] = useState('en');
  const [emailNotifications, setEmailNotifications] = useState(true);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Settings" description="Manage your application preferences" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Toggle dark/light theme</p>
            </div>
            <Switch checked={isDark} onCheckedChange={toggle} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Language</Label>
              <p className="text-sm text-muted-foreground">Select your preferred language</p>
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive email notifications for platform updates</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Manage your password and security settings.</p>
          <Button variant="outline" onClick={() => toast.info('Password change will be available in a future update.')}>
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
