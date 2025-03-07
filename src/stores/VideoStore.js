import { action, flow, makeAutoObservable } from "mobx";
import FrameAccurateVideo, {FrameRateDenominator, FrameRateNumerator, FrameRates} from "@/utils/FrameAccurateVideo";
import UrlJoin from "url-join";
import HLS from "hls.js";
import {DownloadFromUrl} from "@/utils/Utils.js";

// How far the scale can be zoomed, as a percentage
const MIN_SCALE = 0.2;

class VideoStore {
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
  hasAssets = false;
  ready = false;
  showVideoControls = true;

  consecutiveSegmentErrors = 0;

  levels = [];
  currentLevel;

  audioTracks = [];
  currentAudioTrack;

  subtitleTracks = [];
  currentSubtitleTrack = -1;

  source;
  baseUrl = undefined;
  baseStateChannelUrl = undefined;
  baseFileUrl = undefined;
  previewSupported = false;
  downloadUrl;

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
  playbackRate = 2.0;
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

  downloadJobInfo = {};
  downloadJobStatus = {};
  downloadedJobs = {};

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

  constructor(rootStore) {
    makeAutoObservable(
      this,
      {
        metadata: false
      }
    );

    this.rootStore = rootStore;

    this.Update = this.Update.bind(this);
  }

  Reset() {
    this.loading = true;
    this.initialized = false;
    this.isVideo = false;
    this.hasAssets = false;

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

    this.source = undefined;
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

    this.clipInFrame = undefined;
    this.clipOutFrame = undefined;

    this.rootStore.tagStore.ClearTags();
    this.rootStore.trackStore.Reset();
  }

  ToggleVideoControls(enable) {
    this.showVideoControls = enable;
  }

  SetOffering = flow(function * (offeringKey) {
    yield this.SetVideo({...this.videoObject, preferredOfferingKey: offeringKey});
  });

  SetVideo = flow(function * ({libraryId, objectId, preferredOfferingKey="default"}) {
    this.loading = true;
    this.ready = false;
    this.rootStore.SetError(undefined);

    try {
      this.rootStore.Reset();
      this.selectedObject = undefined;

      if(!libraryId) {
        libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});
      }

      const versionHash = yield this.rootStore.client.LatestVersionHash({objectId});

      const metadata = yield this.rootStore.client.ContentObjectMetadata({
        versionHash,
        resolveLinks: true,
        resolveIgnoreErrors: true,
        linkDepthLimit: 1,
        select: [
          "public/name",
          "public/description",
          "offerings",
          "video_tags",
          "mime_types",
          "assets"
        ]
      });

      const videoObject = {
        libraryId,
        objectId,
        versionHash,
        name: metadata.public && metadata.public.name || metadata.name || versionHash,
        description: metadata.public && metadata.public.description || metadata.description,
        metadata,
        isVideo: metadata.offerings
      };

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

      this.rootStore.signedToken = new URL(this.baseFileUrl).searchParams.get("authorization");

      this.metadata = videoObject.metadata;
      this.isVideo = videoObject.isVideo;
      this.hasAssets = Object.keys((videoObject.metadata || {}).assets || {}).length > 0;

      if(this.hasAssets) {
        this.rootStore.assetStore.SetAssets(videoObject.metadata.assets);
      }

      this.LoadDownloadJobInfo();

      let metadataTags = {};
      if(!this.isVideo) {
        this.initialized = true;
        this.ready = true;
      } else {
        this.availableOfferings = yield this.rootStore.client.AvailableOfferings({
          versionHash: videoObject.versionHash
        });

        if(this.availableOfferings?.default) {
          this.availableOfferings.default.display_name = "Default Offering";
        }

        this.SetOfferingClipDetails();

        const browserSupportedDrms = (yield this.rootStore.client.AvailableDRMs() || []).filter(drm => ["clear", "aes-128"].includes(drm));
        const { playoutOptions, offeringKey } = yield this.GetSupportedOffering({
          versionHash: videoObject.versionHash,
          browserSupportedDrms,
          preferredOfferingKey
        });

        this.offeringKey = offeringKey;

        // Specify playout for full, untrimmed content
        const playoutMethods = playoutOptions["hls"].playoutMethods;

        this.drm = playoutMethods.clear ? "clear" : "aes-128";

        const source = new URL((playoutMethods.clear || playoutMethods["aes-128"]).playoutUrl);
        source.searchParams.set("ignore_trimming", true);
        source.searchParams.set("player_profile", "hls-js-2441");

        const thumbnailTrackUrl = (playoutMethods.clear || playoutMethods["aes-128"]).thumbnailTrack;

        this.source = source.toString();
        this.thumbnailTrackUrl = thumbnailTrackUrl;

        try {
          this.primaryContentStartTime = 0;

          const offering = this.metadata.offerings[this.offeringKey];
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

          if(offering.tag_point_rat) {
            this.primaryContentStartTime = FrameAccurateVideo.ParseRat(offering.tag_point_rat);
          }

          if(offering.exit_point_rat) {
            // End time is end of specified frame
            this.primaryContentEndTime = Number((FrameAccurateVideo.ParseRat(offering.exit_point_rat)).toFixed(3));
          }
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error("Unable to determine frame rate");
        }

        // Tags
        if(this.metadata.video_tags && this.metadata.video_tags.metadata_tags) {
          if(this.metadata.video_tags.metadata_tags["/"]) {
            // Single tag file

            metadataTags = yield this.rootStore.client.LinkData({
              versionHash: this.versionHash,
              linkPath: "video_tags/metadata_tags",
              format: "json"
            });
          } else {
            // Load and merge tag files
            // Record file, group and index of tags so that they can be individually modified
            const tagData = yield this.rootStore.client.utils.LimitedMap(
              5,
              Object.keys(this.metadata.video_tags.metadata_tags),
              async fileName => await this.rootStore.client.LinkData({
                versionHash: this.versionHash,
                linkPath: `video_tags/metadata_tags/${fileName}`,
                format: "json"
              })
            );

            tagData.forEach((tags, fileIndex) => {
              if(!tags) { return; }

              const tagVersion = tags.version || 0;

              if(tags.metadata_tags) {
                Object.keys(tags.metadata_tags).forEach(trackKey => {
                  const trackTags = ((tags.metadata_tags[trackKey].tags) || [])
                    .map((tag, tagIndex) => ({...tag, fi: fileIndex, tk: trackKey, ti: tagIndex}));

                  if(metadataTags[trackKey]) {
                    metadataTags[trackKey].tags = metadataTags[trackKey].tags
                      .concat(trackTags)
                      .sort((a, b) => a.startTime < b.startTime ? -1 : 1);
                  } else {
                    metadataTags[trackKey] = {
                      ...tags.metadata_tags[trackKey],
                      tags: trackTags
                    };
                  }

                  metadataTags[trackKey].version = tagVersion;
                });
              }
            });
          }
        }

        delete metadataTags.shot_tags;

        this.rootStore.trackStore.InitializeTracks(metadataTags);

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

  GetSupportedOffering = flow(function * ({versionHash, browserSupportedDrms, preferredOfferingKey}) {
    const offeringPlayoutOptions = {};

    const offeringKeys = Object.keys(this.availableOfferings)
      .sort((a, b) => {
        // Prefer 'default', then anything including 'default', then alphabetically
        if(a === "default") {
          return -1;
        } else if(b === "default") {
          return 1;
        } else if(a.includes("default")) {
          return b.includes("default") ? 0 : -1;
        } else if(b.includes("default")) {
          return 1;
        }

        return a < b ? -1 : 1;
      });

    let offeringKey;
    for(let offering of offeringKeys) {
      offeringPlayoutOptions[offering] = yield this.rootStore.client.PlayoutOptions({
        versionHash,
        protocols: ["hls"],
        drms: browserSupportedDrms,
        hlsjsProfile: false,
        offering
      });

      const playoutMethods = offeringPlayoutOptions[offering].hls.playoutMethods;

      if(!(playoutMethods["aes-128"] || playoutMethods["clear"])) {
        this.availableOfferings[offering].disabled = true;
      } else {
        if(!offeringKey || offering === preferredOfferingKey) {
          offeringKey = offering;
        }
      }
    }

    const hasHlsOfferings = Object.values(this.availableOfferings).some(offering => !offering.disabled);

    if(!hasHlsOfferings) { throw Error("No offerings with HLS Clear or AES-128 playout found."); }

    return {
      playoutOptions: offeringPlayoutOptions[offeringKey],
      offeringKey
    };
  });

  SetOfferingClipDetails = () => {
    Object.keys(this.metadata.offerings || {}).map(offeringKey => {
      const tagPointRat = this.metadata.offerings[offeringKey].tag_point_rat;
      const exitPointRat = this.metadata.offerings[offeringKey].exit_point_rat;
      let tagPoint = null, exitPoint = null;

      if(tagPointRat) {
        tagPoint = FrameAccurateVideo.ParseRat(tagPointRat);
      }

      if(exitPointRat) {
        exitPoint = FrameAccurateVideo.ParseRat(exitPointRat);
      }

      this.availableOfferings[offeringKey].tag = tagPoint;
      this.availableOfferings[offeringKey].exit = exitPoint;
      this.availableOfferings[offeringKey].durationTrimmed = (tagPoint === null || exitPoint === null) ? null : (exitPoint - tagPoint);
    });
  };

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
        "files",
        "mime_types"
      ]
    });

    if(this.videoObject) {
      this.videoObject.metadata = this.metadata;
    }
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
      callback: this.Update
    });

    this.videoHandler = videoHandler;

    video.load();

    // Attach fullscreen state handling to video container
    video.__containerElement.onfullscreenchange = action(() => this.fullScreen = !this.fullScreen);

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

        this.clipInFrame = 0;
        this.clipOutFrame = this.videoHandler.TotalFrames() - 1;

        this.aspectRatio = this.video.videoWidth / this.video.videoHeight;
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

  SetClipMark({inFrame, outFrame, inProgress, outProgress}) {
    if(typeof inProgress !== "undefined" && inProgress >= 0) {
      inFrame = this.ProgressToFrame(inProgress);
    }

    if(typeof outProgress !== "undefined" && outProgress <= 100) {
      outFrame = this.ProgressToFrame(outProgress);
    }

    const inFrameChanged = inFrame !== this.clipInFrame;
    const outFrameChanged = outFrame !== this.clipOutFrame;

    const totalFrames = this.videoHandler.TotalFrames();

    if(typeof inFrame !== "undefined") { this.clipInFrame = Math.max(0, inFrame); }
    if(outFrame) { this.clipOutFrame = Math.min(outFrame, totalFrames - 1); }

    if(!this.clipInFrame) { this.clipInFrame = 0; }
    if(!this.clipOutFrame) { this.clipOutFrame = totalFrames - 1; }

    if(inFrameChanged && inFrame >= this.clipOutFrame) {
      this.clipOutFrame = Math.min(totalFrames - 1, this.clipInFrame + (totalFrames * 0.05));
    } else if(outFrameChanged && outFrame <= this.clipInFrame) {
      this.clipInFrame = Math.max(0, this.clipOutFrame - (totalFrames * 0.05));
    }
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

    return this.videoHandler.ProgressToTime(seek / 100);
  }

  ProgressToSMPTE(seek) {
    if(!this.videoHandler) { return; }

    return this.videoHandler.ProgressToSMPTE(seek / 100);
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

  Update({frame, smpte, progress}) {
    if(!this.video) { return; }

    this.frame = Math.floor(frame);
    this.totalFrames = this.videoHandler?.TotalFrames();
    this.smpte = smpte;
    this.seek = progress * 100;
    this.duration = this.video.duration;
    this.durationSMPTE = this.videoHandler?.TimeToSMPTE(this.video.duration);
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

  PlaySegment(startFrame, endFrame) {
    this.Seek(startFrame);
    this.segmentEnd = endFrame;
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
    this.videoHandler.SeekPercentage(percent);
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
    const targetScale = (targetFrame / this.videoHandler.TotalFrames()) * 100;
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


  // Clip download

  // Video/Audio track info

  ResolutionOptions(offering) {
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

  DownloadJobDefaultFilename({format="mp4", offering="default", clipInFrame, clipOutFrame, representationInfo, audioRepresentationInfo}) {
    let filename = this.name;

    if(offering && offering !== "default") {
      filename = `${filename} (${offering})`;
    }

    if(clipInFrame || (clipOutFrame && clipOutFrame !== this.videoHandler.TotalFrames() - 1)) {
      const startTime = this.videoHandler.FrameToString({frame: clipInFrame}).replaceAll(" ", "");
      const endTime = this.videoHandler.FrameToString({frame: clipOutFrame || this.videoHandler.TotalFrames()}).replaceAll(" ", "");
      filename = `${filename} (${startTime} - ${endTime})`;
    }

    if(representationInfo && !representationInfo.isTopResolution) {
      filename = `${filename} (${representationInfo.width}x${representationInfo.height})`;
    }

    if(audioRepresentationInfo && !audioRepresentationInfo.default) {
      filename = `${filename} (${audioRepresentationInfo.label})`;
    }

    return `${filename}.${format === "mp4" ? "mp4" : "mov"}`;
  }

  async SaveDownloadJobInfo() {
    await this.rootStore.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `download-jobs-${this.videoObject.objectId}`,
      value: this.rootStore.client.utils.B64(
        JSON.stringify(this.downloadJobInfo || {})
      )
    });
  }

  LoadDownloadJobInfo = flow(function * () {
    const response = JSON.parse(
      this.rootStore.client.utils.FromB64(
        (yield this.rootStore.client.walletClient.ProfileMetadata({
          type: "app",
          appId: "video-editor",
          mode: "private",
          key: `download-jobs-${this.videoObject.objectId}`,
        })) || ""
      ) || "{}"
    );

    let deleted = false;
    // Remove expired entries
    Object.keys(response).forEach(key => {
      if(Date.now() > response[key].expiresAt) {
        delete response[key];
        deleted = true;
      }
    });

    this.downloadJobInfo = response;

    if(deleted) {
      this.SaveDownloadJobInfo();
    }
  });

  StartDownloadJob = flow(function * ({
    filename,
    format="mp4",
    offering="default",
    representation,
    audioRepresentation,
    clipInFrame,
    clipOutFrame,
    encrypt=true
  }) {
    try {
      filename = filename || this.DownloadJobDefaultFilename({format, offering, clipInFrame, clipOutFrame});
      const expectedExtension = format === "mp4" ? ".mp4" : ".mov";
      if(!filename.endsWith(expectedExtension)) {
        filename = `${filename}${expectedExtension}`;
      }

      let params = {
        format,
        offering,
        filename
      };

      if(representation) {
        params.representation = representation;
      }

      if(audioRepresentation) {
        params.audio = audioRepresentation;
      }

      if(clipInFrame) {
        // Use more literal time for api as opposed to SMPTE
        params.start_ms = `${((1 / this.frameRate) * clipInFrame).toFixed(4)}s`;
      }

      if(clipOutFrame && clipOutFrame !== this.videoHandler.TotalFrames() - 1) {
        params.end_ms = `${((1 / this.frameRate) * clipOutFrame).toFixed(4)}s`;
      }

      const response = yield this.rootStore.client.MakeFileServiceRequest({
        versionHash: this.videoObject.versionHash,
        path: "/call/media/files",
        method: "POST",
        body: params,
        encryption: encrypt ? "cgck" : undefined
      });

      const status = yield this.DownloadJobStatus({
        jobId: response.job_id,
        versionHash: this.videoObject.versionHash
      });

      this.downloadJobInfo[response.job_id] = {
        versionHash: this.videoObject.versionHash,
        filename,
        format,
        offering,
        representation,
        audioRepresentation,
        clipInFrame,
        clipOutFrame,
        startedAt: Date.now(),
        expiresAt: Date.now() + 29 * 24 * 60 * 60 * 1000
      };

      this.SaveDownloadJobInfo();

      this.downloadJobInfo[response.job_id].automaticDownloadInterval = setInterval(async () => {
        const status = await this.DownloadJobStatus({jobId: response.job_id}) || {};

        if(status?.status === "completed") {
          this.SaveDownloadJob({jobId: response.job_id});
        }

        if(status?.status !== "processing") {
          clearInterval(this.downloadJobInfo?.[response.job_id]?.automaticDownloadInterval);
        }
      }, 10000);

      return {
        jobId: response.job_id,
        status
      };
    } catch(error) {
      if(encrypt) {
        return this.StartDownloadJob({...arguments[0], encrypt: false});
      }
    }
  });

  DownloadJobStatus = flow(function * ({jobId, versionHash}) {
    this.downloadJobStatus[jobId] = yield this.rootStore.client.MakeFileServiceRequest({
      versionHash: versionHash || this.downloadJobInfo[jobId].versionHash,
      path: UrlJoin("call", "media", "files", jobId)
    });

    return this.downloadJobStatus[jobId];
  });

  SaveDownloadJob = flow(function * ({jobId}) {
    clearInterval(this.downloadJobInfo[jobId]?.automaticDownloadInterval);

    const jobInfo = this.downloadJobInfo[jobId];

    const downloadUrl = yield this.rootStore.client.FabricUrl({
      versionHash: jobInfo.versionHash,
      call: UrlJoin("media", "files", jobId, "download"),
      service: "files",
      queryParams: {
        "header-x_set_content_disposition": `attachment; filename="${jobInfo.filename}"`
      }
    });

    try {
      DownloadFromUrl(downloadUrl, jobInfo.filename);

      this.downloadedJobs[jobId] = true;
    } catch(error) {
      this.rootStore.menuStore.SetErrorMessage("Unable to download");
      // eslint-disable-next-line no-console
      console.error("Invalid URL or failed to download", error);
    }
  });

  RemoveDownloadJob({jobId}) {
    clearInterval(this.downloadJobInfo[jobId]?.automaticDownloadInterval);
    delete this.downloadJobInfo[jobId];
    this.SaveDownloadJobInfo();
  }

  CreateEmbedUrl = flow(function * ({offeringKey, audioTrackLabel, clipInFrame, clipOutFrame}) {
    let options = {
      autoplay: true,
    };

    if(offeringKey !== "default") {
      options.offerings = [offeringKey];
    }


    if(clipInFrame > 0) {
      options.clipStart = this.FrameToTime(clipInFrame);
    }

    if(this.videoHandler.TotalFrames() > clipOutFrame + 1) {
      options.clipEnd = this.FrameToTime(clipOutFrame + 1);
    }

    const url = new URL(
      yield this.rootStore.client.EmbedUrl({
        objectId: this.videoObject.objectId,
        duration: 7 * 24 * 60 * 60 * 1000,
        options
      })
    );

    if(audioTrackLabel) {
      url.searchParams.set("aud", this.rootStore.client.utils.B64(audioTrackLabel));
    }

    url.searchParams.set("vc", "");

    return url.toString();
  });
}

export default VideoStore;
