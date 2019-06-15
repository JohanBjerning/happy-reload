/* eslint no-console:0 */
const asyncHandler = require('express-async-handler');
const reload = require('./reload');
var WebSocketServer = require('websocket').server;
var mysql = require('mysql');
const configuration = require('./config');
var dateFormat = require('dateformat');

var http = require('http');
var clients = [ ];

var server = http.createServer(function(request, response) {
});
server.listen(1337, function() { console.log("Listening 1337")});

wsServer = new WebSocketServer({
  httpServer: server
});

// WebSocket server
wsServer.on('request', function(request) {
  var connection = request.accept(null, request.origin);
  var index = clients.push(connection) - 1;

  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      // process WebSocket message
    }
  });

  connection.on('close', function(connection) {
    // close user connection
    clients.splice(index, 1);
  });
});

function sendMessage(message) {
    var obj = {
        time: (new Date()).getTime(),
        button: message,
    };
    var json = JSON.stringify({ type:'message', data: obj });
    for (var i=0; i < clients.length; i++) {
        clients[i].sendUTF(json);
    }  
}

module.exports.sendMessage = sendMessage;

var express = require("express");
var app = express();

app.get('/reload', asyncHandler(async (req, res, next) => {
    test = await reload.setupAndReload(true);
    res.send(test);
}))

app.put('/create/app', asyncHandler(async (req, res, next) => {
  var state = req.params.state;
  sendMessage(state);

  await reload.createApp().catch((err) => console.log(err));
  return res.status(201).send({
      success: 'true',
      message: 'added successfully',
      state
  })
}))

app.put('/add/mood/:state', asyncHandler(async (req, res, next) => {
    var state = req.params.state;
    if (!state.match(/^(happy|sad|content)$/)) {
        return res.status(400).send({
            success: 'false',
            message: 'Not supported value',
            state
          })
    }
    sendMessage(state);

    var con = mysql.createConnection({
        host: configuration.connection.MySQLHost,
        user: configuration.connection.MySQLUser,
        password: configuration.connection.MySQLPass,
        database: configuration.connection.MySQLDatabase
    });

    con.connect(function(err) {
        if (err) throw err;
        var now=dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
        var sql = "INSERT INTO happy (happiness, timestamp) VALUES ?";
        var values = [[state, now]];
        con.query(sql, [values], function (err, result) {
            if (err) throw err;
            con.end();
        });
    });
    await reload.setupAndReload(true).catch((err) => console.log(err));
    return res.status(201).send({
        success: 'true',
        message: 'added successfully',
        state
      })
}))
   
app.listen(3002, () => {
 console.log("Server running on port 3002");
});

