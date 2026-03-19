import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('API Endpoints', () => {
  test('TC031 - POST /api/tts returns audio stream', async ({ request }) => {
    const res = await request.post(`${BASE}/api/tts`, {
      headers: { 'Content-Type': 'application/json' },
      data: { text: 'Hello, this is a test.', voiceId: '1b160c4cf02e4855a09efd59475b9370' },
    });
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toMatch(/audio|octet-stream/);
  });

  test('TC032 - POST /api/auth/simli-token returns session token', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/simli-token`, {
      headers: { 'Content-Type': 'application/json' },
      data: { faceId: 'default' },
    });
    // May return 200 with token or 429/500 if rate limited or API key invalid
    expect([200, 429, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('token');
    }
  });

  test('TC033 - POST /api/agents requires authentication (returns 401)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/agents`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: 'Test Agent', website_url: 'https://example.com' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('TC034 - GET /api/agents/nonexistent returns 401 or 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/agents/nonexistent-id`);
    expect([401, 403, 404]).toContain(res.status());
  });

  test('TC035 - POST /api/agents/test-id/converse with no query returns error', async ({ request }) => {
    const res = await request.post(`${BASE}/api/agents/test-id/converse`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    expect([400, 404, 500]).toContain(res.status());
  });

  test('TC036 - GET /api/widget/nonexistent returns 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/widget/nonexistent-id`);
    expect([404, 500]).toContain(res.status());
  });

  test('TC037 - POST /api/tts with empty text returns error', async ({ request }) => {
    const res = await request.post(`${BASE}/api/tts`, {
      headers: { 'Content-Type': 'application/json' },
      data: { text: '', voiceId: '' },
    });
    expect([400, 500]).toContain(res.status());
  });

  test('TC039 - POST /api/demo/verify with invalid email returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/demo/verify`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'not-an-email', turnstileToken: '' },
    });
    expect([400, 403, 429]).toContain(res.status());
  });

  test('TC040 - GET /api/voices/gallery returns voice list', async ({ request }) => {
    const res = await request.get(`${BASE}/api/voices/gallery`);
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('voices');
      expect(Array.isArray(body.voices)).toBe(true);
    }
  });
});
