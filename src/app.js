'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const pkg = require('../package.json');
const {
  CATEGORIES,
  loadEvents,
  filterEvents,
  getEventById,
  seatsLeft,
  formatDate,
  validateRegistration
} = require('./lib/events');

function createApp() {
  const app = express();
  const events = loadEvents();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Off because CI reaches the container over plain http://app:3000;
          // with it on, the browser rewrites CSS/image URLs to https and they fail.
          // In production Render terminates HTTPS in front of the app anyway.
          upgradeInsecureRequests: null
        }
      }
    })
  );
  app.use(compression());
  app.use(express.urlencoded({ extended: false }));
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
    })
  );

  // Values available in every template
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.formatDate = formatDate;
    res.locals.seatsLeft = seatsLeft;
    res.locals.CATEGORIES = CATEGORIES;
    next();
  });

  app.get('/healthz', (req, res) => {
    res.json({
      status: 'ok',
      version: pkg.version,
      commit: process.env.GIT_SHA || 'dev', // baked into the Docker image at build time
      uptime: Math.round(process.uptime())
    });
  });

  app.get('/', (req, res) => {
    res.render('index', {
      title: 'Campus Events',
      upcoming: filterEvents(events).slice(0, 3)
    });
  });

  app.get('/events', (req, res) => {
    const q = req.query.q || '';
    const category = req.query.category || '';
    const results = filterEvents(events, { q, category });
    res.render('events', { title: 'All events', results, q, category });
  });

  app.get('/events/:id', (req, res, next) => {
    const event = getEventById(events, req.params.id);
    if (!event) return next();
    res.render('event', { title: event.title, event, errors: {}, values: {}, registered: false });
  });

  app.post('/events/:id/register', (req, res, next) => {
    const event = getEventById(events, req.params.id);
    if (!event) return next();

    const { valid, errors, values } = validateRegistration(req.body, event);
    if (!valid) {
      return res
        .status(422)
        .render('event', { title: `Error: ${event.title}`, event, errors, values, registered: false });
    }
    event.registrations.push({ ...values, at: new Date().toISOString() });
    res.render('event', { title: `Registered: ${event.title}`, event, errors: {}, values, registered: true });
  });

  app.get('/about', (req, res) => {
    res.render('about', { title: 'About this project' });
  });

  // JSON API (used by the tests and handy for the demo)
  app.get('/api/events', (req, res) => {
    const results = filterEvents(events, req.query).map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      date: e.date,
      time: e.time,
      venue: e.venue,
      seatsLeft: seatsLeft(e)
    }));
    res.json({ count: results.length, events: results });
  });

  app.use((req, res) => {
    res.status(404).render('404', { title: 'Page not found' });
  });

  return app;
}

module.exports = { createApp };
