import {observable, action, runInAction, flow} from "mobx";
import {WebVTT} from "vtt.js";
import Id from "../utils/Id";
import IntervalTree from "node-interval-tree";
import {Parser as HLSParser} from "m3u8-parser";
import UrlJoin from "url-join";

import SegmentTags from "../static/tags-segment";

class Tracks {
  @observable tracks = [];
  @observable subtitleTracks = [];
  @observable metadataTracks = [];

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  async ParseHLSPlaylist(playlistUrl) {
    const playlist = await (await fetch(playlistUrl)).text();
    const parser = new HLSParser();
    parser.push(playlist);
    parser.end();

    return parser.manifest;
  }

  @action.bound
  AddTracksFromHLSPlaylist = flow(function * (playlistUrl) {
    let vttFiles = [];

    try {
      const playoutUrl = (playlistUrl.split("?")[0]).replace("playlist.m3u8", "");
      const playlist = yield this.ParseHLSPlaylist(playlistUrl);
      const subtitles = playlist.mediaGroups.SUBTITLES.subs;

      if(!subtitles) { return; }

      yield Promise.all(
        Object.keys(subtitles).map(async subtitleName => {
          // Get playlist for subtitles
          const subPlaylistPath = subtitles[subtitleName].uri;
          const subPlaylistUrl = UrlJoin(playoutUrl, subPlaylistPath);
          const subPlaylist = await this.ParseHLSPlaylist(subPlaylistUrl);

          // Get VTT data
          const vttPath = subPlaylist.segments[0].uri;
          const subBaseUrl = (subPlaylistUrl.split("?")[0]).replace("playlist.m3u8", "");
          const vttUrl = UrlJoin(subBaseUrl, vttPath);
          const vttData = await (await fetch(vttUrl)).text();

          vttFiles.push({
            label: subtitleName,
            kind: "subtitles",
            vttData
          });
        })
      );
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Error parsing subtitle tracks from playlist:");
      // eslint-disable-next-line no-console
      console.error(error);
    }

    this.subtitleTracks = vttFiles;
  });

  @action.bound
  AddTracksFromTags = flow(function * () {
    const tags = SegmentTags["AustinCityLimits-HE2R7raDpDw"];

    yield;

    this.metadataTracks = [tags];
  });

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

  ParseSegmentTags(tags) {
    return Object.keys(tags).map(tag => {
      const entries = tags[tag];

      return entries.map(({start, end}) =>
        this.Cue({
          label: tag,
          startTime: start,
          endTime: end,
          text: tag
        })
      );
    })
      .flat()
      .sort((a, b) => a.startTime > b.startTime ? 1 : -1);
  }

  @action.bound
  async InitializeTracks() {
    let tracks = [];

    // Initialize video WebVTT tracks by fetching and parsing the VTT file

    this.subtitleTracks.map(track => {
      const entries = this.ParseVTTTrack(track);
      const intervalTree = new IntervalTree();
      entries.forEach(entry => intervalTree.insert(entry.startTime, entry.endTime, entry));

      tracks.push({
        ...track,
        vttTrack: true,
        entries,
        intervalTree
      });
    });

    this.metadataTracks.map(track => {
      const parsedTags = this.ParseSegmentTags(track);
      const intervalTree = new IntervalTree();
      parsedTags.forEach(entry => intervalTree.insert(entry.startTime, entry.endTime, entry));

      tracks.push({
        label: "Tags",
        vttTrack: false,
        entries: parsedTags,
        intervalTree
      });
    });

    runInAction(() => this.tracks = tracks);
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
