import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--color-bg-secondary)] p-[var(--container-padding)]">
      {/* Subtle theme toggle — top-right corner, low visual weight */}
      <div className="absolute right-4 top-4 opacity-50 hover:opacity-100 transition-opacity">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
