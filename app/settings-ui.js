'use strict';

var settings = require('./settings');

function SettingsUI(){
  var gui = new DAT.GUI();
  DAT.GUI.autoPlace = false;

  $("#uiContainer").append(gui.domElement);

  gui.add(settings, 'ballRadius').min(5).max(80).listen();

  gui.add(settings, 'ballScale').min(0.2).max(3);
}

module.exports = SettingsUI;