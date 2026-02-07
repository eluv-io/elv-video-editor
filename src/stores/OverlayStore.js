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

    tag.start_time = this.rootStore.videoStore.FrameToTime(frame);
    tag.end_time = this.rootStore.videoStore.FrameToTime(frame);
    tag.trackKey = trackKey;
    tag.trackId = this.rootStore.trackStore.Track(trackKey)?.trackId;

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

    modifiedTag.start_time = this.rootStore.videoStore.FrameToTime(frame);
    modifiedTag.end_time = this.rootStore.videoStore.FrameToTime(frame);

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

  // eslint-disable-next-line require-yield
  AddOverlayTracks = flow(function * (overlayTags) {
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

      if(overlayTags) {
        this.metadataOverlayTags = overlayTags;
      }

      this.overlayEnabled = true;
    } catch(error) {
      console.error("Failed to load overlay tracks:");
      console.error(error);
    }
  });

  SetOverlayCanvasDimensions(dimensions) {
    this.overlayCanvasDimensions = dimensions;
  }
}

export default OverlayStore;
