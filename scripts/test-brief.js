'use strict';
/* Verifies the exact brief-generation code the browser runs, using the
   demo dataset. Run: npm test */
const assert = require('assert');
const Brief = require('../public/brief.js');
const demo = require('../lib/demo-data.json');

const brief = Brief.generateBrief(demo, { dateStr: 'Tuesday 24 November 2026' });
assert.ok(Array.isArray(brief.thread) && brief.thread.length >= 3, 'thread has posts');
brief.thread.forEach((p) => assert.ok(p.length <= 285, 'post within limit: ' + p.length));
const joined = brief.thread.join(' ');
assert.ok(joined.includes('Greed (72/100)'), 'mood in thread');
assert.ok(joined.includes('Example Alpha'), 'top gainer in thread');
assert.ok(joined.includes('#BuildwithCMC'), 'hashtag footer present');
assert.ok(brief.paragraph.includes('Not financial advice'), 'disclaimer in paragraph');
assert.strictEqual(Brief.fmtMoney(3280000000000), '$3.28T');
assert.strictEqual(Brief.fmtPct(-6.24), '-6.2%');
console.log('All brief tests passed.');
console.log('--- Sample thread ---');
brief.thread.forEach((p) => console.log(p));
console.log('--- Paragraph ---');
console.log(brief.paragraph);
