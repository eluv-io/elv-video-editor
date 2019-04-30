import Fraction from "fraction.js";

export const FrameRates = {
  film: Fraction(24),
  NTSC : Fraction(30000).div(1001),
  NTSC_Film: Fraction(24000).div(1001),
  NTSC_HD : Fraction(60000).div(1001),
  PAL: Fraction(25),
  PAL_HD: Fraction(50),
  web: Fraction(30),
  high: Fraction(60)
};

class FrameAccurateVideo {
  constructor({video, frameRate, callback}) {
    this.video = video;
    this.frameRate = frameRate || FrameRates.NTSC;
    this.callback = callback;

    if(callback) {
      this.RegisterCallback();
    }

    this.Update = this.Update.bind(this);
  }

  /* Time representations */

  Frame() {
    return Fraction(this.video.currentTime).mul(this.frameRate).round().toString(0);
  }

  SMPTE() {
    const frame = Fraction(this.Frame());
    const second = Fraction(this.frameRate);
    const minute = second.mul(60);
    const hour = minute.mul(60);

    const hours = frame.div(hour).floor();
    const minutes = frame.div(minute).mod(60).floor();
    const seconds = frame.div(second).mod(60).floor();
    const frames = frame.mod(this.frameRate).round();

    const pad = (fraction) => {
      fraction = fraction.valueOf();
      return fraction < 10 ? `0${fraction}` : fraction;
    };

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
  }

  Progress() {
    return Fraction(this.video.currentTime).div(this.video.duration);
  }

  /* Controls */

  SeekForward(frames=1) {
    const frame = Fraction(this.Frame());
    this.Seek(frame.add(frames));
  }

  SeekBackward(frames=1) {
    const frame = Fraction(this.Frame());
    this.Seek(frame.sub(frames));
  }

  SeekPercentage(percent) {
    this.video.currentTime = Fraction(percent).mul(this.video.duration).valueOf();
  }

  Seek(frame) {
    if(!this.video.paused) { this.video.pause(); }

    this.video.currentTime = Fraction(frame).div(this.frameRate).valueOf();
  }

  /* Callbacks */

  Update() {
    if(this.callback) {
      this.callback({
        frame: this.Frame(),
        smpte: this.SMPTE(),
        progress: this.Progress()
      });
    }
  }

  RegisterCallback() {
    this.Update();

    this.video.onseeked = (event) => this.Update(event);
    this.video.onseeking = (event) => this.Update(event);
    this.video.onplay = () => this.AddListener();
    this.video.onpause = () => this.RemoveListener();
    this.video.onended = () => this.RemoveListener();
    this.video.onratechange = () => {
      // Update listener rate
      if(this.listener) {
        this.RemoveListener();
        this.AddListener();
      }
    };
  }

  RemoveCallback() {
    this.video.onseeked = undefined;
    this.video.onseeking = undefined;
    this.video.onplay = undefined;
    this.video.onpause = undefined;
    this.video.onended = undefined;
    this.video.onratechange = undefined;
  }

  AddListener() {
    // Call twice per frame
    const fps = Fraction(this.video.playbackRate || 1.0).mul(this.frameRate);
    const interval = Fraction(1000).div(fps).div(2);

    this.listener = setInterval(() => {
      if(this.video.paused || this.video.ended) {
        return;
      }

      this.Update();
    }, interval);
  }

  RemoveListener() {
    if(this.listener) {
      clearInterval(this.listener);
    }

    this.Update();
  }
}

export default FrameAccurateVideo;
