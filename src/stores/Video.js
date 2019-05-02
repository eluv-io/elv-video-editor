import {observable, action} from "mobx";
import FrameAccurateVideo, {FrameRates} from "../utils/FrameAccurateVideo";

class VideoStore {
  @observable initialized = false;
  @observable dropFrame = false;
  @observable frameRateKey = "NTSC";
  @observable frameRate = FrameRates.NTSC;
  @observable currentTime = 0;
  @observable frame = 0;
  @observable smpte = "00:00:00:00";
  @observable progress = 0;
  @observable playing = false;
  @observable playbackRate = 1.0;
  @observable fullScreen = false;

  @action.bound
  Initialize({video}) {
    this.video = video;

    const videoHandler = new FrameAccurateVideo({
      video: video,
      frameRate: this.frameRate,
      dropFrame: this.dropFrame,
      callback: this.Update
    });

    // Ensure no existing callbacks on video element are overridden
    const AppendVideoCallback = (event, callback) => {
      const existingCallback = video[event];
      video[event] = (e) => {
        if(existingCallback) {
          existingCallback(e);
        }

        callback(e);
      };
    };

    // Use video element as source of truth - attach handlers to relevant events to update our state
    AppendVideoCallback("onpause", action(() => this.playing = false));
    AppendVideoCallback("onplay", action(() => this.playing = true));
    AppendVideoCallback("onratechange", action(() => this.playbackRate = this.video.playbackRate));
    AppendVideoCallback("onfullscreenchange", action(() => this.fullScreen = !this.fullScreen));
    AppendVideoCallback("onclick", action(() => {
      // Handle click (play/pause) and double click (enter/exit full screen)
      if(this.click) {
        // Doubleclick
        clearTimeout(this.click);
        this.click = undefined;

        this.ToggleFullscreen();
      } else {
        // Single click delayed by 200ms
        this.click = setTimeout(() => {
          this.video.paused ? this.video.play() : this.video.pause();
          this.click = undefined;
        }, 200);
      }
    }));

    this.initialized = true;
    this.videoHandler = videoHandler;
  }

  @action.bound
  Update({frame, smpte, progress}) {
    this.frame = frame;
    this.smpte = smpte;
    this.progress = progress;
    this.currentTime = this.video.currentTime;
  }

  @action.bound
  PlayPause() {
    if(this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  @action.bound
  SetPlaybackRate(rate) {
    this.video.playbackRate = rate;
  }

  @action.bound
  SetFrameRate(frameRateKey) {
    this.frameRateKey = frameRateKey;
    this.frameRate = FrameRates[frameRateKey];
    this.videoHandler.frameRate = this.frameRate;

    this.videoHandler.Update();
  }

  @action.bound
  SetDropFrame(dropFrame) {
    this.dropFrame = dropFrame;
    this.videoHandler.dropFrame = this.dropFrame;

    this.videoHandler.Update();
  }

  @action.bound
  Seek(percent) {
    this.videoHandler.SeekPercentage(percent);
  }

  @action.bound
  SeekForward(frames) {
    this.videoHandler.SeekForward(frames);
  }

  @action.bound
  SeekBackward(frames) {
    this.videoHandler.SeekBackward(frames);
  }

  @action.bound
  ToggleFullscreen() {
    if(this.fullScreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } else {
      if (this.video.requestFullscreen) {
        this.video.requestFullscreen();
      } else if (this.state.video.mozRequestFullScreen) {
        this.video.mozRequestFullScreen();
      } else if (this.state.video.webkitRequestFullscreen) {
        this.video.webkitRequestFullscreen();
      } else if (this.state.video.msRequestFullscreen) {
        this.video.msRequestFullscreen();
      }
    }
  }
}

export default VideoStore;
