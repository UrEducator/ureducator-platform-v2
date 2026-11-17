import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface LogoIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
  primaryColor?: string;
  darkColor?: string;
  tealColor?: string;
  monochrome?: boolean;
}

/**
 * Responsive Logo SVG component utilizing UrEducator brand palette:
 * - Dark Blue: #295c89
 * - Primary Blue: #3a8bed
 * - Teal Blue: #3ba9d2
 * Supports monochrome adaptability using currentColor when monochrome=true.
 */
export function LogoIcon({
  className,
  size,
  primaryColor = '#3a8bed',
  darkColor = '#295c89',
  tealColor = '#3ba9d2',
  monochrome = false,
  ...props
}: LogoIconProps) {
  const dark = monochrome ? 'currentColor' : darkColor;
  const primary = monochrome ? 'currentColor' : primaryColor;
  const teal = monochrome ? 'currentColor' : tealColor;

  return (
    <svg
      width={size ?? '100%'}
      height={size ?? '100%'}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none', className)}
      aria-hidden="true"
      {...props}
    >
      {/* Top Cap (Dark Blue) */}
      <path
        d="M50 15 L85 30 L50 45 L15 30 Z"
        fill={monochrome ? 'currentColor' : dark}
      />
      {/* Cap Base (Dark Blue) */}
      <path
        d="M35 41 L35 52 C35 56 65 56 65 52 L65 41 L50 48 Z"
        fill={monochrome ? 'currentColor' : dark}
      />
      {/* Left Page (Teal) */}
      <path
        d="M15 50 L46 62 L46 95 L15 80 Z"
        fill={monochrome ? 'currentColor' : teal}
      />
      {/* Right Page (Primary Blue) */}
      <path
        d="M54 62 L85 50 L85 80 L54 95 Z"
        fill={monochrome ? 'currentColor' : primary}
      />
    </svg>
  );
}

export interface LogoProps {
  className?: string;
  tone?: 'ink' | 'light';
  showText?: boolean;
  iconClassName?: string;
  iconOnly?: boolean;
  size?: number | string;
}

/**
 * Main application Logo component for branding, headers, and watermark layouts.
 */
export function Logo({
  className,
  tone = 'ink',
  showText = true,
  iconClassName,
  iconOnly = false,
  size = 28,
}: LogoProps) {
  if (iconOnly) {
    return <LogoIcon className={cn('size-7', className, iconClassName)} size={size} />;
  }

  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center gap-2.5 font-semibold tracking-tight transition-colors',
        tone === 'light' ? 'text-white' : 'text-pen-900',
        className
      )}
      aria-label="UrEducator home"
    >
      <LogoIcon className={cn('size-7', iconClassName)} size={size} />
      {showText && <span className="text-[1.3rem] font-bold">UrEducator</span>}
    </Link>
  );
}

export default Logo;
