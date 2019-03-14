/* eslint no-console:0 */
const WebSocket = require('ws');
const enigma = require('enigma.js');
const schema = require('enigma.js/schemas/3.2.json');
const Table = require('easy-table');
const fs = require('fs');
const path = require('path');

const host =  //process.env.TEST_HOST || 'localhost';

async function openSessionApp() {
  const session = enigma.create({
    schema,
    url: `ws://${host}:19076/app/engineData`,
    createSocket: url => new WebSocket(url),
  });
  const qix = await session.open();
  const app = await qix.createSessionApp();
  await qix.configureReload(true, true, false);
  console.log('Session opened.\n');
  return { session, qix, app };
}

const mysqlConnectionSettings = {

  };

async function createConnection(app, name, connectionString, type) {
  await app.createConnection(mysqlConnectionSettings);
}

const script2 = `
SET DateFormat='YYYY-MM-DD';

lib connect to 'jdbc';
happy:
LOAD
Date(timestamp) as HappinessDate,
Hour(TimeStamp(Round(timestamp, 1/24))) As Hour,
happiness as Happiness;
sql SELECT * FROM happy;
`;


async function setScriptAndDoReload(qix, app, script) {
  await app.setScript(script2);
  await app.doReload();

  const progress = await qix.getProgress(0);
  if (progress.qErrorData.length !== 0) {
    const result = await app.checkScriptSyntax();
    if (result.length !== 0) {
      console.log(result[0]);
    }
    console.log(progress.qErrorData[0]);
  }

  return progress.qErrorData.length === 0;
}

async function getTables(app) {
  const tablesAndKeys = await app.getTablesAndKeys(
    { qcx: 1000, qcy: 1000 },
    { qcx: 0, qcy: 0 },
    30,
    true,
    false,
  );
  return tablesAndKeys.qtr;
}

async function printTable(app, table) {
  const easyTable = new Table();
  console.log('==========');
  console.log(table.qName);
  console.log('----------');
  const data = await app.getTableData(0, 100, true, table.qName);
  for (let index = 0; index < data.length; index += 1) {
    const row = data[index];
    table.qFields.forEach((field, idx) => {
      easyTable.cell(field.qName, row.qValue[idx].qText);
    });
    easyTable.newRow();
  }
  console.log(easyTable.toString());
}

async function printTables(app) {
  const tables = await getTables(app);

  const results = [];

  tables.forEach((table) => {
    results.push(printTable(app, table));
  });

  await Promise.all(results);
}

async function closeSession(session) {
  await session.close();
  console.log('Session closed.');
}

async function setupAndReload(scriptPath, printOutput) {
  const script = script2;
  const { session, qix, app } = await openSessionApp(script2);
  await createConnection(app, mysqlConnectionSettings.qName, mysqlConnectionSettings.qConnectionString, mysqlConnectionSettings.qType);
  const reloadOK = await setScriptAndDoReload(qix, app, script);

  if (printOutput) {
    await printTables(app);
  }

  await closeSession(session);

  return reloadOK;
}

module.exports.setupAndReload = setupAndReload;