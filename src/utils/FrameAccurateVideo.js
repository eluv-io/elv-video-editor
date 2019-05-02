import Fraction from "fraction.js";

export const FrameRates = {
  NTSC: Fraction(30000).div(1001),
  NTSCFilm: Fraction(24000).div(1001),
  NTSCHD: Fraction(60000).div(1001),
  PAL: Fraction(25),
  PALHD: Fraction(50),
  Film: Fraction(24),
  Web: Fraction(30),
  High: Fraction(60)
};

class FrameAccurateVideo {
  constructor({video, frameRate, dropFrame=false, callback}) {
    this.video = video;
    this.frameRate = frameRate || FrameRates.NTSC;
    this.dropFrame = dropFrame && (frameRate.equals(FrameRates.NTSC) || frameRate.equals(FrameRates.NTSC_HD));
    this.callback = callback;

    if(callback) {
      this.RegisterCallback();
    }

    this.Update = this.Update.bind(this);
  }

  /* Time representations */

  Frame() {
    return Fraction(this.video.currentTime).mul(this.frameRate);
  }

  Pad(fraction) {
    fraction = fraction.valueOf();
    return fraction < 10 ? `0${fraction}` : fraction;
  }

  SMPTE() {
    let frame = this.Frame().floor();
    const frameRate = this.frameRate.round();

    if(this.dropFrame) {
      const framesPerMinute = this.frameRate.equals(FrameRates.NTSCHD) ? Fraction(4) : Fraction(2);
      const tenMinutes = Fraction("17982").mul(framesPerMinute).div(2);
      const oneMinute = Fraction("1798").mul(framesPerMinute).div(2);

      const tenMinuteIntervals = frame.div(tenMinutes).floor();
      let framesSinceLastInterval = frame.mod(tenMinutes);

      // If framesSinceLastInterval < framesPerMinute
      if(framesSinceLastInterval.compare(framesPerMinute) < 0) {
        // This is where the jump from :59:29 -> :00:02 or :59:59 -> :00:04 happens
        framesSinceLastInterval = framesSinceLastInterval.add(framesPerMinute);
      }

      frame = frame.add(
        framesPerMinute.mul(tenMinuteIntervals).mul("9").add(
          framesPerMinute.mul((framesSinceLastInterval.sub(framesPerMinute)).div(oneMinute).floor())
        )
      );
    }

    const hours = frame.div(frameRate.mul(3600)).mod(24).floor();
    const minutes = frame.div(frameRate.mul(60)).mod(60).floor();
    const seconds = frame.div(frameRate).mod(60).floor();
    const frames = frame.mod(frameRate).floor();

    return `${this.Pad(hours)}:${this.Pad(minutes)}:${this.Pad(seconds)}:${this.Pad(frames)}`;
  }

  Progress() {
    return Fraction(this.video.currentTime).div(this.video.duration);
  }

  /* Controls */

  SeekForward(frames=1) {
    const frame = this.Frame();
    this.Seek(frame.add(frames));
  }

  SeekBackward(frames=1) {
    const frame = Fraction(this.Frame());
    this.Seek(frame.sub(frames));
  }

  SeekPercentage(percent) {
    const totalFrames = Fraction(this.video.duration).mul(this.frameRate);
    this.Seek(totalFrames.mul(percent));
  }

  Seek(frame) {
    if(!this.video.paused) { this.video.pause(); }

    // Whenever seeking, stop comfortably in the middle of a frame
    frame = Fraction(frame).floor().add(0.5);

    this.video.currentTime = frame.div(this.frameRate).valueOf();
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
    this.video.onpause = () => {
      this.Seek(this.Frame().add(this.frameRate.valueOf() > 30 ? 2 : 1));
      this.RemoveListener();
    };

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
    // Call twice per frame - possible range 10hz - 100hz
    const fps = Fraction(1.0).mul(this.frameRate);
    const interval = Math.min(Math.max(Fraction(1000).div(fps).div(2).valueOf(), 10), 100);

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
