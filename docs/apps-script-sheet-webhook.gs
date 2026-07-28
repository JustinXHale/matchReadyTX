/**
 * Sample Apps Script to push Sheet edits to MatchReadyTX sheetWebhook.
 * Deploy as web app is not required — use UrlFetchApp to your Cloud Function URL.
 *
 * Bind to the schedule spreadsheet. Set SCRIPT properties:
 *   WEBHOOK_URL, WEBHOOK_SECRET, ORG_ID
 */
function onEdit(e) {
  pushSchedule();
}

function timedSync() {
  pushSchedule();
}

function pushSchedule() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('WEBHOOK_SECRET');
  const orgId = props.getProperty('ORG_ID');
  if (!url) return;

  const sheet = SpreadsheetApp.getActive().getSheetByName('Schedule');
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const rows = values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-webhook-secret': secret || '' },
    payload: JSON.stringify({ orgId: orgId, rows: rows }),
    muteHttpExceptions: true,
  });
}
