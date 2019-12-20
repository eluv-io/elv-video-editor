import Fraction from "fraction.js";

export const FrameRateNumerator = {
  NTSC: 1001,
  NTSCFilm: 1001,
  NTSCHD: 1001,
  PAL: 1,
  PALHD: 1,
  Film: 1,
  Web: 1,
  High: 1
};

export const FrameRateDenominator = {
  NTSC: 30000,
  NTSCFilm: 24000,
  NTSCHD: 60000,
  PAL: 25,
  PALHD: 50,
  Film: 24,
  Web: 30,
  High: 60
};

export const FrameRates = {
  NTSC: Fraction(FrameRateDenominator["NTSC"]).div(FrameRateNumerator["NTSC"]),
  NTSCFilm: Fraction(FrameRateDenominator["NTSCFilm"]).div(FrameRateNumerator["NTSC"]),
  NTSCHD: Fraction(FrameRateDenominator["NTSCHD"]).div(FrameRateNumerator["NTSCHD"]),
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

  static FractionToRateKey(input) {
    let rate = input;
    if(typeof input === "string") {
      if(input.includes("/")) {
        rate = input.split("/");
        rate = rate[0] / rate[1];
      } else {
        rate = parseFloat(input);
      }
    }

    switch(rate) {
      case 24:
        return "Film";
      case 25:
        return "PAL";
      case 30:
        return "Web";
      case 50:
        return "PALHD";
      case 60:
        return "High";
      default:
        if(Math.abs(24 - rate) < 0.1) {
          return "NTSCFilm";
        } else if(Math.abs(30 - rate) < 0.1) {
          return "NTSC";
        } else if(Math.abs(60 - rate) < 0.1) {
          return "NTSCHD";
        }

        // eslint-disable-next-line no-console
        console.error(`Unknown playback rate: ${input}`);
    }
  }

  /* Conversion utility methods */

  static ParseRat(str) {
    if(str.includes("/")) {
      const num = parseInt(str.split("/")[0]);
      const denom = parseInt(str.split("/")[1]);

      return Number((num / denom).toFixed(3));
    } else {
      return parseInt(str);
    }
  }

  FrameToRat(frame) {
    const rateKey = FrameAccurateVideo.FractionToRateKey(this.frameRate);
    return `${frame * FrameRateNumerator[rateKey]}/${FrameRateDenominator[rateKey]}`;
  }

  ProgressToTime(progress) {
    const duration = this.video.duration || 0;

    return Fraction(progress).mul(duration).valueOf();
  }

  ProgressToSMPTE(progress) {
    const duration = this.video.duration || 0;

    return this.TimeToSMPTE(Fraction(progress).mul(duration));
  }

  TimeToFrame(time) {
    return Fraction(time || 0).mul(this.frameRate).floor().valueOf();
  }

  TimeToSMPTE(time) {
    return this.SMPTE(this.TimeToFrame(time));
  }

  SMPTEToFrame(smpte) {
    const components = smpte.split(":").reverse();

    const frames = Fraction(components[0]);
    const seconds = Fraction(components[1]);
    const minutes = Fraction(components[2]);
    const hours = Fraction(components[3] || 0);

    let skippedFrames = 0;
    if(this.dropFrame) {
      const skippedFramesPerMinute = this.frameRate.equals(FrameRates.NTSCHD) ? Fraction(4) : Fraction(2);
      const totalMinutes = minutes.add(hours.mul(60));
      const tenMinutes = totalMinutes.div(10).floor();
      skippedFrames = totalMinutes.mul(skippedFramesPerMinute)
        .sub(tenMinutes.mul(skippedFramesPerMinute));
    }

    return frames
      .add(seconds.mul(this.frameRate.round()))
      .add(minutes.mul(this.frameRate.round()).mul(60))
      .add(hours.mul(this.frameRate.round()).mul(60).mul(60))
      .sub(skippedFrames)
      .valueOf();
  }

  SMPTEToTime(smpte) {
    const frame = this.SMPTEToFrame(smpte);

    return Fraction(frame).div(this.frameRate).valueOf();
  }

  /* Time Calculations */

  Frame() {
    return this.TimeToFrame(this.video.currentTime);
  }

  Pad(fraction) {
    fraction = fraction.valueOf();
    return fraction < 10 ? `0${fraction}` : fraction;
  }

  SMPTE(f) {
    let frame = (f ? Fraction(f) : Fraction(this.Frame())).floor();
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

    const lastColon = this.dropFrame ? ";" : ":";

    return `${this.Pad(hours)}:${this.Pad(minutes)}:${this.Pad(seconds)}${lastColon}${this.Pad(frames)}`;
  }

  Progress() {
    if(isNaN(this.video.duration)) { return Fraction(0); }

    return Fraction(this.video.currentTime).div(this.video.duration);
  }

  TotalFrames() {
    return Fraction(this.video.duration || 0).mul(this.frameRate).valueOf();
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
    this.Seek(Fraction(this.TotalFrames()).mul(percent));
  }

  Seek(frame) {
    // Whenever seeking, stop comfortably in the middle of a frame
    frame = Fraction(frame).floor().add(0.5);

    this.video.currentTime = frame.div(this.frameRate).valueOf().toFixed(3);
  }

  /* Callbacks */

  Update() {
    if(this.callback) {
      this.callback({
        frame: this.Frame().valueOf(),
        smpte: this.SMPTE(),
        progress: this.Progress().valueOf()
      });
    }
  }

  RegisterCallback() {
    this.Update();

    this.video.onseeked = (event) => this.Update(event);
    this.video.onseeking = (event) => this.Update(event);
    this.video.onplay = () => this.AddListener();
    this.video.onpause = () => {
      // On pause, seek to the nearest frame
      this.Seek(this.Frame() + (this.frameRate.valueOf() > 30 ? 2 : 1));
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
    // Call once per frame - possible range 10hz - 50hz               Prevent division by zero
    const fps = Fraction(this.video.playbackRate).mul(this.frameRate).add(Fraction("0.00001"));
    const interval = Math.min(Math.max(Fraction(1000).div(fps).valueOf(), 20), 100);

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
