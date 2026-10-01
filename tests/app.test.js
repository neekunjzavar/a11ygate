'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');

describe('HTTP routes', () => {
  let app;
  beforeEach(() => {
    app = createApp();
  });

  test('GET /healthz reports ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.commit).toBeDefined();
  });

  test.each(['/', '/events', '/events/1', '/about'])('GET %s renders an HTML page', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('GET /events filters by category', async () => {
    const res = await request(app).get('/events?category=sports');
    expect(res.text).toContain('Football');
    expect(res.text).not.toContain('Docker Workshop');
  });

  test('unknown pages and events return 404', async () => {
    expect((await request(app).get('/nope')).status).toBe(404);
    expect((await request(app).get('/events/999')).status).toBe(404);
  });

  test('GET /api/events returns JSON with a count', async () => {
    const res = await request(app).get('/api/events?category=tech');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(res.body.events.length);
    expect(res.body.events.every((e) => e.category === 'tech')).toBe(true);
  });

  test('registration succeeds and reduces seats left', async () => {
    const before = (await request(app).get('/api/events')).body.events.find((e) => e.id === 1).seatsLeft;
    const res = await request(app)
      .post('/events/1/register')
      .type('form')
      .send({ name: 'Asha Patil', email: 'asha@college.edu' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('registered, Asha Patil');
    const after = (await request(app).get('/api/events')).body.events.find((e) => e.id === 1).seatsLeft;
    expect(after).toBe(before - 1);
  });

  test('invalid registration returns 422 with an error summary', async () => {
    const res = await request(app).post('/events/1/register').type('form').send({ name: '', email: 'bad' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('There is a problem');
    expect(res.text).toContain('aria-invalid="true"');
  });

  test('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});
