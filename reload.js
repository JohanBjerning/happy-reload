/* eslint no-console:0 */
const WebSocket = require('ws');
const enigma = require('enigma.js');
const schema = require('enigma.js/schemas/3.2.json');
const Table = require('easy-table');
const fs = require('fs');
const path = require('path');
const configuration = require('./config');

async function openSessionApp() {
  const session = enigma.create({
    schema,
    url: `ws://${configuration.connection.engineUrl}/app/engineData`,
    createSocket: url => new WebSocket(url),
  });
  const qix = await session.open(); 
  const app = await qix.openDoc(configuration.connection.appName);
  await qix.configureReload(true, true, false);
  console.log('Session opened.\n');
  return { session, qix, app };
}

const mysqlConnectionSettings = {
    qType: 'jdbc', // the name we defined as a parameter to engine in our docker-compose.yml
    qName: 'jdbc',
    qConnectionString: configuration.connection.MySQLConnectionString, // the connection string includes both the provide to use and parameters to it.
    qUserName: configuration.connection.MySQLUser,
    qPassword: configuration.connection.MySQLPass,
  };

async function createConnection(app, name, connectionString, type) {
  await app.createConnection(mysqlConnectionSettings);
}

async function setScriptAndDoReload(qix, app, script) {
  await app.setScript(script);
  await app.doReload();

  const progress = await qix.getProgress(0);
  if (progress.qErrorData.length !== 0) {
    const result = await app.checkScriptSyntax();
    if (result.length !== 0) {
      console.log(result[0]);
    }
    console.log(progress.qErrorData[0]);
  }
  app.doSave();

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
  const tablesandkeys = await app.getTablesAndKeys({}, {}, 0, true, false);
  console.log(tablesandkeys.qtr[0].qNoOfRows);
  const data = await app.getTableData(tablesandkeys.qtr[0].qNoOfRows - 1, 1, true, table.qName);

  console.log(tablesandkeys);
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

async function setupAndReload(printOutput) {
  const { session, qix, app } = await openSessionApp();
  //await createConnection(app, mysqlConnectionSettings.qName, mysqlConnectionSettings.qConnectionString, mysqlConnectionSettings.qType);
  const reloadOK = await setScriptAndDoReload(qix, app, configuration.script);

  if (printOutput) {
    await printTables(app);
  }

  await closeSession(session);

  return reloadOK;
}

module.exports.setupAndReload = setupAndReload;