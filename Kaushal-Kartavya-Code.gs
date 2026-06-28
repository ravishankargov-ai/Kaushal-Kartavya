// ============================================================
//  Kaushal Kartavya — Google Apps Script Backend
//  Skill Development & Employment Department, Uttarakhand
//
//  SETUP INSTRUCTIONS (do this on a DESKTOP/LAPTOP, not iPad):
//  1. Go to script.google.com -> New Project
//  2. Delete existing code -> Paste this entire file
//  3. Click Deploy -> New Deployment -> Web App
//  4. Execute as: Me | Who has access: Anyone
//  5. Click Deploy -> Authorize -> Copy the Web App URL
//  6. Paste that URL into the Kaushal Kartavya app when prompted
// ============================================================

const SHEET_NAME = 'UKSDSTasks';
const LOG_NAME   = 'ActivityLog';

function getSpreadsheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch(e) {}
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');
  if (ssId) {
    try { return SpreadsheetApp.openById(ssId); } catch(e) {}
  }
  const ss = SpreadsheetApp.create('Kaushal Kartavya — Data (Skill Dev & Employment Dept, Uttarakhand)');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    const action = (e.parameter && e.parameter.action) || '';
    const id     = (e.parameter && e.parameter.id) || '';
    let body = {};
    if (e.parameter && e.parameter.payload) {
      try { body = JSON.parse(e.parameter.payload); } catch(x) {}
    } else if (e.postData) {
      try { body = JSON.parse(e.postData.contents || '{}'); } catch(x) {}
    }
    let result;
    switch (action) {
      case 'getTasks':   result = getTasks();                  break;
      case 'saveTask':   result = saveTask(body.task || body); break;
      case 'deleteTask': result = deleteTask(id || body.id);   break;
      case 'ping':       result = { ok: true, app: 'Kaushal Kartavya', version: 1 }; break;
      default:           result = { error: 'Unknown action: ' + action };
    }
    return buildResponse(result);
  } catch (err) {
    return buildResponse({ error: err.message });
  }
}

function buildResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  const ss  = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#1a4f8a').setFontColor('#ffffff')
        .setFontWeight('bold').setFontSize(11);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
    }
  }
  return sheet;
}

function getTasksSheet() {
  return getOrCreateSheet(SHEET_NAME, [
    'id','title','workstream','priority','status','due',
    'officer','duration','notes','done','created','completedDate','subtasks'
  ]);
}

function getLogSheet() {
  return getOrCreateSheet(LOG_NAME, ['timestamp','userEmail','action','taskId','taskTitle']);
}

function getTasks() {
  const sheet = getTasksSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { tasks: [] };
  const headers = data[0];
  const tasks = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    try { obj.subtasks = obj.subtasks ? JSON.parse(obj.subtasks) : []; }
    catch (e) { obj.subtasks = []; }
    obj.done = (obj.done === true || obj.done === 'TRUE' || obj.done === 'true');
    if (obj.due instanceof Date) obj.due = Utilities.formatDate(obj.due, 'Asia/Kolkata', 'yyyy-MM-dd');
    if (obj.created instanceof Date) obj.created = Utilities.formatDate(obj.created, 'Asia/Kolkata', 'yyyy-MM-dd');
    if (obj.completedDate instanceof Date) obj.completedDate = Utilities.formatDate(obj.completedDate, 'Asia/Kolkata', 'yyyy-MM-dd');
    return obj;
  });
  return { tasks };
}

function saveTask(task) {
  if (!task || !task.id) return { error: 'No task data provided' };
  const sheet   = getTasksSheet();
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const row = headers.map(h => {
    if (h === 'subtasks') return JSON.stringify(task[h] || []);
    if (h === 'done')     return task[h] ? 'TRUE' : 'FALSE';
    return (task[h] !== undefined && task[h] !== null) ? String(task[h]) : '';
  });
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(task.id)) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      found = true; break;
    }
  }
  if (!found) sheet.appendRow(row);
  applyPriorityColour(sheet, task);
  logActivity('save', task.id, task.title || '');
  return { ok: true, id: task.id };
}

function deleteTask(id) {
  if (!id) return { error: 'No task ID provided' };
  const sheet = getTasksSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      logActivity('delete', id, '');
      return { ok: true };
    }
  }
  return { error: 'Task not found' };
}

function applyPriorityColour(sheet, task) {
  const colours = {
    critical:'#fdf2f1', high:'#fdf5f0', medium:'#fdfbf0', low:'#f0faf5', info:'#f0f6fc'
  };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(task.id)) {
      sheet.getRange(i + 1, 1, 1, data[0].length)
        .setBackground(colours[task.priority] || '#ffffff');
      break;
    }
  }
}

function logActivity(action, taskId, taskTitle) {
  try {
    const log  = getLogSheet();
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    log.appendRow([new Date(), user, action, taskId, taskTitle]);
  } catch(e) {}
}

function setupSheets() {
  const ss = getSpreadsheet();
  getTasksSheet();
  getLogSheet();
  Logger.log('UKSDS Tasks spreadsheet URL: ' + ss.getUrl());
  try {
    ss.toast('Kaushal Kartavya is ready!', 'Setup Complete', 8);
  } catch(e) {}
  return { ok: true, spreadsheetUrl: ss.getUrl() };
}
