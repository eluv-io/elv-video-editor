import {observable, action, flow, computed} from "mobx";
import FrameAccurateVideo, {FrameRateDenominator, FrameRateNumerator, FrameRates} from "../utils/FrameAccurateVideo";
import UrlJoin from "url-join";
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

  @observable availableOfferings = {};
  @observable offeringKey = "default";

  @observable loading = false;
  @observable initialized = false;
  @observable isVideo = false;

  @observable consecutiveSegmentErrors = 0;

  @observable levels = [];
  @observable currentLevel;

  @observable audioTracks = [];
  @observable currentAudioTrack;

  @observable source;
  @observable baseUrl = undefined;
  @observable baseStateChannelUrl = undefined;
  @observable baseVideoFrameUrl = undefined;
  @observable baseFileUrl = undefined;
  @observable previewSupported = false;
  @observable downloadUrl;

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

  @observable downloadJobInfo = {};
  @observable downloadJobStatus = {};
  @observable downloadedJobs = {};
  @observable showDownloadModal = false;

  @computed get scaleMinTime() { return this.duration ? this.ProgressToTime(this.scaleMin) : 0; }
  @computed get scaleMaxTime() { return this.duration ? this.ProgressToTime(this.scaleMax) : 0; }

  @computed get scaleMinFrame() { return this.duration ? this.ProgressToFrame(this.scaleMin) : 0; }
  @computed get scaleMaxFrame() { return this.duration ? this.ProgressToFrame(this.scaleMax) : 0; }

  // Pass dropFrame parameter so SMPTE strings are redrawn on dropframe display change
  @computed get scaleMinSMPTE() { return this.duration ? this.ProgressToSMPTE(this.scaleMin) : ""; }
  @computed get scaleMaxSMPTE() {
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
    this.offeringKey = "default";
    this.availableOfferings = {};

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
    this.rootStore.trackStore.Reset();
  }

  @action.bound
  SetOffering = flow(function * (offeringKey) {
    this.Reset();
    this.offeringKey = offeringKey;
    yield this.SetVideo(this.videoObject, offeringKey);
  });

  @action.bound
  SetVideo = flow(function * (videoObject) {
    this.loading = true;

    try {
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

      this.metadata = videoObject.metadata;
      this.isVideo = videoObject.isVideo;

      this.LoadDownloadJobInfo();

      if(!this.isVideo) {
        this.initialized = true;
      } else {
        this.availableOfferings = yield this.rootStore.client.AvailableOfferings({
          versionHash: videoObject.versionHash
        });

        this.SetOfferingClipDetails();

        const offeringPlayoutOptions = {};
        const browserSupportedDrms = (yield this.rootStore.client.AvailableDRMs() || []).filter(drm => ["clear", "aes-128"].includes(drm));

        let playoutOptions;
        try {
          playoutOptions = yield this.rootStore.client.PlayoutOptions({
            versionHash: videoObject.versionHash,
            protocols: ["hls"],
            drms: browserSupportedDrms,
            hlsjsProfile: false,
            offering: this.offeringKey
          });
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error(error);
          this.rootStore.menuStore.SetErrorMessage(`Unable to load playout options for ${this.offeringKey}`);
        }

        if(!playoutOptions || !playoutOptions["hls"] || !(playoutOptions["hls"].playoutMethods.clear || playoutOptions["hls"].playoutMethods["aes-128"])) {
          // eslint-disable-next-line no-console
          console.error(`HLS Clear and AES-128 not supported by ${this.offeringKey} offering.`);

          const response = yield this.GetSupportedOffering({versionHash: videoObject.versionHash, browserSupportedDrms});
          this.offeringKey = response.offeringKey;
          playoutOptions = response.playoutOptions;
        }

        // Specify playout for full, untrimmed content
        const playoutMethods = playoutOptions["hls"].playoutMethods;

        this.drm = playoutMethods.clear ? "clear" : "aes-128";

        const source = new URL((playoutMethods.clear || playoutMethods["aes-128"]).playoutUrl);
        source.searchParams.set("ignore_trimming", true);
        source.searchParams.set("player_profile", "hls-js-2441");

        this.baseVideoFrameUrl = yield this.rootStore.client.Rep({
          versionHash: videoObject.versionHash,
          rep: UrlJoin("playout", this.offeringKey, "frames.png")
        });

        try {
          // Query preview API to check support
          const frameUrl = new URL(this.baseVideoFrameUrl);
          frameUrl.searchParams.set("frame", 0);
          const response = yield fetch(frameUrl.toString());
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

        this.source = source.toString();

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

          if(offering.entry_point_rat) {
            this.primaryContentStartTime = FrameAccurateVideo.ParseRat(offering.entry_point_rat);
          }

          if(offering.exit_point_rat) {
            // End time is end of specified frame
            const frameRate = FrameRates[this.frameRateKey].valueOf();
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

  GetSupportedOffering = flow(function * ({versionHash, browserSupportedDrms}) {
    let setNewOffering = false;
    const offeringPlayoutOptions = {};
    let offeringKey;

    for(let offering of Object.keys(this.availableOfferings).sort()) {
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
        if(!setNewOffering) {
          offeringKey = offering;
          setNewOffering = true;
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

  @action.bound
  SetOfferingClipDetails = () => {
    Object.keys(this.metadata.offerings || {}).map(offeringKey => {
      const entryPointRat = this.metadata.offerings[offeringKey].entry_point_rat;
      const exitPointRat = this.metadata.offerings[offeringKey].exit_point_rat;
      let entryPoint = null, exitPoint = null;

      if(entryPointRat) {
        entryPoint = FrameAccurateVideo.ParseRat(entryPointRat);
      }

      if(exitPointRat) {
        exitPoint = FrameAccurateVideo.ParseRat(exitPointRat);
      }

      this.availableOfferings[offeringKey].entry = entryPoint;
      this.availableOfferings[offeringKey].exit = exitPoint;
      this.availableOfferings[offeringKey].durationTrimmed = (entryPoint === null || exitPoint === null) ? null : (exitPoint - entryPoint);
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

    this.player.on(HLS.Events.AUDIO_TRACKS_UPDATED, action(() => {
      this.audioTracks = this.player.audioTracks;
      this.currentAudioTrack = this.player.audioTrack;
    }));

    this.player.on(HLS.Events.AUDIO_TRACK_SWITCHED, action(() => {
      this.audioTracks = this.player.audioTracks;
      this.currentAudioTrack = this.player.audioTrack;
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
  TimeToFrame(time, round=false) {
    if(!this.videoHandler) { return 0; }

    return this.videoHandler.TimeToFrame(time, round);
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
    this.player.nextLevel = parseInt(level);
    this.player.streamController.immediateLevelSwitch();
  }

  @action.bound
  SetAudioTrack(trackIndex) {
    this.player.audioTrack = parseInt(trackIndex);
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

    deltaY *= 100 * -0.0003;

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
      Math.max(0, Math.min(100, volume - (deltaY * 100 * 0.001)))
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

    const url = new URL(this.baseStateChannelUrl);
    url.pathname = UrlJoin(url.pathname, "rep", "thumbnail", "files", filePath);

    if(height) {
      url.searchParams.set("height", height);
    }

    return url.toString();
  }

  @action.bound
  VideoFrame(frame) {
    const url = new URL(this.baseVideoFrameUrl);
    url.searchParams.set("frame", frame);
    return url.toString();
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

  @action.bound
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

    try {
      // Check if download URL is valid before downloading
      const response = await fetch(downloadUrl);

      if(response.ok) {
        DownloadFromUrl(
          downloadUrl,
          filename
        );
      }
    } catch(error) {
      this.rootStore.menuStore.SetErrorMessage("Unable to download");
      // eslint-disable-next-line no-console
      console.error("Invalid URL or failed to download", error);
    }
  }

  // Video Downloads

  @action.bound
  ToggleDownloadModal(show) {
    this.showDownloadModal = show;
  }

  DownloadJobDefaultFilename({format="mp4", offering="default", clipInFrame, clipOutFrame, representationInfo}) {
    let filename = this.name;

    if(offering && offering !== "default") {
      filename = `${filename} (${offering})`;
    }

    if(clipInFrame || (clipOutFrame && clipOutFrame !== this.videoHandler.TotalFrames() - 1)) {
      const startTime = this.videoHandler.TimeToString({
        time: this.videoHandler.FrameToTime(clipInFrame || 0),
        showMinutes: true
      }).replaceAll(" ", "");
      const endTime = this.videoHandler.TimeToString({
        time: this.videoHandler.FrameToTime(clipOutFrame || this.videoHandler.TotalFrames()),
        showMinutes: true
      }).replaceAll(" ", "");
      filename = `${filename} (${startTime} - ${endTime})`;
    }

    if(representationInfo && !representationInfo.isTopResolution) {
      filename = `${filename} (${representationInfo.width}x${representationInfo.height})`;
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

  @action.bound
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
    clipInFrame,
    clipOutFrame
  }) {
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

    if(clipInFrame) {
      params.start_ms = this.videoHandler.TimeToString({time: this.videoHandler.FrameToTime(clipInFrame), includeFractionalSeconds: true}).replaceAll(" ", "");
    }

    if(clipOutFrame && clipOutFrame !== this.videoHandler.TotalFrames() - 1) {
      params.end_ms = this.videoHandler.TimeToString({time: this.videoHandler.FrameToTime(clipOutFrame), includeFractionalSeconds: true}).replaceAll(" ", "");
    }

    const response = yield this.rootStore.client.MakeFileServiceRequest({
      versionHash: this.videoObject.versionHash,
      path: "/call/media/files",
      method: "POST",
      body: params,
      encryption: "cgck"
    });

    const status = yield this.DownloadJobStatus({
      jobId: response.job_id,
      versionHash: this.videoObject.versionHash
    });

    // Allow re-downloading if this is the same job as a previous one
    delete this.downloadedJobs[response.job_id];

    this.downloadJobInfo[response.job_id] = {
      versionHash: this.videoObject.versionHash,
      filename,
      format,
      offering,
      clipInFrame,
      clipOutFrame,
      startedAt: Date.now(),
      expiresAt: Date.now() + 29 * 24 * 60 * 60 * 1000
    };

    this.SaveDownloadJobInfo();

    let statusInterval = setInterval(async () => {
      const status = await this.DownloadJobStatus({jobId: response.job_id}) || {};

      if(status?.status === "completed") {
        this.SaveDownloadJob({jobId: response.job_id});
      }

      if(status?.status !== "processing") {
        clearInterval(statusInterval);
      }
    }, 10000);

    return {
      jobId: response.job_id,
      status
    };
  });

  @action.bound
  DownloadJobStatus = flow(function * ({jobId, versionHash}) {
    this.downloadJobStatus[jobId] = yield this.rootStore.client.MakeFileServiceRequest({
      versionHash: versionHash || this.downloadJobInfo[jobId].versionHash,
      path: UrlJoin("call", "media", "files", jobId)
    });

    return this.downloadJobStatus[jobId];
  });

  @action.bound
  SaveDownloadJob = flow(function * ({jobId}) {
    if(this.downloadedJobs[jobId]) { return; }

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

  @action.bound
  RemoveDownloadJob({jobId}) {
    delete this.downloadJobInfo[jobId];
    this.SaveDownloadJobInfo();
  }
}

export default VideoStore;
