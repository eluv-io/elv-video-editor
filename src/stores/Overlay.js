import {observable, action} from "mobx";
import Id from "../utils/Id";

class OverlayStore {
  @observable overlayTracks = [];

  constructor(client) {
    this.client = client;
  }

  @action.bound
  AddOverlayTracks(frameTags) {
    if(!frameTags) { return; }
    
    const entries = Object.keys(frameTags).map(frame => {
      const frameInfo = frameTags[frame];

      if(!frameInfo) { return; }

      return Object.keys(frameInfo.object_detection).map(label => ({
        entryId: Id.next(),
        entryType: "overlay",
        label: "Overlay Test",
        text: label,
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
