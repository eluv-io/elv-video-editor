import {configure, observable, action, runInAction} from "mobx";
import EditStore from "./Edit";
import EntryStore from "./Entry";
import KeyboardControlStore from "./KeyboardControls";
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
    this.editStore = new EditStore(this);
    this.entryStore = new EntryStore(this);
    this.keyboardControlStore = new KeyboardControlStore(this);
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
      this.trackStore,
      this.editStore
    ]
      .forEach(store => store.Reset());
  }

  @action
  async InitializeClient() {
    // Contained in IFrame
    const client = new FrameClient({
      target: window.parent,
      timeout: 30
    });

    client.SendMessage({options: {operation: "HideHeader"}, noResponse: true});

    runInAction(() => this.client = client);
    const appPath = window.location.hash
      .replace(/^\/*#?\/*/, "")
      .split("/");

    if(appPath.length >= 1 && appPath[0].startsWith("hq__")){
      // Version Hash

      const versionHash = appPath[0];
      const libraryId = await client.ContentObjectLibraryId({versionHash});
      const { objectId } = client.utils.DecodeVersionHash(versionHash);

      this.menuStore.SetLibraryId(libraryId);
      this.menuStore.SetObjectId(objectId);
      this.menuStore.SelectVideo({libraryId, objectId, versionHash});
      this.menuStore.ToggleMenu(false);
    } else if(appPath.length >= 2 && appPath[0].startsWith("ilib") && appPath[1].startsWith("iq__")) {
      // libraryId + objectId
      const libraryId = appPath[0];
      const objectId = appPath[1];

      this.menuStore.SetLibraryId(libraryId);
      this.menuStore.SetObjectId(objectId);
      this.menuStore.SelectVideo({libraryId, objectId});
      this.menuStore.ToggleMenu(false);
    }
  }
}

const rootStore = new RootStore();

export const root = rootStore;
export const edit = rootStore.editStore;
export const entry = rootStore.entryStore;
export const keyboardControls = rootStore.keyboardControlStore;
export const menu = rootStore.menuStore;
export const overlay = rootStore.overlayStore;
export const tracks = rootStore.trackStore;
export const video = rootStore.videoStore;
