import { isEmail, normalizeEmail } from './email.utils';

describe('isEmail', () => {
  it('returns true for a valid email', () => {
    expect(isEmail('user@example.com')).toBe(true);
  });

  it('returns false for invalid input', () => {
    expect(isEmail('invalid-email')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases the value', () => {
    expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
  });
});
