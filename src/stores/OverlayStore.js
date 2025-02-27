import { flow, makeAutoObservable } from "mobx";
import Id from "@/utils/Id.js";

class OverlayStore {
  overlayEnabled = false;
  enabledOverlayTracks = {};
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

  TagsAtFrame(frame) {
    const overlayInfo = this.overlayTags?.[frame?.toString()];

    let tags = [];
    if(overlayInfo) {
      Object.keys(overlayInfo).forEach(key =>
        tags.push(overlayInfo[key]?.tags || [])
      );
    }

    return tags.flat();
  }

  Reset() {
    this.overlayTags = undefined;
    this.overlayEnabled = false;
  }

  AddTag({frame, tag}) {

  }

  ModifyTag({frame, modifiedTag}) {
    const trackKey = this.rootStore.trackStore.Track(modifiedTag.trackId)?.key;

    if(!trackKey) { return; }

    this.overlayTags[frame.toString()][trackKey].tags = this.overlayTags[frame.toString()][trackKey].tags
      .map(tag =>
        tag.tagId === modifiedTag.tagId ?
          { ...modifiedTag } :
          tag
      );
  }

  DeleteTag({frame, tagId}) {
    Object.keys(this.overlayTags[frame?.toString()]).forEach(trackKey => {
      if(this.overlayTags[frame.toString()][trackKey]?.tags) {
        this.overlayTags[frame.toString()][trackKey].tags = this.overlayTags[frame.toString()][trackKey].tags
          .filter(tag => tag.tagId !== tagId);
      }
    });
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

      let trackIdMap = {};
      this.rootStore.trackStore.tracks.forEach(track =>
        trackIdMap[track.key] = track.trackId
      );

      // Determine all tracks with overlay
      let availableOverlayTrackKeys = {};
      Object.keys(overlayTags).forEach(frame =>
        Object.keys(overlayTags[frame]).forEach(trackKey => {
          availableOverlayTrackKeys[trackKey] = true;

          if(typeof overlayTags[frame][trackKey] !== "object") {
            return;
          }

          overlayTags[frame][trackKey].tags = (overlayTags[frame][trackKey]?.tags || [])
            .map((tag, tagIndex) => ({
              ...tag,
              tagId: Id.next(),
              frame,
              trackId: trackIdMap[trackKey],
              o: {
                f: frame,
                tk: trackKey,
                i: tagIndex
              }
            }));
        })
      );

      Object.keys(availableOverlayTrackKeys).forEach(trackKey => {
        this.enabledOverlayTracks[trackKey] = true;

        const metadataTrack = this.rootStore.trackStore.tracks.find(track => track.key === trackKey);

        if(metadataTrack) {
          metadataTrack.hasOverlay = true;
        }
      });

      // Overlay track is not observable for memory purposes
      this.overlayTags = overlayTags;
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
