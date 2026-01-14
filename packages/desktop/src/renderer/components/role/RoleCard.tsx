import { cn } from '../../utils/cn';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { Role } from '@codecafe/core/types/role';

const SKILLS_DISPLAY_LIMIT = 3;

interface RoleCardProps {
  role: Role;
  onClick: () => void;
}

export function RoleCard({ role, onClick }: RoleCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]',
        'flex flex-col gap-3 h-full'
      )}
      onClick={onClick}
    >
      <RoleHeader name={role.name} id={role.id} isDefault={role.isDefault} />

      <RoleDescription systemPrompt={role.systemPrompt} />

      <RoleSkills skills={role.skills} />

      <RoleFooter provider={role.recommendedProvider} source={role.source} />
    </Card>
  );
}

interface RoleHeaderProps {
  name: string;
  id: string;
  isDefault: boolean;
}

function RoleHeader({ name, id, isDefault }: RoleHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{id}</p>
      </div>
      <Badge variant={isDefault ? 'default' : 'secondary'}>
        {isDefault ? 'Default' : 'User'}
      </Badge>
    </div>
  );
}

function RoleDescription({ systemPrompt }: { systemPrompt: string }) {
  if (!systemPrompt) return null;

  return (
    <p className="text-sm text-foreground/80 line-clamp-2">
      {systemPrompt}
    </p>
  );
}

interface RoleSkillsProps {
  skills: string[];
}

function RoleSkills({ skills }: RoleSkillsProps) {
  if (!skills || skills.length === 0) return null;

  const displaySkills = skills.slice(0, SKILLS_DISPLAY_LIMIT);
  const remainingCount = skills.length - SKILLS_DISPLAY_LIMIT;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1">
        {displaySkills.map((skill) => (
          <Badge key={skill} variant="outline" className="text-xs">
            {skill}
          </Badge>
        ))}
        {remainingCount > 0 && (
          <Badge variant="outline" className="text-xs">
            +{remainingCount} more
          </Badge>
        )}
      </div>
    </div>
  );
}

interface RoleFooterProps {
  provider: string;
  source: string;
}

function RoleFooter({ provider, source }: RoleFooterProps) {
  return (
    <div className="mt-auto pt-3 border-t border-border">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Provider: {provider}
        </span>
        <span className="text-muted-foreground">
          Source: {source}
        </span>
      </div>
    </div>
  );
}
