import { isEmail, isValidPhone, normalizeEmail, normalizeToE164 } from './phone.utils';

describe('normalizeToE164', () => {
  it('normalizes a 10-digit US number', () => {
    expect(normalizeToE164('2125551234')).toBe('+12125551234');
  });

  it('normalizes a formatted US number with parens and dashes', () => {
    expect(normalizeToE164('(212) 555-1234')).toBe('+12125551234');
  });

  it('normalizes a US number with dots', () => {
    expect(normalizeToE164('212.555.1234')).toBe('+12125551234');
  });

  it('normalizes a US number with dashes', () => {
    expect(normalizeToE164('212-555-1234')).toBe('+12125551234');
  });

  it('returns E.164 for an already-formatted international number', () => {
    expect(normalizeToE164('+442071234567')).toBe('+442071234567');
  });

  it('returns null for an invalid phone number', () => {
    expect(normalizeToE164('123')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(normalizeToE164('')).toBeNull();
  });

  it('returns null for a string with only spaces', () => {
    expect(normalizeToE164('   ')).toBeNull();
  });

  it('handles leading and trailing whitespace', () => {
    expect(normalizeToE164('  2125551234  ')).toBe('+12125551234');
  });
});

describe('isValidPhone', () => {
  it('returns true for a valid US phone number', () => {
    expect(isValidPhone('2125551234')).toBe(true);
  });

  it('returns true for a valid international number', () => {
    expect(isValidPhone('+442071234567')).toBe(true);
  });

  it('returns false for a short invalid number', () => {
    expect(isValidPhone('123')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });

  it('returns false for words', () => {
    expect(isValidPhone('not a number')).toBe(false);
  });
});

describe('isEmail', () => {
  it('returns true for a valid email', () => {
    expect(isEmail('user@example.com')).toBe(true);
  });

  it('returns true for an email with subdomain', () => {
    expect(isEmail('john.doe@company.co.uk')).toBe(true);
  });

  it('returns false when missing @', () => {
    expect(isEmail('invalidemail.com')).toBe(false);
  });

  it('returns false when missing domain', () => {
    expect(isEmail('user@')).toBe(false);
  });

  it('returns false when missing local part', () => {
    expect(isEmail('@example.com')).toBe(false);
  });

  it('handles leading and trailing whitespace', () => {
    expect(isEmail('  user@example.com  ')).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('converts to lowercase', () => {
    expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });
});
