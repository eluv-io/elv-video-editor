import {action, computed, observable} from "mobx";

class ClipStore {
  @observable scaleRangeTime = 20 * 60;

  @observable clipBin = [];

  @observable timeline = [];

  @observable heldClip;

  @observable scaleMin = 0;
  @observable scaleMax = 75;

  @observable selectedClipId;

  @computed get selectedClip() {
    if(!this.selectedClipId) { return undefined; }

    return this.clipBin.find(clip => clip.clipBinId === this.selectedClipId) ||
      this.timeline.find(clip => clip.id === this.selectedClipId);
  }

  @computed get scaleStartTime() { return this.scaleRangeTime * this.scaleMin / 100; }
  @computed get scaleEndTime() { return this.scaleRangeTime * this.scaleMax / 100; }
  @computed get scaleStartFrame() { return this.rootStore.videoStore.TimeToFrame(this.scaleStartTime); }
  @computed get scaleEndFrame() { return this.rootStore.videoStore.TimeToFrame(this.scaleEndTime); }

  constructor(rootStore) {
    this.rootStore = rootStore;

    this.clipLabelId = 1;
    this.clipId = 1;
  }

  Reset() {
    this.clipBin = [];
    this.scaleMin = 0;
    this.scaleMax = 75;
    this.scaleRangeTime = 20 * 60;

    this.clipLabelId = 0;
    this.clipId = 0;
  }

  @action.bound
  SelectClip(clipId) {
    this.selectedClipId = clipId;
  }

  @action.bound
  ClearSelectedClip() {
    this.selectedClipId = undefined;
  }

  @action.bound
  SaveClip({start, end}) {
    if(this.clipBin.find(clip => clip.start === start && clip.end === end)) {
      return;
    }

    const id = this.NextClipId();
    this.clipBin = [{start, end, label: this.ClipLabel({start, end}), clipBinId: id}, ...this.clipBin];

    this.SelectClip(id);
  }

  @action.bound
  HoldClip(clip) {
    this.heldClip = clip;
  }

  @action.bound
  ReleaseClip() {
    this.heldClip = undefined;
  }

  @action.bound
  PlaceClip({clip, startPosition}) {
    const clipDuration = clip.end - clip.start;

    clip = {
      ...clip,
      id: clip.id || this.NextClipId(),
      startPosition,
      endPosition: startPosition + clipDuration,
      label: this.ClipLabel(clip)
    };

    delete clip.clipBinId;

    if(startPosition < 0) {
      clip.startPosition = 0;
      clip.endPosition = clipDuration;
    }

    let clipInserted = false;

    let newTimeline = [];

    for(let i = 0; i < this.timeline.length; i++) {
      let otherClip = this.timeline[i];

      // Replace clip in new position
      if(otherClip.id === clip.id) { continue; }

      if(otherClip.startPosition >= startPosition && !clipInserted) {
        newTimeline.push(clip);
        clipInserted = true;
      }

      newTimeline.push(otherClip);
    }

    if(!clipInserted) {
      newTimeline.push(clip);
    }

    for(let i = 1; i < newTimeline.length; i++) {
      const previousClip = newTimeline[i-1];

      if(newTimeline[i].startPosition <= previousClip.endPosition) {
        newTimeline[i].startPosition = previousClip.endPosition + 1;
        newTimeline[i].endPosition = newTimeline[i].startPosition + (newTimeline[i].end - newTimeline[i].start);
      }
    }

    this.timeline = newTimeline;

    const lastClip = this.timeline.slice(-1)[0];
    if(lastClip.endPosition > this.rootStore.videoStore.TimeToFrame(this.scaleRangeTime) * 0.75) {
      this.scaleRangeTime = this.rootStore.videoStore.FrameToTime(lastClip.endPosition * 1.5);
    }

    this.SelectClip(clip.id);
  }

  @action.bound
  UpdateSelectedClipLabel(label) {
    this.selectedClip.label = label;
  }

  @action.bound
  DeleteClip(clipId) {
    this.clipBin = this.clipBin.filter(clip => clip.clipBinId !== clipId);
    this.timeline = this.timeline.filter(clip => clip.id !== clipId);
  }

  @action.bound
  SetScale(min, max) {
    this.scaleMin = Math.max(0, min);
    this.scaleMax = Math.min(100, max);
  }

  @action.bound
  ProgressToSMPTE(seek) {
    return this.rootStore.videoStore.FrameToSMPTE(this.ProgressToFrame(seek));
  }

  @action.bound
  ProgressToFrame(seek) {
    return this.rootStore.videoStore.TimeToFrame(this.scaleRangeTime) * seek / 100;
  }

  NextClipId() {
    this.clipId += 1;

    return this.clipId;
  }

  NextClipLabelId() {
    this.clipLabelId += 1;

    return this.clipLabelId;
  }

  ClipLabel(clip) {
    if(clip.label) { return clip.label; }

    const binClip = this.clipBin.find(otherClip => clip.start === otherClip.start && clip.end === otherClip.end);
    if(binClip && binClip.label) {
      return binClip.label;
    }

    const placedClip = this.timeline.find(otherClip => clip.start === otherClip.start && clip.end === otherClip.end);
    if(placedClip && placedClip.label) {
      return placedClip.label;
    }

    return `Clip ${this.NextClipLabelId()}`;
  }
}

export default ClipStore;
