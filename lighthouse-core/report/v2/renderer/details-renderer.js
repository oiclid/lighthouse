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

class DetailsRenderer {
  /**
   * @param {!DOM} dom
   */
  constructor(dom) {
    this._dom = dom;
  }

  /**
   * @param (!DetailsRenderer.DetailsJSON|!DetailsRenderer.CardsDetailsJSON)} details
   * @return {!Element}
   */
  render(details) {
    switch (details.type) {
      case 'text':
        return this._renderText(details);
      case 'block':
        return this._renderBlock(details);
      case 'cards':
        return this._renderCards(details);
      case 'list':
        return this._renderList(details);
      default:
        throw new Error(`Unknown type: ${details.type}`);
    }
  }

  /**
   * @param {!DetailsJSON} text
   * @return {!Element}
   */
  _renderText(text) {
    const element = this._dom.createElement('div', 'lighthouse-text');
    element.textContent = text.text;
    return element;
  }

  /**
   * @param {!DetailsJSON} block
   * @return {!Element}
   */
  _renderBlock(block) {
    const element = this._dom.createElement('div', 'lighthouse-block');
    for (const item of block.items) {
      element.appendChild(this.render(item));
    }
    return element;
  }

  /**
   * @param {!DetailsJSON} list
   * @return {!Element}
   */
  _renderList(list) {
    const element = this._dom.createElement('details', 'lighthouse-list');
    if (list.header) {
      const summary = this._dom.createElement('summary', 'lighthouse-list__header');
      summary.textContent = list.header.text;
      element.appendChild(summary);
    }

    const items = this._dom.createElement('div', 'lighthouse-list__items');
    for (const item of list.items) {
      items.appendChild(this.render(item));
    }
    element.appendChild(items);
    return element;
  }

  /**
   * @param {!CardsDetailsJSON} details
   * @return {!Element}
   */
  _renderCards(details) {
    const element = this._dom.createElement('details', 'lighthouse-details');
    if (details.header) {
      element.appendChild(this._dom.createElement('summary')).textContent = details.header.text;
    }

    const cardsParent = this._dom.createElement('div', 'lighthouse-scorecards');
    for (const item of details.items) {
      const card = cardsParent.appendChild(
          this._dom.createElement('div', 'lighthouse-scorecard', {title: item.snippet}));
      const titleEl = this._dom.createElement('div', 'lighthouse-scorecard__title');
      const valueEl = this._dom.createElement('div', 'lighthouse-scorecard__value');
      const targetEl = this._dom.createElement('div', 'lighthouse-scorecard__target');

      card.appendChild(titleEl).textContent = item.title;
      card.appendChild(valueEl).textContent = item.value;

      if (item.target) {
        card.appendChild(targetEl).textContent = `target: ${item.target}`;
      }
    }

    element.appendChild(cardsParent);
    return element;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DetailsRenderer;
}

/** @typedef {{type: string, text: string|undefined, header: DetailsJSON|undefined, items: Array<DetailsJSON>|undefined}} */
DetailsRenderer.DetailsJSON; // eslint-disable-line no-unused-expressions


/** @typedef {{type: string, text: string, header: DetailsJSON, items: Array<{title: string, value: string, snippet: string|undefined, target: string}>}} */
DetailsRenderer.CardsDetailsJSON; // eslint-disable-line no-unused-expressions
