import {observable, action, flow} from "mobx";
import {FormatName} from "elv-components-js";

class OverlayStore {
  @observable trackMap = {};
  @observable overlayEnabled = false;
  @observable enabledOverlayTracks = {};
  @observable trackInfo = {};

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  Reset() {
    this.overlayTrack = undefined;
    this.overlayEnabled = false;
  }

  @action.bound
  TrackInfo(trackKey) {
    if(!this.trackInfo[trackKey]) {
      const track = this.rootStore.trackStore.tracks
        .filter(track => track.trackType === "metadata")
        .find(track => track.key === trackKey);

      if(track) {
        this.trackInfo[trackKey] = {label: track.label, color: track.color};
      } else {
        this.trackInfo[trackKey] = {
          label: FormatName(trackKey),
          color: this.rootStore.trackStore.NextColor()
        };
      }
    }

    return this.trackInfo[trackKey];
  }

  @action.bound
  AddOverlayTracks = flow(function * () {
    try {
      const metadata = this.rootStore.videoStore.metadata;
      if(!metadata.video_tags || !metadata.video_tags.overlay_tags) {
        return;
      }

      let overlayTagChunks = [];
      let overlayTagVersion = 0;
      const tagFiles = Object.keys(metadata.video_tags.overlay_tags);
      for(let i = 0; i < tagFiles.length; i++) {
        const {overlay_tags, version} = yield this.rootStore.client.LinkData({
          versionHash: this.rootStore.videoStore.versionHash,
          linkPath: `video_tags/overlay_tags/${tagFiles[i]}`,
          format: "json"
        });

        overlayTagVersion = version || 0;
        overlayTagChunks.push(overlay_tags.frame_level_tags);
      }

      if(overlayTagChunks.length === 0) {
        return;
      }

      const overlayTags = Object.assign({}, ...overlayTagChunks);
      overlayTags.version = overlayTagVersion;

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
