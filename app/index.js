'use strict';
var debug = require('debug');

debug.enable('*');
debug('app:')('debug is enabled');

var Builder = require('./builder.js');


$(function() {
  var builder = new Builder();
  builder.init();
});

