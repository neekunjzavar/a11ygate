'use strict';

/*
 * Layer 1 of the accessibility gate: fast static checks on the rendered HTML.
 * These run in milliseconds with no browser, so they catch the most common
 * mistakes before the slower browser-based scans (pa11y-ci, Lighthouse) run.
 */

const request = require('supertest');
const cheerio = require('cheerio');
const { createApp } = require('../src/app');

const PAGES = ['/', '/events', '/events?q=zzz', '/events/1', '/about', '/does-not-exist'];

async function load(app, url) {
  const res = await request(app).get(url);
  return cheerio.load(res.text);
}

describe.each(PAGES)('Static accessibility checks for %s', (url) => {
  let $;
  beforeAll(async () => {
    $ = await load(createApp(), url);
  });

  test('<html> has a lang attribute', () => {
    expect($('html').attr('lang')).toBeTruthy();
  });

  test('page has a descriptive <title>', () => {
    expect($('title').text().trim().length).toBeGreaterThan(5);
  });

  test('page has exactly one <h1>', () => {
    expect($('h1')).toHaveLength(1);
  });

  test('headings do not skip levels', () => {
    const levels = $('h1, h2, h3, h4, h5, h6')
      .map((i, el) => Number(el.tagName[1]))
      .get();
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
    });
  });

  test('every <img> has an alt attribute (empty is fine for decorative images)', () => {
    const missing = $('img')
      .filter((i, el) => $(el).attr('alt') === undefined)
      .map((i, el) => $(el).attr('src'))
      .get();
    expect(missing).toEqual([]);
  });

  test('every form control has a <label>', () => {
    const unlabelled = $('input:not([type=hidden]), select, textarea')
      .filter((i, el) => {
        const id = $(el).attr('id');
        return !(id && $(`label[for="${id}"]`).length) && !$(el).attr('aria-label');
      })
      .map((i, el) => $(el).attr('name'))
      .get();
    expect(unlabelled).toEqual([]);
  });

  test('every link has accessible text', () => {
    const empty = $('a')
      .filter((i, el) => !$(el).text().trim() && !$(el).attr('aria-label'))
      .map((i, el) => $(el).attr('href'))
      .get();
    expect(empty).toEqual([]);
  });

  test('has a skip link and a <main> landmark', () => {
    expect($('a.skip-link').attr('href')).toBe('#main');
    expect($('main#main')).toHaveLength(1);
  });
});
