import Fraction from "fraction.js/fraction";
import {FilledRect, Rect} from "./Utils";

const selectedColor = {
  r: 25,
  g: 200,
  b: 255,
  a: 150,
  priority: true
};

const activeColor = {
  r: 50,
  g: 255,
  b: 0,
  a: 150,
  priority: true
};

class TrackWorker {
  constructor({trackId, color, height, width, entries, scale, duration}) {
    this.trackId = trackId;
    this.color = color;
    this.entries = entries;
    this.scale = scale;
    this.duration = duration;
    this.width = width;
    this.height = height;
    this.filter = "";

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
    const formatString = string => (string || "").toString().toLowerCase();
    const filter = formatString(this.filter);
    entries = entries.filter(entry =>
      entry.endTime >= startTime.valueOf() &&
      entry.startTime <= endTime.valueOf() &&
      (!filter || formatString(entry.text).includes(filter))
    );

    const widthRatio = this.width / visibleDuration;
    const halfHeight = Math.floor(this.height * 0.5);
    const startY = Math.floor(this.height * 0.25);

    entries.map(entry => {
      const startPixel = Math.floor((entry.startTime - startTime) * widthRatio);
      const endPixel = Math.floor((entry.endTime - startTime) * widthRatio);

      let color = this.color;
      if(this.selectedEntryId === entry.entryId) {
        // Currently shown entry
        //context.fillStyle = color;
        color = selectedColor;
      } else if(this.selectedEntryIds.includes(entry.entryId)) {
        // Selected item - highlight fill

        color = selectedColor;
      } else if(this.hoverEntryIds.includes(entry.entryId)) {
        // Hover item - fill

        //context.fillStyle = color;
        color = selectedColor;
      } else if(this.activeEntryIds.includes(entry.entryId)) {
        // Active item - highlight fill

        color = activeColor;
      }

      FilledRect(
        imageData,
        color,
        startPixel,
        startY,
        endPixel - startPixel,
        halfHeight,
      );

      Rect(
        imageData,
        {r: 0, g: 0, b: 0, a: 0, priority: true},
        startPixel,
        startY,
        endPixel - startPixel,
        halfHeight,
      );
    });

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
        workers[data.trackId] = new TrackWorker(data);
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
