module.exports = Ball;

var Emitter = require('emitter');

var reflectionMap = THREE.ImageUtils.loadTexture('assets/images/snow-reflection2.jpg');
reflectionMap.repeat.x = reflectionMap.repeat.y = 4
reflectionMap.wrapT = reflectionMap.wrapS = THREE.RepeatWrapping;

var ballMap = THREE.ImageUtils.loadTexture('assets/images/snow-diffuse-spherical3.jpg');
ballMap.magFilter = ballMap.minFilter = THREE.LinearFilter;

var ballBumpMap = THREE.ImageUtils.loadTexture('assets/images/ball-bump-spherical.jpg');
ballBumpMap.repeat.x = ballBumpMap.repeat.y = 1;
ballBumpMap.magFilter = ballBumpMap.minFilter = THREE.LinearFilter;
ballBumpMap.wrapT = ballBumpMap.wrapS = THREE.RepeatWrapping;

var STATIC_ID = -1;

function Ball( scene ) {
  this.id = STATIC_ID++
  this.groundSize = {width:2000,height:2000};
  this.scene = scene;
  this.up = new THREE.Vector3(0,1,0);
  this.moveDir = new THREE.Vector3();
  this._prevSnowBallPos = new THREE.Vector3();
  this.momentumZ = 0;
  this.momentumX = 0;
  this.ballRadius = 1;
  this.ballOffsetY = 0;
  this._positionDirty = false;

  this.snowBallGeo = new THREE.IcosahedronGeometry(this.ballRadius,3);
  this.snowBallGeo.isDynamic = true;

  var vertices = this.snowBallGeo.vertices;
  var vertex;
  for (var i = vertices.length - 1; i >= 0; i--) {
    vertex = vertices[i];
    vertex.offset = new THREE.Vector3();
    vertex.offset.y = Math.random()*4-2;
    vertex.offset.x = Math.random()*4-2;
    vertex.offset.z = Math.random()*4-2;
  };

  this.snowballMaterial = new THREE.MeshPhongMaterial({ map:ballMap,perPixel:true, color: 0xeeeeee, ambient:0xffffff, bumpMap: ballBumpMap, bumpScale:3, specularMap: reflectionMap, specular:0xffffff,shininess:5 });


  var snowBall = new THREE.Mesh( this.snowBallGeo, this.snowballMaterial);
  snowBall.castShadow = true;
  snowBall.receiveShadow = false;
  snowBall.position.y = 40;

  this.scene.add(snowBall);

  TweenMax.fromTo( this,2.7,{ballRadius:5},{ballRadius:15});
  TweenMax.fromTo( this,2.7,{ballOffsetY:10},{ballOffsetY:0});

  this.mesh = snowBall;

  return this;
}

var p = Ball.prototype;
Emitter(p);

p.steerWithMouse =  function( mousePoint  ){

  var rotateSpeedFactor = 70/100*(100-this.ballRadius);
  this.momentumX += (mousePoint.x*2.5 - this.momentumX)/rotateSpeedFactor;
  this.momentumZ += (mousePoint.y*2.5 - this.momentumZ)/rotateSpeedFactor;

  this._positionDirty = true;

}

p.steerWithKeyboard =  function( keyboardStatus ){

  if( keyboardStatus['left'] ) {
    this.momentumX -= 0.1;
  }

  if( keyboardStatus['right'] ) {
    this.momentumX += 0.1;
  }

  if( keyboardStatus['up'] ) {
    this.momentumZ -= 0.1;
  }

  if( keyboardStatus['down'] ) {
    this.momentumZ += 0.1;
  }

  this.momentumZ = Math.max(-2,Math.min(2,this.momentumZ));
  this.momentumX = Math.max(-2,Math.min(2,this.momentumX));

  this._positionDirty = true;

}

p.update = function(){

  var snowBall = this.mesh;
  var rotateAmountFactor = 0.05*(80-this.ballRadius)/40;

  if( !this._positionDirty ) {
    this.momentumX *= 0.9
    this.momentumZ *= 0.9
  }
  else {
    this._positionDirty = false;
  }

  this.moveDir.set(-this.momentumX, 0, -this.momentumZ);

  var rotationDir = new THREE.Vector3().crossVectors(this.moveDir, this.up);
  var amount = Math.sqrt( this.momentumX*rotateAmountFactor * this.momentumX*rotateAmountFactor + this.momentumZ*rotateAmountFactor * this.momentumZ*rotateAmountFactor);

  this._rotateAroundWorldAxis( snowBall, rotationDir,amount)

  snowBall.position.x += this.momentumX;
  snowBall.position.z += this.momentumZ;

  if( snowBall.position.distanceTo(this._prevSnowBallPos ) > 0.3 ) {

    //this._spawnSnowChunk();

    if( this.ballRadius < 65 ) {
      this.ballRadius += 0.01;
    }
    this.emit("trailPositionUpdate",
      this.id,
      (snowBall.position.x/this.groundSize.width)*1024+512,
      (snowBall.position.z/this.groundSize.height)*1024 + 512,
      (this.ballRadius*0.75)/2000*1024
    );

  }

  this._prevSnowBallPos.copy(snowBall.position);

  var vertices = snowBall.geometry.vertices;
  var vertex, worldVector;
  for (var i = vertices.length - 1; i >= 0; i--) {
    vertex = vertices[i];

    worldVector = snowBall.localToWorld( vertex.clone() );

    //if( this.up.negate().dot( snowBall.position.clone().sub(worldVector).normalize()) < 0.2 ) {
    //if( (worldVector.y < snowBall.position.y - this.ballRadius + 10) || (vertex.length() < this.ballRadius-3) ) {

      vertex.hasUpdated = true;
      //vertex.setLength(this.ballRadius + Math.random()*2.3);
      vertex.setLength(this.ballRadius+vertex.offset.y*this.ballRadius/60);

    /*}
    else if( vertex.hasUpdated && worldVector.y > 5 ) {
      vertex.hasUpdated = false;
    }*/
   /* vertex.y += Math.random()*15-7.5;
    vertex.x += Math.random()*15-7.5;
    vertex.z += Math.random()*15-7.5;*/
  };
  snowBall.geometry.verticesNeedUpdate = true;
  //snowBall.geometry.computeFaceNormals();
  //snowBall.geometry.computeVertexNormals();


  this.snowballMaterial.bumpScale = 5*this.ballRadius/40;

  snowBall.position.y = this.ballOffsetY + this.ballRadius*2 - 20-40*this.ballRadius/40;
};


p._rotateAroundWorldAxis = function(object, axis, radians) {
  var rotWorldMatrix = new THREE.Matrix4();
  var euler = new THREE.Euler();
  rotWorldMatrix.makeRotationAxis(axis.normalize(), radians);
  rotWorldMatrix.multiply(object.matrix);
  object.matrix = rotWorldMatrix;

  object.rotation = euler.setFromRotationMatrix(object.matrix);
}