import {action, computed, observable} from "mobx";

class ClipStore {
  @observable scaleRangeTime = 20 * 60;

  @observable scaleMin = 0;
  @observable scaleMax = 75;

  @computed get scaleStartTime() { return this.scaleRangeTime * this.scaleMin / 100; }
  @computed get scaleEndTime() { return this.scaleRangeTime * this.scaleMax / 100; }
  @computed get scaleStartFrame() { return this.rootStore.videoStore.TimeToFrame(this.scaleStartTime); }
  @computed get scaleEndFrame() { return this.rootStore.videoStore.TimeToFrame(this.scaleEndTime); }

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  SetScale(min, seek, max) {
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
}

export default ClipStore;
