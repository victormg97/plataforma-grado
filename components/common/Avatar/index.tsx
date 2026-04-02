import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils/formatters';

interface AvatarProps {
  nombre: string;
  apellido: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

export function Avatar({
  nombre,
  apellido,
  avatarUrl,
  size = 'md',
  className,
}: AvatarProps) {
  const initials = getInitials(nombre, apellido);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${nombre} ${apellido}`}
        className={cn(
          'rounded-full object-cover',
          sizeStyles[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-white font-medium',
        sizeStyles[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
