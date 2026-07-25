import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function UserMenu() {
  const navigate = useNavigate();
  const { state, logout } = useAuthStore();
  const { roleMeta } = usePermissions();

  const RoleIcon = roleMeta.icon;
  const initials = `${state.user?.firstName?.[0] ?? ''}${state.user?.lastName?.[0] ?? ''}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-accent">
          <Avatar className="h-7 w-7 ring-1 ring-border">
            {state.user?.avatar ? <AvatarImage src={state.user.avatar} /> : null}
            <AvatarFallback initials={initials} />
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="text-sm font-medium leading-tight">
              {state.user?.firstName} {state.user?.lastName}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px] font-semibold border', roleMeta.badgeClass)}>
                <RoleIcon className="mr-1 h-3 w-3 inline-block" />
                {roleMeta.shortTitle}
              </Badge>
            </div>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1.5">
            <p className="text-sm font-medium">
              {state.user?.firstName} {state.user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{state.user?.email}</p>
            <Badge variant="outline" className={cn('w-fit text-xs font-semibold px-2 py-0.5 border flex items-center gap-1', roleMeta.badgeClass)}>
              <RoleIcon className="h-3 w-3" />
              {roleMeta.title}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => logout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserMenu };
