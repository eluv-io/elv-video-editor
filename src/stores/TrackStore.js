import {flow, makeAutoObservable, runInAction, toJS} from "mobx";
import Id from "@/utils/Id";
import IntervalTree from "node-interval-tree";
import {Parser as HLSParser} from "m3u8-parser";
import UrlJoin from "url-join";
import {Utils} from "@eluvio/elv-client-js";
import {ConvertColor} from "@/utils/Utils.js";

/*
 * Track Types:
 *
 * audio - Audio waveform
 * clip - Start/end points for playout trimming
 * metadata - Metadata tags
 * preview - Preview images
 * segments - Audio/video segment parts + download
 * vtt - VTT Subtitles
 */



class TrackStore {
  tags = {};
  intervalTrees = {};

  initialized = false;

  thumbnails = false;
  thumbnailStatus = { loaded: false };
  thumbnailImages = {};

  tracks = [];
  audioTracks = [];
  selectedTrack;
  activeTracks = {};
  activeClipTracks = {};
  editingTrack = false;
  audioLoading = false;
  audioSupported = true;

  showTags = true;
  showSegments = false;
  showAudio = false;
  showThumbnails = true;
  showSubtitles = false;
  showOverlay = true;

  showPrimaryContent = true;

  totalTags = 0;
  uiUpdateDelayFactor = 1;

  colors = [
    "#FFFFFF",
    "#19ded3",
    "#e02b10",
    "#ffc806",
    "#f10fbf",
    "#8a0c0c",
    "#405ff5",
    "#be6ef6",
    "#fb8e3e"
  ].map(color => ConvertColor({hex: color, alpha: 100}));

  constructor(rootStore) {
    makeAutoObservable(
      this,
      {
        tags: false,
        intervalTrees: false,
        thumbnails: false
      }
    );

    this.rootStore = rootStore;

    if(!window.AudioContext && !window.webkitAudioContext) {
      this.audioSupported = false;

      // eslint-disable-next-line no-console
      console.error("AudioContext not supported in this browser");
    }
  }

  get tracksSelected() {
    return Object.keys(this.activeTracks).length > 0;
  }

  get visibleMetadataTracks() {
    return !this.tracksSelected ?
      this.metadataTracks :
      this.metadataTracks.filter(track => this.activeTracks[track.key]);
  }

  get metadataTracks() {
    return this.tracks
      .filter(track => track.trackType === "metadata")
      .sort((a, b) =>
        // Move shot detection to top
        a.key === "shot_detection" ? -1 :
          b.key === "shot_detection" ? 1 :
            (a.label?.toLowerCase() > b.label?.toLowerCase() ? 1 : -1)
      );
  }

  get clipTracksSelected() {
    return Object.keys(this.activeClipTracks).length > 0;
  }

  get visibleClipTracks() {
    return !this.clipTracksSelected ?
      this.clipTracks :
      this.clipTracks.filter(track => this.activeClipTracks[track.key]);
  }

  get clipTracks() {
    return this.tracks
      .filter(track => track.trackType === "clip" && track.key !== "primary-content")
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }

  get viewTracks() {
    return this.rootStore.view === "clips" ? this.clipTracks : this.metadataTracks;
  }

  NextId() {
    return Id.next();
  }

  Reset() {
    this.tracks = [];
    this.audioTracks = [];
    this.selectedTrack = undefined;
    this.editingTrack = false;
    this.audioLoading = false;
    this.initialized = false;
    this.thumbnails = false;
    this.thumbnailImages = { loaded: false };
    this.thumbnailImages = {};
  }

  TrackColor(key) {
    const index = key.split("").reduce((acc, v, i) => acc + v.charCodeAt(0) * i, 0) % this.colors.length;

    return this.colors[index];
  }

  Track(trackKeyOrId) {
    const trackIndex = this.tracks.findIndex(track =>
      track.trackId === trackKeyOrId || track.key === trackKeyOrId
    );

    return trackIndex >= 0 ? this.tracks[trackIndex] : undefined;
  }

  ModifyTrack(modifiedTrack) {
    const trackIndex = this.tracks.findIndex(track => track.trackId === modifiedTrack.trackId);

    this.tracks[trackIndex] = modifiedTrack;
  }

  AddTag({trackId, tag}) {
    if(!tag.tagId) {
      tag.tagId = this.NextId();
    }

    this.tags[trackId][tag.tagId] = JSON.parse(JSON.stringify(tag));

    this.__UpdateTrackVersion(trackId);
  }

  ModifyTag({trackId, modifiedTag}) {
    if(!this.tags[trackId]) { return; }

    this.tags[trackId][modifiedTag.tagId] = JSON.parse(JSON.stringify(modifiedTag));

    this.__UpdateTrackVersion(trackId);
  }

  DeleteTag({trackId, tagId}) {
    delete this.tags[trackId][tagId];

    // Unselect deleted tags
    this.rootStore.tagStore.selectedTagIds =
      this.rootStore.tagStore.selectedTagIds
        .filter(selectedTagId => selectedTagId !== tagId);

    this.__UpdateTrackVersion(trackId);
  }

  __UpdateTrackVersion(trackId) {
    const trackIndex = this.tracks.findIndex(track => track.trackId === trackId);
    const track = this.tracks[trackIndex];

    // Rebuild interval tree in case tag start/end times changed
    this.intervalTrees[trackId] = this.CreateTrackIntervalTree(
      this.TrackTags(trackId),
      trackId,
      track.label || track.key
    );

    this.tracks[trackIndex].version++;
  }

  /* HLS Playlist Parsing */

  BasePlayoutUrl() {
    return this.rootStore.videoStore.source.split("?")[0].replace("playlist.m3u8", "");
  }

  // TODO: Try switching to hls-parser
  async ParsedHLSPlaylist(playlistUrl) {
    if(!playlistUrl) { playlistUrl = this.rootStore.videoStore.source; }

    const playlist = await (await fetch(playlistUrl)).text();
    const parser = new HLSParser();
    parser.push(playlist);
    parser.end();

    return parser.manifest;
  }

  AudioTracksFromHLSPlaylist = flow(function * () {
    const playlist = yield this.ParsedHLSPlaylist();
    const audioInfo = playlist.mediaGroups.AUDIO.audio;

    if(!audioInfo) { return []; }

    return yield Promise.all(
      Object.keys(audioInfo).map(async audioName => {
        // Get playlist for audio track
        const audioPlaylistPath = audioInfo[audioName].uri;
        const audioPlaylistUrl = UrlJoin(this.BasePlayoutUrl(), audioPlaylistPath);
        const audioPlaylist = await this.ParsedHLSPlaylist(audioPlaylistUrl);

        const initSegmentUrl = audioPlaylistUrl.replace("playlist.m3u8", "init.m4s");

        if(!audioPlaylist) { return; }

        const audioSegmentBaseUrl = (audioPlaylistUrl.split("?")[0]).replace("playlist.m3u8", "");
        const audioSegmentUrls = audioPlaylist.segments.map((segment, i)=> ({
          number: i,
          url: UrlJoin(audioSegmentBaseUrl, segment.uri),
          duration:segment.duration
        }));

        return {
          label: audioName === "audio" ? "Audio" : audioName,
          initSegmentUrl: initSegmentUrl,
          segments: audioSegmentUrls
        };
      })
    );
  });

  SubtitleTracksFromHLSPlaylist = flow(function * () {
    const playlist = yield this.ParsedHLSPlaylist();
    const subtitleInfo = playlist.mediaGroups.SUBTITLES.subs;

    if(!subtitleInfo) { return []; }

    let vttTracks = [];
    yield Promise.all(
      Object.keys(subtitleInfo).map(async subtitleName => {
        // Get playlist for subtitles
        const subPlaylistPath = subtitleInfo[subtitleName].uri;
        const subPlaylistUrl = UrlJoin(this.BasePlayoutUrl(), subPlaylistPath);
        const subPlaylist = await this.ParsedHLSPlaylist(subPlaylistUrl);

        if(!subPlaylist) { return; }

        // Get VTT data
        const vttPath = subPlaylist.segments[0].uri;
        const subBaseUrl = (subPlaylistUrl.split("?")[0]).replace("playlist.m3u8", "");
        const vttUrl = UrlJoin(subBaseUrl, vttPath);
        const vttData = await (await fetch(vttUrl)).text();

        vttTracks.push({
          label: subtitleName,
          vttData
        });
      })
    );

    return vttTracks;
  });

  AddTrack({trackId, label, key, type, tags={}, color, ...additional}) {
    trackId = trackId || this.NextId();

    let updatedTags = {};
    Object.keys(tags).forEach(key =>
      updatedTags[key] = { trackId, ...tags[key] }
    );

    this.tracks.push({
      trackId,
      color: color || this.TrackColor(key),
      version: 1,
      label,
      key: key || `track-${label}`,
      trackType: type,
      ...additional
    });

    this.tags[trackId] = updatedTags;
    this.intervalTrees[trackId] = this.CreateTrackIntervalTree(tags, label);

    return trackId;
  }

  DeleteTrack({trackId}) {
    const trackKey = this.Track(trackId)?.key;

    delete this.tags[trackId];
    this.tracks = this.tracks.filter(track => track.trackId !== trackId);
    delete this.intervalTrees[trackId];

    delete this.activeTracks[trackKey];
  }

  TrackTags(trackId) {
    if(trackId in this.tags) {
      return this.tags[trackId];
    }

    return this.audioTracks.find(track => track.trackId === trackId)?.tags.flat();
  }

  TrackTagIntervalTree(trackId) {
    return this.intervalTrees[trackId];
  }

  /* Audio Tracks */

  DecodeAudioSegment = flow(function * (trackId, audioData, duration, number, samplesPerSecond) {
    const source = this.audioContext.createBufferSource();
    yield new Promise((resolve, reject) => {
      try {
        this.audioContext.decodeAudioData(audioData, (buffer) => {
          source.buffer = buffer;
          resolve();
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to decode audio segment");
        // eslint-disable-next-line no-console
        console.error(error);
        reject(error);
      }
    });

    const startTime = duration * number;
    const samples = Math.ceil(source.buffer.duration * samplesPerSecond);
    const channel = source.buffer.getChannelData(0);
    const sampleSize = Math.round(channel.length / samples);
    const sampleDuration = 1 / samplesPerSecond;

    let segmentMax = 0;

    const audioSamples = [...Array(samples).keys()]
      .map(i => channel.slice(i * sampleSize, (i + 1) * sampleSize))
      .map((samples, i) => {
        const sampleMax = Math.max(...samples);
        if (sampleMax > segmentMax) {
          segmentMax = sampleMax;
        }

        return {
          startTime: startTime + i * sampleDuration,
          endTime: startTime + (i + 1) * sampleDuration,
          max: sampleMax
        };
      })
      .sort((a, b) => a.startTime < b.startTime ? -1 : 1);

    return { audioSamples, segmentMax };
  });

  AddAudioTracks = flow(function * () {
    if(!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if(this.audioLoading) { return; }

    this.audioLoading = true;

    const loadingVersion = this.rootStore.videoStore.versionHash;
    const concurrentRequests = 20;
    const audioTracks = yield this.AudioTracksFromHLSPlaylist();

    yield Promise.all(
      audioTracks.map(async track => {
        try {
          const trackId = this.NextId();

          this.audioTracks.push({
            trackId,
            label: track.label || "Audio",
            trackType: "audio",
            tags: [],
            max: 0,
            version: 1
          });

          const trackProxy = this.audioTracks.find(t => t.trackId === trackId);

          const duration = track.segments.reduce((duration, segment) => duration + segment.duration, 0);
          // Limit samples per second to a reasonable amount based on the video duration - somewhere between 20 for shorter videos and 4 for longer
          const samplesPerSecond = Math.min(20, Math.max(4, Math.floor(1000 * Math.log2(duration) / duration)));

          const initSegment = new Uint8Array(
            await (await fetch(track.initSegmentUrl, { headers: {"Content-type": "audio/mp4"}})).arrayBuffer()
          );

          let trackMax = 0;
          this.tags[trackId] = [];

          // Start with a course group and load progressively finer groups
          let s100 = track.segments.filter((_, i) => i % 100 === 0);
          let s10 = track.segments.filter((_, i) => i % 100 !== 0 && i % 10 === 0);
          let s5 = track.segments.filter((_, i) => i % 10 !== 0 && i % 5 === 0);
          let s2 = track.segments.filter((_, i) => i % 10 !== 0 && i % 5 !== 0 && i % 2 === 0);
          let s1 = track.segments.filter((_, i) => i % 5 !== 0 && i % 2 !== 0);

          let addedSegments = {};
          await Utils.LimitedMap(
            concurrentRequests,
            [...s100, ...s10, ...s5, ...s2, ...s1],
            async segment => {
              // Abort if segment already loaded or video has changed
              if(
                addedSegments[segment.number] ||
                this.tags[trackId][segment.number] ||
                this.rootStore.videoStore.versionHash !== loadingVersion
              ) {
                return;
              }

              addedSegments[segment.number] = true;

              const segmentData = new Uint8Array(await (await fetch(segment.url)).arrayBuffer());

              // Add init segment to start of segment data for necessary decoding information
              const audioData = new Int8Array(initSegment.byteLength + segmentData.byteLength);
              audioData.set(initSegment);
              audioData.set(segmentData, initSegment.byteLength);

              const { audioSamples, segmentMax } = await this.DecodeAudioSegment(trackId, audioData.buffer, segment.duration, segment.number, samplesPerSecond);

              runInAction(() => {
                this.tags[trackId][segment.number] = audioSamples;

                if(segmentMax > trackMax) {
                  trackMax = segmentMax;
                  trackProxy.max = segmentMax;
                }

                trackProxy.version = trackProxy.version + 1;
              });
            }
          );
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      })
    );
  });

  /* Subtitles and Metadata */

  AddTracksFromTags = (metadataTags) => {
    if(!metadataTags) { return []; }

    let metadataTracks = [];
    Object.keys(metadataTags).forEach(key => {
      let tags = {};
      const millis = metadataTags[key].version > 0;
      metadataTags[key].tags.forEach(tag => {
        const parsedTag = this.Cue({
          trackKey: key,
          tagType: "metadata",
          startTime: millis ? (tag.start_time / 1000) : tag.start_time,
          endTime: millis ? (tag.end_time / 1000) : tag.end_time,
          text: tag.text,
          tag: toJS(tag),
          origin: {
            fi: tag.fi,
            tk: tag.tk,
            ti: tag.ti
          }
        });

        tags[parsedTag.tagId] = parsedTag;
      });

      metadataTracks.push({
        label: metadataTags[key].label,
        trackType: "metadata",
        key,
        tags
      });
    });

    return metadataTracks;
  };

  Cue({tagType, label, startTime, endTime, text, tag, ...extra}) {
    const isSMPTE = typeof startTime === "string" && startTime.split(":").length > 1;

    if(isSMPTE) {
      startTime = this.rootStore.videoStore.videoHandler.SMPTEToTime(startTime);
      endTime = this.rootStore.videoStore.videoHandler.SMPTEToTime(endTime);
    }

    let textList, content;
    if(Array.isArray(text)) {
      textList = text;
    } else if(typeof text === "object") {
      content = text;
      textList = [];
    } else {
      textList = [text];
    }

    return {
      tagId: this.NextId(),
      tagType,
      label,
      startTime,
      endTime,
      textList: toJS(textList),
      content: toJS(content),
      tag,
      ...extra
    };
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

    return this.Cue({
      tagType: "vtt",
      label,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: cue.text,
      textList: [cue.text],
      tag: cueCopy
    });
  }

  async ParseVTTTrack(track) {
    const videoElement = document.createElement("video");
    const trackElement = document.createElement("track");

    const dataURL = "data:text/plain;base64," + this.rootStore.client.utils.B64(track.vttData);

    const textTrack = trackElement.track;

    videoElement.append(trackElement);
    trackElement.src = dataURL;

    textTrack.mode = "hidden";

    await new Promise(resolve => setTimeout(resolve, 250));

    let cues = {};
    Array.from(textTrack.cues)
      .forEach(cue => {
        const parsedCue = this.FormatVTTCue(track.label, cue);
        cues[parsedCue.tagId] = parsedCue;
      });

    return cues;
  }

  CreateTrackIntervalTree(tags, label) {
    const intervalTree = new IntervalTree();

    Object.values(tags).forEach(tag => {
      try {
        intervalTree.insert(tag.startTime, tag.endTime, tag.tagId);
      } catch(error) {
        // eslint-disable-next-line no-console
        console.warn(`Invalid tag in track '${label}'`);
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify(tag, null, 2));
      }
    });

    return intervalTree;
  }

  AddSubtitleTracks = flow(function * () {
    try {
      const subtitleTracks = yield this.SubtitleTracksFromHLSPlaylist();

      // Initialize video WebVTT tracks by fetching and parsing the VTT file
      yield Promise.all(
        subtitleTracks.map(async track => {
          try {
            const tags = await this.ParseVTTTrack(track);

            this.totalTags += Object.keys(tags).length;

            this.AddTrack({
              ...track,
              key: track.label,
              type: "vtt",
              tags
            });
          } catch(error) {
            // eslint-disable-next-line no-console
            console.error("Error parsing VTT track:");
            // eslint-disable-next-line no-console
            console.error(error);
          }
        })
      );
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load subtitle tracks:");
      // eslint-disable-next-line no-console
      console.error(error);
    }
  });

  AddMetadataTracks(metadataTags) {
    try {
      const metadataTracks = this.AddTracksFromTags(metadataTags);
      metadataTracks.map(track => {
        if(!track.label || !track.tags) {
          // eslint-disable-next-line no-console
          console.error("Invalid track:", track.key);
          // eslint-disable-next-line no-console
          console.error(toJS(metadataTags[track.key]));
          return;
        }

        this.totalTags += Object.keys(track.tags).length;

        this.AddTrack({
          label: track.label,
          key: track.key,
          type: "metadata",
          tags: track.tags
        });
      });

      this.uiUpdateDelayFactor = Math.max(0.25, Math.log10(this.totalTags) / 4 - 0.5);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load metadata tracks:");
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  AddSegmentTracks() {
    if(!this.rootStore.videoStore.isVideo || !this.rootStore.videoStore.metadata.offerings) { return; }

    try {
      const streams = this.rootStore.videoStore.metadata.offerings[this.rootStore.videoStore.offeringKey].media_struct.streams;

      ["video", "audio"].forEach(stream => {
        if(!streams[stream]) {
          // eslint-disable-next-line no-console
          console.error(`No ${stream} stream found. Skipping ${stream} segment track.`);
          return;
        }

        const sources = streams[stream].sources;

        let segments = {};
        sources.forEach(({timeline_start, timeline_end, source}) => {
          let segment = this.Cue({
            tagType: "segment",
            startTime: parseFloat(timeline_start.float.toFixed(2)),
            endTime: parseFloat(timeline_end.float.toFixed(2)),
            text: `${timeline_start.float.toFixed(2)} - ${timeline_end.float.toFixed(2)}`,
            tag: {}
          });

          segment.source = source;
          segment.streamType = stream;

          segments[segment.tagId] = segment;
        });

        this.AddTrack({
          label: `${stream === "video" ? "Video" : "Audio"} Segments`,
          key: `${stream}-segments`,
          type: "segments",
          tags: segments
        });
      });
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load segment tracks:");
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  async AddPrimaryContentTrack() {
    while(!this.rootStore.videoStore.initialized) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const clip = this.Cue({
      trackKey: "primary-content",
      tagType: "clip",
      startTime: this.rootStore.videoStore.primaryContentStartTime,
      endTime: this.rootStore.videoStore.primaryContentEndTime,
      text: "Primary Content",
      tag: {}
    });

    const tags = {
      [clip.tagId]: clip
    };

    this.AddTrack({
      label: "Primary Content",
      key: "primary-content",
      type: "primary-content",
      color: {r: 255, g: 255, b: 255, a: 200},
      tags
    });
  }

  LoadThumbnails = flow(function * () {
    if(!this.rootStore.videoStore.thumbnailTrackUrl) {
      this.thumbnailStatus = {
        loaded: true,
        available: false,
        status: (yield this.ThumbnailGenerationStatus()) || {}
      };

      return;
    }

    const vttData = yield (yield fetch(this.rootStore.videoStore.thumbnailTrackUrl)).text();

    let tags = yield this.ParseVTTTrack({label: "Thumbnails", vttData});

    let imageUrls = {};
    Object.keys(tags).map(id => {
      const [path, rest] = tags[id].tag.text.split("\n")[0].split("?");
      const [query, hash] = rest.split("#");
      const positionParams = hash.split("=")[1].split(",").map(n => parseInt(n));
      const queryParams = new URLSearchParams(`?${query}`);
      const url = new URL(this.rootStore.videoStore.thumbnailTrackUrl);
      url.pathname = UrlJoin(url.pathname.split("/").slice(0, -1).join("/"), path);
      queryParams.forEach((key, value) =>
        url.searchParams.set(key, value)
      );

      tags[id].imageUrl = url.toString();
      tags[id].thumbnailPosition = positionParams;

      imageUrls[url.toString()] = true;

      delete tags[id].tag.text;
      delete tags[id].textList;
    });

    yield Promise.all(
      Object.keys(imageUrls).map(async url => {
        const image = new Image();

        await new Promise(resolve => {
          image.src = url;
          image.crossOrigin = "anonymous";
          image.onload = () => {
            resolve();
          };
        });

        imageUrls[url] = image;
      })
    );

    this.thumbnailImages = imageUrls;
    this.thumbnails = tags;
    this.intervalTrees.thumbnails = this.CreateTrackIntervalTree(tags, "Thumbnails");
    this.thumbnailStatus = { loaded: true, available: true };
  });

  ThumbnailImage(time) {
    if(!this.thumbnailStatus.available) { return; }

    let thumbnailIndex = this.intervalTrees?.thumbnails?.search(time, time + 10)[0];
    const tag = this.thumbnails?.[thumbnailIndex?.toString()];

    if(!tag) { return; }

    if(!tag.thumbnailUrl) {
      if(!this.thumbnailCanvas) {
        this.thumbnailCanvas = document.createElement("canvas");
      }

      const image = this.thumbnailImages[tag?.imageUrl];

      if(image) {
        const [x, y, w, h] = tag.thumbnailPosition;
        this.thumbnailCanvas.height = h;
        this.thumbnailCanvas.width = w;
        const context = this.thumbnailCanvas.getContext("2d");
        context.drawImage(image, x, y, w, h, 0, 0, w, h);
        tag.thumbnailUrl = this.thumbnailCanvas.toDataURL("image/png");
      }
    }

    return tag.thumbnailUrl;
  }

  InitializeTracks = flow(function * (metadataTags) {
    if(this.initialized) { return; }

    this.initialized = true;

    this.AddPrimaryContentTrack();
    yield this.AddSubtitleTracks();
    yield this.AddMetadataTracks(metadataTags);
    yield this.AddSegmentTracks();
    yield this.rootStore.overlayStore.AddOverlayTracks();

    this.LoadThumbnails();
  });

  /* User Actions */

  ResetActiveTracks() {
    this.activeTracks = {};
  }

  ToggleTrackSelected(key) {
    if(this.activeTracks[key]) {
      delete this.activeTracks[key];
    } else {
      this.activeTracks[key] = true;
    }
  }

  ResetActiveClipTracks() {
    this.activeClipTracks = {};
  }

  ToggleClipTrackSelected(key) {
    if(this.activeClipTracks[key]) {
      delete this.activeClipTracks[key];
    } else {
      this.activeClipTracks[key] = true;
    }
  }

  ToggleTrackType({type, visible}) {
    if(type === "Audio" && visible && this.audioTracks.length === 0) {
      this.AddAudioTracks();
      setTimeout(() => runInAction(() => this.showAudio = visible), 1000);
    } else {
      this[`show${type}`] = visible;
    }
  }

  ClipInfo() {
    const clipTrack = this.tracks.find(track => track.trackType === "clip");
    return Object.values(this.tags[clipTrack.trackId])[0];
  }

  /* Video thumbnails creation */

  GenerateVideoThumbnails = flow(function * ({options={}}={}) {
    try {
      this.thumbnailStatus.status = { state: "started" };

      const {libraryId, objectId} = this.rootStore.videoStore.videoObject;
      const {writeToken} = yield this.rootStore.client.EditContentObject({
        libraryId,
        objectId
      });

      const {data} = yield this.rootStore.client.CallBitcodeMethod({
        libraryId,
        objectId,
        writeToken,
        method: "/media/thumbnails/create",
        constant: false,
        body: {
          async: true,
          frame_interval: Math.ceil(this.rootStore.videoStore.frameRate) * 6,
          add_thumb_track: true,
          generate_storyboards: true,
          ...options
        }
      });

      const nodeUrl = yield this.rootStore.client.WriteTokenNodeUrl({writeToken});

      yield this.rootStore.client.walletClient.SetProfileMetadata({
        type: "app",
        appId: "video-editor",
        mode: "private",
        key: `thumbnail-job-${objectId}`,
        value: JSON.stringify({writeToken, lroId: data, nodeUrl})
      });
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error(error);
      this.thumbnailStatus.status = { state: "failed" };
    }
  });

  ThumbnailGenerationStatus = flow(function * ({finalize=false}={}) {
    const { libraryId, objectId } = this.rootStore.videoStore.videoObject;
    const info = yield this.rootStore.client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `thumbnail-job-${objectId}`
    });

    if(!info) { return; }

    try {
      const {writeToken, lroId, nodeUrl} = JSON.parse(info);

      if(nodeUrl) {
        this.rootStore.client.RecordWriteToken({writeToken, fabricNodeUrl: nodeUrl});
      }

      const response = yield this.rootStore.client.CallBitcodeMethod({
        libraryId,
        objectId,
        writeToken,
        method: UrlJoin("/media/thumbnails/status", lroId),
        constant: true
      });

      if(response.data.custom.run_state === "finished" && finalize) {
        yield this.rootStore.client.FinalizeContentObject({
          libraryId,
          objectId,
          writeToken,
          commitMessage: "Eluvio Video Editor: Generate video thumbnails"
        });

        yield this.rootStore.client.walletClient.RemoveProfileMetadata({
          type: "app",
          appId: "video-editor",
          mode: "private",
          key: `thumbnail-job-${objectId}`
        });
      }

      this.thumbnailStatus.status = {
        state: response?.data?.custom?.run_state,
        progress: response?.data?.custom?.progress?.percentage || 0,
        ...response
      };

      return this.thumbnailStatus.status;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  });
}

export default TrackStore;
