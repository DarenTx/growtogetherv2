const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(input: string): boolean {
  return EMAIL_PATTERN.test(input.trim());
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}