'use strict';

const {
  loadEvents,
  filterEvents,
  getEventById,
  seatsLeft,
  formatDate,
  validateRegistration
} = require('../src/lib/events');

describe('filterEvents', () => {
  const events = loadEvents();

  test('returns all events sorted by date when no filters are given', () => {
    const result = filterEvents(events);
    expect(result).toHaveLength(events.length);
    const dates = result.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
  });

  test('filters by category', () => {
    const result = filterEvents(events, { category: 'sports' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.category === 'sports')).toBe(true);
  });

  test('search is case-insensitive and checks title, summary and venue', () => {
    expect(filterEvents(events, { q: 'DOCKER' }).map((e) => e.id)).toContain(1);
    expect(filterEvents(events, { q: 'auditorium' }).map((e) => e.id)).toContain(2);
  });

  test('combines search and category', () => {
    const result = filterEvents(events, { q: 'git', category: 'workshop' });
    expect(result.map((e) => e.id)).toEqual([6]);
  });

  test('returns an empty list when nothing matches', () => {
    expect(filterEvents(events, { q: 'no-such-event-xyz' })).toEqual([]);
  });
});

describe('getEventById', () => {
  const events = loadEvents();

  test('finds an event by numeric string id', () => {
    expect(getEventById(events, '3').title).toMatch(/Cultural Fest/);
  });

  test.each(['999', 'abc', '', undefined])('returns undefined for %p', (id) => {
    expect(getEventById(events, id)).toBeUndefined();
  });
});

describe('formatDate', () => {
  test('formats ISO dates in a readable, timezone-safe way', () => {
    expect(formatDate('2026-10-14')).toBe('Wednesday, 14 October 2026');
  });
});

describe('validateRegistration', () => {
  test('accepts a valid name and email and normalises the email', () => {
    const [event] = loadEvents();
    const result = validateRegistration({ name: ' Asha Patil ', email: 'Asha@College.EDU ' }, event);
    expect(result.valid).toBe(true);
    expect(result.values).toEqual({ name: 'Asha Patil', email: 'asha@college.edu' });
  });

  test('rejects a missing name and invalid email with helpful messages', () => {
    const result = validateRegistration({ name: 'A', email: 'not-an-email' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toMatch(/full name/);
    expect(result.errors.email).toMatch(/valid email/);
  });

  test('rejects a duplicate registration', () => {
    const [event] = loadEvents();
    event.registrations.push({ name: 'Asha', email: 'asha@college.edu' });
    const result = validateRegistration({ name: 'Asha', email: 'asha@college.edu' }, event);
    expect(result.errors.email).toMatch(/already registered/);
  });

  test('rejects registration when the event is full', () => {
    const [event] = loadEvents();
    event.seats = 1;
    event.registrations.push({ name: 'X', email: 'x@college.edu' });
    expect(seatsLeft(event)).toBe(0);
    expect(validateRegistration({ name: 'Ravi', email: 'ravi@college.edu' }, event).errors.form).toMatch(/full/);
  });
});
