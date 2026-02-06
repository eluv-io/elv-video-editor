import {flow, makeAutoObservable, runInAction} from "mobx";
import {Parser as HLSParser} from "m3u8-parser";
import UrlJoin from "url-join";
import {Utils} from "@eluvio/elv-client-js";
import {ConvertColor, Unproxy} from "@/utils/Utils.js";
import {ParseVTTTrack, Cue, CreateTrackIntervalTree} from "@/stores/Helpers.js";

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
  trackAlpha = 100;

  colors = [
    "#FFFFFF",
    "#19ded3",
    "#ff2100",
    "#b700ff",
    "#f10fbf",
    "#8a0c0c",
    "#405ff5",
    "#be6ef6",
    "#fb8e3e"
  ].map(color => ConvertColor({hex: color, alpha: this.trackAlpha}));

  constructor(rootStore) {
    makeAutoObservable(
      this,
      {
        tags: false,
        intervalTrees: false
      }
    );

    this.rootStore = rootStore;

    if(!window.AudioContext && !window.webkitAudioContext) {
      this.audioSupported = false;
      console.error("AudioContext not supported in this browser");
    }
  }

  get tracksSelected() {
    return Object.keys(this.activeTracks).length > 0;
  }

  get visibleMetadataTracks() {
    return !this.tracksSelected ?
      this.metadataTracks :
      this.metadataTracks.filter(track => this.IsTrackVisible(track.key));
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
    return (
      this.rootStore.page === "clips" ?
        [...this.visibleClipTracks, ...this.clipTracks] :
        [...this.visibleMetadataTracks, ...this.metadataTracks]
    )
      .filter((track, index, array) => array.findIndex(otherTrack => otherTrack.key === track.key) === index);
  }

  Reset() {
    this.tracks = [];
    this.audioTracks = [];
    this.selectedTrack = undefined;
    this.editingTrack = false;
    this.audioLoading = false;
    this.initialized = false;

    this.tags = {};
    this.totalTags = 0;
    this.intervalTrees = {};
    this.selectedTrack = undefined;
    this.activeTracks = {};
    this.activeClipTracks = {};
    this.editingTrack = false;
  }

  TrackColor(key, type) {
    let savedTrackInfo;
    if(type === "clip") {
      savedTrackInfo = this.clipTrackSettings?.[key];
    }

    if(savedTrackInfo) {
      return ConvertColor({hex: savedTrackInfo.color, alpha: this.trackAlpha});
    }

    const index = key.split("").reduce((acc, v, i) => acc + v.charCodeAt(0) * i, 0) % this.colors.length;

    return this.colors[index];
  }

  Track(trackKeyOrId, type) {
    const trackIndex = this.tracks.findIndex(track =>
      (!type || track.trackType === type) &&
      (track.trackId === trackKeyOrId || track.key === trackKeyOrId)
    );

    return trackIndex >= 0 ? this.tracks[trackIndex] : undefined;
  }

  IsTrackVisible(trackKeyOrId) {
    const track = this.Track(trackKeyOrId, this.rootStore.page === "clips" ? "clip" : "metadata");

    if(this.rootStore.page === "clips") {
      return !this.clipTracksSelected || this.activeClipTracks[track?.key];
    } else {
      return !this.tracksSelected || this.activeTracks[track?.key];
    }
  }

  ModifyTrack(modifiedTrack) {
    const trackIndex = this.tracks.findIndex(track => track.trackId === modifiedTrack.trackId);

    this.tracks[trackIndex] = modifiedTrack;
  }

  AddTag({trackId, tag}) {
    if(!tag.tagId) {
      tag.tagId = tag.id || this.rootStore.NextId(true);
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
    this.intervalTrees[trackId] = CreateTrackIntervalTree(
      this.TrackTags(trackId),
      track.label || track.key
    );

    this.tracks[trackIndex].version++;
  }

  /* HLS Playlist Parsing */

  BasePlayoutUrl() {
    return this.rootStore.videoStore.playoutUrl.split("?")[0].replace("playlist.m3u8", "");
  }

  // TODO: Try switching to hls-parser
  async ParsedHLSPlaylist(playlistUrl) {
    if(!playlistUrl) { playlistUrl = this.rootStore.videoStore.playoutUrl; }

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
    const subtitleInfo = playlist.mediaGroups?.SUBTITLES?.subs;

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
    if(color && typeof color === "string") {
      color = ConvertColor({hex: color, alpha: this.trackAlpha});
    }

    trackId = trackId || this.rootStore.NextId();

    let updatedTags = {};
    Object.keys(tags).forEach(key =>
      updatedTags[key] = { trackId, ...tags[key] }
    );

    this.tracks.push({
      trackId,
      color: color || this.TrackColor(key, type),
      version: 1,
      label,
      key: key || `track-${label}`,
      trackType: type,
      requiresSave: true,
      ...additional
    });

    this.tags[trackId] = updatedTags;
    this.intervalTrees[trackId] = CreateTrackIntervalTree(tags, label);

    return trackId;
  }

  DeleteTrack({trackId}) {
    const trackKey = this.Track(trackId)?.key;

    delete this.tags[trackId];
    this.tracks = this.tracks.filter(track => track.trackId !== trackId);
    delete this.intervalTrees[trackId];

    delete this.activeTracks[trackKey];

    this.ResetActiveClipTracks();
    this.ResetActiveTracks();
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
        console.error("Failed to decode audio segment");
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
          const trackId = this.rootStore.NextId();

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
          console.error(error);
        }
      })
    );
  });

  /* Subtitles and Metadata */

  FormatAggregatedSpeechToTextTag(tag) {
    if(!tag.text?.["Speech to Text"]) {
      return;
    }

    const text = tag.text["Speech to Text"].map(({text}) => text).join(" ");

    return {
      ...tag,
      text
    };
  }

  AddTracksFromTags = (metadataTags, type="metadata") => {
    if(!metadataTags) { return []; }

    let metadataTracks = [];
    Object.keys(metadataTags).forEach(key => {
      const track = metadataTags[key];
      let tags = {};
      const millis = type === "clip";
      metadataTags[key].tags.forEach(tag => {
        if(key === "shot_tags") {
          tag = this.FormatAggregatedSpeechToTextTag(tag);

          if(!tag) { return; }
        }

        let tagId = tag.id;
        if(tag?.lk === "user" && tag.id) {
          // Ensure user tags have UUID tag IDs
          tagId = this.rootStore.NextId(true);
        }

        let parsedTag = Cue({
          tagId,
          trackKey: key,
          tagType: type,
          startTime: millis ? (tag.start_time / 1000) : tag.start_time,
          endTime: millis ? (tag.end_time / 1000) : tag.end_time,
          text: tag.text,
          tag: Unproxy(tag),
          o: {
            lk: tag.lk,
            tk: tag.tk,
            ti: tag.ti
          }
        });

        if(parsedTag.startTime >= parsedTag.endTime) {
          parsedTag.endTime = parsedTag.startTime + this.rootStore.videoStore.FrameToTime(1);
        }

        tags[parsedTag.tagId] = parsedTag;
      });

      metadataTracks.push({
        ...track,
        label: key === "shot_tags" ? "Speech to Text (Aggregated)" : metadataTags[key].label,
        trackType: type,
        key,
        tags
      });
    });

    return metadataTracks;
  };

  AddSubtitleTracks = flow(function * () {
    try {
      const subtitleTracks = yield this.SubtitleTracksFromHLSPlaylist();

      // Initialize video WebVTT tracks by fetching and parsing the VTT file
      yield Promise.all(
        subtitleTracks.map(async track => {
          try {
            const tags = await ParseVTTTrack({track, store: this.rootStore.videoStore});

            this.totalTags += Object.keys(tags).length;

            this.AddTrack({
              ...track,
              key: track.label,
              type: "vtt",
              tags
            });
          } catch(error) {
            console.error("Error parsing VTT track:");
            console.error(error);
          }
        })
      );
    } catch(error) {
      console.error("Failed to load subtitle tracks:");
      console.error(error);
    }
  });

  AddMetadataTracks(metadataTags, type="metadata") {
    try {
      const metadataTracks = this.AddTracksFromTags(metadataTags, type);
      metadataTracks.map(track => {
        if(!track.label || !track.tags) {
          console.error("Invalid track:", track.key);
          console.error(Unproxy(metadataTags[track.key]));
          return;
        }

        this.totalTags += Object.keys(track.tags).length;

        this.AddTrack({
          ...track,
          label: track.label,
          key: track.key,
          type,
          tags: track.tags
        });
      });

      this.uiUpdateDelayFactor = Math.max(0.25, Math.log10(this.totalTags) / 4 - 0.5);
    } catch(error) {
      console.error("Failed to load metadata tracks:");
      console.error(error);
    }
  }

  LoadSegments = flow(function * () {
    const segmentMetadata = yield this.rootStore.client.ContentObjectMetadata({
      ...this.rootStore.videoStore.videoObject,
      metadataSubtree: UrlJoin("/offerings", this.rootStore.videoStore.offeringKey, "media_struct", "streams")
    });

    if(segmentMetadata) {
      this.AddSegmentTracks(segmentMetadata);
    }
  });

  AddSegmentTracks(streams) {
    try {
      Object.keys(streams)
        .filter(stream =>
          (stream.toLowerCase().includes("video") || stream.toLowerCase().includes("audio")) &&
          !stream.toLowerCase().includes("thumb")
        )
        .forEach(stream => {
          if(!streams[stream]) {
            console.error(`No ${stream} stream found. Skipping ${stream} segment track.`);
            return;
          }

          const sources = streams[stream].sources;

          let segments = {};
          sources.forEach(({timeline_start, timeline_end, source}) => {
            let segment = Cue({
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
            label: `${stream === "video" ? "Video" : "Audio"} Segments ${!["audio", "video"].includes(stream) ? `(${stream})` : ""}`,
            key: `${stream}-segments`,
            type: "segments",
            tags: segments
          });
        });
      } catch(error) {
        console.error("Failed to load segment tracks:");
        console.error(error);
      }
  }

  async AddPrimaryContentTrack() {
    while(!this.rootStore.videoStore?.initialized) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const clip = Cue({
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


  InitializeTracks = flow(function * ({metadata, metadataTags, metadataOverlayTags=[], clipTags}) {
    if(this.initialized) { return; }

    // Get saved track settings from metadata
    this.clipTrackSettings = metadata?.clips?.evie?.tracks;

    this.AddPrimaryContentTrack();
    yield this.AddSubtitleTracks();
    yield this.AddMetadataTracks(metadataTags, "metadata");
    yield this.AddMetadataTracks(clipTags, "clip");

    this.initialized = true;

    let trackIds = {};
    this.tracks.forEach(track => trackIds[track.trackKey] = track.trackId);

    let overlayTags = {};
    metadataOverlayTags.forEach(tag => {
      if(!overlayTags[tag.frame]) {
        overlayTags[tag.frame] = {};
      }

      if(!overlayTags[tag.frame][tag.trackKey]) {
        overlayTags[tag.frame][tag.trackKey] = { tags: [] };
      }

      overlayTags[tag.frame][tag.trackKey].tags.push({
        ...tag,
        trackId: trackIds[tag.trackKey],
        o: {}
      });
    });

    this.rootStore.overlayStore.AddOverlayTracks(overlayTags);
  });

  /* User Actions */

  ResetActiveTracks() {
    this.activeTracks = {};
  }

  ToggleTrackSelected(key, value) {
    if(typeof value !== "undefined") {
      value ?
        this.activeTracks[key] = true :
        delete this.activeTracks[key];

      return;
    }

    if(this.activeTracks[key]) {
      delete this.activeTracks[key];
    } else {
      this.activeTracks[key] = true;
    }
  }

  ResetActiveClipTracks() {
    this.activeClipTracks = {};
  }

  ToggleClipTrackSelected(key, value) {
    if(typeof value !== "undefined") {
      value ?
        this.activeClipTracks[key] = true :
        delete this.activeClipTracks[key];

      return;
    }

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

    if(type === "Segments" && visible) {
      this.LoadSegments();
    }
  }

  ClipInfo() {
    const clipTrack = this.tracks.find(track => track.key === "primary-content");
    return Object.values(this.tags[clipTrack.trackId])[0];
  }
}

export default TrackStore;
