'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

export function ThemeToggle({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('ur_theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ur_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex items-center justify-center rounded-control border border-line transition-all duration-150',
        'bg-surface hover:bg-surface-hover text-ink active:scale-95 focus-visible:outline-pen-500',
        size === 'sm' ? 'size-8' : 'size-9',
        className
      )}
      aria-label={mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
      title={mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
    >
      {mounted ? (
        isDark ? (
          <Sun className={cn(size === 'sm' ? 'size-4' : 'size-4.5', 'text-marker animate-in fade-in duration-200')} aria-hidden="true" />
        ) : (
          <Moon className={cn(size === 'sm' ? 'size-4' : 'size-4.5', 'text-pen-600 animate-in fade-in duration-200')} aria-hidden="true" />
        )
      ) : (
        <span className={cn(size === 'sm' ? 'size-4' : 'size-4.5', 'opacity-0')} aria-hidden="true" />
      )}
    </button>
  );
}
