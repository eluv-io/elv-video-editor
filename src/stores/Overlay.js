import {observable, action} from "mobx";

class OverlayStore {
  @observable trackMap = {};
  @observable overlayTrack;
  @observable overlayEnabled = false;
  @observable enabledOverlayTracks = {};

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  Reset() {
    this.overlayTrack = undefined;
    this.overlayEnabled = false;
  }

  @action.bound
  AddOverlayTracks() {
    let overlayTags = this.rootStore.videoStore.tags.overlay_tags;

    if(!overlayTags) { return; }

    this.overlayTrack = overlayTags.frame_level_tags;
    this.overlayEnabled = true;

    Object.keys(Object.values(this.overlayTrack)[0]).forEach(trackKey => {
      this. enabledOverlayTracks[trackKey] = true;

      const metadataTrack = this.rootStore.trackStore.tracks.find(track => track.key === trackKey);

      if(metadataTrack) {
        metadataTrack.hasOverlay = true;
        this.trackMap[trackKey] = metadataTrack.trackId;
      }
    });
  }

  @action.bound
  ToggleOverlay(enabled) {
    this.overlayEnabled = enabled;
  }

  @action.bound
  ToggleOverlayTrack(trackKey, enabled) {
    this. enabledOverlayTracks[trackKey] = enabled;
  }
}

export default OverlayStore;
