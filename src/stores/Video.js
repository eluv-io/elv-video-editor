import {observable, action, flow} from "mobx";
import FrameAccurateVideo, {FrameRates} from "../utils/FrameAccurateVideo";

class VideoStore {
  @observable contentObject;
  @observable name;

  @observable initialized = false;
  @observable loading = false;

  @observable source;
  @observable poster;

  @observable dropFrame = false;
  @observable frameRateKey = "NTSC";
  @observable frameRate = FrameRates.NTSC;

  @observable frame = 0;
  @observable smpte = "00:00:00:00";

  @observable duration;
  @observable playing = false;
  @observable playbackRate = 1.0;
  @observable fullScreen = false;
  @observable volume = 100;
  @observable muted = false;

  @observable seek = 0;
  @observable scale = 10000;
  @observable scaleMin = 0;
  @observable scaleMax = this.scale;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  Reset() {
    this.initialized = false;

    if(this.videoHandler) {
      this.videoHandler.RemoveCallback();
      this.videoHandler = undefined;
    }

    this.source = undefined;
    this.poster = undefined;

    this.dropFrame = false;
    this.frameRateKey = "NTSC";
    this.frameRate = FrameRates.NTSC;

    this.currentTime = 0;
    this.frame = 0;
    this.smpte = "00:00:00:00";

    this.playing = false;
    this.playbackRate = 1.0;
    this.fullScreen = false;
    this.volume = 100;
    this.muted = false;

    this.seek = 0;
    this.scale = 10000;
    this.scaleMin = 0;
    this.scaleMax = this.scale;

    this.rootStore.keyboardControlStore.UnregisterControlListener();
    this.rootStore.entryStore.ClearEntries();
  }

  @action.bound
  IndicateLoading() {
    this.loading = true;
    this.Reset();
  }

  @action.bound
  SetVideo = flow(function * (videoObject) {
    this.name = videoObject.name;

    const playoutOptions = yield this.rootStore.client.PlayoutOptions({
      versionHash: videoObject.versionHash,
      protocols: ["hls"],
      drms: ["aes-128"]
    });

    const source = playoutOptions["hls"].playoutUrl;

    let poster;
    if(videoObject.metadata.image || videoObject.metadata.public.image) {
      poster = yield this.rootStore.client.Rep({
        versionHash: videoObject.versionHash,
        rep: "player_background",
        channelAuth: true
      });
    }

    yield this.rootStore.trackStore.AddTracksFromHLSPlaylist(source);
    yield this.rootStore.trackStore.AddTracksFromTags(videoObject.metadata.segment_level_tags);
    yield this.rootStore.overlayStore.AddOverlayTracks(videoObject.metadata.frame_level_tags);

    this.source = source;
    this.poster = poster;
    this.loading = false;
  });

  @action.bound
  Initialize = flow(function * (video) {
    this.video = video;

    const videoHandler = new FrameAccurateVideo({
      video: video,
      frameRate: this.frameRate,
      dropFrame: this.dropFrame,
      callback: this.Update
    });

    this.videoHandler = videoHandler;

    yield this.rootStore.trackStore.InitializeTracks();

    video.load();

    // Attach fullscreen state handling to video container
    video.parentElement.parentElement.onfullscreenchange = action(() => this.fullScreen = !this.fullScreen);

    this.volume = video.volume;
    this.muted = video.muted;

    // Use video element as source of truth - attach handlers to relevant events to update app state
    this.video.addEventListener("pause", action(() => this.playing = false));
    this.video.addEventListener("play", action(() => this.playing = true));
    this.video.addEventListener("ratechange", action(() => this.playbackRate = this.video.playbackRate));
    this.video.addEventListener("volumechange", action(() => {
      this.volume = video.volume * this.scale;
      this.muted = video.muted;
    }));
    this.video.addEventListener("click", action(() => {
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

    // When sufficiently loaded, update video info and mark video as initialized
    this.video.addEventListener("canplaythrough", action(() => {
      videoHandler.Update();
      this.initialized = true;
    }));

    this.rootStore.keyboardControlStore.RegisterControlListener();
  });

  ToggleTrack(label) {
    const track = Array.from(this.video.textTracks).find(track => track.label === label);

    if(!track) { return; }

    if(track.mode === "showing") {
      track.mode = "disabled";
      return false;
    } else {
      track.mode = "showing";
      return true;
    }
  }

  @action.bound
  ProgressToSMPTE(seek) {
    return this.videoHandler.ProgressToSMPTE(seek / this.scale);
  }

  @action.bound
  TimeToSMPTE(time) {
    return this.videoHandler.TimeToSMPTE(time);
  }

  @action.bound
  Update({frame, smpte, progress}) {
    if(!this.video) { return; }

    this.frame = Math.floor(frame);
    this.smpte = smpte;
    this.seek = progress * this.scale;
    this.duration = this.video.duration;
    this.currentTime = this.video.currentTime;

    // Ensure min isn't less than seek - may happen if the video isn't buffered
    if(this.seek < this.scaleMin) {
      this.scaleMin = this.seek;
    }

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
  ChangePlaybackRate(delta) {
    this.video.playbackRate = Math.min(4, Math.max(0.1, this.video.playbackRate + delta));
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
  ScrollScale(position, deltaY) {
    if(!this.video || !this.video.duration) { return; }

    let deltaMin, deltaMax;
    deltaY *= this.scale * -0.005;

    // deltaY: Positive => zoom in, negative => zoom out
    if(deltaY > 0) {
      // When zooming in, zoom to mouse position
      let scalePosition = this.scale * position;

      // Adjust scale according to mouse position relative to min/max positions
      const range = this.scaleMax - this.scaleMin;
      deltaMin = deltaY * (scalePosition - this.scaleMin) / range;
      deltaMax = deltaY * (this.scaleMax - scalePosition) / range;
    } else {
      // When zooming out, expand equally
      deltaMin = deltaY;
      deltaMax = deltaY;
    }

    this.SetScale(
      Math.max(0, this.scaleMin + deltaMin),
      this.seek,
      Math.min(this.scale, this.scaleMax - deltaMax)
    );
  }

  @action.bound
  SetScale(min, seek, max) {
    const bump = this.scale * 0.015;
    const range = max - min;

    // Prevent range from going too small
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
  SeekFrames({frames=0, seconds=0}) {
    if(seconds) {
      frames += this.frameRate.ceil().mul(seconds);
    }

    // Adjust scale, if necessary
    const targetFrame = this.frame + frames;
    const targetScale = (targetFrame / this.videoHandler.TotalFrames()) * this.scale;
    const bump = this.scale * 0.015;
    const scaleWidth = this.scaleMax - this.scaleMin;

    if(targetScale <= this.scaleMin) {
      this.scaleMin = Math.max(0, targetScale - bump);
      this.scaleMax = this.scaleMin + scaleWidth;
    } else if(targetScale >= this.scaleMax) {
      this.scaleMax = Math.min(this.scale, targetScale + bump);
      this.scaleMin = this.scaleMax - scaleWidth;
    }

    this.videoHandler.Seek(targetFrame);
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
  ChangeVolume(delta) {
    this.video.volume = Math.max(0, Math.min(1, this.video.volume + (delta / this.scale)));

    if(this.video.volume === 0) {
      this.video.muted = true;
    } else if(this.video.muted && this.video.volume !== 0) {
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
  ToggleMuted() {
    this.video.muted = !this.video.muted;

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
