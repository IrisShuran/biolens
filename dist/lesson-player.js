/* Shared finite lesson timeline; rendering and scientific content belong to each lesson. */
window.LessonPlayer=class LessonPlayer{
 constructor({count,interval=2400,onStep,onPlay=()=>{}}){this.count=count;this.interval=interval;this.onStep=onStep;this.onPlay=onPlay;this.index=0;this.timer=null}
 seek(index){this.pause();this.index=Math.max(0,Math.min(this.count-1,index));this.onStep(this.index)}
 next(){this.seek((this.index+1)%this.count)}
 previous(){this.seek(this.index-1)}
 play(){if(this.timer!==null){this.pause();return}if(this.index===this.count-1)this.seek(0);this.onPlay(true);this.timer=setInterval(()=>{this.index++;this.onStep(this.index);if(this.index===this.count-1)this.pause()},this.interval)}
 pause(){if(this.timer!==null)clearInterval(this.timer);this.timer=null;this.onPlay(false)}
};
