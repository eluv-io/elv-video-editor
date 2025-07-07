import { flow, makeAutoObservable } from "mobx";
import {Capitalize} from "@/utils/Utils.js";

class OverlayStore {
  metadataOverlayTags = {};
  clipOverlayTags = {};
  overlayEnabled = false;
  overlayCanvasDimensions = {width: 0, height: 0};

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  get tagField() {
    return this.rootStore.page === "clips" ?
      "clipOverlayTags" : "metadataOverlayTags";
  }

  get overlayTags() {
    return this[this.tagField];
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
    this.metadataOverlayTags = {};
    this.clipOverlayTags = {};
  }

  AddTag({frame, trackKey, tag}) {
    frame = frame.toString();

    if(!this[this.tagField][frame]) {
      this[this.tagField][frame] = {
        // timestamp sec is actually ms??
        timestamp_sec: Math.floor(this.rootStore.videoStore.FrameToTime(frame) * 1000)
      };
    }

    if(!this[this.tagField][frame][trackKey]) {
      this[this.tagField][frame][trackKey] = { tags: [] };
    }

    this[this.tagField][frame][trackKey].tags = [
      ...(this[this.tagField][frame][trackKey].tags || []),
      tag
    ];
  }

  ModifyTag({frame, modifiedTag}) {
    const trackKey = this.rootStore.trackStore.Track(modifiedTag.trackId)?.key;
    frame = frame.toString();

    if(!trackKey) { return; }

    this[this.tagField][frame][trackKey].tags = this[this.tagField][frame][trackKey].tags
      .map(tag =>
        tag.tagId === modifiedTag.tagId ?
          { ...modifiedTag } :
          tag
      );
  }

  DeleteTag({frame, tagId}) {
    frame = frame.toString();
    Object.keys(this[this.tagField][frame?.toString()]).forEach(trackKey => {
      if(this[this.tagField][frame][trackKey]?.tags) {
        this[this.tagField][frame][trackKey].tags = this[this.tagField][frame][trackKey].tags
          .filter(tag => tag.tagId !== tagId);
      }
    });
  }

  AddOverlayTracks = flow(function * () {
    try {
      const metadata = this.rootStore.videoStore.metadata;

      let trackIdMap = {};
      this.rootStore.trackStore.tracks.forEach(track =>
        trackIdMap[track.key] = track.trackId
      );

      // Load clip overlay tags from metadata
      if(metadata.clips?.overlay_tags) {
        let overlayTags = metadata.clips.overlay_tags?.frame_level_tags || {};
        Object.keys(overlayTags).forEach(frame =>
          Object.keys(overlayTags[frame]).forEach(trackKey => {
            if(typeof overlayTags[frame][trackKey] !== "object") {
              return;
            }

            if(!trackIdMap[trackKey]) {
              trackIdMap[trackKey] = this.rootStore.trackStore.AddTrack({
                key: trackKey,
                label: trackKey.split("_").map(Capitalize).join(" "),
                type: "clip",
                tags: []
              });
            }

            overlayTags[frame][trackKey].tags = (overlayTags[frame][trackKey]?.tags || [])
              .map((tag, tagIndex) => ({
                ...tag,
                tagId: tag.id || this.rootStore.NextId(true),
                frame: parseInt(frame),
                trackId: trackIdMap[trackKey],
                o: {
                  tk: trackKey,
                  ti: tagIndex,
                  lk: "clips"
                }
              }));
          })
        );

        this.clipOverlayTags = overlayTags;
      }

      if(!metadata.video_tags || !metadata.video_tags.overlay_tags) {
        this.overlayEnabled = true;
        return;
      }

      const tagFileLinks = Object.keys(metadata.video_tags.overlay_tags);
      for(let i = 0; i < tagFileLinks.length; i++) {
        const tagInfo = yield this.rootStore.client.LinkData({
          versionHash: this.rootStore.videoStore.versionHash,
          linkPath: `video_tags/overlay_tags/${tagFileLinks[i]}`,
          format: "json"
        });

        let overlayTags = tagInfo.overlay_tags?.frame_level_tags || {};
        Object.keys(overlayTags).forEach(frame =>
          Object.keys(overlayTags[frame]).forEach(trackKey => {
            if(typeof overlayTags[frame][trackKey] !== "object") {
              return;
            }

            if(!trackIdMap[trackKey]) {
              trackIdMap[trackKey] = this.rootStore.trackStore.AddTrack({
                key: trackKey,
                label: trackKey.split("_").map(Capitalize).join(" "),
                type: "metadata",
                tags: []
              });
            }

            overlayTags[frame][trackKey].tags = (overlayTags[frame][trackKey]?.tags || [])
              .map((tag, tagIndex) => ({
                ...tag,
                tagId: tag.id || this.rootStore.NextId(),
                frame: parseInt(frame),
                trackId: trackIdMap[trackKey],
                o: {
                  tk: trackKey,
                  ti: tagIndex,
                  lk: tagFileLinks[i]
                }
              }));
          })
        );

        this.metadataOverlayTags = {
          ...this.metadataOverlayTags,
          ...overlayTags,
          version: tagInfo.version || this.metadataOverlayTags?.version || 0,
        };

        this.overlayEnabled = true;
      }
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
