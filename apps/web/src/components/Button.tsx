import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const styles: Record<Variant, string> = {
  primary: 'btn-violet',
  secondary: 'border border-ink-600 bg-ink-700/70 text-white hover:bg-ink-600',
  ghost: 'bg-transparent text-ink-200 hover:bg-ink-700',
  danger: 'bg-pop-rose text-night hover:brightness-110 shadow-chunky',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sz =
    size === 'sm'
      ? 'px-3 py-1.5 text-sm rounded-lg'
      : size === 'lg'
        ? 'px-6 py-3.5 text-lg rounded-xl'
        : 'px-4 py-2.5 rounded-xl';
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 font-bold transition active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ${sz} ${styles[variant]} ${className}`}
    />
  );
}
