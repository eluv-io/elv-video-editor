import {observable, action} from "mobx";
import FrameTags from "../static/tags-frame";
import Id from "../utils/Id";

class OverlayStore {
  @observable overlayTracks = [];

  constructor(client) {
    this.client = client;
  }

  @action.bound
  AddOverlayTracks() {
    const overlayData = FrameTags["elv_media_platform_video_tags"].frame_level_tags;

    const entries = Object.keys(overlayData).map(frame => {
      const frameInfo = overlayData[frame];

      if(!frameInfo) { return; }

      return Object.keys(frameInfo.object_detection).map(label => ({
        entryId: Id.next(),
        entryType: "overlay",
        label,
        ...frameInfo.object_detection[label][0]
      }));
    })
      .filter(entry => entry);

    this.overlayTracks.push({
      label: "Overlay Test",
      entries
    });
  }
}

export default OverlayStore;
