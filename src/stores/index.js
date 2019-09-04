import {configure, observable, action, runInAction} from "mobx";
import KeyboardControlStore from "./KeyboardControls";
import EntryStore from "./Entry";
import MenuStore from "./Menu";
import OverlayStore from "./Overlay";
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
    this.overlayStore = new OverlayStore(this);
    this.trackStore = new TrackStore(this);
    this.videoStore = new VideoStore(this);

    this.InitializeClient();
  }

  Reset() {
    [
      this.videoStore,
      this.entryStore,
      this.overlayStore,
      this.trackStore
    ]
      .forEach(store => store.Reset());
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

      // Pull private key from URL args
      let privateKey;
      let queryParams = window.location.search.split("?")[1];
      if(queryParams) {
        queryParams = queryParams.split("&");

        queryParams.forEach(param => {
          const key = param.split("=")[0];
          if(key === "privateKey") {
            privateKey = param.split("=")[1];
          }
        });
      }

      if(!privateKey) { throw Error("No private key specified"); }

      client = await ElvClient.FromConfigurationUrl({configUrl: EluvioConfiguration["config-url"]});

      const wallet = client.GenerateWallet();
      const signer = wallet.AddAccount({privateKey});

      await client.SetSigner({signer});
    } else {
      // Contained in IFrame
      client = new FrameClient({
        target: window.parent,
        timeout: 30
      });

      client.SendMessage({options: {operation: "HideHeader"}, noResponse: true});
    }

    runInAction(() => this.client = client);
  }
}

const rootStore = new RootStore();

export const root = rootStore;
export const entry = rootStore.entryStore;
export const keyboardControls = rootStore.keyboardControlStore;
export const menu = rootStore.menuStore;
export const overlay = rootStore.overlayStore;
export const tracks = rootStore.trackStore;
export const video = rootStore.videoStore;
