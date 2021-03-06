/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
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

/* global ga, logger */

const FileUploader = require('./fileuploader');
const GithubAPI = require('./github');
const idb = require('idb-keyval');
const ReportGenerator = require('../../../lighthouse-core/report/report-generator');
const LighthouseReport = require('../../../lighthouse-core/report/scripts/lighthouse-report');

const LH_CURRENT_VERSION = require('../../../package.json').version;
const APP_URL = `${location.origin}${location.pathname}`;

/**
 * Class to handle dynamic changes to the page when users view new reports.
 * @class
 */
class LighthouseViewerReport extends LighthouseReport {

  constructor() {
    super();

    this.onPaste = this.onPaste.bind(this);
    this.onShare = this.onShare.bind(this);
    this.onFileUpload = this.onFileUpload.bind(this);
    this.onInputChange = this.onInputChange.bind(this);

    this.fileUploader = new FileUploader(this.onFileUpload);
    this.github = new GithubAPI();

    this._isNewReport = true;

    this._addEventListeners();
    this.loadFromDeepLink();
    this.listenForMessages();
  }

  _addEventListeners() {
    super._addEventListeners();

    this.shareButton = document.querySelector('.js-share');
    if (this.shareButton) {
      this.shareButton.addEventListener('click', this.onShare);

      // Disable the share button after the user shares the gist or if we're loading
      // a gist from GitHub. In both cases, the gist is already shared :)
      if (this._isNewReport) {
        this.enableButton(this.shareButton);
      } else {
        this.disableButton(this.shareButton);
      }
    }

    document.addEventListener('paste', this.onPaste);

    const gistURLInput = document.querySelector('.js-gist-url');
    if (gistURLInput) {
      gistURLInput.addEventListener('change', this.onInputChange);
    }
  }

  enableButton(button) {
    if (button) {
      button.disabled = false;
    }
  }

  disableButton(button) {
    if (button) {
      button.disabled = true;
    }
  }

  loadFromDeepLink() {
    // Pull gist id from URL and render it.
    const params = new URLSearchParams(location.search);
    const gistId = params.get('gist');
    if (gistId) {
      logger.log('Fetching report from GitHub...', false);

      this.github.auth.ready.then(_ => {
        this.github.getGistFileContentAsJson(gistId).then(json => {
          logger.hide();

          this._isNewReport = false;
          this.replaceReportHTML(json.content);

          // Save fetched json and etag to IDB so we can use it later for 304
          // requests. This is done after replaceReportHTML, so we don't save
          // unrecognized JSON to IDB. replaceReportHTML will throw in that case.
          return idb.set(gistId, {etag: json.etag, content: json.content});
        }).catch(err => logger.error(err.message));
      });
    }
  }

  _validateReportJson(reportJson) {
    if (!reportJson.lighthouseVersion) {
      throw new Error('JSON file was not generated by Lighthouse');
    }

    // Leave off patch version in the comparison.
    const semverRe = new RegExp(/^(\d+)?\.(\d+)?\.(\d+)$/);
    const reportVersion = reportJson.lighthouseVersion.replace(semverRe, '$1.$2');
    const lhVersion = LH_CURRENT_VERSION.replace(semverRe, '$1.$2');

    if (reportVersion < lhVersion) {
      // TODO: figure out how to handler older reports. All permalinks to older
      // reports will start to throw this warning when the viewer rev's its
      // minor LH version.
      // See https://github.com/GoogleChrome/lighthouse/issues/1108
      logger.warn('Results may not display properly.\n' +
                  'Report was created with an earlier version of ' +
                  `Lighthouse (${reportJson.lighthouseVersion}). The latest ` +
                  `version is ${LH_CURRENT_VERSION}.`);
    }
  }

  replaceReportHTML(json) {
    this._validateReportJson(json);

    const reportGenerator = new ReportGenerator();

    let html;
    try {
      html = reportGenerator.generateHTML(json, 'viewer');
    } catch (err) {
      html = reportGenerator.renderException(err, json);
    }

    // Use only the results section of the full HTML page.
    const div = document.createElement('div');
    div.innerHTML = html;

    document.title = div.querySelector('title').textContent;

    html = div.querySelector('.js-report').outerHTML;

    this.json = json;

    // Remove the placeholder drop area UI once the user has interacted.
    this.fileUploader.removeDropzonePlaceholder();

    // Replace the HTML and hook up event listeners to the new DOM.
    document.querySelector('output').innerHTML = html;
    this._addEventListeners();

    ga('send', 'event', 'report', 'view');
  }

  /**
   * Updates the page's HTML with contents of the JSON file passed in.
   * @param {!File} file
   * @return {!Promise<string>}
   * @throws file was not valid JSON generated by Lighthouse or an unknown file
   *     type of used.
   */
  onFileUpload(file) {
    return FileUploader.readFile(file).then(str => {
      let json;
      try {
        json = JSON.parse(str);
      } catch(e) {
        throw new Error('Could not parse JSON file.');
      }

      this._isNewReport = true;

      this.replaceReportHTML(json);
    }).catch(err => logger.error(err.message));
  }

  /**
   * Shares the current report by creating a gist on GitHub.
   * @return {!Promise<string>} id of the created gist.
   */
  onShare() {
    ga('send', 'event', 'report', 'share');

    // TODO: find and reuse existing json gist if one exists.
    return this.github.createGist(this.json).then(id => {
      ga('send', 'event', 'report', 'created');

      this.disableButton(this.shareButton);
      history.pushState({}, null, `${APP_URL}?gist=${id}`);

      return id;
    }).catch(err => logger.log(err.message));
  }

  /**
   * Enables pasting a JSON report on the page.
   */
  onPaste(e) {
    e.preventDefault();

    // Try paste as gist URL.
    try {
      const url = new URL(e.clipboardData.getData('text'));
      this._loadFromGistURL(url);

      ga('send', 'event', 'report', 'paste-link');
    } catch (err) {
      // noop
    }

    // Try paste as json content.
    try {
      const json = JSON.parse(e.clipboardData.getData('text'));
      this.replaceReportHTML(json);

      ga('send', 'event', 'report', 'paste');
    } catch (err) {
      // noop
    }
  }

  /**
   * Handles changes to the gist url input.
   */
  onInputChange(e) {
    e.stopPropagation();

    if (!e.target.value) {
      return;
    }

    try {
      this._loadFromGistURL(e.target.value);
    } catch (err) {
      logger.error('Invalid URL');
    }
  }

  /**
   * Updates URL with user's gist and loads from github.
   * @param {string} url Gist URL.
   */
  _loadFromGistURL(url) {
    try {
      url = new URL(url);

      if (url.origin !== 'https://gist.github.com') {
        logger.error('URL was not a gist');
        return;
      }

      const match = url.pathname.match(/[a-f0-9]{5,}/);
      if (match) {
        history.pushState({}, null, `${APP_URL}?gist=${match[0]}`);
        this.loadFromDeepLink();
      }
    } catch (err) {
      logger.error('Invalid URL');
    }
  }

  /*
   * Initializes of a `message` listener to respond to postMessage events.
   */
  listenForMessages() {
    window.addEventListener('message', e => {
      if (e.source === self.opener && e.data.lhresults) {
        this.replaceReportHTML(e.data.lhresults);
        ga('send', 'event', 'report', 'open in viewer');
      }
    });

    // If the page was opened as a popup, tell the opening window we're ready.
    if (self.opener && !self.opener.closed) {
      self.opener.postMessage({opened: true}, '*');
    }
  }
}

module.exports = LighthouseViewerReport;
