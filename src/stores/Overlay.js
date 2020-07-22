import {observable, action, flow} from "mobx";

class OverlayStore {
  @observable trackMap = {};
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
    try {
      const metadata = this.rootStore.videoStore.metadata;
      if(!metadata.video_tags || !metadata.video_tags.overlay_tags) {
        return;
      }

      let overlayTagChunks = [];
      const tagFiles = Object.keys(metadata.video_tags.overlay_tags);
      for(let i = 0; i < tagFiles.length; i++) {
        const {overlay_tags} = yield this.rootStore.client.LinkData({
          versionHash: this.rootStore.videoStore.versionHash,
          linkPath: `video_tags/overlay_tags/${tagFiles[i]}`,
          format: "json"
        });

        overlayTagChunks.push(overlay_tags.frame_level_tags);
      }

      if(overlayTagChunks.length === 0) {
        return;
      }

      const overlayTags = Object.assign({}, ...overlayTagChunks);

      Object.keys(Object.values(overlayTags)[0]).forEach(trackKey => {
        this.enabledOverlayTracks[trackKey] = true;

        const metadataTrack = this.rootStore.trackStore.tracks.find(track => track.key === trackKey);

        if(metadataTrack) {
          metadataTrack.hasOverlay = true;
          this.trackMap[trackKey] = metadataTrack.trackId;
        }
      });

      // Overlay track is not observable for memory purposes
      this.overlayTrack = overlayTags;
      this.overlayEnabled = true;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load overlay tracks:");
      // eslint-disable-next-line no-console
      console.error(error);
    }
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
