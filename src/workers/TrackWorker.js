import Fraction from "fraction.js";
import {FilledRect} from "./Utils";

const selectedColor = {
  r: 25,
  g: 200,
  b: 255,
  a: 150
};

const activeColor = {
  r: 50,
  g: 255,
  b: 0,
  a: 150
};

const editingColor = {
  ...activeColor,
  a: 255
};

const isolatedColor = {
  r: 206,
  g: 188,
  b: 12,
  a: 255
};

class TrackWorker {
  constructor({trackId, trackLabel, color, height, width, tags, scale, duration, noActive, isolatedTag}) {
    this.trackId = trackId;
    this.trackLabel = trackLabel;
    this.color = color;
    this.tags = tags;
    this.scale = scale;
    this.duration = duration;
    this.width = width;
    this.height = height;
    this.filter = "";
    this.noActive = noActive;

    this.selectedTagId = undefined;
    this.activeTagIds = [];
    this.hoverTagIds = [];
    this.selectedTagIds = [];

    this.isolatedTag = isolatedTag;

    this.editedTag = undefined;
  }

  Draw() {
    if(!this.width || !this.height) { return; }

    let tags = Object.values(this.tags);

    const imageData = new ImageData(this.width, this.height);

    const {scale, scaleMin, scaleMax} = this.scale;

    // How much of the duration of the video is currently visible
    const visibleDuration = Fraction(scaleMax - scaleMin).div(scale).mul(this.duration);

    // Where the currently visible segment starts
    let startTime = Fraction(scaleMin).div(scale).mul(this.duration);
    let endTime = startTime.add(visibleDuration);

    // Filter non visible and non-matching tags
    const formatString = string => (string || "").toString().toLowerCase();
    const filter = formatString(this.filter);

    tags = tags.filter(tag =>
      tag.endTime >= startTime.valueOf() &&
      tag.startTime <= endTime.valueOf() &&
      (!this.isolatedTag || tag.endTime > this.isolatedTag.startTime) &&
      (!this.isolatedTag || tag.startTime < this.isolatedTag.endTime) &&
      (!filter || formatString(tag.text).includes(filter)) &&
      (!this.editedTag || tag.tagId !== this.editedTag.tagId)
    );

    if(this.editedTag) {
      tags.push(this.editedTag);
    }

    const widthRatio = this.width / visibleDuration;
    const tagHeight = Math.ceil(this.height * 1);
    const startY = Math.ceil((this.height - tagHeight) / 2) - 2;

    tags.map(tag => {
      const startPixel = Math.floor((tag.startTime - startTime) * widthRatio);
      const endPixel = Math.floor((tag.endTime - startTime) * widthRatio);

      let color = this.color;
      if(this.isolatedTag?.tagId === tag.tagId) {
        color = isolatedColor;
      } else if(this.editedTag?.tagId === tag.tagId) {
        color = editingColor;
      } else if(this.selectedTagId === tag.tagId) {
        // Currently shown tag
        //context.fillStyle = color;
        color = selectedColor;
      } else if(this.selectedTagIds.includes(tag.tagId)) {
        // Selected item - highlight fill

        color = selectedColor;
      } else if(this.hoverTagIds.includes(tag.tagId)) {
        // Hover item - fill

        //context.fillStyle = color;
        color = selectedColor;
      } else if(!this.noActive && this.activeTagIds.includes(tag.tagId)) {
        // Active item - highlight fill

        color = activeColor;
      }

      FilledRect({
        imageData,
        color,
        borderColor: {...color, a: color.a + 10},
        x: startPixel,
        y: startY,
        width: endPixel - startPixel,
        height: tagHeight,
      });
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
        delete workers[data.trackId];
        workers[data.trackId] = new TrackWorker(data);
        return;

      case "Destroy":
        delete workers[data.trackId];
        return;

      case "SetTags":
        worker.tags = data.tags;
        break;

      case "SetScale":
        worker.scale = data.scale;
        worker.duration = data.duration;
        break;

      case "SetTime":
        worker.currentTime = data.currentTime;
        break;

      case "SetSelected":
        worker.selectedTagId = data.selectedTagId;
        worker.selectedTagIds = data.selectedTagIds;
        worker.hoverTagIds = data.hoverTagIds;
        break;

      case "SetFilter":
        worker.filter = data.filter;
        break;

      case "SetIsolatedTag":
        worker.isolatedTag = data.isolatedTag;
        break;

      case "SetActive":
        worker.activeTagIds = data.activeTagIds;
        break;

      case "SetColor":
        worker.color = data.color;
        break;

      case "SetEditedTag":
        worker.editedTag = data.editedTag;
        break;

      case "ClearEditedTag":
        worker.editedTag = undefined;
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
