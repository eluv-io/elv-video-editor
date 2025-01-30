import { configure, runInAction, makeAutoObservable } from "mobx";
import EditStore from "./EditStore";
import TagStore from "./TagStore.js";
import KeyboardControlStore from "./KeyboardControlsStore";
import BrowserStore from "./BrowserStore";
import OverlayStore from "./OverlayStore";
import TrackStore from "./TrackStore";
import VideoStore from "./VideoStore";

import {FrameClient} from "@eluvio/elv-client-js/src/FrameClient";

if(window.location.hash) {
  const path = `/${window.location.hash.replace("#", "")}`;
  const url = new URL(window.location.href);
  url.hash = "";
  url.pathname = path;
  window.history.replaceState({}, null, url.toString());
}

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

class RootStore {
  client;
  initialized = false;
  view = "source";
  sidePanelDimensions = {};
  errorMessage = undefined;

  constructor() {
    makeAutoObservable(this);

    this.editStore = new EditStore(this);
    this.tagStore = new TagStore(this);
    this.keyboardControlStore = new KeyboardControlStore(this);
    this.browserStore = new BrowserStore(this);
    this.overlayStore = new OverlayStore(this);
    this.trackStore = new TrackStore(this);
    this.videoStore = new VideoStore(this);

    this.InitializeClient();

    window.rootStore = this;
  }

  Reset() {
    [
      this.videoStore,
      this.tagStore,
      this.overlayStore,
      this.trackStore,
      this.editStore
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

    this.initialized = true;

    const UpdatePage = () =>
      client.SendMessage({
        options: {
          operation: "SetFramePath",
          path: "/" + window.location.pathname
        },
        noResponse: true
      });

    let page = window.location.pathname;
    setInterval(() => {
      if(page !== window.location.pathname) {
        page = window.location.pathname;
        UpdatePage();
      }
    }, 500);
  }

  SetSidePanelDimensions(dimensions) {
    this.sidePanelDimensions = dimensions;
  }

  SetError(message) {
    this.errorMessage = message;
  }
}

const root = new RootStore();

export const rootStore = root;
export const editStore = rootStore.editStore;
export const tagStore = rootStore.tagStore;
export const keyboardControlsStore = rootStore.keyboardControlStore;
export const browserStore = rootStore.browserStore;
export const overlayStore = rootStore.overlayStore;
export const tracksStore = rootStore.trackStore;
export const videoStore = rootStore.videoStore;
