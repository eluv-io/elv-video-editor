import {configure, observable, action, runInAction} from "mobx";
import KeyboardControlStore from "./KeyboardControls";
import EntryStore from "./Entry";
import MenuStore from "./Menu";
import TrackStore from "./Tracks";
import VideoStore from "./Video";

import {FrameClient} from "elv-client-js/src/FrameClient";

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

class RootStore {
  @observable client;

  constructor() {
    this.keyboardControlStore = new KeyboardControlStore(this);
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
      const ElvClient = (await import(
        /* webpackChunkName: "elv-client-js" */
        /* webpackMode: "lazy" */
        "elv-client-js"
      )).ElvClient;

      client = await ElvClient.FromConfigurationUrl({configUrl: EluvioConfiguration["config-url"]});

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
export const keyboardControls = rootStore.keyboardControlStore;
export const menu = rootStore.menuStore;
export const tracks = rootStore.trackStore;
export const video = rootStore.videoStore;
