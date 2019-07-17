import {observable, action, runInAction, flow} from "mobx";
import {WebVTT} from "vtt.js";
import Id from "../utils/Id";
import IntervalTree from "node-interval-tree";

class Tracks {
  @observable tracks = [];
  @observable subtitleTracks = [];
  @observable metadataTracks = [];

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  AddTracksFromMetadata = flow(function * (metadata) {
    let tracks;
    if(metadata.pkg) {
      tracks = Object.keys(metadata.pkg).filter(entry => entry.endsWith(".vtt"));
    }

    if(!tracks) { return; }

    let subtitles = [];

    // Download subtitle data from parts
    yield Promise.all(
      tracks.map(async label => {
        const partHash = metadata.pkg[label];
        const contentObject = this.rootStore.videoStore.contentObject;

        /*
        const vttData = await this.rootStore.client.DownloadPart({
          versionHash: contentObject.versionHash,
          partHash,
          format: "text"
        });
        */

        const vttData = await (await fetch("https://host-66-220-3-82.contentfabric.io/q/hq__KhZm1WqJvLNjrKVKSuyZXrpLx5pwtyQ3MocExGoygsrik3Kc8RRVyAd9D9TLsgPRvBP4DVEord/rep/playout/default/dash-clear/captions_eng/vtt/captions.vtt?authorization=eyJxc3BhY2VfaWQiOiJpc3BjQXBvV1BRUnJUa1JRVjFLcFlqdnFQeVNBbXhhIiwicWxpYl9pZCI6ImlsaWI0TjF5V0hvMzlVSzZRdUZad3JCaFVkbU5BNWEzIiwiYWRkciI6IjB4ZDlEQzk3QjU4QzVmMjU4NDA2MkNmNjk3NzVkMTYwZWQ5QTNCRmJDNCIsInFpZCI6ImlxX18yUXRpaUV0c3M5YzhSNnVQdXpmQ002NWFqVUdtIiwiZ3JhbnQiOiJyZWFkIiwidHhfcmVxdWlyZWQiOmZhbHNlLCJpYXQiOjE1NjMzOTQyNzYsImV4cCI6MTU2MzQ4MDY3NiwiYXV0aF9zaWciOiJFUzI1NktfS1FFNjVwaUg4MnVOampjMmp4aEtwVXQ5elY4azZUemNaemM5ZDZ6TEtYQzFRZ0FHVzhRRzZlZ3JKYmd3WTROdDlkck5ia043S2JwZ2l0UHZhV1ZySzZHTlQiLCJhZmdoX3BrIjoiIn0%3D.RVMyNTZLXzNpRzlReGFhMW1TMVM1Y0J4emJnWWV5RDZSak42U3UydjdNamo4S2tNeHZuTWJrR1ZjQ2lTTGR0SDZaODdKRTZjMWZZeEhNemVGVGRhTEt0VG9LenhoZjVE")).text();


        subtitles.push({
          label,
          kind: "subtitles",
          vttData,
          source: await this.rootStore.client.FabricUrl({
            versionHash: contentObject.hash,
            partHash
          })
        });
      })
    );

    this.subtitleTracks = subtitles;

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
