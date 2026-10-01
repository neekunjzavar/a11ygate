'use strict';

const allEvents = require('../data/events.json');

const CATEGORIES = [
  { value: 'tech', label: 'Tech' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'sports', label: 'Sports' }
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns a fresh in-memory copy so tests and the server never share state. */
function loadEvents() {
  return allEvents.map((e) => ({ ...e, registrations: [] }));
}

/** Sorted by date, filtered by optional free-text query and category. */
function filterEvents(events, { q = '', category = '' } = {}) {
  const query = String(q).trim().toLowerCase();
  const cat = String(category).trim().toLowerCase();

  return events
    .filter((e) => !cat || e.category === cat)
    .filter((e) => {
      if (!query) return true;
      return [e.title, e.summary, e.venue].some((field) => field.toLowerCase().includes(query));
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function getEventById(events, id) {
  const num = Number.parseInt(id, 10);
  if (!Number.isInteger(num)) return undefined;
  return events.find((e) => e.id === num);
}

function seatsLeft(event) {
  return Math.max(event.seats - event.registrations.length, 0);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

/**
 * "2026-10-14" -> "Wednesday, 14 October 2026".
 * Built by hand (not toLocaleDateString) so output is identical in every
 * container and CI runner, whatever locale data is installed.
 */
function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[day]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** Validates the registration form; returns { valid, errors, values }. */
function validateRegistration(body = {}, event) {
  const values = {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase()
  };
  const errors = {};

  if (values.name.length < 2) errors.name = 'Enter your full name (at least 2 characters).';
  if (!EMAIL_RE.test(values.email)) errors.email = 'Enter a valid email address, like name@college.edu.';
  if (event && !errors.email && event.registrations.some((r) => r.email === values.email)) {
    errors.email = 'This email is already registered for this event.';
  }
  if (event && seatsLeft(event) === 0) errors.form = 'Sorry, this event is full.';

  return { valid: Object.keys(errors).length === 0, errors, values };
}

module.exports = {
  CATEGORIES,
  loadEvents,
  filterEvents,
  getEventById,
  seatsLeft,
  formatDate,
  validateRegistration
};
