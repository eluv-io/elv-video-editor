import {observable, action} from "mobx";
import Id from "../utils/Id";

class OverlayStore {
  @observable overlayTracks = [];
  @observable overlayEnabled = false;

  constructor(client) {
    this.client = client;
  }

  Reset() {
    this.overlayTracks = [];
  }

  @action.bound
  AddOverlayTracks(frameTags) {
    if(!frameTags) { return; }

    let entries = {};

    Object.keys(frameTags).forEach(frame => {
      const frameInfo = frameTags[frame].object_detection;

      if(!frameInfo || Object.keys(frameInfo).length === 0) { return; }

      entries[frame] = Object.keys(frameInfo).map(label => {
        return frameInfo[label].map(instance =>
          ({
            entryId: Id.next(),
            entryType: "overlay",
            label: "Object Detection",
            text: label,
            ...instance
          })
        );
      })
        .flat()
        .filter(entry => entry.confidence > 0.6);
    });

    if(Object.keys(entries).length > 0) {
      this.overlayTracks.push({
        label: "Object Detection",
        entries
      });
    }

    this.overlayEnabled = true;
  }

  @action.bound
  ToggleOverlay(enabled) {
    this.overlayEnabled = enabled;
  }
}

export default OverlayStore;
