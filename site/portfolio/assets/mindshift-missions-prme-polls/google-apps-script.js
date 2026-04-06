// ═══════════════════════════════════════════════════════════════════
// mindshift missions PPCS — Google Apps Script
//
// SETUP INSTRUCTIONS:
// 1. Go to https://script.google.com → New project
// 2. Replace the default Code.gs content with this entire file
// 3. Click Deploy → New deployment
// 4. Select type: "Web app"
// 5. Set "Execute as": Me
// 6. Set "Who has access": Anyone
// 7. Click Deploy, authorise when prompted
// 8. Copy the Web app URL
// 9. Paste it into app.js as the SHEET_ENDPOINT value
//
// The script auto-creates a "PPCS Engagement" spreadsheet on first
// request, then appends one row per submission.
// ═══════════════════════════════════════════════════════════════════

var SHEET_NAME = 'responses';
var SPREADSHEET_NAME = 'mindshift missions — PPCS engagement data';

function getOrCreateSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // spreadsheet was deleted — recreate
    }
  }

  var ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  props.setProperty('SPREADSHEET_ID', ss.getId());

  var sheet = ss.getActiveSheet();
  sheet.setName(SHEET_NAME);
  sheet.appendRow([
    'timestamp',
    'institutional_email',
    'poll_motivation',
    'poll_session_interest',
    'poll_teaching_approach',
    'poll_prme_familiarity',
    'poll_confidence'
  ]);

  // freeze header row
  sheet.setFrozenRows(1);

  // bold header
  sheet.getRange(1, 1, 1, 7).setFontWeight('bold');

  // auto-resize columns
  for (var i = 1; i <= 7; i++) {
    sheet.autoResizeColumn(i);
  }

  return ss;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = getOrCreateSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    var polls = data.polls || {};

    sheet.appendRow([
      new Date().toISOString(),
      data.institutionalEmail || '',
      (polls.motivation || {}).answer || '',
      (polls.session_interest || {}).answer || '',
      (polls.teaching_approach || {}).answer || '',
      (polls.prme_familiarity || {}).answer || '',
      (polls.confidence || {}).answer || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Allow GET for testing — returns spreadsheet URL
function doGet() {
  var ss = getOrCreateSpreadsheet();
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      spreadsheetUrl: ss.getUrl()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
