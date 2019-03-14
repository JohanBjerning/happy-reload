/* eslint no-console:0 */
const asyncHandler = require('express-async-handler');
const reload = require('./reload');

var express = require("express");
var app = express();

app.get('/reload', asyncHandler(async (req, res, next) => {
    test = await reload.setupAndReload("", true);
    res.send(test);
}))
   
app.listen(3001, () => {
 console.log("Server running on port 3001");
});