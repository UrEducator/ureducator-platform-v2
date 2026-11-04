/** Only same-site paths are accepted as a post-login destination (prevents open redirects). */
export function safeNext(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  return raw;
}
