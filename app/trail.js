"use strict";

module.exports = Trail;

function Trail(){

  this.el = document.getElementById('c');
  this.prevID = -2;

  this.ctx = this.el.getContext('2d');
  this.ctx.lineJoin = this.ctx.lineCap = 'round';

  this.ctx.fillStyle = 'white';
  this.ctx.fillRect(0, 0, this.el.width, this.el.height);

  this.isDrawing;
  this.prevPoint = new THREE.Vector2(512,512);
  this.currentPoint = new THREE.Vector2(512,512);
}

var p = Trail.prototype;

p.update = function(id,x,y,radius) {

  //if new point, don't interpolate
  if( id != this.prevID ) {
    this.prevPoint.set(x,y);
  }

  this.currentPoint.set(x,y);
  var dist = this.prevPoint.distanceTo(this.currentPoint);
  var angle = angleBetween(this.prevPoint, this.currentPoint);

  this.radius = radius+2;


  var interpolateX,interpolateY;
  for (var i = 0; i < dist; i+=3) {

    interpolateX = this.prevPoint.x + (Math.sin(angle) * i);
    interpolateY = this.prevPoint.y + (Math.cos(angle) * i);

    var radgrad = this.ctx.createRadialGradient(interpolateX,interpolateY,this.radius*0.45,interpolateX,interpolateY,this.radius);
    var pressure = 255 - Math.floor(55 + 200*this.radius/60);
    var lastColor = 255;// - Math.floor(255*this.radius/40);
    radgrad.addColorStop(0, 'rgba('+pressure+','+pressure+','+pressure+',0.3)');
    radgrad.addColorStop(0.2, 'rgba('+pressure+','+pressure+','+pressure+',0.6)');
    radgrad.addColorStop(1, 'rgba('+lastColor+','+lastColor+','+lastColor+',0)');

    this.ctx.fillStyle = radgrad;
    this.ctx.fillRect(interpolateX-20, interpolateY-20, 40, 40);
  }

  this.prevID = id;
  this.prevPoint.copy(this.currentPoint);
}

p.makeRoomForSnowman = function( power ){

  var radgrad = this.ctx.createRadialGradient(512,512,10+20*power,512,512,20 + 20*power);
  var pressure = 170;// - Math.floor(55 + 200*this.radius/60);
  var lastColor = 255;// - Math.floor(255*this.radius/40);
  radgrad.addColorStop(0, 'rgba('+pressure+','+pressure+','+pressure+',0.3)');
  radgrad.addColorStop(0.8, 'rgba('+pressure+','+pressure+','+pressure+',0.6)');
  radgrad.addColorStop(1, 'rgba('+lastColor+','+lastColor+','+lastColor+',0)');

  this.ctx.fillStyle = radgrad;
  this.ctx.fillRect(512-60 - 40*power, 512-60-40*power , 120+ 80*power, 120 + 80*power);

  this.ctx.fillStyle = 'rgba(170,170,170,0.6)';
  this.ctx.lineWidth = 20;
  this.ctx.strokeStyle = 'rgba(170,170,170,0.6)';
  this.ctx.font = "bold 70px Calibri";
  this.ctx.fillText("MERRY CHRISTMAS", 212, 612);
}


function angleBetween(point1, point2) {
  return Math.atan2( point2.x - point1.x, point2.y - point1.y );
}