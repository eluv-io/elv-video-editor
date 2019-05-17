import {observable, action, runInAction} from "mobx";
import {WebVTT} from "vtt.js";
import Id from "../utils/Id";

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


class Tracks {
  @observable tracks = trackInfo;

  constructor(rootStore) {
    this.rootStore = rootStore;
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
      startTimeSMPTE: this.rootStore.videoStore.videoHandler.TimeToSMPTE(cue.startTime),
      endTimeSMPTE: this.rootStore.videoStore.videoHandler.TimeToSMPTE(cue.endTime),
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
      this.tracks.map(async track => {
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
    const trackInfo = this.tracks.find(track => track.label === label);

    if(!trackInfo) { return; }

    // Toggle track on video, using video's status as source of truth
    trackInfo.active = this.rootStore.videoStore.ToggleTrack(label);
  }
}

export default Tracks;
