import {observable, action} from "mobx";

class OverlayStore {
  @observable overlayTrack;
  @observable overlayEnabled = false;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  Reset() {
    this.overlayTrack = undefined;
    this.overlayEnabled = false;
  }

  @action.bound
  AddOverlayTracks() {
    let overlayTags = this.rootStore.videoStore.metadata.overlay_tags;

    if(!overlayTags) { return; }

    this.overlayTrack = overlayTags.frame_level_tags;
    this.overlayEnabled = true;
  }

  @action.bound
  ToggleOverlay(enabled) {
    this.overlayEnabled = enabled;
  }
}

export default OverlayStore;
