import {configure, runInAction, makeAutoObservable, flow} from "mobx";
import AssetStore from "@/stores/AssetStore.js";
import BrowserStore from "./BrowserStore";
import EditStore from "./EditStore";
import KeyboardControlStore from "./KeyboardControlsStore";
import OverlayStore from "./OverlayStore";
import TagStore from "./TagStore.js";
import TrackStore from "./TrackStore";
import VideoStore from "./VideoStore";
import FileBrowserStore from "./FileBrowserStore.js";
import CompositionStore from "@/stores/CompositionStore.js";
import Id from "@/utils/Id.js";
import {FrameClient} from "@eluvio/elv-client-js/src/FrameClient";

import LocalizationEN from "@/assets/localizations/en.yml";
import UrlJoin from "url-join";

if(window.location.hash) {
  const path = `/${window.location.hash.replace("#", "")}`.replace("//", "/");
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
  page = "source";
  subpage = undefined;
  sidePanelDimensions = {};
  expandedPanel = undefined;
  errorMessage = undefined;
  l10n = LocalizationEN;

  signedToken;
  authToken;

  libraryIds = {};
  versionHashes = {};

  constructor() {
    makeAutoObservable(this);

    this.editStore = new EditStore(this);
    this.tagStore = new TagStore(this);
    this.keyboardControlStore = new KeyboardControlStore(this);
    this.browserStore = new BrowserStore(this);
    this.overlayStore = new OverlayStore(this);
    this.trackStore = new TrackStore(this);
    this.videoStore = new VideoStore(this);
    this.compositionStore = new CompositionStore(this);
    this.assetStore = new AssetStore(this);
    this.fileBrowserStore = new FileBrowserStore(this);

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

  Navigate(to) {
    this.navigate(to);
  }

  SetNavigation(location, navigate) {
    this.navigate = navigate;
    this.location = location;
  }

  SetPage(page) {
    this.page = page;
    this.subpage = undefined;
  }

  SetSubpage(subpage) {
    this.subpage = subpage;
  }

  InitializeClient = flow(function * () {
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
          path: window.location.pathname
        },
        noResponse: true
      });

    let page = window.location.pathname;
    setInterval(() => {
      if(page !== window.location.pathname) {
        page = window.location.pathname;
        UpdatePage();
      }
    }, 1000);

    this.address = yield this.client.CurrentAccountAddress();
    this.network = (yield this.client.NetworkInfo()).name;
    this.publicToken = client.utils.B64(JSON.stringify({qspace_id: yield this.client.ContentSpaceId()}));
    this.signedToken = yield client.CreateFabricToken({duration: 24 * 60 * 60 * 1000});
  });

  FabricUrl({libraryId, objectId, writeToken, versionHash, noWriteToken=false, path="", auth, resolve=true, width}) {
    let url = new URL(
      this.network === "main" ?
        "https://main.net955305.contentfabric.io" :
        "https://demov3.net955210.contentfabric.io"
    );

    if(!noWriteToken && editStore.writeInfo[objectId]) {
      writeToken = editStore.writeInfo[objectId].writeToken || writeToken;
      const fabricNodeUrl = editStore.writeInfo[objectId]?.fabricNodeUrl;

      if(!fabricNodeUrl) {
        return "";
      }

      url = new URL(fabricNodeUrl);
    }
    let urlPath = UrlJoin("s", this.network);
    if(auth === "private") {
      urlPath = UrlJoin("t", this.authToken);
    }

    if(versionHash) {
      objectId = this.client.utils.DecodeVersionHash(versionHash).objectId;
    } else {
      // Ensure library ID is loaded for this object
      this.LibraryId({objectId});
      libraryId = libraryId || this.libraryIds[objectId];
    }

    if(objectId && !versionHash) {
      // Ensure version hash is loaded for this object
      if(!this.versionHashes[objectId]) {
        this.VersionHash({objectId});
      }

      versionHash = this.versionHashes[objectId]?.versionHash;
    }

    if(path?.startsWith("/qfab")) {
      urlPath = UrlJoin(urlPath, path.replace(/^\/qfab/, "q"));
    } else if(versionHash) {
      urlPath = UrlJoin(urlPath, "q", writeToken || versionHash, path);
    } else {
      urlPath = UrlJoin(urlPath, "qlibs", libraryId, "q", writeToken || objectId, path);
    }

    url.pathname = urlPath;

    if(resolve) {
      url.searchParams.set("resolve", "true");
    }

    if(width && !path.endsWith(".svg")) {
      url.searchParams.set("width", width);
    }

    return url.toString();
  }

  SetSidePanelDimensions(dimensions) {
    this.sidePanelDimensions = dimensions;
  }

  SetError(message) {
    this.errorMessage = message;
  }

  SetExpandedPanel(panel) {
    this.expandedPanel = panel;
  }

  NextId() {
    return Id.next();
  }

  LibraryId = flow(function * ({objectId, versionHash}) {
    if(!objectId && !versionHash) { return; }

    if(versionHash) {
      objectId = this.utils.DecodeVersionHash(versionHash).objectId;
    }

    if(!this.libraryIds[objectId]) {
      this.libraryIds[objectId] = yield this.client.ContentObjectLibraryId({objectId});
    }

    return this.libraryIds[objectId];
  });

  VersionHash = flow(function * ({objectId, versionHash, force}) {
    if(versionHash) {
      objectId = this.utils.DecodeVersionHash(versionHash).objectId;
    }

    if(force || !this.versionHashes[objectId] || Date.now() - this.versionHashes[objectId].retrievedAt > 30000) {
      this.versionHashes[objectId] = {
        versionHash: yield this.client.LatestVersionHash({objectId}),
        retrievedAt: Date.now()
      };
    }

    return this.versionHashes[objectId].versionHash;
  });
}

const root = new RootStore();

export const rootStore = root;
export const editStore = rootStore.editStore;
export const tagStore = rootStore.tagStore;
export const keyboardControlsStore = rootStore.keyboardControlStore;
export const browserStore = rootStore.browserStore;
export const overlayStore = rootStore.overlayStore;
export const trackStore = rootStore.trackStore;
export const videoStore = rootStore.videoStore;
export const compositionStore = rootStore.compositionStore;
export const assetStore = rootStore.assetStore;
export const fileBrowserStore = rootStore.fileBrowserStore;
