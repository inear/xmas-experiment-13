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

var snowBallGeo = new THREE.IcosahedronGeometry(this.ballRadius,3);
snowBallGeo.isDynamic = true;

var vertices = snowBallGeo.vertices;
var vertex;
for (var i = vertices.length - 1; i >= 0; i--) {
  vertex = vertices[i];
  vertex.offset = new THREE.Vector3();
  vertex.offset.y = Math.random()*4-2;
  vertex.offset.x = Math.random()*4-2;
  vertex.offset.z = Math.random()*4-2;
};

function Ball( scene) {
  this.id = "ball_" + STATIC_ID++
  this.groundSize = {width:2000,height:2000};
  this.scene = scene;
  this.up = new THREE.Vector3(0,1,0);
  this.moveDir = new THREE.Vector3();
  this._prevSnowBallPos = new THREE.Vector3();
  this.velocity = new THREE.Vector3();
  this.colliding = false;
  this.ballRadius = 1;
  this.ballOffsetY = 0;
  this._positionDirty = false;



  this.snowballMaterial = new THREE.MeshPhongMaterial({ map:ballMap,perPixel:true, color: 0xeeeeee, ambient:0xeeeeee, bumpMap: ballBumpMap, bumpScale:3, specularMap: reflectionMap, specular:0x999999,shininess:4 });

  var snowBall = new THREE.Mesh( snowBallGeo.clone(), this.snowballMaterial);
  var vertices = snowBall.geometry.vertices;
  var vertex;
  for (var i = vertices.length - 1; i >= 0; i--) {
    vertex = vertices[i];
    vertex.offset = snowBallGeo.vertices[i].offset.clone();
  }

  snowBall.castShadow = true;
  snowBall.receiveShadow = false;
  snowBall.position.y = 40;

  this.scene.add(snowBall);

  TweenMax.fromTo( this,1.7,{ballOffsetY:10},{ballOffsetY:0});

  this.mesh = snowBall;
  this.mesh.id = this.id;
  this.mesh.parentObject = this;

  return this;
}

var p = Ball.prototype;
Emitter(p);

p.steerWithMouse =  function( mousePoint  ){

  var rotateSpeedFactor = 70/100*(100-this.ballRadius);
  this.velocity.x += (mousePoint.x*3.5 - this.velocity.x)/rotateSpeedFactor;
  this.velocity.z += (mousePoint.y*3.5 - this.velocity.z)/rotateSpeedFactor;

  this._positionDirty = true;

}

p.steerWithKeyboard =  function( keyboardStatus ){

  if( keyboardStatus['left'] ) {
    this.velocity.x -= 0.1;
  }

  if( keyboardStatus['right'] ) {
    this.velocity.x += 0.1;
  }

  if( keyboardStatus['up'] ) {
    this.velocity.z -= 0.1;
  }

  if( keyboardStatus['down'] ) {
    this.velocity.z += 0.1;
  }

  this.velocity.set(Math.max(-2,Math.min(2,this.velocity.x)),0,Math.max(-2,Math.min(2,this.velocity.z)));

  //this.velocity.set(this.velocity.x,0,this.velocity.z);

  this._positionDirty = true;

}

p.updateCollision = function(balls){

  if(
    ((this.mesh.position.x+this.velocity.x > 900-this.ballRadius) && this.velocity.x>0)||
    ((this.mesh.position.x+this.velocity.x < -900+this.ballRadius) && this.velocity.x<0)||
    ((this.mesh.position.z+this.velocity.z > 900-this.ballRadius) && this.velocity.z>0)||
    ((this.mesh.position.z+this.velocity.z < -900+this.ballRadius) && this.velocity.z<0)
  ) {
    this.colliding = true;
    return;
  }

  if( balls.length <= 1 ) {
    this.colliding = false;
    return;
  }

  var isMovable = true;
  for (var i = balls.length-1; i >= 0; i--) {
    if( this.id !== balls[i].id ) {
      isMovable = this._canMove(this, balls[i]);

      if (!isMovable) {
        this.velocity.multiplyScalar(0.7);
        this.colliding = true;
        return;
      }
    }
  }

  this.colliding = false;
}

p._canMove = function(ballA, ballB) {
  var testPointA = ballA.mesh.position.clone().add( this.velocity );
  var distance = testPointA.distanceTo(ballB.mesh.position) - ballA.ballRadius - ballB.ballRadius;

  if (distance >= 0) {
    return true;
  }

  return false;
}

p.update = function(){

  var snowBall = this.mesh;
  var rotateAmountFactor = 0.05*(80-this.ballRadius)/40;

  if( !this._positionDirty ) {
    this.velocity.multiplyScalar(0.9);
  }
  else {
    this._positionDirty = false;
  }

  this.moveDir.set(-this.velocity.x, 0, -this.velocity.z);

  var rotationDir = new THREE.Vector3().crossVectors(this.moveDir, this.up);
  var amount = Math.sqrt( this.velocity.x*rotateAmountFactor * this.velocity.x*rotateAmountFactor + this.velocity.z*rotateAmountFactor * this.velocity.z*rotateAmountFactor);

  this._rotateAroundWorldAxis( snowBall, rotationDir,amount)

  if( !this.colliding ) {
    snowBall.position.add( this.velocity );
  }

  if( snowBall.position.distanceTo(this._prevSnowBallPos ) > 0.3 ) {

    //this._spawnSnowChunk();

    if( this.ballRadius < 35 && this.ballOffsetY === 0) {
      this.ballRadius += 0.03;
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


      //vertex.setLength(this.ballRadius + Math.random()*2.3);
      //vertex.setLength(this.ballRadius-vertex.offset.y*this.ballRadius/60);
      vertex.setLength(this.ballRadius-vertex.offset.y*this.ballRadius/60);

    /*}
    else if( vertex.hasUpdated && worldVector.y > 5 ) {
      vertex.hasUpdated = false;
    }*/
   /* vertex.y += Math.random()*15-7.5;
    vertex.x += Math.random()*15-7.5;
    vertex.z += Math.random()*15-7.5;*/
  };
  snowBall.geometry.verticesNeedUpdate = true;
  snowBall.geometry.computeBoundingSphere()
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