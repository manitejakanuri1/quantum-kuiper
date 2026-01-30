/**
 * Tests for validation schemas
 */

import {
  validateRequest,
  urlSchema,
  createAgentSchema,
  sanitizeString,
  sanitizeUserInput,
  authCredentialsSchema,
} from '../src/lib/validation';

describe('URL Schema Validation', () => {
  test('accepts valid HTTP URLs', () => {
    expect(() => urlSchema.parse('http://example.com')).not.toThrow();
    expect(() => urlSchema.parse('https://example.com')).not.toThrow();
  });

  test('rejects non-HTTP protocols', () => {
    expect(() => urlSchema.parse('ftp://example.com')).toThrow();
    expect(() => urlSchema.parse('file:///etc/passwd')).toThrow();
    expect(() => urlSchema.parse('javascript:alert(1)')).toThrow();
  });

  test('rejects localhost and private IPs', () => {
    expect(() => urlSchema.parse('http://localhost')).toThrow();
    expect(() => urlSchema.parse('http://127.0.0.1')).toThrow();
    expect(() => urlSchema.parse('http://10.0.0.1')).toThrow();
    expect(() => urlSchema.parse('http://192.168.1.1')).toThrow();
    expect(() => urlSchema.parse('http://172.16.0.1')).toThrow();
  });

  test('rejects URLs that are too long', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2000);
    expect(() => urlSchema.parse(longUrl)).toThrow();
  });
});

describe('Create Agent Schema', () => {
  test('accepts valid agent data', () => {
    const validAgent = {
      name: 'Test Agent',
      websiteUrl: 'https://example.com',
    };
    expect(() => createAgentSchema.parse(validAgent)).not.toThrow();
  });

  test('rejects empty agent name', () => {
    const invalidAgent = {
      name: '',
      websiteUrl: 'https://example.com',
    };
    expect(() => createAgentSchema.parse(invalidAgent)).toThrow();
  });

  test('rejects agent name that is too long', () => {
    const invalidAgent = {
      name: 'a'.repeat(101),
      websiteUrl: 'https://example.com',
    };
    expect(() => createAgentSchema.parse(invalidAgent)).toThrow();
  });

  test('trims whitespace from agent name', () => {
    const agent = {
      name: '  Test Agent  ',
      websiteUrl: 'https://example.com',
    };
    const result = createAgentSchema.parse(agent);
    expect(result.name).toBe('Test Agent');
  });
});

describe('Auth Credentials Schema', () => {
  test('accepts valid email and password', () => {
    const valid = {
      email: 'user@example.com',
      password: 'SecurePass123!',
    };
    expect(() => authCredentialsSchema.parse(valid)).not.toThrow();
  });

  test('rejects invalid email format', () => {
    const invalid = {
      email: 'not-an-email',
      password: 'SecurePass123!',
    };
    expect(() => authCredentialsSchema.parse(invalid)).toThrow();
  });

  test('rejects password that is too short', () => {
    const invalid = {
      email: 'user@example.com',
      password: 'short',
    };
    expect(() => authCredentialsSchema.parse(invalid)).toThrow();
  });

  test('converts email to lowercase', () => {
    const data = {
      email: 'USER@EXAMPLE.COM',
      password: 'SecurePass123!',
    };
    const result = authCredentialsSchema.parse(data);
    expect(result.email).toBe('user@example.com');
  });
});

describe('Sanitization Functions', () => {
  test('sanitizeString removes HTML tags', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeString('Hello <b>World</b>')).toBe('Hello bWorld/b');
  });

  test('sanitizeString removes javascript: protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
  });

  test('sanitizeString removes inline event handlers', () => {
    expect(sanitizeString('Click me onclick=alert(1)')).toBe('Click me alert(1)');
  });

  test('sanitizeUserInput enforces max length', () => {
    const longString = 'a'.repeat(1001);
    expect(() => sanitizeUserInput(longString, 1000)).toThrow();
  });

  test('sanitizeUserInput throws on non-string input', () => {
    expect(() => sanitizeUserInput(123 as any)).toThrow();
    expect(() => sanitizeUserInput(null as any)).toThrow();
  });
});

describe('validateRequest Helper', () => {
  test('returns valid data when validation passes', () => {
    const data = { email: 'user@example.com', password: 'SecurePass123!' };
    const result = validateRequest(authCredentialsSchema, data);
    expect(result).toEqual({ email: 'user@example.com', password: 'SecurePass123!' });
  });

  test('throws error with validation messages when validation fails', () => {
    const data = { email: 'invalid', password: 'short' };
    expect(() => validateRequest(authCredentialsSchema, data)).toThrow('Validation failed');
  });
});
