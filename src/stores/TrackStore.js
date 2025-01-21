import {flow, makeAutoObservable, runInAction, toJS} from "mobx";
import {WebVTT} from "vtt.js";
import Id from "@/utils/Id";
import IntervalTree from "node-interval-tree";
import {Parser as HLSParser} from "m3u8-parser";
import UrlJoin from "url-join";
import {Utils} from "@eluvio/elv-client-js";

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

const HexToRGB = (hex, a) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a
  } : null;
};

const colors = [
  "#FFFFFF",
  "#19ded3",
  "#e02b10",
  "#ffc806",
  "#f10fbf",
  "#8a0c0c",
  "#405ff5",
  "#be6ef6",
  "#fb8e3e"
].map(color => HexToRGB(color, 150));

class TrackStore {
  entries = {};
  intervalTrees = {};

  initialized = false;
  tracks = [];
  audioTracks = [];
  selectedTrack;
  editingTrack = false;
  audioLoading = false;
  audioSupported = true;

  showTags = true;
  showSegments = false;
  showAudio = false;

  totalEntries = 0;

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;

    if(!window.AudioContext && !window.webkitAudioContext) {
      this.audioSupported = false;

      // eslint-disable-next-line no-console
      console.error("AudioContext not supported in this browser");
    }
  }

  Reset() {
    this.tracks = [];
    this.audioTracks = [];
    this.selectedTrack = undefined;
    this.editingTrack = false;
    this.audioLoading = false;
    this.initialized = false;
  }

  TrackColor(key) {
    const index = key.split("").reduce((acc, v, i) => acc + v.charCodeAt(0) * i, 0) % colors.length;

    return colors[index];
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

  AddTrack({label, key, type, entries, color}) {
    const trackId = Id.next();
    this.tracks.push({
      trackId,
      color: color || this.TrackColor(key),
      version: 1,
      label,
      key: key || `track-${label}`,
      trackType: type
    });

    this.entries[trackId] = entries;
    this.intervalTrees[trackId] = this.CreateTrackIntervalTree(entries, label);

    return trackId;
  }

  TrackEntries(trackId) {
    if(trackId in this.entries) {
      return this.entries[trackId];
    }

    return this.audioTracks.find(track => track.trackId === trackId)?.entries.flat();
  }

  TrackEntryIntervalTree(trackId) {
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
          const trackId = Id.next();

          this.audioTracks.push({
            trackId,
            label: track.label || "Audio",
            trackType: "audio",
            entries: [],
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
          this.entries[trackId] = [];

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
                this.entries[trackId][segment.number] ||
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
                this.entries[trackId][segment.number] = audioSamples;

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
      let entries = {};
      const millis = metadataTags[key].version > 0;
      metadataTags[key].tags.forEach(entry => {
        const parsedEntry = this.Cue({
          entryType: "metadata",
          startTime: millis ? (entry.start_time / 1000) : entry.start_time,
          endTime: millis ? (entry.end_time / 1000) : entry.end_time,
          text: entry.text,
          entry: toJS(entry)
        });

        entries[parsedEntry.entryId] = parsedEntry;
      });

      metadataTracks.push({
        label: metadataTags[key].label,
        trackType: "metadata",
        key,
        entries
      });
    });

    return metadataTracks;
  };

  Cue({entryType, label, startTime, endTime, text, entry}) {
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
      entryId: Id.next(),
      entryType,
      label,
      startTime,
      endTime,
      textList: toJS(textList),
      content: toJS(content),
      entry
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
      entryType: "vtt",
      label,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: cue.text,
      textList: [cue.text],
      entry: cueCopy
    });
  }

  ParseVTTTrack(track) {
    const vttParser = new WebVTT.Parser(window, WebVTT.StringDecoder());

    let cues = {};
    vttParser.oncue = cue => {
      const parsedCue = this.FormatVTTCue(track.label, cue);
      cues[parsedCue.entryId] = parsedCue;
    };

    try {
      vttParser.parse(track.vttData);
      vttParser.flush();
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error(`VTT cue parse failure on track ${track.label}: `);
      // eslint-disable-next-line no-console
      console.error(error);
    }

    return cues;
  }

  CreateTrackIntervalTree(entries, label) {
    const intervalTree = new IntervalTree();

    Object.values(entries).forEach(entry => {
      try {
        intervalTree.insert(entry.startTime, entry.endTime, entry.entryId);
      } catch(error) {
        // eslint-disable-next-line no-console
        console.warn(`Invalid entry in track '${label}'`);
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify(entry, null, 2));
      }
    });

    return intervalTree;
  }

  AddSubtitleTracks = flow(function * () {
    try {
      const subtitleTracks = yield this.SubtitleTracksFromHLSPlaylist();

      // Initialize video WebVTT tracks by fetching and parsing the VTT file
      subtitleTracks.map(track => {
        try {
          const entries = this.ParseVTTTrack(track);

          this.totalEntries += Object.keys(entries).length;

          this.AddTrack({
            ...track,
            type: "vtt",
            entries
          });
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error("Error parsing VTT track:");
          // eslint-disable-next-line no-console
          console.error(error);
        }
      });
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load subtitle tracks:");
      // eslint-disable-next-line no-console
      console.error(error);
    }
  });

  AddMetadataTracks() {
    try {
      const metadataTracks = this.AddTracksFromTags(this.rootStore.videoStore.tags.metadata_tags);
      metadataTracks.map(track => {
        if(!track.label || !track.entries) {
          // eslint-disable-next-line no-console
          console.error("Invalid track:", track.key);
          // eslint-disable-next-line no-console
          console.error(toJS(this.rootStore.videoStore.tags.metadata_tags[track.key]));
          return;
        }

        this.totalEntries += Object.keys(track.entries).length;

        this.AddTrack({
          label: track.label,
          key: track.key,
          type: "metadata",
          entries: track.entries
        });
      });
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
            entryType: "segment",
            startTime: parseFloat(timeline_start.float.toFixed(2)),
            endTime: parseFloat(timeline_end.float.toFixed(2)),
            text: `${timeline_start.float.toFixed(2)} - ${timeline_end.float.toFixed(2)}`,
            entry: {}
          });

          segment.source = source;
          segment.streamType = stream;

          segments[segment.entryId] = segment;
        });

        this.AddTrack({
          label: `${stream === "video" ? "Video" : "Audio"} Segments`,
          key: `${stream}-segments`,
          type: "segments",
          entries: segments
        });
      });
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load segment tracks:");
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  AddClipTrack() {
    const clip = this.Cue({
      entryType: "clip",
      startTime: this.rootStore.videoStore.primaryContentStartTime,
      endTime: this.rootStore.videoStore.primaryContentEndTime,
      text: "Primary Content",
      entry: {}
    });

    const entries = {
      [clip.entryId]: clip
    };

    this.AddTrack({
      label: "Primary Content",
      key: "primary-content",
      type: "clip",
      color: {r: 255, g: 255, b: 255, a: 200},
      entries
    });
  }

  InitializeTracks = flow(function * () {
    if(this.initialized) { return; }

    this.initialized = true;

    this.AddClipTrack();
    yield this.AddSubtitleTracks();
    yield this.AddMetadataTracks();
    yield this.AddSegmentTracks();
    yield this.rootStore.overlayStore.AddOverlayTracks();
  });

  /* User Actions */

  SelectedTrack() {
    if(!this.selectedTrack) { return; }

    return this.tracks.find(track => track.trackId === this.selectedTrack);
  }

  SetSelectedTrack(trackId) {
    if(this.selectedTrack === trackId) { return; }

    this.selectedTrack = trackId;
    this.rootStore.entryStore.ClearEntries();
    this.rootStore.entryStore.ClearFilter();

    this.ClearEditing();
  }

  ClearSelectedTrack() {
    this.SetSelectedTrack(undefined);

    this.rootStore.videoStore.EndSegment();
  }

  ToggleTrackType({type, visible}) {
    if(type === "Audio" && visible && this.audioTracks.length === 0) {
      this.AddAudioTracks();
      setTimeout(() => runInAction(() => this.showAudio = visible), 1000);
    } else {
      this[`show${type}`] = visible;
    }
  }

  ToggleTrack(label) {
    const trackInfo = this.tracks.find(track => track.label === label);

    if(!trackInfo) { return; }

    // Toggle track on video, using video's status as source of truth
    trackInfo.active = this.rootStore.videoStore.ToggleTrack(label);
  }

  ToggleTrackByIndex(index) {
    const trackInfo = this.tracks[index];

    if(!trackInfo) { return; }

    // Toggle track on video, using video's status as source of truth
    trackInfo.active = this.rootStore.videoStore.ToggleTrack(trackInfo.label);
  }

  SetEditing(trackId) {
    this.SetSelectedTrack(trackId);

    this.editingTrack = true;
  }

  ClearEditing() {
    this.editingTrack = false;
  }

  CreateTrack({label, key}) {
    const trackId = this.AddTrack({
      label,
      key,
      type: "metadata",
      entries: {}
    });

    this.rootStore.entryStore.ClearSelectedEntry();

    this.SetEditing(trackId);
  }

  EditTrack({trackId, label, key}) {
    const track = this.tracks.find(track => track.trackId === trackId);

    track.label = label;
    track.key = key;

    this.ClearEditing();
  }

  ModifyTrack(f) {
    const track = this.SelectedTrack();
    f(track);
    this.intervalTrees[track.trackId] = this.CreateTrackIntervalTree(this.entries[track.trackId], track.label);
    track.version += 1;
  }

  RemoveTrack(trackId) {
    this.ClearSelectedTrack();

    this.tracks = this.tracks.filter(track => track.trackId !== trackId);
  }

  AddEntry({trackId, text, startTime, endTime}) {
    const track = this.tracks.find(track => track.trackId === trackId);
    const cue = this.Cue({entryType: "metadata", text, startTime, endTime});

    this.entries[track.trackId][cue.entryId] = cue;

    return cue.entryId;
  }

  ClipInfo() {
    const clipTrack = this.tracks.find(track => track.trackType === "clip");
    return Object.values(this.entries[clipTrack.trackId])[0];
  }
}

export default TrackStore;
