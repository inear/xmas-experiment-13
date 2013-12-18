module.exports = Sounds;

function Sounds() {
  this.ambientTrack = new Howl({
    urls: ['assets/audio/ambient-loop.m4a','assets/audio/ambient-loop.ogg','assets/audio/ambient-loop.mp3'],
    autoplay: true,
    loop: true
  });

  this.rollTrack = new Howl({
    urls: ['assets/audio/snow-loop.m4a','assets/audio/snow-loop.ogg','assets/audio/snow-loop.mp3'],
    autoplay: true,
    loop: true
  });
  this.rollTrack.volume(0);

}

Sounds.prototype.init = function(){
  this.ambientTrack.volume(0.2)
}

Sounds.prototype.setRollVolume = function(value) {
  this.rollTrack.volume(0.5*value);
}