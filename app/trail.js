module.exports = Trail;

function Trail(){
  this.el = document.getElementById('c');

  this.ctx = this.el.getContext('2d');
  this.ctx.lineJoin = this.ctx.lineCap = 'round';

  this.ctx.fillStyle = 'white';
  this.ctx.fillRect(0, 0, this.el.width, this.el.height);

  this.isDrawing;
  this.lastPoint = {x:512,y:512};
}

var p = Trail.prototype;

p.update = function(x,y) {

  var currentPoint = { x: x, y: y };
  var dist = distanceBetween(this.lastPoint, currentPoint);
  var angle = angleBetween(this.lastPoint, currentPoint);

  var interpolateX,interpolateY;
  for (var i = 0; i < dist; i+=5) {

    interpolateX = this.lastPoint.x + (Math.sin(angle) * i);
    interpolateY = this.lastPoint.y + (Math.cos(angle) * i);

    var radgrad = this.ctx.createRadialGradient(interpolateX,interpolateY,12,interpolateX,interpolateY,20);

    radgrad.addColorStop(0, 'rgba(0,0,0,0.6)');
    radgrad.addColorStop(0.1, 'rgba(0,0,0,0.3)');
    radgrad.addColorStop(1, 'rgba(255,255,255,0)');

    this.ctx.fillStyle = radgrad;
    this.ctx.fillRect(interpolateX-20, interpolateY-20, 40, 40);
  }

  this.lastPoint = currentPoint;
}

function distanceBetween(point1, point2) {
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
}
function angleBetween(point1, point2) {
  return Math.atan2( point2.x - point1.x, point2.y - point1.y );
}