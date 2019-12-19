import {observable, action, flow, computed} from "mobx";
import FrameAccurateVideo, {FrameRates} from "../utils/FrameAccurateVideo";
import UrlJoin from "url-join";
import URI from "urijs";
import HLS from "hls.js";

class VideoStore {
  @observable videoKey = 0;

  @observable versionHash = "";
  @observable metadata = {};
  @observable tags = {};
  @observable name;
  @observable videoTags = [];

  @observable loading = false;
  @observable initialized = false;

  @observable levels = [];
  @observable currentLevel;

  @observable source;
  @observable poster;
  @observable baseVideoFrameUrl = undefined;
  @observable previewSupported = false;

  @observable dropFrame = false;
  @observable frameRateKey = "NTSC";
  @observable frameRate = FrameRates.NTSC;

  @observable currentTime = 0;
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

  @observable segmentEnd = undefined;

  @computed get scaleMinTime() { return this.ProgressToTime(this.scaleMin); }
  @computed get scaleMaxTime() { return this.ProgressToTime(this.scaleMax); }

  // Pass dropFrame parameter so SMPTE strings are redrawn on dropframe display change
  @computed get scaleMinSMPTE() { return this.ProgressToSMPTE(this.scaleMin, this.dropFrame); }
  @computed get scaleMaxSMPTE() { return this.ProgressToSMPTE(this.scaleMax, this.dropFrame); }

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  Reset() {
    this.loading = true;
    this.initialized = false;

    this.video = undefined;
    this.player = undefined;

    this.levels = [];
    this.currentLevel = undefined;

    if(this.videoHandler) {
      this.videoHandler.RemoveCallback();
      this.videoHandler = undefined;
    }

    this.versionHash = "";
    this.metadata = {};
    this.tags = {};
    this.name = "";
    this.videoTags = [];

    this.source = undefined;
    this.poster = undefined;
    this.baseVideoFrameUrl = undefined;
    this.previewSupported = false;

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

    this.segmentEnd = undefined;

    this.rootStore.entryStore.ClearEntries();
  }

  @action.bound
  SetVideo = flow(function * (videoObject) {
    this.loading = true;

    try {
      this.name = videoObject.name;
      this.versionHash = videoObject.versionHash;

      const playoutOptions = yield this.rootStore.client.PlayoutOptions({
        versionHash: videoObject.versionHash,
        protocols: ["hls"],
        drms: []
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

      this.baseVideoFrameUrl = yield this.rootStore.client.Rep({
        versionHash: videoObject.versionHash,
        rep: UrlJoin("playout", "default", "frames.png")
      });

      try {
        // Query preview API to check support
        const response = yield fetch(URI(this.baseVideoFrameUrl).addSearch("frame", 0).toString());
        if(response.ok) {
          this.previewSupported = true;
        } else {
          // eslint-disable-next-line no-console
          console.error("Preview not supported for this content");
        }
      } catch(error) {
        // eslint-disable-next-line no-console
        console.error("Preview not supported for this content");
      }

      this.source = source;
      this.poster = poster;
      this.metadata = videoObject.metadata;

      if(this.metadata.asset_metadata && this.metadata.asset_metadata.tags) {
        this.tags = yield this.rootStore.client.LinkData({
          versionHash: this.versionHash,
          linkPath: "asset_metadata/tags",
          format: "json"
        });

        let videoTags = this.tags.video_level_tags || [];
        if(typeof videoTags === "object") {
          videoTags = Object.keys(videoTags);
        }

        this.videoTags = videoTags;
      }

      if(!this.tags || Object.keys(this.tags).length === 0) {
        this.tags = {
          metadata_tags: this.metadata.metadata_tags || {}
        };

        if(this.metadata.overlay_tags) {
          this.tags.overlay_tags = {
            frame_level_tags: this.metadata.overlay_tags
          };
        }

        let videoTags = (this.metadata.metadata_tags || {}).video_level_tags || [];
        if(typeof videoTags === "object") {
          videoTags = Object.keys(videoTags);
        }

        this.videoTags = videoTags;
      }
    } finally {
      this.loading = false;
    }

    this.rootStore.trackStore.InitializeTracks();
  });

  @action.bound
  Initialize(video, player) {
    this.initialized = false;
    this.video = video;
    this.player = player;

    const videoHandler = new FrameAccurateVideo({
      video,
      frameRate: this.frameRate,
      dropFrame: this.dropFrame,
      callback: this.Update
    });

    this.videoHandler = videoHandler;

    try {
      const offeringOptions = this.metadata.offerings.default.media_struct.streams || {};

      let rate;
      if(offeringOptions.video) {
        rate = offeringOptions.video.rate;
      } else {
        const videoKey = Object.keys(offeringOptions).find(key => key.startsWith("video"));
        rate = offeringOptions[videoKey].rate;
      }

      const rateKey = this.videoHandler.FractionToRateKey(rate);
      this.SetFrameRate(rateKey);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Unable to determine frame rate");
    }

    video.load();

    // Attach fullscreen state handling to video container
    video.parentElement.parentElement.onfullscreenchange = action(() => this.fullScreen = !this.fullScreen);

    this.volume = video.volume;
    this.muted = video.muted;

    this.player.on(HLS.Events.LEVEL_SWITCHED, action(() => {
      this.levels = this.player.levels;
      this.currentLevel = this.player.currentLevel;
    }));

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
    const loadedSource = this.source;
    this.video.addEventListener("durationchange", action(() => {
      if(this.source !== loadedSource) { return; }

      if(this.video.duration > 0 && isFinite(this.video.duration)) {
        videoHandler.Update();
        this.initialized = true;
      }
    }));

    this.video.addEventListener("error", action(() => {
      // eslint-disable-next-line no-console
      console.error("Video error: ");
      // eslint-disable-next-line no-console
      console.error(video.error);
      this.videoKey = this.videoKey + 1;
    }));
  }

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
  ProgressToTime(seek) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.ProgressToTime(seek / this.scale);
  }

  @action.bound
  ProgressToSMPTE(seek) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.ProgressToSMPTE(seek / this.scale);
  }

  @action.bound
  TimeToSMPTE(time) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.TimeToSMPTE(time);
  }

  @action.bound
  TimeToFrame(time) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.TimeToFrame(time).floor().valueOf();
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

    // Segment play specified - stop when segment ends
    if(this.segmentEnd && this.frame >= this.segmentEnd - 3) {
      this.video.pause();
      this.Seek(this.segmentEnd - 1);
      this.segmentEnd = undefined;
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
  SetPlaybackLevel(level) {
    this.player.levelController.manualLevel = level;
    this.player.streamController.immediateLevelSwitch();
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
    if(!frameRateKey) { return; }

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
  ScrollScale(position, deltaY) {
    if(!this.video || !this.video.duration) { return; }

    let deltaMin, deltaMax;

    const minProportion = position;
    const maxProportion = 1 - position;

    deltaY *= this.scale * -0.003;

    deltaMin = deltaY * minProportion;
    deltaMax = deltaY * maxProportion;

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

    this.SeekPercentage(seek / this.scale, false);
  }

  @action.bound
  PlaySegment(startFrame, endFrame) {
    this.Seek(startFrame);
    this.segmentEnd = endFrame;
    this.video.play();
  }

  @action.bound
  Seek(frame, clearSegment=true) {
    if(clearSegment) { this.segmentEnd = undefined; }
    this.videoHandler.Seek(frame);
  }

  @action.bound
  SeekPercentage(percent, clearSegment=true) {
    if(clearSegment) { this.segmentEnd = undefined; }
    this.videoHandler.SeekPercentage(percent);
  }

  @action.bound
  SeekFrames({frames=0, seconds=0}) {
    if(this.playing) {
      this.PlayPause();
    }

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

  @action.bound
  VideoFrame(frame) {
    return URI(this.baseVideoFrameUrl)
      .addSearch("frame", frame)
      .toString();
  }
}

export default VideoStore;
