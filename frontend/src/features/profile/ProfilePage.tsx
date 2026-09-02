import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';
import { useUpdateProfileMutation, useChangePasswordMutation } from '@/hooks/mutations/useAuthMutations';
import { changePasswordSchema, type ChangePasswordFormData } from '@/utils/validators';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import {
  User,
  Mail,
  Shield,
  Calendar,
  Building2,
  Lock,
  CheckCircle2,
  KeyRound,
  Sparkles,
  Save,
  Clock,
  Briefcase,
  Phone,
  ShieldCheck,
  Eye,
  Check,
  X,
  FileCheck,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

export default function ProfilePage() {
  const toast = useToast();
  const { t } = useLanguage();
  const { state } = useAuthStore();
  const user = state.user;
  const permissions = usePermissions();
  const { roleMeta } = permissions;
  const RoleIcon = roleMeta.icon;

  const [activeTab, setActiveTab] = useState('info');

  const updateProfileMutation = useUpdateProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();

  // Profile Edit Form State
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState((user as any)?.phone || '');
  const [organization, setOrganization] = useState(user?.organization || 'Stellantis Global Purchasing & Quality');

  // Password Change Form
  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  // Watch password fields for real-time complexity criteria checklist
  const watchedNewPassword = passwordForm.watch('newPassword') || '';
  const watchedConfirmPassword = passwordForm.watch('confirmNewPassword') || '';

  const passwordCriteria = [
    { label: t('profile.pass_req_len', 'At least 8 characters long'), met: watchedNewPassword.length >= 8 },
    { label: t('profile.pass_req_upper', 'Contains an uppercase letter (A-Z)'), met: /[A-Z]/.test(watchedNewPassword) },
    { label: t('profile.pass_req_lower', 'Contains a lowercase letter (a-z)'), met: /[a-z]/.test(watchedNewPassword) },
    { label: t('profile.pass_req_num', 'Contains a number (0-9)'), met: /[0-9]/.test(watchedNewPassword) },
    { label: t('profile.pass_req_match', 'Passwords match'), met: watchedNewPassword.length > 0 && watchedNewPassword === watchedConfirmPassword },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20 animate-fade-in">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Please log in to view your profile</p>
        </div>
      </div>
    );
  }

  const initials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((n) => n?.charAt(0).toUpperCase())
      .join('') || 'U';

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(
      { firstName, lastName },
      {
        onSuccess: () => {
          toast.success(t('profile.save_success', 'Profile details updated successfully'));
        },
      },
    );
  };

  const handlePasswordSubmit = (data: ChangePasswordFormData) => {
    changePasswordMutation.mutate(data, {
      onSuccess: () => {
        passwordForm.reset();
        toast.success(t('profile.pass_success', 'Password updated successfully'));
      },
      onError: (err) => {
        toast.error(err?.message || t('profile.pass_error', 'Failed to change password'));
      },
    });
  };

  const handlePasswordInvalid = (errors: FieldErrors<ChangePasswordFormData>) => {
    const errorValues = Object.values(errors);
    if (errorValues.length > 0 && errorValues[0]?.message) {
      toast.error(errorValues[0].message);
    } else {
      toast.error(t('profile.invalid_rules', 'Please resolve the password requirements before saving.'));
    }
  };

  // Form error extraction for top banner alert
  const formErrors = passwordForm.formState.errors;
  const formErrorKeys = Object.keys(formErrors);
  const activeFormError =
    formErrorKeys.length > 0
      ? (formErrors[formErrorKeys[0] as keyof typeof formErrors]?.message as string)
      : null;
  const apiError = changePasswordMutation.error?.message;
  const displayError = activeFormError || apiError;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <PageHeader
        title={t('profile.title', 'User Profile & Security Settings')}
        description={t('profile.description', 'Manage your account identity, personal details, system role capabilities, and password security')}
      />

      {/* ── Hero Profile Header Card ── */}
      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="h-32 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 relative">
          <div className="absolute right-6 top-4">
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs font-semibold px-2.5 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 inline-block" /> Authenticated & Active
            </Badge>
          </div>
        </div>

        <CardContent className="relative -mt-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-6 pb-6">
          <div className="flex items-end gap-5">
            <Avatar className="h-24 w-24 border-4 border-background ring-4 ring-primary/20 shadow-md shrink-0">
              {user.avatar ? <AvatarImage src={user.avatar} alt="User Avatar" /> : null}
              <AvatarFallback className="text-3xl font-bold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="pb-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {user.firstName} {user.lastName}
                </h2>
                <Badge variant="outline" className={cn('px-2.5 py-0.5 text-xs font-bold border', roleMeta.badgeClass)}>
                  <RoleIcon className="mr-1 h-3.5 w-3.5 inline-block" />
                  {roleMeta.title}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('security')}
              className="gap-1.5 text-xs"
            >
              <KeyRound className="h-3.5 w-3.5" /> {t('profile.security_tab', 'Security & Password')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Profile Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border p-1 rounded-xl">
          <TabsTrigger value="info" className="gap-2 text-xs font-semibold">
            <User className="h-4 w-4" /> {t('profile.personal_info', 'Personal Information')}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 text-xs font-semibold">
            <Shield className="h-4 w-4" /> {t('profile.security_tab', 'Security & Password')}
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4" /> {t('profile.roles_tab', 'Role & Permissions')}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 text-xs font-semibold">
            <Clock className="h-4 w-4" /> {t('profile.activity_tab', 'Account Audit Log')}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PERSONAL INFORMATION */}
        <TabsContent value="info" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> {t('profile.edit_details', 'Edit Personal Details')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('profile.edit_details_sub', 'Update your identity and contact preferences')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">{t('profile.first_name', 'First Name')} *</label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="bg-background/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">{t('profile.last_name', 'Last Name')} *</label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="bg-background/80"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">{t('profile.email', 'Email Address')}</label>
                      <Input value={user.email} disabled className="bg-muted/50 font-mono text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">{t('profile.phone', 'Phone Number')}</label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+33 1 23 45 67 89"
                        className="bg-background/80 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">{t('profile.organization', 'Organization / Business Unit')}</label>
                    <Input
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Stellantis Global Purchasing & Quality"
                      className="bg-background/80"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={updateProfileMutation.isPending} className="gap-1.5 bg-primary">
                      <Save className="h-4 w-4" /> {updateProfileMutation.isPending ? t('profile.saving', 'Saving...') : t('profile.save_changes', 'Save Profile Changes')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Quick Profile Summary Card */}
            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" /> {t('profile.summary_title', 'Profile Summary')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('profile.user_id', 'User ID')}:</span>
                  <span className="font-mono font-semibold text-foreground">{user.id?.slice(0, 10) || 'usr-admin'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('profile.system_role', 'System Role')}:</span>
                  <Badge variant="outline" className={cn('capitalize text-[10px]', roleMeta.badgeClass)}>
                    {roleMeta.title}
                  </Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('profile.account_status', 'Account Status')}:</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">{t('profile.member_since', 'Member Since')}:</span>
                  <span className="font-mono text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'Jan 2026'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: SECURITY & PASSWORD CHANGE */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" /> {t('profile.change_password', 'Change Password')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('profile.change_password_sub', 'Update your account password. Enforce minimum length and complexity.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Visible Error Alert Callout Banner */}
                {displayError && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium animate-shake">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{displayError}</span>
                  </div>
                )}

                <Form {...passwordForm}>
                  <form
                    onSubmit={passwordForm.handleSubmit(handlePasswordSubmit, handlePasswordInvalid)}
                    className="space-y-4"
                  >
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">{t('profile.current_password', 'Current Password')} *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" className="bg-background/80" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs text-rose-600 font-medium" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">{t('profile.new_password', 'New Password')} *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" className="bg-background/80" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs text-rose-600 font-medium" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmNewPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">{t('profile.confirm_new_password', 'Confirm New Password')} *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" className="bg-background/80" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs text-rose-600 font-medium" />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={changePasswordMutation.isPending}
                        className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                      >
                        <KeyRound className="h-4 w-4" />
                        {changePasswordMutation.isPending
                          ? t('profile.updating_password', 'Updating Password...')
                          : t('profile.update_password', 'Update Password')}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Live Password Criteria Checklist Sidebar */}
            <Card className="border-border/60 shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-4 w-4" /> {t('profile.password_rules', 'Password Rules')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('profile.password_rules_sub', 'Your new password must satisfy all security requirements:')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {passwordCriteria.map((criterion, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                      criterion.met
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'bg-muted/30 border-border/50 text-muted-foreground'
                    }`}
                  >
                    {criterion.met ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-[11px]">{criterion.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: ROLE & PERMISSIONS MATRIX */}
        <TabsContent value="roles" className="space-y-6">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Capabilities & Role Permissions Matrix
                </span>
                <Badge variant="outline" className={cn('px-2.5 py-0.5 font-bold text-xs', roleMeta.badgeClass)}>
                  Current Role: {roleMeta.title}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Your granted permissions and operational privileges across the CMF platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Manage Projects & Platforms</span>
                    {permissions.canManageProjects ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        <Check className="h-3 w-3 mr-1" /> Granted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[10px]">
                        <X className="h-3 w-3 mr-1" /> Restricted
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Create, edit, and update vehicle platform project data</p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Capacity Audits & CAT Milestones</span>
                    {permissions.canCreateCapacityAssessment ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        <Check className="h-3 w-3 mr-1" /> Granted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[10px]">
                        <X className="h-3 w-3 mr-1" /> Restricted
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Perform industrial capacity assessments and milestone evaluations</p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Manage Suppliers & COFOR Sites</span>
                    {permissions.canManageSuppliers ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        <Check className="h-3 w-3 mr-1" /> Granted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[10px]">
                        <X className="h-3 w-3 mr-1" /> Restricted
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Add and configure manufacturing supplier accounts and plants</p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Risk Registry & Mitigation</span>
                    {permissions.canManageRisks ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        <Check className="h-3 w-3 mr-1" /> Granted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[10px]">
                        <X className="h-3 w-3 mr-1" /> Restricted
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Log risks, set severity levels, and assign countermeasures</p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Executive Admin Panel Access</span>
                    {permissions.canAccessAdminPanel ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        <Check className="h-3 w-3 mr-1" /> Full Administrator Access
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-500 text-[10px]">
                        <Lock className="h-3 w-3 mr-1" /> Administrator Only
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">System configuration, user role assignments, and platform audit logs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: AUDIT LOG */}
        <TabsContent value="activity" className="space-y-6">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Recent Account Activity & Sessions
              </CardTitle>
              <CardDescription className="text-xs">Security audit log of recent sign-ins and system interactions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded-lg border bg-card flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Current Session Authenticated
                  </p>
                  <p className="text-muted-foreground font-mono text-[11px]">Active JWT Token · Chrome on Windows</p>
                </div>
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]">
                  Active Now
                </Badge>
              </div>

              <div className="p-3 rounded-lg border bg-card flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground">Password Authentication Success</p>
                  <p className="text-muted-foreground font-mono text-[11px]">Logged in as {user.email}</p>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">Today</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
