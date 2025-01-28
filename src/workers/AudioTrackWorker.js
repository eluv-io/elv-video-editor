import Fraction from "fraction.js";
import {Line} from "./Utils";

const mainColor = {
  r: 50,
  g: 200,
  b: 50,
  a: 255
};

class AudioTrackWorker {
  constructor({trackId, height, width, tags, scale, duration}) {
    this.trackId = trackId;
    this.tags = (tags || []).flat();
    this.scale = scale;
    this.duration = duration;
    this.width = width;
    this.height = height;
    this.max = 1;
  }

  Draw() {
    if(!this.width || !this.height) { return; }

    let tags = Object.values(this.tags).filter(e => e);

    const imageData = new ImageData(this.width, this.height);

    const {scale, scaleMin, scaleMax} = this.scale;

    // How much of the duration of the video is currently visible
    const visibleDuration = Fraction(scaleMax - scaleMin).div(scale).mul(this.duration);

    // Where the currently visible segment starts
    const startTime = Fraction(scaleMin).div(scale).mul(this.duration);
    const endTime = startTime.add(visibleDuration);

    // Filter non visible and non-matching tags
    tags = tags
      .filter(tag =>
        tag.endTime >= startTime.valueOf() &&
        tag.startTime <= endTime.valueOf()
      )
      .sort((a, b) => a.startTime < b.startTime ? -1 : 1);

    const renderEvery = Math.floor(tags.length / (this.width * 2)) || 1;

    const widthRatio = this.width / visibleDuration;
    const halfHeight = Math.floor(this.height * 0.5);

    const audioScale = 1 / (this.max * 1.2);
    for(let i = 0; i < tags.length; i += renderEvery) {
      const tag = tags[i];
      const tagGroup = tags.slice(i, i + renderEvery);
      const tagAverage = tagGroup.reduce((acc, tag) => acc + tag.max, 0) / tagGroup.length;

      const nextTagIndex = Math.min(i + renderEvery, tags.length - 1);
      const nextTag = tags[nextTagIndex];
      const nextTagGroup = tags.slice(nextTagIndex, nextTagIndex + renderEvery);
      const nextAverage = nextTagGroup.reduce((acc, tag) => acc + tag.max, 0) / nextTagGroup.length;

      const startX = Math.floor((tag.startTime - startTime) * widthRatio);
      const endX = Math.floor((nextTag.startTime - startTime) * widthRatio);

      const startY = Math.floor(halfHeight * tagAverage * audioScale);
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

      case "SetTags":
        worker.tags = (data.tags || []).flat();
        break;

      case "SetScale":
        worker.scale = data.scale;
        worker.duration = data.duration;
        break;

      case "SetTime":
        worker.currentTime = data.currentTime;
        break;

      case "SetActive":
        worker.activeTagIds = data.activeTagIds;
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
