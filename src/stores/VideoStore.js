import {action, flow, makeAutoObservable} from "mobx";
import FrameAccurateVideo, {FrameRateDenominator, FrameRateNumerator, FrameRates} from "@/utils/FrameAccurateVideo";
import UrlJoin from "url-join";
import HLS from "hls.js";
import {DownloadFromUrl} from "@/utils/Utils.js";
import {FormatTags, LoadVideo} from "@/stores/Helpers.js";
import ThumbnailStore from "@/stores/ThumbnailStore.js";

// How far the scale can be zoomed, as a percentage
const MIN_SCALE = 0.2;

class VideoStore {
  channel = false;
  tags = false;

  videoKey = 0;

  primaryContentStartTime = 0;
  primaryContentEndTime;

  versionHash = "";
  metadata = {};
  name;

  availableOfferings = {};
  offeringKey = "default";

  loading = false;
  initialized = false;
  isVideo = false;
  ready = false;
  showVideoControls = true;

  consecutiveSegmentErrors = 0;

  levels = [];
  currentLevel;

  audioTracks = [];
  currentAudioTrack;

  subtitleTracks = [];
  currentSubtitleTrack = -1;

  playoutUrl;
  baseUrl = undefined;
  baseStateChannelUrl = undefined;
  baseFileUrl = undefined;

  dropFrame = false;
  frameRateKey = "NTSC";
  frameRate = FrameRates.NTSC;
  frameRateRat = `${FrameRateNumerator["NTSC"]}/${FrameRateDenominator["NTSC"]}`;
  frameRateSpecified = false;

  currentTime = 0;
  frame = 0;
  totalFrames = 0;
  smpte = "00:00:00:00";

  duration;
  durationSMPTE;
  playing = false;
  playbackRate = 1.0;
  fullScreen = false;
  volume = 1;
  muted = false;
  aspectRatio = 16/9;

  seek = 0;
  scaleMin = 0;
  scaleMax = 100;

  segmentEnd = undefined;

  sliderMarks = 100;
  majorMarksEvery = 10;

  clipInFrame;
  clipOutFrame;

  get scaleMagnitude() { return this.scaleMax - this.scaleMin; }

  get scaleMinTime() { return this.duration ? this.ProgressToTime(this.scaleMin) : 0; }
  get scaleMaxTime() { return this.duration ? this.ProgressToTime(this.scaleMax) : 0; }

  get scaleMinFrame() { return this.duration ? this.ProgressToFrame(this.scaleMin) : 0; }
  get scaleMaxFrame() { return this.duration ? this.ProgressToFrame(this.scaleMax) : 0; }

  // Pass dropFrame parameter so SMPTE strings are redrawn on dropframe display change
  get scaleMinSMPTE() { return this.duration ? this.ProgressToSMPTE(this.scaleMin) : ""; }
  get scaleMaxSMPTE() {
    if(!this.duration) { return ""; }

    let frame = this.TimeToFrame(this.ProgressToTime(this.scaleMax), true);
    return this.FrameToSMPTE(frame - 1, this.dropFrame);
  }

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

  constructor(rootStore, options={clipKey: "", tags: true, channel: false}) {
    makeAutoObservable(
      this,
      {
        metadata: false,
        sourceVideoStore: false
      }
    );

    this.rootStore = rootStore;
    this.thumbnailStore = new ThumbnailStore(this);
    this.tags = typeof options.tags !== "undefined" ? options.tags : true;
    this.initialClipPoints = options.initialClipPoints;
    this.channel = options.channel || false;

    this.Update = this.Update.bind(this);

    addEventListener("fullscreenchange", () => this.SetFullscreen());
  }

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
    this.name = "";
    this.offeringKey = "default";
    this.availableOfferings = {};

    this.playoutUrl = undefined;
    this.baseFileUrl = undefined;
    this.baseUrl = undefined;

    this.dropFrame = false;
    this.frameRateKey = "NTSC";
    this.frameRate = FrameRates.NTSC;
    this.frameRateRat = `${FrameRateNumerator["NTSC"]}/${FrameRateDenominator["NTSC"]}`;
    this.frameRateSpecified = false;

    this.currentTime = 0;
    this.frame = 0;
    this.totalFrames = 0;
    this.smpte = "00:00:00:00";
    this.showVideoControls = true;

    this.playing = false;
    this.playbackRate = 1.0;
    this.fullScreen = false;
    this.volume = 1;
    this.muted = false;

    this.seek = 0;
    this.scaleMin = 0;
    this.scaleMax = 100;

    this.segmentEnd = undefined;

    this.consecutiveSegmentErrors = 0;

    this.initialClipPoints = undefined;

    this.clipInFrame = undefined;
    this.clipOutFrame = undefined;

    if(this.tags) {
      this.rootStore.tagStore.ClearTags();
      this.rootStore.trackStore.Reset();
    }

    this.thumbnailStore = new ThumbnailStore(this);
  }

  ToggleVideoControls(enable) {
    this.showVideoControls = enable;
  }

  SetOffering = flow(function * (offeringKey) {
    yield this.SetVideo({...this.videoObject, preferredOfferingKey: offeringKey});
  });

  SetVideo = flow(function * ({objectId, writeToken, preferredOfferingKey="default"}) {
    this.loading = true;
    this.ready = false;
    this.rootStore.SetError(undefined);

    if(this.videoObject?.objectId !== objectId) {
      this.Reset();
    }

    try {
      this.selectedObject = undefined;

      const videoObject = yield LoadVideo({objectId, writeToken, preferredOfferingKey, channel: this.channel});

      this.videoObject = videoObject;

      this.name = videoObject.name;
      this.versionHash = videoObject.versionHash;

      this.baseUrl = yield this.rootStore.client.FabricUrl({
        versionHash: this.versionHash
      });

      this.baseStateChannelUrl = yield this.rootStore.client.FabricUrl({
        versionHash: this.versionHash,
        channelAuth: true
      });

      this.baseFileUrl = yield this.rootStore.client.FileUrl({
        versionHash: this.versionHash,
        filePath: "/"
      });

      this.rootStore.authToken = new URL(this.baseFileUrl).searchParams.get("authorization");

      this.metadata = videoObject.metadata;
      this.isVideo = videoObject.isVideo;
      this.playoutUrl = videoObject.playoutUrl;
      this.availableOfferings = videoObject.availableOfferings;
      this.offeringKey = videoObject.offeringKey;
      this.thumbnailTrackUrl = videoObject.thumbnailTrackUrl;
      this.hasAssets = videoObject.metadata.assets;

      try {
        if(this.channel) {
          videoObject.rate = videoObject.metadata?.channel?.source_info?.frameRate;
          videoObject.frameRateSpecified = !!videoObject.rate;
        } else {
          videoObject.primaryContentStartTime = 0;
          const offering = videoObject.metadata.offerings[videoObject.offeringKey];
          const offeringOptions = offering.media_struct.streams || {};

          let rate;
          if(offeringOptions.video) {
            rate = offeringOptions.video.rate;
          } else {
            const videoKey = Object.keys(offeringOptions).find(key => key.startsWith("video"));
            rate = offeringOptions[videoKey].rate;
          }

          videoObject.frameRateSpecified = true;
          videoObject.rate = rate;

          this.SetFrameRate({rateRat: rate});

          if(offering.entry_point_rat) {
            this.primaryContentStartTime = FrameAccurateVideo.ParseRat(offering.entry_point_rat);
          }

          if(offering.exit_point_rat) {
            // End time is end of specified frame
            this.primaryContentEndTime = Number((FrameAccurateVideo.ParseRat(offering.exit_point_rat)).toFixed(3));
          }
        }
      } catch(error) {
        // eslint-disable-next-line no-console
        console.error("Unable to determine frame rate");
      }

      this.duration = videoObject.duration;
      this.videoHandler = new FrameAccurateVideo({
        frameRate: this.frameRate,
        frameRateRat: this.frameRateRat,
        dropFrame: this.dropFrame,
        duration: this.duration || 1
      });

      if(this.duration) {
        this.durationSMPTE = this.videoHandler?.TimeToSMPTE(this.duration);
        this.totalFrames = this.videoHandler?.TotalFrames(this.duration);

        this.SetClipMark({
          inFrame: 0,
          outFrame: this.videoHandler.TotalFrames(this.duration)
        });
      }

      this.thumbnailStore.LoadThumbnails(this.thumbnailTrackUrl);

      if(!this.tags) {
        this.initialized = true;
        this.ready = true;
        return;
      }

      // Load tags and assets
      this.rootStore.assetStore.SetAssets(videoObject.metadata.assets);
      this.rootStore.downloadStore.LoadDownloadJobInfo();

      if(!this.isVideo) {
        this.initialized = true;
        this.ready = true;
      } else {
        // Load and merge tag files
        const tagData = yield this.rootStore.client.utils.LimitedMap(
          5,
          Object.keys(this.metadata.video_tags?.metadata_tags || {}),
          async linkKey => ({
            linkKey,
            tags: await this.rootStore.client.LinkData({
              versionHash: this.versionHash,
              linkPath: `video_tags/metadata_tags/${linkKey}`,
              format: "json"
            })
          })
        );

        const metadataTags = FormatTags({tagData});

        let clipTags;
        if(videoObject.metadata?.clips?.metadata_tags) {
          clipTags = FormatTags({
            tagData: [{
              linkKey: "clips",
              tags: videoObject.metadata?.clips
            }]
          });
        }

        yield this.rootStore.trackStore.InitializeTracks(metadataTags, clipTags);

        this.ready = true;
      }
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load:");
      // eslint-disable-next-line no-console
      console.log(error);

      this.rootStore.SetError(error.toString());
    } finally {
      this.loading = false;
    }
  });

  Reload = flow(function * () {
    const objectId = this.videoObject?.objectId;
    const offering = this.offeringKey;

    this.Reset();
    yield this.SetVideo({objectId, writeToken: this.videoObject?.writeToken, preferredOfferingKey: offering});
  });

  ReloadMetadata = flow(function * () {
    const versionHash = this.rootStore.menuStore.selectedObject.versionHash;

    this.metadata = yield this.rootStore.client.ContentObjectMetadata({
      versionHash,
      resolveLinks: true,
      resolveIgnoreErrors: true,
      linkDepthLimit: 1,
      select: [
        "public/name",
        "public/description",
        "offerings",
        "video_tags",
        "clips",
        "mime_types"
      ]
    });

    if(this.videoObject) {
      this.videoObject.metadata = this.metadata;
    }
  });

  // Update version hash and urls without reloading (e.g. uploading files)
  UpdateObjectVersion = flow(function * () {
    if(!this.videoObject.objectId) { return; }

    this.versionHash = yield this.rootStore.client.LatestVersionHash({objectId: this.videoObject.objectId});

    this.baseUrl = yield this.rootStore.client.FabricUrl({
      versionHash: this.versionHash
    });

    this.baseStateChannelUrl = yield this.rootStore.client.FabricUrl({
      versionHash: this.versionHash,
      channelAuth: true
    });

    this.baseFileUrl = yield this.rootStore.client.FileUrl({
      versionHash: this.versionHash,
      filePath: "/"
    });

    this.videoObject.versionHash = this.versionHash;
  });

  Initialize(video, player) {
    this.loading = true;

    this.initialized = false;
    this.video = video;
    this.player = player;

    const videoHandler = new FrameAccurateVideo({
      video,
      frameRate: this.frameRate,
      frameRateRat: this.frameRateRat,
      dropFrame: this.dropFrame,
      callback: this.Update,
      duration: this.duration
    });

    this.videoHandler = videoHandler;

    video.load();

    this.volume = video.volume;
    this.muted = video.muted;

    this.player.on(HLS.Events.LEVEL_SWITCHED, action(() => {
      this.levels = this.player.levels;
      this.currentLevel = this.player.currentLevel;
    }));

    this.player.on(HLS.Events.AUDIO_TRACKS_UPDATED, action(() => {
      this.audioTracks = this.player.audioTracks;
      this.currentAudioTrack = this.player.audioTrack;
    }));

    this.player.on(HLS.Events.AUDIO_TRACK_SWITCHED, action(() => {
      this.audioTracks = this.player.audioTracks;
      this.currentAudioTrack = this.player.audioTrack;
    }));

    this.player.on(HLS.Events.SUBTITLE_TRACKS_UPDATED, action(() => {
      this.subtitleTracks = this.player.subtitleTracks;
      this.currentSubtitleTrack = this.player.subtitleTrack;
    }));

    this.player.on(HLS.Events.SUBTITLE_TRACK_SWITCH, action(() => {
      this.subtitleTracks = this.player.subtitleTracks;
      this.currentSubtitleTrack = this.player.subtitleTrack;
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
          //this.rootStore.SetError("Playback Error");
          this.Reset();
        }
      }
    }));

    this.player.on(HLS.Events.FRAG_LOADED, action(() => {
      // Loaded good segment, reset error count
      this.consecutiveSegmentErrors = 0;
    }));

    // Use video element as source of truth - attach handlers to relevant events to update app state
    this.video.addEventListener("pause", action(() => {
      this.playing = false;
      this.segmentEnd = undefined;
    }));
    this.video.addEventListener("play", action(() => this.playing = true));
    this.video.addEventListener("ratechange", action(() => this.playbackRate = this.video.playbackRate));
    this.video.addEventListener("volumechange", action(() => {
      this.volume = video.volume;
      this.muted = video.muted;
    }));
    this.video.addEventListener("click", action(() => {
      // Handle click (play/pause) and double click (enter/exit full screen)
      if(this.click) {
        // Doubleclick
        clearTimeout(this.click);
        this.click = undefined;

        // TODO: Fullscreen handling
        this.ToggleFullscreen();
      } else {
        // Single click delayed by 200ms
        this.click = setTimeout(() => {
          this.video.paused ? this.video.play() : this.video.pause();
          this.click = undefined;
        }, 200);
      }
    }));

    const loadedSource = this.playoutUrl;

    // When sufficiently loaded, update video info and mark video as initialized
    const InitializeDuration = action(() => {
      if(this.initialized || this.playoutUrl !== loadedSource) { return; }

      if(this.video.readyState > 2 && this.video.duration > 3 && isFinite(this.video.duration)) {
        videoHandler.Update();
        this.initialized = true;

        if(!this.primaryContentEndTime) {
          this.primaryContentEndTime = Number((this.video.duration).toFixed(3));
        }

        if(this.initialClipPoints && Object.keys(this.initialClipPoints).length > 0) {
          this.SetClipMark(this.initialClipPoints);
        } else if(!this.clipOutFrame || this.clipOutFrame < 1) {
          this.SetClipMark({
            inFrame: 0,
            outFrame: this.videoHandler.TotalFrames(this.duration)
          });
        }

        this.aspectRatio = this.video.videoWidth / this.video.videoHeight;
      }

      this.InitializeCallback?.(this.video);
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

    this.loading = false;
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

  SetClipMark({inFrame, outFrame, inProgress, outProgress, inTime, outTime}) {
    if(typeof inProgress !== "undefined" && inProgress >= 0) {
      inFrame = this.ProgressToFrame(inProgress);
    } else if(typeof inTime!== "undefined" && inTime >= 0) {
      inFrame = this.TimeToFrame(inTime);
    }

    if(typeof outProgress !== "undefined" && outProgress <= 100) {
      outFrame = this.ProgressToFrame(outProgress);
    } else if(typeof outTime !== "undefined") {
      outFrame = this.TimeToFrame(outTime);
    }

    inFrame = typeof inFrame === "undefined" ? this.clipInFrame : inFrame;
    outFrame = typeof outFrame === "undefined" ? this.clipOutFrame : outFrame;

    const inFrameChanged = inFrame !== this.clipInFrame;
    const outFrameChanged = outFrame !== this.clipOutFrame;

    const totalFrames = this.videoHandler.TotalFrames(this.duration);

    if(typeof inFrame !== "undefined") { this.clipInFrame = Math.max(0, inFrame); }
    if(outFrame) { this.clipOutFrame = Math.min(outFrame, totalFrames - 1); }

    if(!this.clipInFrame) { this.clipInFrame = 0; }
    if(!this.clipOutFrame) { this.clipOutFrame = totalFrames - 1; }

    if(inFrameChanged && inFrame >= this.clipOutFrame) {
      this.clipOutFrame = Math.min(totalFrames - 1, this.clipInFrame + Math.floor(totalFrames * 0.05));
    } else if(outFrameChanged && outFrame <= this.clipInFrame) {
      this.clipInFrame = Math.max(0, this.clipOutFrame - Math.floor(totalFrames * 0.05));
    }

    return {
      clipInFrame: this.clipInFrame,
      clipOutFrame: this.clipOutFrame
    };
  }

  ParseClipParams() {
    const params = new URLSearchParams(window.location.search);
    let clipPoints = {};
    if(params.has("sf")) {
      clipPoints.inFrame = parseInt(params.get("sf"));
    } else if(params.has("st")) {
      clipPoints.inTime = parseFloat(params.get("st"));
    }

    if(params.has("ef")) {
      clipPoints.outFrame = parseInt(params.get("ef"));
    } else if(params.has("et")) {
      clipPoints.outTime = parseFloat(params.get("et"));
    }

    if(params.has("isolate")) {
      clipPoints.isolate = true;
    }

    return Object.keys(clipPoints).length > 0 ? clipPoints : undefined;
  }

  FocusView(clipParams) {
    const {clipInFrame, clipOutFrame} = this.SetClipMark(clipParams);

    if(clipParams.isolate) {
      this.rootStore.tagStore.IsolateTag({
        tagId: this.rootStore.NextId(),
        startTime: this.FrameToTime(clipInFrame),
        endTime: this.FrameToTime(clipOutFrame)
      });
    } else {
      this.SetScale(
        this.FrameToProgress(clipInFrame) - 1,
        this.FrameToProgress(clipOutFrame) + 1,
      );
    }

    setTimeout(() => this.Seek(clipInFrame), 1000);
  }

  SMPTEToTime(smpte) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.SMPTEToTime(smpte);
  }

  SMPTEToFrame(smpte) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.SMPTEToFrame(smpte);
  }

  ProgressToTime(seek) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.ProgressToTime(seek / 100, this.duration);
  }

  ProgressToSMPTE(seek) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.ProgressToSMPTE(seek / 100, this.duration);
  }

  ProgressToFrame(seek) {
    if(!this.videoHandler) { return; }

    return this.TimeToFrame(this.ProgressToTime(seek));
  }

  TimeToSMPTE(time) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.TimeToSMPTE(time);
  }

  TimeToFrame(time, round=false) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.TimeToFrame(time, round);
  }

  TimeToProgress(time) {
    if(!this.videoHandler) { return 0; }

    return 100 * time / this.duration;
  }

  FrameToProgress(frame) {
    if(!this.videoHandler) { return 0; }

    return this.TimeToProgress(this.FrameToTime(frame));
  }

  FrameToTime(frame, roundUp=true) {
    if(!this.videoHandler || frame === 0) { return 0; }

    const result = this.videoHandler.FrameToTime(frame);

    return !roundUp ?
      result :
      // Pad number to ensure its rounded up
      Number((result + 0.00051).toFixed(3));
  }

  FrameToSMPTE(frame) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.FrameToSMPTE(frame);
  }

  TimeToString(time, includeFractionalSeconds) {
    if(!this.videoHandler) { return 0; }

    // Pad number to ensure its rounded up
    return this.videoHandler.TimeToString({time, includeFractionalSeconds});
  }

  Update({frame, smpte}) {
    if(!this.video || !this.video.duration) { return; }

    this.frame = Math.floor(frame);
    this.duration = this.duration || this.video.duration;
    this.durationSMPTE = this.videoHandler?.TimeToSMPTE(this.duration);
    this.videoHandler.duration = this.video.duration;
    this.totalFrames = this.totalFrames || this.videoHandler?.TotalFrames(this.duration);
    if(this.clipOutFrame >= this.totalFrames - 2) {
      // Minor shift in duration from channels may cause unset clip out point to show
      this.clipOutFrame = this.totalFrames - 1;
    }
    this.smpte = smpte;
    this.seek = 100 * frame / (this.totalFrames || 1);
    this.currentTime = this.video.currentTime;

    /*
    // Ensure min isn't less than seek - may happen if the video isn't buffered
    if(this.seek < this.scaleMin) {
      this.scaleMin = this.seek;
    }

    */
    if(this.playing && this.seek > this.scaleMax) {
      // If playing has gone beyond the max scale, push the whole scale slider forward by 50%
      const currentRange = this.scaleMax - this.scaleMin;
      const max = Math.min(100, this.scaleMax + this.scaleMagnitude / 2);
      this.SetScale(max - currentRange, max);
    }


    // Segment play specified - stop when segment ends
    if(this.segmentEnd && this.frame >= this.segmentEnd - 3) {
      this.video.pause();
      this.Seek(this.segmentEnd - 1);

      this.EndSegment();
    }
  }

  PlayPause(pause) {
    if(!pause && this.video?.paused) {
      this.video?.play();
    } else {
      this.video?.pause();
    }
  }

  SetPlaybackLevel(level) {
    this.player.nextLevel = parseInt(level);
    this.player.streamController.immediateLevelSwitch();
  }

  SetAudioTrack(trackIndex) {
    this.player.audioTrack = parseInt(trackIndex);
    this.player.streamController.immediateLevelSwitch();
  }

  SetSubtitleTrack(trackIndex) {
    this.player.subtitleTrack = parseInt(trackIndex);
    this.player.streamController.immediateLevelSwitch();
  }

  SetPlaybackRate(rate) {
    this.video.playbackRate = rate;
  }

  ChangePlaybackRate(delta) {
    this.video.playbackRate = Math.min(4, Math.max(0.1, this.video.playbackRate + delta));
  }

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

  SetDropFrame(dropFrame) {
    this.dropFrame = dropFrame;
    this.videoHandler.dropFrame = this.dropFrame;

    this.videoHandler.Update();
  }

  ScrollScale(position, delta) {
    if(
      !this.video ||
      !this.video.duration ||
      (this.scaleMax - this.scaleMin < MIN_SCALE * 1.1 && delta < 0)
    ) { return; }

    delta = delta < 0 ? 3 : -3;

    if(this.scaleMagnitude < 5) {
      delta *= 0.25;
    }

    let deltaMin, deltaMax;

    const minProportion = position;
    const maxProportion = 1 - position;

    deltaMin = delta * minProportion;
    deltaMax = delta * maxProportion;

    this.SetScale(
      Math.max(0, this.scaleMin + deltaMin),
      Math.min(100, this.scaleMax - deltaMax)
    );
  }

  SetScale(min, max, preserveRange=false) {
    if(max < min) {
      return;
    }

    let initialRange = this.scaleMagnitude;

    const minChanged = min !== this.scaleMin;
    const maxChanged = max !== this.scaleMax;

    if(minChanged) {
      // Min changed
      this.scaleMin = Math.max(0, min);
      this.scaleMax = max;

      if(this.scaleMax - this.scaleMin < MIN_SCALE) {
        this.scaleMin = this.scaleMax - MIN_SCALE;
      }
    }

    if(maxChanged) {
      // Max changed
      this.scaleMax = Math.min(100, max);
      this.scaleMin = min;

      if(this.scaleMax - this.scaleMin < MIN_SCALE) {
        this.scaleMax = this.scaleMin + MIN_SCALE;
      }
    }

    this.scaleMin = Math.min(100 - MIN_SCALE, Math.max(0, this.scaleMin));
    this.scaleMax = Math.max(0 + MIN_SCALE, Math.min(100, this.scaleMax));

    if(preserveRange) {
      if(this.scaleMin === 0) {
        this.scaleMax = Math.min(100, this.scaleMin + initialRange);
      } else if(this.scaleMax === 100) {
        this.scaleMin = Math.max(0, this.scaleMax - initialRange);
      }
    }
  }

  SetSegment(startFrame, endFrame) {
    this.Seek(startFrame);
    this.segmentEnd = endFrame;
  }

  PlaySegment(startFrame, endFrame) {
    this.SetSegment(startFrame, endFrame);
    this.video.play();
  }

  EndSegment() {
    this.segmentEnd = undefined;
  }

  Seek(frame, clearSegment=true) {
    if(clearSegment) { this.EndSegment(); }
    this.videoHandler.Seek(frame);
  }

  SeekPercentage(percent, clearSegment=true) {
    if(clearSegment) { this.EndSegment(); }
    this.videoHandler.SeekPercentage(percent, this.duration);
  }

  SeekFrames({frames=0, seconds=0}) {
    if(this.playing) {
      this.PlayPause();
    }

    if(seconds) {
      frames += Math.ceil(this.frameRate) * seconds;
    }

    // Adjust scale, if necessary
    const targetFrame = this.frame + frames;
    const targetScale = (targetFrame / this.videoHandler.TotalFrames(this.duration)) * 100;
    const bump = 100 * 0.015;

    if(targetScale <= this.scaleMin) {
      const min = Math.max(0, targetScale - bump);
      this.SetScale(min, min + this.scaleMagnitude);
    } else if(targetScale >= this.scaleMax) {
      const max = Math.min(100, targetScale + bump);
      this.SetScale(max - this.scaleMagnitude, max);
    }

    this.videoHandler.Seek(targetFrame);
  }

  ScrollVolume(deltaY) {
    const volume = this.muted ? 0 : this.volume;

    this.SetVolume(
      Math.max(0, Math.min(100, volume - (deltaY * 0.001)))
    );
  }

  SetVolume(volume) {
    this.video.volume = Math.max(0, Math.min(1, volume));

    if(volume === 0) {
      this.video.muted = true;
    } else if(this.video.muted && volume !== 0) {
      this.video.muted = false;
    }
  }

  ChangeVolume(delta) {
    if(this.video.muted && delta > 0) {
      // Go up from 0 if muted
      this.video.volume = delta;
    } else {
      this.video.volume = Math.max(0, Math.min(1, this.video.volume + delta));
    }

    if(this.video.volume === 0) {
      this.video.muted = true;
    } else if(this.video.muted && this.video.volume !== 0) {
      this.video.muted = false;
    }
  }

  SetMuted(muted) {
    this.video.muted = muted;

    if(!muted && this.video.volume === 0) {
      this.video.volume = 0.5;
    }
  }

  ToggleMuted() {
    this.video.muted = !this.video.muted;

    if(!this.video.muted && this.video.volume === 0) {
      this.video.volume = 0.5;
    }
  }

  SetFullscreen() {
    this.fullScreen = !!document.fullscreenElement;
  }

  ToggleFullscreen() {
    if(document.fullscreenElement) {
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
      const videoContainer = this.video.__containerElement;

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

  async SaveVideo() {
    const currentLevel = this.levels[this.currentLevel];
    const currentAudioTrack = this.audioTracks[this.currentAudioTrack];
    const offering = this.metadata.offerings[this.offeringKey];
    const playoutKey = Object.keys(offering.playout.streams.video.representations)
      .find(key => {
        const playout = offering.playout.streams.video.representations[key];

        return (
          playout.height.toString() === currentLevel.height.toString() &&
          playout.width.toString() === currentLevel.width.toString() &&
          playout.bit_rate.toString() === currentLevel.bitrate.toString()
        );
      });

    let queryParams = {};

    let audioName;
    if(this.audioTracks.length > 1) {
      queryParams.audio = currentAudioTrack.attrs.URI.split("/")[1];
      audioName = currentAudioTrack.name || currentAudioTrack.lang;
    }

    const filename = `${this.name} (${currentLevel.width}x${currentLevel.height})${audioName ? ` (${audioName}) ` : ""}(${this.FrameToSMPTE(this.clipInFrame).replaceAll(":", "-")} - ${this.FrameToSMPTE(this.clipOutFrame).replaceAll(":", "-")}).mp4`;

    if(this.clipInFrame > 0) {
      queryParams.clip_start = this.FrameToTime(this.clipInFrame);
    }

    if(this.videoHandler.TotalFrames() > this.clipOutFrame + 1) {
      queryParams.clip_end = this.FrameToTime(this.clipOutFrame + 1);
    }

    queryParams["header-x_set_content_disposition"] = `attachment;filename="${filename}";`;

    const downloadUrl = await this.rootStore.client.Rep({
      versionHash: this.versionHash,
      rep: UrlJoin("media_download", this.offeringKey, playoutKey),
      queryParams,
      channelAuth: true
    });

    DownloadFromUrl(
      downloadUrl,
      filename
    );
  }


  // Video/Audio track info

  ResolutionOptions(offering) {
    // Defer to source for channels
    if(this.sourceVideoStore) {
      return this.sourceVideoStore.ResolutionOptions(this.sourceVideoStore.offeringKey);
    }

    const repMetadata = this?.metadata?.offerings?.[offering]?.playout?.streams?.video?.representations || {};

    const repInfo = (
      Object.keys(repMetadata)
        .map(repKey => {
          try {
            const { bit_rate, codec, height, width } = repMetadata[repKey];

            return {
              key: repKey,
              resolution: `${width}x${height}`,
              width,
              height,
              codec,
              bitrate: bit_rate,
              string: `${width}x${height} (${(parseInt(bit_rate) / 1000 / 1000).toFixed(1)}Mbps)`
            };
          } catch(error) {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        })
        .filter(rep => rep)
        .sort((a, b) => a.bitrate > b.bitrate ? -1 : 1)
    );

    if(repInfo[0]) {
      repInfo[0].isTopResolution = true;
    }

    return repInfo;
  }

  AudioOptions(offering) {
    // Defer to source for channels
    if(this.sourceVideoStore) {
      return this.sourceVideoStore.AudioOptions(this.sourceVideoStore.offeringKey);
    }

    const audioRepMetadata = this.metadata.offerings?.[offering]?.playout?.streams || {};
    const mediaStruct = this.metadata.offerings?.[offering]?.media_struct?.streams || {};

    const currentAudioTrack = this.audioTracks[this.currentAudioTrack];
    return (
      Object.keys(audioRepMetadata)
        .map(streamKey =>
          Object.keys(audioRepMetadata[streamKey]?.representations || {})
            .map(repKey => {
              try {
                const rep = audioRepMetadata[streamKey].representations?.[repKey];
                const label = mediaStruct[streamKey]?.label;

                if(rep.type !== "RepAudio") { return; }

                return {
                  trackId: this.audioTracks.find(t => t.name === label)?.id,
                  key: repKey,
                  bitrate: rep.bit_rate,
                  default: mediaStruct[streamKey]?.default_for_media_type,
                  current: label === currentAudioTrack?.name,
                  label: label || repKey,
                  string: label ?
                    `${label} (${(parseInt(rep.bit_rate) / 1000).toFixed(0)}Kbps)` :
                    repKey
                };
              } catch(error) {
                // eslint-disable-next-line no-console
                console.error(error);
              }
            })
        )
        .flat()
        .filter(rep => rep)
        .sort((a, b) => a.string < b.string ? -1 : 1)
    );
  }
}

export default VideoStore;
