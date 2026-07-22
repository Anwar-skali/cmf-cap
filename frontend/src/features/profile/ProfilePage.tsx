import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Shield, Calendar, Building2 } from 'lucide-react';

export default function ProfilePage() {
  const { state } = useAuthStore();
  const user = state.user;

  if (!user) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <User className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">Please log in to view your profile</p>
      </div>
    </div>
  );

  const initials = [user.firstName, user.lastName].filter(Boolean).map((n) => n?.charAt(0).toUpperCase()).join('') || 'U';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Profile" description="Your account information" />

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="relative -mt-12 flex items-end gap-6 px-6 pb-6">
          <Avatar className="h-24 w-24 border-4 border-background ring-2 ring-primary/20">
            <AvatarFallback className="text-3xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="pb-2">
            <h2 className="text-2xl font-bold">{user.firstName} {user.lastName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">{user.email}</p>
              {user.role && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <Badge variant="outline" className="capitalize">{user.role}</Badge>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-muted-foreground" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="flex items-center justify-between border-b py-3 last:border-0">
              <span className="text-sm text-muted-foreground">First Name</span>
              <span className="text-sm font-medium">{user.firstName}</span>
            </div>
            <div className="flex items-center justify-between border-b py-3 last:border-0">
              <span className="text-sm text-muted-foreground">Last Name</span>
              <span className="text-sm font-medium">{user.lastName}</span>
            </div>
            <div className="flex items-center justify-between border-b py-3 last:border-0">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user.email}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-muted-foreground" /> Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="flex items-center justify-between border-b py-3 last:border-0">
              <span className="text-sm text-muted-foreground">Role</span>
              <span className="text-sm font-medium capitalize">{user.role || 'N/A'}</span>
            </div>
            {user.organization && (
              <div className="flex items-center justify-between border-b py-3 last:border-0">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="text-sm font-medium">{user.organization}</span>
              </div>
            )}
            {user.createdAt && (
              <div className="flex items-center justify-between border-b py-3 last:border-0">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
