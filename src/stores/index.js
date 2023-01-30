import {configure, observable, action, runInAction} from "mobx";
import EditStore from "./Edit";
import EntryStore from "./Entry";
import KeyboardControlStore from "./KeyboardControls";
import MenuStore from "./Menu";
import OverlayStore from "./Overlay";
import TrackStore from "./Tracks";
import VideoStore from "./Video";

import {FrameClient} from "@eluvio/elv-client-js/src/FrameClient";
import ClipStore from "./Clip";

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

class RootStore {
  @observable client;
  @observable view = "main";
  @observable offerings;
  @observable selectedOffering;

  constructor() {
    this.editStore = new EditStore(this);
    this.entryStore = new EntryStore(this);
    this.keyboardControlStore = new KeyboardControlStore(this);
    this.menuStore = new MenuStore(this);
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

  @action
  SetView(view) {
    this.view = view;
  }

  @action
  async InitializeClient() {
    try {
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
    } finally {
      this.SetOfferings();
    }
  }

  @action
  async SetOfferings() {
    const offerings = await this.client.ContentObjectMetadata({
      libraryId: this.menuStore.libraryId,
      objectId: this.menuStore.objectId,
      metadataSubtree: "offerings",
      select: [
        "/*/playout/playout_formats"
      ]
    }) || {};

    Object.keys(offerings).forEach(offeringName => {
      const playoutFormats = offerings[offeringName].playout.playout_formats || {};
      const isHlsClear = Object.values(playoutFormats).some(playoutFormat => playoutFormat.drm === null && playoutFormat.protocol.type === "ProtoHls");

      offerings[offeringName].isHlsClear = isHlsClear;
    });

    runInAction(() => this.offerings = offerings);

    const firstHlsClearOffering = Object.keys(offerings).sort().find(offeringName => offerings[offeringName].isHlsClear);

    // Set initial offering
    this.SetOffering(firstHlsClearOffering);
  }

  @action
  SetOffering(offering) {
    if(!Object.keys(this.offerings || {}).includes(offering)) {
      throw Error(`Invalid offering ${offering}`);
    }

    this.selectedOffering = offering;
  }
}

const root = new RootStore();

export const rootStore = root;
export const editStore = rootStore.editStore;
export const entryStore = rootStore.entryStore;
export const keyboardControlsStore = rootStore.keyboardControlStore;
export const menuStore = rootStore.menuStore;
export const overlayStore = rootStore.overlayStore;
export const tracksStore = rootStore.trackStore;
export const videoStore = rootStore.videoStore;
export const clipVideoStore = rootStore.clipVideoStore;
export const clipStore = rootStore.clipStore;
