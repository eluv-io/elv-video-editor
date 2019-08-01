import {observable, action, runInAction, flow} from "mobx";
import {WebVTT} from "vtt.js";
import Id from "../utils/Id";
import IntervalTree from "node-interval-tree";
import {Parser as HLSParser} from "m3u8-parser";
import UrlJoin from "url-join";

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

  Cue({label, vttEntry=false, startTime, endTime, text, entry}) {
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
      label,
      vttEntry,
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
      label,
      vttEntry: true,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: cue.text,
      entry: cueCopy
    });
  }

  async ParseVTTTrack(track) {
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

  ParseSimpleTrack(track) {
    const entries = track.rawData
      .map(entry =>
        this.Cue({
          label: track.label,
          startTime: entry.startTime,
          endTime: entry.endTime,
          text: entry.text,
          entry
        })
      )
      .sort((a, b) => a.startTime > b.startTime ? 1 : -1);

    return {
      ...track,
      entries
    };
  }

  @action.bound
  async InitializeTracks() {
    let tracks = [];

    // Initialize video WebVTT tracks by fetching and parsing the VTT file
    await Promise.all(
      this.subtitleTracks.map(async track => {
        const entries = await this.ParseVTTTrack(track);
        const intervalTree = new IntervalTree();
        entries.forEach(entry => intervalTree.insert(entry.startTime, entry.endTime, entry));

        tracks.push({
          ...track,
          vttTrack: true,
          entries,
          intervalTree
        });
      })
    );

    const customTracks = this.metadataTracks.map(track => this.ParseSimpleTrack(track));
    tracks = tracks.concat(customTracks);

    runInAction(() => this.tracks = tracks);
  }

  @action.bound
  ToggleTrack(label) {
    const trackInfo = this.tracks.find(track => track.label === label);

    if(!trackInfo) { return; }

    // Toggle track on video, using video's status as source of truth
    trackInfo.active = this.rootStore.videoStore.ToggleTrack(label);
  }
}

export default Tracks;
