import { configure, runInAction, makeAutoObservable } from "mobx";
import EditStore from "./EditStore";
import EntryStore from "./EntryStore";
import KeyboardControlStore from "./KeyboardControlsStore";
import BrowserStore from "./BrowserStore";
import OverlayStore from "./OverlayStore";
import TrackStore from "./TrackStore";
import VideoStore from "./VideoStore";
import ClipStore from "./ClipStore";

import {FrameClient} from "@eluvio/elv-client-js/src/FrameClient";

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

class RootStore {
  client;

  view = "source";

  constructor() {
    makeAutoObservable(this);

    this.editStore = new EditStore(this);
    this.entryStore = new EntryStore(this);
    this.keyboardControlStore = new KeyboardControlStore(this);
    this.browserStore = new BrowserStore(this);
    this.overlayStore = new OverlayStore(this);
    this.trackStore = new TrackStore(this);
    this.videoStore = new VideoStore(this);
    this.clipVideoStore = new VideoStore(this);
    this.clipStore = new ClipStore(this);

    this.InitializeClient();

    window.rootStore = this;
  }

  Reset() {
    [
      this.videoStore,
      this.clipVideoStore,
      this.entryStore,
      this.overlayStore,
      this.trackStore,
      this.editStore,
      this.clipStore
    ]
      .forEach(store => store.Reset());
  }

  SetView(view) {
    this.view = view;
  }

  async InitializeClient() {
    // Contained in IFrame
    const client = new FrameClient({
      target: window.parent,
      timeout: 30
    });

    runInAction(() => this.client = client);
    const appPath = window.location.hash
      .replace(/^\/*#?\/*/, "")
      .split("/");

    if(appPath.length >= 1 && appPath[0].startsWith("hq__")){
      // Version Hash

      const versionHash = appPath[0];
      const libraryId = await client.ContentObjectLibraryId({versionHash});
      const { objectId } = client.utils.DecodeVersionHash(versionHash);

      this.browserStore.SetLibraryId(libraryId);
      this.browserStore.SetObjectId(objectId);
      this.browserStore.SelectVideo({libraryId, objectId, versionHash});
    } else if(appPath.length >= 2 && appPath[0].startsWith("ilib") && appPath[1].startsWith("iq__")) {
      // libraryId + objectId
      const libraryId = appPath[0];
      const objectId = appPath[1];

      this.browserStore.SetLibraryId(libraryId);
      this.browserStore.SetObjectId(objectId);
      this.browserStore.SelectVideo({libraryId, objectId});
    }
  }
}

const root = new RootStore();

export const rootStore = root;
export const editStore = rootStore.editStore;
export const entryStore = rootStore.entryStore;
export const keyboardControlsStore = rootStore.keyboardControlStore;
export const browserStore = rootStore.browserStore;
export const overlayStore = rootStore.overlayStore;
export const tracksStore = rootStore.trackStore;
export const videoStore = rootStore.videoStore;
export const clipVideoStore = rootStore.clipVideoStore;
export const clipStore = rootStore.clipStore;
