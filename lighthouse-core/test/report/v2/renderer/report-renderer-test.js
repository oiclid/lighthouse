/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/* eslint-env mocha, browser */

const assert = require('assert');
const fs = require('fs');
const jsdom = require('jsdom');
const URL = require('../../../../lib/url-shim');
const DOM = require('../../../../report/v2/renderer/dom.js');
const ReportRenderer = require('../../../../report/v2/renderer/report-renderer.js');
const sampleResults = require('../../../results/sample_v2.json');

const TEMPLATE_FILE = fs.readFileSync(__dirname + '/../../../../report/v2/templates.html', 'utf8');

describe('ReportRenderer V2', () => {
  let renderer;

  before(() => {
    global.URL = URL;
    global.DOM = DOM;
    global.DetailsRenderer = require('../../../../report/v2/renderer/details-renderer.js');
    global.Logger = require('../../../../report/v2/renderer/logger.js');
    global.ReportFeatures = require('../../../../report/v2/renderer/report-features.js');
    global.matchMedia = function() {
      return {
        addListener: function() {}
      };
    };
    const document = jsdom.jsdom(TEMPLATE_FILE);
    renderer = new ReportRenderer(document);
  });

  after(() => {
    global.URL = undefined;
    global.DOM = undefined;
    global.DetailsRenderer = undefined;
    global.Logger = undefined;
    global.ReportFeatures = undefined;
    global.matchMedia = undefined;
  });

  describe('renderReport', () => {
    it('should render a report', () => {
      const container = renderer._dom._document.body;
      const output = renderer.renderReport(sampleResults, container);
      assert.ok(output.classList.contains('lighthouse-report'));
      assert.ok(container.contains(output), 'report appended to container');
    });

    it('should render an exception for invalid input', () => {
      const container = renderer._dom._document.body;
      const output = renderer.renderReport({
        get reportCategories() {
          throw new Error();
        }
      }, container);
      assert.ok(output.classList.contains('lighthouse-exception'));
    });

    it('renders an audit', () => {
      const audit = sampleResults.reportCategories[0].audits[0];
      const auditDOM = renderer._renderAudit(audit);

      const title = auditDOM.querySelector('.lighthouse-score__title');
      const description = auditDOM.querySelector('.lighthouse-score__description');
      const score = auditDOM.querySelector('.lighthouse-score__value');

      assert.equal(title.textContent, audit.result.description);
      assert.ok(description.querySelector('a'), 'audit help text contains coverted markdown links');
      assert.equal(score.textContent, '0');
      assert.ok(score.classList.contains('lighthouse-score__value--fail'));
      assert.ok(score.classList.contains(`lighthouse-score__value--${audit.result.scoringMode}`));
    });

    it('renders a category', () => {
      const category = sampleResults.reportCategories[0];
      const categoryDOM = renderer._renderCategory(category);

      const score = categoryDOM.querySelector('.lighthouse-score');
      const value = categoryDOM.querySelector('.lighthouse-score  > .lighthouse-score__value');
      const title = score.querySelector('.lighthouse-score__title');
      const description = score.querySelector('.lighthouse-score__description');

      assert.deepEqual(score, score.firstElementChild, 'first child is a score');
      assert.ok(value.classList.contains('lighthouse-score__value--numeric'),
                'category score is numeric');
      assert.equal(value.textContent, Math.round(category.score), 'category score is rounded');
      assert.equal(title.textContent, category.name, 'title is set');
      assert.ok(description.querySelector('a'), 'description contains converted markdown links');

      const audits = categoryDOM.querySelectorAll('.lighthouse-category > .lighthouse-audit');
      assert.equal(audits.length, category.audits.length, 'renders correct number of audits');
    });
  });
});
