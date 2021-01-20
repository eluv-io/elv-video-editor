import {observable, action, flow, computed} from "mobx";
import FrameAccurateVideo, {FrameRateDenominator, FrameRateNumerator, FrameRates} from "../utils/FrameAccurateVideo";
import UrlJoin from "url-join";
import URI from "urijs";
import HLS from "hls.js";
import {DownloadFromUrl} from "../utils/Utils";

class VideoStore {
  @observable videoKey = 0;

  @observable primaryContentStartTime = 0;
  @observable primaryContentEndTime;

  @observable versionHash = "";
  @observable metadata = {};
  @observable tags = {};
  @observable name;
  @observable videoTags = [];

  @observable loading = false;
  @observable initialized = false;
  @observable isVideo = false;

  @observable consecutiveSegmentErrors = 0;

  @observable levels = [];
  @observable currentLevel;

  @observable source;
  @observable baseUrl = undefined;
  @observable baseVideoFrameUrl = undefined;
  @observable baseFileUrl = undefined;
  @observable previewSupported = false;

  @observable dropFrame = false;
  @observable frameRateKey = "NTSC";
  @observable frameRate = FrameRates.NTSC;
  @observable frameRateRat = `${FrameRateNumerator["NTSC"]}/${FrameRateDenominator["NTSC"]}`;
  @observable frameRateSpecified = false;

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
  @observable scaleMin = 0;
  @observable scaleMax = 100;

  @observable segmentEnd = undefined;

  @observable sliderMarks = 100;
  @observable majorMarksEvery = 10;

  @observable clipInFrame;
  @observable clipOutFrame;

  @computed get scaleMinTime() { return this.duration ? this.ProgressToTime(this.scaleMin) : 0; }
  @computed get scaleMaxTime() { return this.duration ? this.ProgressToTime(this.scaleMax) : 0; }

  @computed get scaleMinFrame() { return this.duration ? this.ProgressToFrame(this.scaleMin) : 0; }
  @computed get scaleMaxFrame() { return this.duration ? this.ProgressToFrame(this.scaleMax) : 0; }

  // Pass dropFrame parameter so SMPTE strings are redrawn on dropframe display change
  @computed get scaleMinSMPTE() { return this.duration ? this.ProgressToSMPTE(this.scaleMin, this.dropFrame) : ""; }
  @computed get scaleMaxSMPTE() { return this.duration ? this.ProgressToSMPTE(this.scaleMax, this.dropFrame) : ""; }

  DebounceControl({name, delay, Action}) {
    if(this[`${name}LastFired`] && Date.now() - this[`${name}LastFired`] < delay) {
      clearTimeout(this[`${name}Debounce`]);
      this[`${name}Debounce`] = setTimeout(() => {
        this[`${name}LastFired`] = Date.now();

        Action();
      }, delay - Math.max((Date.now() - this[`${name}LastFired`]), 0));
    } else {
      this[`${name}LastFired`] = Date.now();

      Action();
    }
  }

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  Reset() {
    this.loading = true;
    this.initialized = false;
    this.isVideo = false;

    this.video = undefined;
    this.player = undefined;

    this.levels = [];
    this.currentLevel = undefined;

    if(this.videoHandler) {
      this.videoHandler.RemoveCallback();
      this.videoHandler = undefined;
    }

    this.primaryContentStartTime = 0;
    this.primaryContentEndTime = undefined;

    this.versionHash = "";
    this.metadata = {};
    this.tags = {};
    this.name = "";
    this.videoTags = [];

    this.source = undefined;
    this.baseVideoFrameUrl = undefined;
    this.baseFileUrl = undefined;
    this.baseUrl = undefined;
    this.previewSupported = false;

    this.dropFrame = false;
    this.frameRateKey = "NTSC";
    this.frameRate = FrameRates.NTSC;
    this.frameRateRat = `${FrameRateNumerator["NTSC"]}/${FrameRateDenominator["NTSC"]}`;
    this.frameRateSpecified = false;

    this.currentTime = 0;
    this.frame = 0;
    this.smpte = "00:00:00:00";

    this.playing = false;
    this.playbackRate = 1.0;
    this.fullScreen = false;
    this.volume = 100;
    this.muted = false;

    this.seek = 0;
    this.scaleMin = 0;
    this.scaleMax = 100;

    this.segmentEnd = undefined;

    this.consecutiveSegmentErrors = 0;

    this.clipInFrame = undefined;
    this.clipOutFrame = undefined;

    this.rootStore.entryStore.ClearEntries();
  }

  @action.bound
  SetVideo = flow(function * (videoObject) {
    this.loading = true;

    try {
      this.name = videoObject.name;
      this.versionHash = videoObject.versionHash;

      this.baseUrl = yield this.rootStore.client.FabricUrl({
        versionHash: this.versionHash
      });

      this.baseFileUrl = yield this.rootStore.client.FileUrl({
        versionHash: this.versionHash,
        filePath: "/"
      });

      this.metadata = videoObject.metadata;
      this.isVideo = videoObject.isVideo;

      if(!this.isVideo) {
        this.initialized = true;
      } else {
        const playoutOptions = yield this.rootStore.client.PlayoutOptions({
          versionHash: videoObject.versionHash,
          protocols: ["hls"],
          drms: ["clear", "aes-128"],
          hlsjsProfile: false
        });

        // Specify playout for full, untrimmed content
        const playoutMethods = playoutOptions["hls"].playoutMethods;
        const source = URI(
          (playoutMethods.clear || playoutMethods["aes-128"]).playoutUrl
        )
          .addSearch("ignore_trimming", true)
          .addSearch("player_profile", "hls-js-2441")
          .toString();

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

        try {
          this.primaryContentStartTime = 0;

          const offering = this.metadata.offerings.default;

          const offeringOptions = offering.media_struct.streams || {};

          let rate;
          if(offeringOptions.video) {
            rate = offeringOptions.video.rate;
          } else {
            const videoKey = Object.keys(offeringOptions).find(key => key.startsWith("video"));
            rate = offeringOptions[videoKey].rate;
          }

          this.frameRateSpecified = true;

          this.SetFrameRate({rateRat: rate});

          if(offering.entry_point_rat) {
            this.primaryContentStartTime = FrameAccurateVideo.ParseRat(offering.entry_point_rat);
          }

          if(offering.exit_point_rat) {
            // End time is end of specified frame
            const frameRate = FrameRates[this.frameRateKey].valueOf();
            this.primaryContentEndTime = Number((FrameAccurateVideo.ParseRat(offering.exit_point_rat) - (1 / frameRate)).toFixed(3));
          }
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error("Unable to determine frame rate");
        }

        // Tags
        if(this.metadata.video_tags && this.metadata.video_tags.metadata_tags) {
          if(this.metadata.video_tags.metadata_tags["/"]) {
            // Single tag file

            this.tags = yield this.rootStore.client.LinkData({
              versionHash: this.versionHash,
              linkPath: "video_tags/metadata_tags",
              format: "json"
            });
          } else {
            let video_level_tags = {};
            let metadata_tags = {};

            // Load and merge tag files
            const tagData = yield this.rootStore.client.utils.LimitedMap(
              5,
              Object.keys(this.metadata.video_tags.metadata_tags),
              async fileLink => await this.rootStore.client.LinkData({
                versionHash: this.versionHash,
                linkPath: `video_tags/metadata_tags/${fileLink}`,
                format: "json"
              })
            );

            tagData.forEach(tags => {
              if(tags) {
                const tagVersion = tags.version || 0;

                video_level_tags = Object.assign(video_level_tags, tags.video_level_tags);

                if(tags.metadata_tags) {
                  Object.keys(tags.metadata_tags).forEach(trackKey => {
                    if(metadata_tags[trackKey]) {
                      metadata_tags[trackKey].tags = metadata_tags[trackKey].tags
                        .concat(tags.metadata_tags[trackKey].tags)
                        .sort((a, b) => a.startTime < b.startTime ? -1 : 1);
                    } else {
                      metadata_tags[trackKey] = tags.metadata_tags[trackKey];
                    }

                    metadata_tags[trackKey].version = tagVersion;
                  });
                }
              }
            });

            this.tags = {
              video_level_tags,
              metadata_tags
            };
          }

          let videoTags = this.tags.video_level_tags || [];
          if(typeof videoTags === "object") {
            videoTags = Object.keys(videoTags);
          }

          this.videoTags = videoTags;
        }
      }
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load:");
      // eslint-disable-next-line no-console
      console.log(error);
    } finally {
      this.loading = false;
    }
  });

  ReloadMetadata = flow(function * () {
    const versionHash = this.rootStore.menuStore.selectedObject.versionHash;

    this.metadata = yield this.rootStore.client.ContentObjectMetadata({
      versionHash,
      select: [
        "public/name",
        "public/description",
        "offerings",
        "video_tags",
        "files",
        "mime_types"
      ]
    });
  });

  @action.bound
  Initialize(video, player) {
    this.initialized = false;
    this.video = video;
    this.player = player;

    const videoHandler = new FrameAccurateVideo({
      video,
      frameRate: this.frameRate,
      frameRateRat: this.frameRateRat,
      dropFrame: this.dropFrame,
      callback: this.Update
    });

    this.videoHandler = videoHandler;

    video.load();

    // Attach fullscreen state handling to video container
    video.parentElement.parentElement.onfullscreenchange = action(() => this.fullScreen = !this.fullScreen);

    this.volume = video.volume;
    this.muted = video.muted;

    this.player.on(HLS.Events.LEVEL_SWITCHED, action(() => {
      this.levels = this.player.levels;
      this.currentLevel = this.player.currentLevel;
    }));

    this.player.on(HLS.Events.ERROR, action((event, data) => {
      if(data.fatal || (data.type === "networkError" && parseInt(data.response.code) >= 500)) {
        this.consecutiveSegmentErrors += 1;
        // eslint-disable-next-line no-console
        console.error("HLS playback error:");
        // eslint-disable-next-line no-console
        console.error(data);

        // Give up and show an error message after several failures
        if(this.consecutiveSegmentErrors >= 3) {
          this.rootStore.menuStore.SetErrorMessage("Playback Error");
          this.Reset();
        }
      }
    }));

    this.player.on(HLS.Events.FRAG_LOADED, action(() => {
      // Loaded good segment, reset error count
      this.consecutiveSegmentErrors = 0;
    }));

    // Use video element as source of truth - attach handlers to relevant events to update app state
    this.video.addEventListener("pause", action(() => this.playing = false));
    this.video.addEventListener("play", action(() => this.playing = true));
    this.video.addEventListener("ratechange", action(() => this.playbackRate = this.video.playbackRate));
    this.video.addEventListener("volumechange", action(() => {
      this.volume = video.volume * 100;
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

    const loadedSource = this.source;

    // When sufficiently loaded, update video info and mark video as initialized
    const InitializeDuration = action(() => {
      if(this.initialized || this.source !== loadedSource) { return; }

      if(this.video.readyState > 2 && this.video.duration > 3 && isFinite(this.video.duration)) {
        videoHandler.Update();
        this.initialized = true;

        if(!this.primaryContentEndTime) {
          this.primaryContentEndTime = Number((this.video.duration).toFixed(3));
        }

        this.rootStore.trackStore.InitializeTracks();

        this.clipInFrame = 0;
        this.clipOutFrame = this.videoHandler.TotalFrames() - 1;
      }
    });

    this.video.addEventListener("canplay", InitializeDuration);
    this.video.addEventListener("durationchange", InitializeDuration);

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
  SetClipMark({inFrame, outFrame, inProgress, outProgress}) {
    if(typeof inProgress !== "undefined" && inProgress >= 0) {
      inFrame = this.ProgressToFrame(inProgress);
    }

    if(typeof outProgress !== "undefined" && outProgress <= 100) {
      outFrame = this.ProgressToFrame(outProgress);
    }

    if(typeof inFrame !== "undefined") { this.clipInFrame = Math.max(0, inFrame); }
    if(outFrame) { this.clipOutFrame = Math.min(outFrame, this.videoHandler.TotalFrames() - 1); }

    if(!this.clipInFrame) { this.clipInFrame = 0; }
    if(!this.clipOutFrame) { this.clipOutFrame = this.videoHandler.TotalFrames() - 1; }
  }

  @action.bound
  SMPTEToTime(smpte) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.SMPTEToTime(smpte);
  }

  @action.bound
  ProgressToTime(seek) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.ProgressToTime(seek / 100);
  }

  @action.bound
  ProgressToSMPTE(seek) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.ProgressToSMPTE(seek / 100);
  }

  @action.bound
  ProgressToFrame(seek) {
    if(!this.videoHandler) { return; }

    return this.TimeToFrame(this.ProgressToTime(seek));
  }

  @action.bound
  TimeToSMPTE(time) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.TimeToSMPTE(time);
  }

  @action.bound
  TimeToFrame(time) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.TimeToFrame(time);
  }

  @action.bound
  TimeToProgress(time) {
    if(!this.videoHandler) { return 0; }

    return 100 * time / this.duration;
  }

  @action.bound
  FrameToProgress(frame) {
    if(!this.videoHandler) { return 0; }

    return this.TimeToProgress(this.FrameToTime(frame));
  }

  @action.bound
  FrameToTime(frame) {
    if(!this.videoHandler) { return 0; }

    // Pad number to ensure its rounded up
    return Number((this.videoHandler.FrameToTime(frame) + 0.00051).toFixed(3));
  }

  @action.bound
  FrameToSMPTE(frame) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.FrameToSMPTE(frame);
  }

  @action.bound
  Update({frame, smpte, progress}) {
    if(!this.video) { return; }

    this.frame = Math.floor(frame);
    this.smpte = smpte;
    this.seek = progress * 100;
    this.duration = this.video.duration;
    this.currentTime = this.video.currentTime;

    // Ensure min isn't less than seek - may happen if the video isn't buffered
    if(this.seek < this.scaleMin) {
      this.scaleMin = this.seek;
    }

    if(this.playing && this.seek > this.scaleMax) {
      // If playing has gone beyond the max scale, push the whole scale slider forward by 50%
      const currentRange = this.scaleMax - this.scaleMin;
      this.scaleMax = Math.min(100, this.scaleMax + currentRange/2);
      this.scaleMin = this.scaleMax - currentRange;
    }

    // Segment play specified - stop when segment ends
    if(this.segmentEnd && this.frame >= this.segmentEnd - 3) {
      this.video.pause();
      this.Seek(this.segmentEnd - 1);

      this.EndSegment();
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
  SetFrameRate({rateRat, rateKey}) {
    if(!rateRat && !rateKey) { return; }

    if(rateRat) {
      this.frameRate = FrameAccurateVideo.ParseRat(rateRat);
      this.frameRateKey = FrameAccurateVideo.FractionToRateKey(rateRat);
      this.frameRateRat = rateRat;
    } else {
      this.frameRateKey = rateKey;
      this.frameRate = FrameRates[rateKey];
      this.frameRateRat = `${FrameRateNumerator[rateKey]}/${FrameRateDenominator[rateKey]}`;
    }

    if(this.videoHandler) {
      this.videoHandler.SetFrameRate({rateRat: this.frameRateRat});
      this.videoHandler.Update();
    }
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

    deltaY *= 100 * -0.003;

    deltaMin = deltaY * minProportion;
    deltaMax = deltaY * maxProportion;

    this.SetScale(
      Math.max(0, this.scaleMin + deltaMin),
      this.seek,
      Math.min(100, this.scaleMax - deltaMax)
    );
  }

  @action.bound
  SetScale(min, seek, max) {
    this.scaleMin = Math.max(0, Math.min(min, max - 5));
    this.scaleMax = Math.min(100, Math.max(max, min + 5));
  }

  @action.bound
  PlaySegment(startFrame, endFrame, activeTrack) {
    this.Seek(startFrame);
    this.activeTrack = activeTrack;
    this.segmentEnd = endFrame;
    this.video.play();
    this.rootStore.overlayStore.SetActiveTrack(activeTrack);
  }

  EndSegment() {
    this.segmentEnd = undefined;
    this.activeTrack = undefined;
    this.rootStore.overlayStore.SetActiveTrack(undefined);
  }

  @action.bound
  Seek(frame, clearSegment=true) {
    if(clearSegment) { this.EndSegment(); }
    this.videoHandler.Seek(frame);
  }

  @action.bound
  SeekPercentage(percent, clearSegment=true) {
    if(clearSegment) { this.EndSegment(); }
    this.videoHandler.SeekPercentage(percent);
  }

  @action.bound
  SeekFrames({frames=0, seconds=0}) {
    if(this.playing) {
      this.PlayPause();
    }

    if(seconds) {
      frames += Math.ceil(this.frameRate) * seconds;
    }

    // Adjust scale, if necessary
    const targetFrame = this.frame + frames;
    const targetScale = (targetFrame / this.videoHandler.TotalFrames()) * 100;
    const bump = 100 * 0.015;
    const scaleWidth = this.scaleMax - this.scaleMin;

    if(targetScale <= this.scaleMin) {
      this.scaleMin = Math.max(0, targetScale - bump);
      this.scaleMax = this.scaleMin + scaleWidth;
    } else if(targetScale >= this.scaleMax) {
      this.scaleMax = Math.min(100, targetScale + bump);
      this.scaleMin = this.scaleMax - scaleWidth;
    }

    this.videoHandler.Seek(targetFrame);
  }

  @action.bound
  ScrollVolume(deltaY) {
    const volume = this.muted ? 0 : this.volume;

    this.SetVolume(
      Math.max(0, Math.min(100, volume - (deltaY * 100 * 0.01)))
    );
  }

  @action.bound
  SetVolume(volume) {
    this.video.volume = volume / 100;

    if(volume === 0) {
      this.video.muted = true;
    } else if(this.video.muted && volume !== 0) {
      this.video.muted = false;
    }
  }

  @action.bound
  ChangeVolume(delta) {
    this.video.volume = Math.max(0, Math.min(1, this.video.volume + (delta / 100)));

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
  AssetLink(assetKey, height) {
    const filePath = this.metadata.assets[assetKey].file["/"].split("/files/").slice(1).join("/");

    const uri = URI(this.baseUrl);
    uri.path(UrlJoin(uri.path(), "rep", "thumbnail", "files", filePath));

    if(height) {
      uri.addQuery({height});
    }

    return uri.toString();
  }

  @action.bound
  VideoFrame(frame) {
    return URI(this.baseVideoFrameUrl)
      .addSearch("frame", frame)
      .toString();
  }

  @action.bound
  SaveFrame() {
    if(!this.video) { return; }

    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext("2d").drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
    canvas.toBlob(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const filename = `${this.name}_${this.smpte.replace(":", "-")}.png`;
      DownloadFromUrl(downloadUrl, filename);
    });
  }
}

export default VideoStore;
