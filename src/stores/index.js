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
import UrlJoin from "url-join";

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

class RootStore {
  @observable client;

  @observable view = "main";
  @observable selectedAsset = "";

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

    this.UpdateCoreRoute();
  }

  @action
  SetSelectedAsset(asset) {
    this.selectedAsset = asset;

    this.UpdateCoreRoute();
  }

  @action
  UpdateCoreRoute() {
    if(window.self === window.top) { return; }

    let path = "/";
    if(this.videoStore.videoObject && window.self !== window.top) {
      path = UrlJoin(
        "#",
        this.videoStore.videoObject.libraryId,
        this.videoStore.videoObject.objectId,
        this.view === "assets" ? "assets" : "",
        this.view === "assets" ? this.selectedAsset || "" : ""
      );
    }

    window.location.hash = path;

    this.client.SendMessage({
      options: {
        operation: "SetFramePath",
        path
      },
      noResponse: true
    });
  }

  @action
  async InitializeClient() {
    // Contained in IFrame
    const client = new FrameClient({
      target: window.parent,
      timeout: 30
    });

    runInAction(() => this.client = client);
    const appPath = window.location.hash
      .split("?")[0]
      .replace(/^\/*#?\/*/, "")
      .split("/");
    const params = new URLSearchParams(
      `?${window.location.hash.split("?")[1]}`
    );

    if(appPath.length >= 1 && appPath[0].startsWith("hq__")){
      // Version Hash

      const versionHash = appPath[0];
      const libraryId = await client.ContentObjectLibraryId({versionHash});
      const { objectId } = client.utils.DecodeVersionHash(versionHash);

      this.menuStore.SetLibraryId(libraryId);
      this.menuStore.SetObjectId(objectId);
      this.menuStore.ToggleMenu(false);
      this.menuStore.SelectVideo({libraryId, objectId, versionHash});
    } else if(appPath.length >= 2 && appPath[0].startsWith("ilib") && appPath[1].startsWith("iq__")) {
      // libraryId + objectId
      const libraryId = appPath[0];
      const objectId = appPath[1];
      this.view = appPath[2] || "main";
      this.selectedAsset = appPath[2] === "assets" && appPath[3];

      this.menuStore.SetLibraryId(libraryId);
      this.menuStore.SetObjectId(objectId);
      this.menuStore.ToggleMenu(false);
      this.menuStore.SelectVideo({libraryId, objectId});
    }

    if(params.has("st") || params.has("et")) {
      const start = Date.now();
      const interval = setInterval(() => {
        if(Date.now() - start > 15000) {
          clearInterval(interval);
        }

        if(!videoStore.initialized) { return; }

        try {
          videoStore.SetClipMark({
            inTime: params.get("st"),
            outTime: params.get("et")
          });

          videoStore.Seek(videoStore.TimeToFrame(parseFloat(params.get("st"))));
        } catch(error) {
          // eslint-disable-next-line no-console
          console.log("Clip parameters failed:");
          // eslint-disable-next-line no-console
          console.log(error);
        } finally {
          clearInterval(interval);
        }
      }, 500);

    }
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
