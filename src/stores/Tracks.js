import {observable, action, runInAction, flow} from "mobx";
import {WebVTT} from "vtt.js";
import Id from "../utils/Id";

class Tracks {
  @observable tracks = [];
  @observable subtitleTracks = [];
  @observable metadataTracks = [];

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  AddTracksFromMetadata = flow(function * (metadata) {
    if(metadata.subtitles) {
      let subtitles = [];

      // Download subtitles data from parts
      yield Promise.all(
        Object.keys(metadata.subtitles).map(async label => {
          const partHash = metadata.subtitles[label];
          const contentObject = this.rootStore.videoStore.contentObject;
          const vttData = await this.rootStore.client.DownloadPart({
            libraryId: contentObject.libraryId,
            objectId: contentObject.objectId,
            partHash,
            format: "text"
          });

          subtitles.push({
            label,
            kind: "subtitles",
            vttData,
            source: await this.rootStore.client.FabricUrl({
              objectId: contentObject.objectId,
              versionHash: contentObject.hash,
              partHash
            })
          });
        })
      );

      this.subtitleTracks = subtitles;
    }

    if(metadata.tracks) {
      this.metadataTracks = Object.keys(metadata.tracks).map(label => ({
        label,
        kind: "custom",
        rawData: metadata.tracks[label]
      }));
    }
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
        tracks.push({
          ...track,
          vttTrack: true,
          entries: await this.ParseVTTTrack(track)
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
