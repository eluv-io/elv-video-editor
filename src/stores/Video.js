import {observable, action, runInAction, flow} from "mobx";
import FrameAccurateVideo, {FrameRates} from "../utils/FrameAccurateVideo";
import {WebVTT} from "vtt.js";
import Id from "../utils/Id";

// 30 fps
//const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__GUow8e5MBR2Z1Kuu6fDSw2bYBZo/data/hqp_QmXHvrBRRJ3kbEvKgfqYytHX3Zg49sCXvcHAV7xvhta7mA"
// 60 fps
//const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__3nvTFKUg32AfyG6MSc1LMtt4YGj5/data/hqp_Qmb1NZ5CMU6DXErMrHqt5RRvKKP5F5CfYT2oTfZoH1FwU8"
// Non drop-frame 24000/1001
//const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__3LNTS4eA7LAygQee7MQ78k2ivvnC/data/hqp_QmS5PeFJFycWLMiADhb2Sv7SwHQWXCjEqmHEgYCRxZLWMw";
// Non drop-frame 30000/1001
//const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__2wf1V2eo5QE5hsip7JHoByBnWahU/data/hqp_QmT4q6NaMBnATtWmSVjcHmc66m34wSEWbogzr2HW8A9UwT"
// Drop frame 30000/1001
//const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__2aF5AN7fStTc8XEwq9c1LRwbe4qw/data/hqp_Qmcdww5ssDf9yyvL81S7Tym4DUv8mJsPLxS4poXxp89Do7"


// Subtitles test 1
//const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./ttml-example.mp4";
// Subtitles test 2
//const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./with-subtitles.webm";
// Subtitles test 3
//const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./soybean-talk-clip.mp4";

// SHREK
/*
const source = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__zxDmS6jVfJ4venSukH8CPYPT1hz/data/hqp_QmcHiCpTAQtbJCk2kkvnUd3KU1W6phX6p4TCVoxCwiBJ1d";
const poster = "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/hq__QmTAvEbCPu9X5KnhfPCyh45BFvpDpeneQwNAt7wg3uC2wx/rep/image";
*/

const trackInfo = [
  /*
  {
    label: "MIB 2",
    default: false,
    kind: "subtitles",
    source: "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./MIB2-subtitles-pt-BR.vtt",
  },
  {
    label: "Boring lady",
    default: false,
    kind: "subtitles",
    source: "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./webvtt-example.vtt"
  },
  {
    label: "Coffee guys",
    default: false,
    kind: "subtitles",
    source: "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./soybean-talk-clip-region.vtt"
  },
  */
  {
    label: "Shrek Retold (English)",
    default: true,
    active: true,
    kind: "subtitles",
    source: "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__zxDmS6jVfJ4venSukH8CPYPT1hz/files/./SHREK-RETOLD.vtt"
  },
  {
    label: "Shrek Retold (Spanish)",
    default: false,
    active: false,
    kind: "subtitles",
    source: "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__zxDmS6jVfJ4venSukH8CPYPT1hz/files/./SHREK-RETOLD-SPANISH.vtt"
  },
  {
    label: "Shrek Retold (French)",
    default: false,
    active: false,
    kind: "subtitles",
    source: "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__zxDmS6jVfJ4venSukH8CPYPT1hz/files/./SHREK-RETOLD-FRENCH.vtt"
  },
  {
    label: "Shrek Retold (Russian)",
    default: false,
    active: false,
    kind: "subtitles",
    source: "http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__zxDmS6jVfJ4venSukH8CPYPT1hz/files/./SHREK-RETOLD-RUSSIAN.vtt"
  }
];

class VideoStore {
  @observable contentObject;
  @observable name;

  @observable initialized = false;

  @observable source;
  @observable poster;
  @observable trackInfo = trackInfo;
  @observable tracks = [];

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

  constructor(client) {
    this.client = client;
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
  }

  @action.bound
  SelectObject = flow(function * (libraryId, objectId) {
    const metadata = yield this.client.ContentObjectMetadata({libraryId, objectId});
    metadata.name = metadata.name || objectId;

    this.name = metadata.name;

    this.contentObject = {
      objectId,
      ...(yield this.client.ContentObject({libraryId, objectId})),
      meta: metadata
    };

    const videoSourceUrl = yield this.client.FabricUrl({
      libraryId,
      objectId,
      partHash: metadata.video
    });

    let videoPosterUrl;
    if(metadata.image) {
      videoPosterUrl = yield this.client.Rep({
        libraryId,
        objectId,
        rep: "image"
      });
    }

    this.source = videoSourceUrl;
    this.poster = videoPosterUrl;
  });

  @action.bound
  Initialize(video) {
    video.load();

    this.InitializeTracks();

    this.video = video;

    const videoHandler = new FrameAccurateVideo({
      video: video,
      frameRate: this.frameRate,
      dropFrame: this.dropFrame,
      callback: this.Update
    });

    // Attach fullscreen state handling to video container
    video.parentElement.parentElement.onfullscreenchange = action(() => this.fullScreen = !this.fullScreen);

    this.videoHandler = videoHandler;
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
  }

  FormatVTTCue(label, cue) {
    // VTT Cues are weird about being inspected and copied
    // Manually copy all relevant values
    const cueAttributes = [
      "align",
      "endTime",
      "id",
      "line",
      "lineAlign",
      "position",
      "positionAlign",
      "region",
      "size",
      "snapToLines",
      "startTime",
      "text",
      "vertical"
    ];

    const cueCopy = {};
    cueAttributes.forEach(attr => cueCopy[attr] = cue[attr]);

    return {
      entryId: Id.next(),
      label: label,
      startTime: cue.startTime,
      endTime: cue.endTime,
      startTimeSMPTE: this.videoHandler.TimeToSMPTE(cue.startTime),
      endTimeSMPTE: this.videoHandler.TimeToSMPTE(cue.endTime),
      text: cue.text,
      type: "VTTCue",
      entry: cueCopy
    };
  }

  @action.bound
  async InitializeTracks() {
    let tracks = [];

    // Initialize video WebVTT tracks by fetching and parsing the VTT file
    await Promise.all(
      this.trackInfo.map(async track => {
        const vttParser = new WebVTT.Parser(window, WebVTT.StringDecoder());

        let cues = [];
        vttParser.oncue = cue => cues.push(this.FormatVTTCue(track.label, cue));

        const response = await fetch(track.source);
        const vtt = await response.text();
        try {
          vttParser.parse(vtt);
          vttParser.flush();
        } catch(error) {
          /* eslint-disable no-console */
          console.error(`VTT cue parse failure on track ${track.label}: `);
          console.error(error);
          /* eslint-enable no-console */
        }

        tracks.push({
          ...track,
          entries: cues
        });
      })
    );

    runInAction(() => this.tracks = tracks);
  }

  @action.bound
  ToggleTrack(label) {
    const track = Array.from(this.video.textTracks).find(track => track.label === label);
    const trackInfo = this.tracks.find(track => track.label === label);

    if(!track || !trackInfo) { return; }

    if(track.mode === "showing") {
      track.mode = "disabled";
      trackInfo.active = false;
    } else {
      track.mode = "showing";
      trackInfo.active = true;
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
    const bump = this.scale * 0.025;
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
