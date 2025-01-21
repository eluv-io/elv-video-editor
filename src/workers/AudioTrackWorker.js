import Fraction from "fraction.js";
import {Line} from "./Utils";

const mainColor = {
  r: 50,
  g: 200,
  b: 50,
  a: 255
};

class AudioTrackWorker {
  constructor({trackId, height, width, entries, scale, duration}) {
    this.trackId = trackId;
    this.entries = (entries || []).flat();
    this.scale = scale;
    this.duration = duration;
    this.width = width;
    this.height = height;
    this.filter = "";
    this.max = 1;

    this.selectedEntryId = undefined;
    this.activeEntryIds = [];
    this.hoverEntryIds = [];
    this.selectedEntryIds = [];
  }

  Draw() {
    if(!this.width || !this.height) { return; }

    let entries = Object.values(this.entries).filter(e => e);

    const imageData = new ImageData(this.width, this.height);

    const {scale, scaleMin, scaleMax} = this.scale;

    // How much of the duration of the video is currently visible
    const visibleDuration = Fraction(scaleMax - scaleMin).div(scale).mul(this.duration);

    // Where the currently visible segment starts
    const startTime = Fraction(scaleMin).div(scale).mul(this.duration);
    const endTime = startTime.add(visibleDuration);

    // Filter non visible and non-matching entries
    entries = entries
      .filter(entry =>
        entry.endTime >= startTime.valueOf() &&
        entry.startTime <= endTime.valueOf()
      )
      .sort((a, b) => a.startTime < b.startTime ? -1 : 1);

    const renderEvery = Math.floor(entries.length / (this.width * 2)) || 1;

    const widthRatio = this.width / visibleDuration;
    const halfHeight = Math.floor(this.height * 0.5);

    const audioScale = 1 / (this.max * 1.2);
    for(let i = 0; i < entries.length; i += renderEvery) {
      const entry = entries[i];
      const entryGroup = entries.slice(i, i + renderEvery);
      const entryAverage = entryGroup.reduce((acc, entry) => acc + entry.max, 0) / entryGroup.length;

      const nextEntryIndex = Math.min(i + renderEvery, entries.length - 1);
      const nextEntry = entries[nextEntryIndex];
      const nextEntryGroup = entries.slice(nextEntryIndex, nextEntryIndex + renderEvery);
      const nextAverage = nextEntryGroup.reduce((acc, entry) => acc + entry.max, 0) / nextEntryGroup.length;

      const startX = Math.floor((entry.startTime - startTime) * widthRatio);
      const endX = Math.floor((nextEntry.startTime - startTime) * widthRatio);

      const startY = Math.floor(halfHeight * entryAverage * audioScale);
      const endY = Math.floor(halfHeight * nextAverage * audioScale);

      Line(imageData, mainColor, startX, halfHeight + startY, endX, halfHeight + endY);
      Line(imageData, mainColor, endX, halfHeight + endY, endX, halfHeight - endY);
      Line(imageData, mainColor, endX, halfHeight - endY, startX, halfHeight - startY);
    }

    postMessage({
      trackId: this.trackId,
      imageData
    });
  }
}

const workers = {};

self.addEventListener(
  "message",
  e => {
    const data = e.data;

    let worker = workers[data.trackId];

    switch(data.operation) {
      case "Initialize":
        workers[data.trackId] = new AudioTrackWorker(data);
        return;

      case "Destroy":
        delete workers[data.trackId];
        return;

      case "SetEntries":
        worker.entries = (data.entries || []).flat();
        break;

      case "SetScale":
        worker.scale = data.scale;
        worker.duration = data.duration;
        break;

      case "SetTime":
        worker.currentTime = data.currentTime;
        break;

      case "SetSelected":
        worker.selectedEntryId = data.selectedEntryId;
        worker.selectedEntryIds = data.selectedEntryIds;
        worker.hoverEntryIds = data.hoverEntryIds;
        break;

      case "SetFilter":
        worker.filter = data.filter;
        break;

      case "SetActive":
        worker.activeEntryIds = data.activeEntryIds;
        break;

      case "Resize":
        if(data.width === worker.width && data.height === worker.height) {
          return;
        }

        worker.width = data.width;
        worker.height = data.height;
        break;

      case "Redraw":
        break;

      case "UpdateTrack":
        worker.track = data.track;
        break;

      default:
        return;
    }

    worker.Draw();
  }
);
