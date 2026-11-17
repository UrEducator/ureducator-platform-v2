'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ThemeToggle({ className, size = 'md' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedDark, setResolvedDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize theme from localStorage or default to system
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('ur_theme') as Theme | null;
    const initialTheme: Theme = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    setTheme(initialTheme);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = initialTheme === 'system' ? mq.matches : initialTheme === 'dark';
    setResolvedDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);

    // Sync across tabs and other ThemeToggle instances
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ur_theme' && e.newValue) {
        const nextTheme = e.newValue as Theme;
        if (nextTheme === 'light' || nextTheme === 'dark' || nextTheme === 'system') {
          setTheme(nextTheme);
          const nextDark = nextTheme === 'system' ? mq.matches : nextTheme === 'dark';
          setResolvedDark(nextDark);
          document.documentElement.setAttribute('data-theme', nextDark ? 'dark' : 'light');
          document.documentElement.classList.toggle('dark', nextDark);
        }
      }
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>;
      if (customEvent.detail) {
        const nextTheme = customEvent.detail;
        setTheme(nextTheme);
        const nextDark = nextTheme === 'system' ? mq.matches : nextTheme === 'dark';
        setResolvedDark(nextDark);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('ur_theme_change', handleCustomChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('ur_theme_change', handleCustomChange);
    };
  }, []);

  // Listen to OS prefers-color-scheme changes when system theme is active
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const isDark = e.matches;
      setResolvedDark(isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', isDark);
    };

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [mounted, theme]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (nextTheme: Theme) => {
    setTheme(nextTheme);
    setIsOpen(false);
    localStorage.setItem('ur_theme', nextTheme);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = nextTheme === 'system' ? mq.matches : nextTheme === 'dark';
    setResolvedDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);

    // Notify other components
    window.dispatchEvent(new CustomEvent('ur_theme_change', { detail: nextTheme }));
  };

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const getAriaLabel = () => {
    if (!mounted) return 'Toggle theme';
    if (theme === 'system') return `Theme: System (${resolvedDark ? 'Dark' : 'Light'})`;
    return `Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`;
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        id="theme-menu-button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center justify-center rounded-control border border-line transition-all duration-150',
          'bg-surface hover:bg-surface-hover text-ink active:scale-95 focus-visible:outline-pen-500 cursor-pointer',
          size === 'sm' ? 'size-8' : 'size-9',
          className
        )}
        aria-label={getAriaLabel()}
        title={getAriaLabel()}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {mounted ? (
          theme === 'system' ? (
            <Monitor
              className={cn(size === 'sm' ? 'size-4' : 'size-4.5', 'text-pen-600 dark:text-brand-primary animate-in fade-in duration-200')}
              aria-hidden="true"
            />
          ) : theme === 'dark' ? (
            <Moon
              className={cn(size === 'sm' ? 'size-4' : 'size-4.5', 'text-pen-600 dark:text-brand-primary animate-in fade-in duration-200')}
              aria-hidden="true"
            />
          ) : (
            <Sun
              className={cn(size === 'sm' ? 'size-4' : 'size-4.5', 'text-marker animate-in fade-in duration-200')}
              aria-hidden="true"
            />
          )
        ) : (
          <span className={cn(size === 'sm' ? 'size-4' : 'size-4.5', 'opacity-0')} aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="theme-menu-button"
          className="absolute right-0 mt-1.5 w-36 rounded-control border border-line bg-surface text-ink shadow-lg z-50 p-1 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-sm transition-colors text-left cursor-pointer',
                  isSelected
                    ? 'bg-pen-50 dark:bg-pen-900/50 text-pen-700 dark:text-pen-200 font-semibold'
                    : 'text-ink hover:bg-surface-hover hover:text-ink'
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      'size-3.5 shrink-0',
                      opt.value === 'light' ? 'text-amber-500' : opt.value === 'dark' ? 'text-indigo-400' : 'text-muted'
                    )}
                    aria-hidden="true"
                  />
                  <span>{opt.label}</span>
                </span>
                {isSelected && (
                  <Check className="size-3.5 text-pen-600 dark:text-brand-primary shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
