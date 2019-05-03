import {observable, action} from "mobx";
import FrameAccurateVideo, {FrameRates} from "../utils/FrameAccurateVideo";

class VideoStore {
  // TODO: Make @calculated values + cleanup

  @observable initialized = false;
  @observable dropFrame = false;
  @observable frameRateKey = "NTSC";
  @observable frameRate = FrameRates.NTSC;
  @observable currentTime = 0;
  @observable frame = 0;
  @observable smpte = "00:00:00:00";
  @observable progress = 0;
  @observable seek = 0;
  @observable playing = false;
  @observable playbackRate = 1.0;
  @observable fullScreen = false;

  @observable scale = 10000;
  @observable scaleMin = 0;
  @observable scaleMax = this.scale;

  @observable volume = 100;
  @observable muted = false;

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
    AppendVideoCallback("onvolumechange", action(() => {
      this.volume = video.volume * this.scale;
      this.muted = video.muted;
    }));
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
    this.volume = video.volume;
    this.muted = video.muted;
  }

  @action.bound
  ProgressToSMPTE(seek) {
    return this.videoHandler.ProgressToSMPTE(seek / this.scale);
  }

  @action.bound
  Update({frame, smpte, progress}) {
    this.frame = frame;
    this.smpte = smpte;
    this.progress = progress;
    this.currentTime = this.video.currentTime;
    this.seek = progress * this.scale;

    if(this.playing && this.seek > this.scaleMax) {
      // If playing has gone beyond the max scale, push the whole scale slider forward by 50%
      const currentRange = this.scaleMax - this.scaleMin;
      this.scaleMax = Math.min(this.scale, this.scaleMax + currentRange/2);
      this.scaleMin = this.scaleMax - currentRange;
    }
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
  ScrollScale(deltaY) {
    if(!this.video || !this.video.duration) { return; }

    deltaY *= this.scale * 0.005;

    // Adjust scale according to current position relative to min/max positions
    // In other words, scale changes, seek position stays the same
    const range = this.scaleMax - this.scaleMin;
    const deltaMin = deltaY * (this.seek - this.scaleMin) / range;
    const deltaMax = deltaY * (this.scaleMax - this.seek) / range;

    this.SetScale(
      Math.max(0, this.scaleMin + deltaMin),
      this.seek,
      Math.min(this.scale, this.scaleMax - deltaMax)
    );
  }

  @action.bound
  SetScale(min, seek, max) {
    const bump = this.scale * 0.05;
    const range = max - min;

    if(range < bump) { return; }

    if(min >= seek) {
      if(min === this.scaleMin) {
        // Seek moved past min range
        min = Math.max(0, min - bump);
      } else {
        // Min range moved ahead of seek
        seek += bump;
      }
    } else if(seek >= max) {
      if(max === this.scaleMax) {
        // Seek moved ahead of max range
        max = Math.min(this.scale, max + bump);
      } else {
        // Max range moved behind seek
        seek -= bump;
      }
    }

    this.scaleMin = min;
    this.scaleMax = max;

    this.Seek(seek / this.scale);
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
  ScrollVolume(deltaY) {
    const volume = this.muted ? 0 : this.volume;

    this.SetVolume(
      Math.max(0, Math.min(this.scale, volume - (deltaY * this.scale * 0.01)))
    );
  }

  @action.bound
  SetVolume(volume) {
    this.video.volume = volume / this.scale;

    if(volume === 0) {
      this.video.muted = true;
    } else if(this.video.muted && volume !== 0) {
      this.video.muted = false;
    }
  }

  @action.bound
  SetMuted(muted) {
    this.video.muted = muted;

    if(this.video.volume === 0) {
      this.video.volume = 0.5;
    }
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
      const videoContainer = this.video.parentElement.parentElement;
      
      if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen();
      } else if (videoContainer.mozRequestFullScreen) {
        videoContainer.mozRequestFullScreen();
      } else if (videoContainer.webkitRequestFullscreen) {
        videoContainer.webkitRequestFullscreen();
      } else if (videoContainer.msRequestFullscreen) {
        videoContainer.msRequestFullscreen();
      }
    }
  }
}

export default VideoStore;
