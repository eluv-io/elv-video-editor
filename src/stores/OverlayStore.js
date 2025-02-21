import { flow, makeAutoObservable } from "mobx";

const FormatName = (name) => {
  return (name || "")
    .replace("-", " ")
    .split(/[_, \s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

class OverlayStore {
  overlayEnabled = false;
  enabledOverlayTracks = {};
  trackInfo = {};
  overlayCanvasDimensions = {width: 0, height: 0};

  get visibleOverlayTracks() {
    if(!this.rootStore.trackStore.tracksSelected) {
      return this.enabledOverlayTracks;
    }

    let visibleTracks = {};
    Object.keys(this.enabledOverlayTracks).forEach(key =>
      visibleTracks[key] = this.rootStore.trackStore.activeTracks[key]
    );

    return visibleTracks;
  }

  constructor(rootStore) {
    makeAutoObservable(
      this,
      {
        overlayTrack: false
      }
    );

    this.rootStore = rootStore;
  }

  Reset() {
    this.overlayTrack = undefined;
    this.overlayEnabled = false;
  }

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
          color: this.rootStore.trackStore.TrackColor(trackKey)
        };
      }
    }

    return this.trackInfo[trackKey];
  }

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


      // Determine all tracks with overlay
      let availableOverlayTrackKeys = {};
      Object.values(overlayTags).forEach(overlayTag => {
        Object.keys(overlayTag).forEach(trackKey => availableOverlayTrackKeys[trackKey] = true);
      });

      Object.keys(availableOverlayTrackKeys).forEach(trackKey => {
        this.enabledOverlayTracks[trackKey] = true;

        const metadataTrack = this.rootStore.trackStore.tracks.find(track => track.key === trackKey);

        if(metadataTrack) {
          metadataTrack.hasOverlay = true;
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

  SetOverlayCanvasDimensions(dimensions) {
    this.overlayCanvasDimensions = dimensions;
  }
}

export default OverlayStore;
