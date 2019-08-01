import {configure, observable, action, runInAction} from "mobx";
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
  @observable client;

  constructor() {
    this.entryStore = new EntryStore(this);
    this.menuStore = new MenuStore(this);
    this.trackStore = new TrackStore(this);
    this.videoStore = new VideoStore(this);

    this.InitializeClient();
  }

  @action
  async InitializeClient() {
    let client;
    // Initialize ElvClient or FrameClient
    if(window.self === window.top) {
      client = await ElvClient.FromConfigurationUrl(Configuration);

      const privateKey = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const wallet = client.GenerateWallet();
      const signer = wallet.AddAccount({privateKey});

      await client.SetSigner({signer});
    } else {
      // Contained in IFrame
      client = new FrameClient({
        target: window.parent,
        timeout: 30
      });
    }

    runInAction(() => this.client = client);
  }
}

const rootStore = new RootStore();

export const root = rootStore;
export const entry = rootStore.entryStore;
export const menu = rootStore.menuStore;
export const tracks = rootStore.trackStore;
export const video = rootStore.videoStore;
