import { cn } from '../../utils/cn';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
// import type { Role } from '@codecafe/core/types/role';

// Temporary type for compilation
interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  skills: string[];
  recommendedProvider: string;
  variables: any[];
  isDefault: boolean;
  source: string;
}

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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{role.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{role.id}</p>
        </div>
        <Badge variant={role.isDefault ? 'default' : 'secondary'}>
          {role.isDefault ? 'Default' : 'User'}
        </Badge>
      </div>

      {/* Description */}
      {role.systemPrompt && (
        <p className="text-sm text-foreground/80 line-clamp-2">
          {role.systemPrompt}
        </p>
      )}

      {/* Skills */}
      {role.skills && role.skills.length > 0 && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {role.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {role.skills.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{role.skills.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Provider: {role.recommendedProvider}
          </span>
          <span className="text-muted-foreground">
            Source: {role.source}
          </span>
        </div>
      </div>
    </Card>
  );
}