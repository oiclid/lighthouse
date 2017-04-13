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

/**
 * @fileoverview The entry point for rendering the Lighthouse report based on the JSON output.
 *    This file is injected into the report HTML along with the JSON report.
 *
 * Dummy text for ensuring report robustness: </script> pre$`post %%LIGHTHOUSE_JSON%%
 */

/* globals DOM, DetailsRenderer */

const RATINGS = {
  PASS: {label: 'pass', minScore: 75},
  AVERAGE: {label: 'average', minScore: 45},
  FAIL: {label: 'fail'}
};

/**
 * Convert a score to a rating label.
 * @param {number} score
 * @return {string}
 */
function calculateRating(score) {
  let rating = RATINGS.FAIL.label;
  if (score >= RATINGS.PASS.minScore) {
    rating = RATINGS.PASS.label;
  } else if (score >= RATINGS.AVERAGE.minScore) {
    rating = RATINGS.AVERAGE.label;
  }
  return rating;
}

/**
 * Format number.
 * @param {number} number
 * @return {string}
 */
function formatNumber(number) {
  return number.toLocaleString(undefined, {maximumFractionDigits: 1});
}

class ReportRenderer {
  /**
   * @param {!Document} document
   */
  constructor(document) {
    this._dom = new DOM(document);
    this._detailsRenderer = new DetailsRenderer(this._dom);
  }

  /**
   * @param {!ReportJSON} report
   * @return {!Element}
   */
  renderReport(report) {
    try {
      return this._renderReport(report);
    } catch (e) {
      return this._renderException(e);
    }
  }

  /**
   * @param {!DocumentFragment|!Element} element DOM node to populate with values.
   * @param {number} score
   * @param {string} scoringMode
   * @param {string} title
   * @param {string} description
   * @return {!Element}
   */
  _populateScore(element, score, scoringMode, title, description) {
    // Fill in the blanks.
    const valueEl = element.querySelector('.lighthouse-score__value');
    valueEl.textContent = formatNumber(score);
    valueEl.classList.add(`lighthouse-score__value--${calculateRating(score)}`,
                          `lighthouse-score__value--${scoringMode}`);

    element.querySelector('.lighthouse-score__title').textContent = title;
    element.querySelector('.lighthouse-score__description')
        .appendChild(this._dom.createSpanFromMarkdown(description));

    return element;
  }

  /**
   * @param {!AuditJSON} audit
   * @return {!Element}
   */
  _renderAuditScore(audit) {
    const tmpl = this._dom.cloneTemplate('#tmpl-lighthouse-audit-score');

    const scoringMode = audit.result.scoringMode;
    const description = audit.result.helpText;
    let title = audit.result.description;

    if (audit.result.displayValue) {
      title += `:  ${audit.result.displayValue}`;
    }
    if (audit.result.optimalValue) {
      title += ` (target: ${audit.result.optimalValue})`;
    }

    // Append audit details to header section so the entire audit is within a <details>.
    const header = tmpl.querySelector('.lighthouse-score__header');
    header.open = audit.score < 100; // expand failed audits
    if (audit.result.details) {
      header.appendChild(this._detailsRenderer.render(audit.result.details));
    }

    return this._populateScore(tmpl, audit.score, scoringMode, title, description);
  }

  /**
   * @param {!CategoryJSON} category
   * @return {!Element}
   */
  _renderCategoryScore(category) {
    const tmpl = this._dom.cloneTemplate('#tmpl-lighthouse-category-score');
    const score = Math.round(category.score);
    return this._populateScore(tmpl, score, 'numeric', category.name, category.description);
  }

  /**
   * @param {!Error} e
   * @return {!Element}
   */
  _renderException(e) {
    const element = this._dom.createElement('div', 'lighthouse-exception');
    element.textContent = String(e.stack);
    return element;
  }

  /**
   * @param {!ReportJSON} report
   * @return {!Element}
   */
  _renderReport(report) {
    const element = this._dom.createElement('div', 'lighthouse-report');
    for (const category of report.reportCategories) {
      element.appendChild(this._renderCategory(category));
    }
    return element;
  }

  /**
   * @param {!CategoryJSON} category
   * @return {!Element}
   */
  _renderCategory(category) {
    const element = this._dom.createElement('div', 'lighthouse-category');
    element.appendChild(this._renderCategoryScore(category));
    for (const audit of category.audits) {
      element.appendChild(this._renderAudit(audit));
    }
    return element;
  }

  /**
   * @param {!AuditJSON} audit
   * @return {!Element}
   */
  _renderAudit(audit) {
    const element = this._dom.createElement('div', 'lighthouse-audit');
    element.appendChild(this._renderAuditScore(audit));
    return element;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReportRenderer;
}

/** @typedef {{id: string, weight: number, score: number, result: {description: string, displayValue: string, helpText: string, score: number|boolean, details: DetailsRenderer.DetailsJSON|DetailsRenderer.CardsDetailsJSON|undefined}}} */
let AuditJSON; // eslint-disable-line no-unused-vars

/** @typedef {{name: string, weight: number, score: number, description: string, audits: Array<AuditJSON>}} */
let CategoryJSON; // eslint-disable-line no-unused-vars

/** @typedef {{reportCategories: Array<CategoryJSON>}} */
let ReportJSON; // eslint-disable-line no-unused-vars
