import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalizes a phone number string to E.164 format.
 * Defaults to US (+1) if no country code is provided.
 * Returns null if the number cannot be parsed or is invalid.
 */
export function normalizeToE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, 'US');
  if (parsed && parsed.isValid()) {
    return parsed.format('E.164');
  }
  return null;
}

/**
 * Returns true if the input is a valid, parseable phone number.
 */
export function isValidPhone(input: string): boolean {
  return normalizeToE164(input) !== null;
}

/**
 * Returns true if the input looks like an email address.
 */
export function isEmail(input: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(input.trim());
}

/**
 * Normalizes an email address to lowercase and trimmed.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
