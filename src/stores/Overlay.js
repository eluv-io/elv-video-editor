import {observable, action, flow} from "mobx";

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
  AddOverlayTracks = flow(function * () {
    const metadata = this.rootStore.videoStore.metadata;
    if(!metadata.video_tags || !metadata.video_tags.overlay_tags) {
      return;
    }

    let overlayTags = {};
    for(let i = 0; i < Object.keys(metadata.video_tags.overlay_tags).length; i++) {
      const {overlay_tags} = yield this.rootStore.client.LinkData({
        versionHash: this.rootStore.videoStore.versionHash,
        linkPath: `video_tags/overlay_tags/${i}`,
        format: "json"
      });

      overlayTags = {...overlayTags, ...overlay_tags.frame_level_tags};
    }

    if(!overlayTags || Object.keys(overlayTags).length === 0) { return; }

    this.overlayTrack = overlayTags;
    this.overlayEnabled = true;

    Object.keys(Object.values(this.overlayTrack)[0]).forEach(trackKey => {
      this.enabledOverlayTracks[trackKey] = true;

      const metadataTrack = this.rootStore.trackStore.tracks.find(track => track.key === trackKey);

      if(metadataTrack) {
        metadataTrack.hasOverlay = true;
        this.trackMap[trackKey] = metadataTrack.trackId;
      }
    });
  });

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
