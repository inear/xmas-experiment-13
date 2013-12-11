var settings = require('./settings');

function SettingsUI(){
  var gui = new DAT.GUI();
  DAT.GUI.autoPlace = false;

  $("#uiContainer").append(gui.domElement);

  gui.add(settings, 'ballRadius').min(5).max(100.12);

  gui.add(settings, 'ballScale').min(1).max(10);
}

module.exports = SettingsUI;