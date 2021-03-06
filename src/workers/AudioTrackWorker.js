import Fraction from "fraction.js/fraction";
import {Line} from "./Utils";

const mainColor = {
  r: 50,
  g: 200,
  b: 50,
  a: 255
};

class AudioTrackWorker {
  constructor({trackId, height, width, entries, scale, duration, max}) {
    this.trackId = trackId;
    this.entries = entries;
    this.scale = scale;
    this.duration = duration;
    this.width = width;
    this.height = height;
    this.filter = "";
    this.max = max;

    this.selectedEntryId = undefined;
    this.activeEntryIds = [];
    this.hoverEntryIds = [];
    this.selectedEntryIds = [];
  }

  Draw() {
    if(!this.width || !this.height) { return; }

    let entries = Object.values(this.entries);

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
    for(let i = 0; i < entries.length; i++) {
      if(renderEvery > 1 && i % renderEvery !== 0) {
        continue;
      }

      const entry = entries[i];
      const nextEntryIndex = Math.min(i + renderEvery, entries.length - 1);
      const nextEntry = entries[nextEntryIndex];

      const startX = Math.floor((entry.startTime - startTime) * widthRatio);
      const endX = Math.floor((nextEntry.startTime - startTime) * widthRatio);

      const startY = Math.floor(halfHeight * entry.max * audioScale);
      const endY = Math.floor(halfHeight * nextEntry.max * audioScale);

      Line(imageData, mainColor, startX, halfHeight + startY, endX, halfHeight + endY);
      Line(imageData, mainColor, endX, halfHeight + endY, endX, halfHeight - endY);
      Line(imageData, mainColor, endX, halfHeight - endY, startX, halfHeight - startY);
      Line(imageData, mainColor, startX, halfHeight - startY, startX, halfHeight + startY);
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
        worker.entries = data.entries;
        break;

      case "SetScale":
        worker.scale = data.scale;
        worker.duration = data.duration;
        worker.max = data.max;
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
