import { flow, makeAutoObservable } from "mobx";

class OverlayStore {
  overlayEnabled = true;
  overlayTags = {};
  overlayCanvasDimensions = {width: 0, height: 0};

  constructor(rootStore) {
    makeAutoObservable(
      this,
      {
        overlayTags: false
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
    this.overlayTags = {};
    this.overlayEnabled = false;
  }

  AddTag({frame, trackKey, tag}) {
    if(!this.overlayTags[frame.toString()]) {
      this.overlayTags[frame.toString()] = {
        // timestamp sec is actually ms??
        timestamp_sec: Math.floor(this.rootStore.videoStore.FrameToTime(frame) * 1000)
      };
    }

    if(!this.overlayTags[frame.toString()][trackKey]) {
      this.overlayTags[frame.toString()][trackKey] = { tags: [] };
    }

    this.overlayTags[frame.toString()][trackKey].tags = [
      ...(this.overlayTags[frame.toString()][trackKey].tags || []),
      tag
    ];
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

      this.overlayEnabled = true;

      let trackIdMap = {};
      this.rootStore.trackStore.tracks.forEach(track =>
        trackIdMap[track.key] = track.trackId
      );

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

            overlayTags[frame][trackKey].tags = (overlayTags[frame][trackKey]?.tags || [])
              .map((tag, tagIndex) => ({
                ...tag,
                tagId: this.rootStore.NextId(),
                frame: parseInt(frame),
                trackId: trackIdMap[trackKey],
                o: {
                  f: frame,
                  tk: trackKey,
                  i: tagIndex,
                  lk: tagFileLinks[i]
                }
              }));
          })
        );

        this.overlayTags = {
          ...this.overlayTags,
          ...overlayTags,
          version: tagInfo.version || this.overlayTags.version || 0,
        };
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
