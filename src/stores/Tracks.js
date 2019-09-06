import {observable, action, flow} from "mobx";
import {WebVTT} from "vtt.js";
import Id from "../utils/Id";
import IntervalTree from "node-interval-tree";
import {Parser as HLSParser} from "m3u8-parser";
import UrlJoin from "url-join";
import {SortEntries} from "../utils/Utils";

class Tracks {
  @observable tracks = [];
  @observable audioTracks = [];
  @observable subtitleTracks = [];
  @observable metadataTracks = [];
  @observable selectedTrack;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  Reset() {
    this.tracks = [];
    this.audioTracks = [];
    this.subtitleTracks = [];
    this.metadataTracks = [];
    this.selectedTrack = undefined;
  }

  async ParseHLSPlaylist(playlistUrl) {
    const playlist = await (await fetch(playlistUrl)).text();
    const parser = new HLSParser();
    parser.push(playlist);
    parser.end();

    return parser.manifest;
  }

  AddSubtitleTracksFromHLSPlaylist = flow(function * (playoutUrl, subtitles) {
    if(!subtitles) { return []; }

    let vttTracks = [];

    yield Promise.all(
      Object.keys(subtitles).map(async subtitleName => {
        // Get playlist for subtitles
        const subPlaylistPath = subtitles[subtitleName].uri;
        const subPlaylistUrl = UrlJoin(playoutUrl, subPlaylistPath);
        const subPlaylist = await this.ParseHLSPlaylist(subPlaylistUrl);

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

  @action.bound
  AddTracksFromHLSPlaylist = flow(function * (playlistUrl) {
    let subtitleTracks = [];
    try {
      const playoutUrl = (playlistUrl.split("?")[0]).replace("playlist.m3u8", "");
      const playlist = yield this.ParseHLSPlaylist(playlistUrl);

      subtitleTracks = yield this.AddSubtitleTracksFromHLSPlaylist(playoutUrl, playlist.mediaGroups.SUBTITLES.subs);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Error parsing subtitle tracks from playlist:");
      // eslint-disable-next-line no-console
      console.error(error);
    }

    return subtitleTracks;
  });

  DownloadAudioTrack = async (selectedObject, partHash) => {
    let audioData = new Uint8Array([]);

    return audioData;

    await new Promise(async resolve => {
      await this.rootStore.client.DownloadPart({
        libraryId: selectedObject.libraryId,
        versionHash: selectedObject.versionHash,
        partHash,
        chunked: true,
        format: "arrayBuffer",
        callback: ({chunk, bytesFinished, bytesTotal}) => {
          audioData = new Uint8Array([
            ...audioData,
            ...(new Uint8Array(chunk))
          ]);

          if(bytesFinished === bytesTotal) {
            resolve();
          }
        }
      });
    });

    return audioData.buffer;
  };

  AddAudioTracks = flow(function * (segments) {
    // Scale sample rate to video duration - short videos should have many samples because the
    // visible can be set very small
    const duration = segments.reduce((total, segment) => total + segment.duration.float, 0);
    const samplesPerSecond = Math.ceil(Math.max(5, 50 * (5000 - duration) / 5000));

    const selectedObject = this.rootStore.menuStore.selectedObject;

    this.audioTracks = [{
      trackId: Id.next(),
      label: "Audio",
      trackType: "audio",
      entries: []
    }];

    for(let i = 0; i < segments.length; i++) {
      const segmentInfo = segments[i];
      const audioData = yield this.DownloadAudioTrack(selectedObject, segmentInfo.source);

      const audioContext = new AudioContext();
      const source = audioContext.createBufferSource();
      yield new Promise(resolve => {
        audioContext.decodeAudioData(audioData, (buffer) => {
          source.buffer = buffer;
          resolve();
        });
      });

      const samples = Math.ceil(source.buffer.duration * samplesPerSecond);
      const channel = source.buffer.getChannelData(0);
      const sampleSize = Math.round(channel.length / samples);
      const sampleDuration = 1 / samplesPerSecond;
      const startTime = segmentInfo.timeline_start.float;
      let audioSamples = [...Array(samples).keys()]
        .map(i => channel.slice(i * sampleSize, (i+1) * sampleSize))
        .map((samples, i) => ({
          startTime: startTime + i * sampleDuration,
          endTime: startTime + (i + 1) * sampleDuration,
          max: Math.max(...samples)
        }));

      this.audioTracks[0].entries = [
        ...this.audioTracks[0].entries,
        ...audioSamples
      ];
    }
  });

  AddTracksFromTags = (metadataTags) => {
    if(!metadataTags) { return []; }

    let metadataTracks = [];
    Object.keys(metadataTags).forEach(key => {
      const entries = metadataTags[key].entries
        .map(entry =>
          this.Cue({
            entryType: "metadata",
            label: entry.label,
            startTime: entry.start_time,
            endTime: entry.end_time,
            text: entry.text,
            entry
          })
        );

      metadataTracks.push({
        label: metadataTags[key].name,
        trackType: "metadata",
        key,
        entries: SortEntries(entries)
      });
    });

    return metadataTracks;
  };

  Cue({entryType, label, startTime, endTime, text, entry}) {
    const isSMPTE = typeof startTime === "string" && startTime.split(":").length > 1;

    let startTimeSMPTE, endTimeSMPTE;
    if(isSMPTE) {
      // Given times are in SMPTE - calculate numerical time
      startTimeSMPTE = startTime;
      endTimeSMPTE = endTime;

      startTime = this.rootStore.videoStore.videoHandler.SMPTEToTime(startTime);
      endTime = this.rootStore.videoStore.videoHandler.SMPTEToTime(endTime);
    } else {
      // Given times are in numerical time - calculate SMPTE
      startTimeSMPTE = this.rootStore.videoStore.videoHandler.TimeToSMPTE(startTime);
      endTimeSMPTE = this.rootStore.videoStore.videoHandler.TimeToSMPTE(endTime);
    }

    return {
      entryId: Id.next(),
      entryType,
      label,
      startTime,
      endTime,
      startTimeSMPTE,
      endTimeSMPTE,
      text,
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
      entry: cueCopy
    });
  }

  ParseVTTTrack(track) {
    const vttParser = new WebVTT.Parser(window, WebVTT.StringDecoder());

    let cues = [];
    vttParser.oncue = cue => cues.push(this.FormatVTTCue(track.label, cue));

    try {
      vttParser.parse(track.vttData);
      vttParser.flush();
    } catch(error) {
      /* eslint-disable no-console */
      console.error(`VTT cue parse failure on track ${track.label}: `);
      console.error(error);
      /* eslint-enable no-console */
    }

    return cues;
  }

  @action.bound
  InitializeTracks = flow(function * () {
    let tracks = [];

    const subtitleTracks = yield this.AddTracksFromHLSPlaylist(this.rootStore.videoStore.source);
    // Initialize video WebVTT tracks by fetching and parsing the VTT file
    subtitleTracks.map(track => {
      const entries = this.ParseVTTTrack(track);
      const intervalTree = new IntervalTree();
      entries.forEach(entry => intervalTree.insert(entry.startTime, entry.endTime, entry));

      tracks.push({
        trackId: Id.next(),
        ...track,
        trackType: "vtt",
        entries,
        intervalTree
      });
    });

    const metadataTracks = this.AddTracksFromTags(this.rootStore.videoStore.metadata.metadata_tags);
    metadataTracks.map(track => {
      const intervalTree = new IntervalTree();
      track.entries.forEach(entry => intervalTree.insert(entry.startTime, entry.endTime, entry));

      tracks.push({
        trackId: Id.next(),
        label: track.label,
        key: track.key,
        trackType: "metadata",
        entries: track.entries,
        intervalTree
      });
    });

    this.tracks = tracks;
  });

  @action.bound
  SelectedTrack() {
    if(!this.selectedTrack) { return; }

    return this.tracks.find(track => track.trackId === this.selectedTrack);
  }

  @action.bound
  SetSelectedTrack(trackId) {
    if(this.selectedTrack === trackId) { return; }

    this.selectedTrack = trackId;
    this.rootStore.entryStore.ClearFilter();
  }

  @action.bound
  ClearSelectedTrack() {
    this.SetSelectedTrack(undefined);
  }

  @action.bound
  ToggleTrack(label) {
    const trackInfo = this.tracks.find(track => track.label === label);

    if(!trackInfo) { return; }

    // Toggle track on video, using video's status as source of truth
    trackInfo.active = this.rootStore.videoStore.ToggleTrack(label);
  }

  @action.bound
  ToggleTrackByIndex(index) {
    const trackInfo = this.tracks[index];

    if(!trackInfo) { return; }

    // Toggle track on video, using video's status as source of truth
    trackInfo.active = this.rootStore.videoStore.ToggleTrack(trackInfo.label);
  }
}

export default Tracks;
