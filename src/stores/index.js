import { configure } from "mobx";
import EntryStore from "./Entry";
import MenuStore from "./Menu";
import TrackStore from "./Tracks";
import VideoStore from "./Video";

import {FrameClient} from "elv-client-js/src/FrameClient";
import {ElvClient} from "elv-client-js/src/ElvClient";
import Configuration from "../../configuration";

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

class RootStore {
  constructor() {
    // Initialize ElvClient or FrameClient
    if(window.self === window.top) {
      const privateKey = "0x0000000000000000000000000000000000000000000000000000000000000000";
      this.client = ElvClient.FromConfiguration({configuration: Configuration});
      this.client.SetSigner({signer: this.client.GenerateWallet().AddAccount({privateKey})});
    } else {
      // Contained in IFrame
      this.client = new FrameClient({
        target: window.parent,
        timeout: 30
      });
    }

    this.entryStore = new EntryStore(this);
    this.menuStore = new MenuStore(this);
    this.trackStore = new TrackStore(this);
    this.videoStore = new VideoStore(this);
  }
}

const rootStore = new RootStore();

export const entry = rootStore.entryStore;
export const menu = rootStore.menuStore;
export const tracks = rootStore.trackStore;
export const video = rootStore.videoStore;
