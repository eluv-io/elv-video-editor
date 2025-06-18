import {configure, makeAutoObservable, flow} from "mobx";
import Id from "@/utils/Id.js";
import {FrameClient} from "@eluvio/elv-client-js/src/FrameClient";
import {v4 as UUID, parse as UUIDParse} from "uuid";

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
import DownloadStore from "@/stores/DownloadStore.js";
import AIStore from "@/stores/AIStore.js";
import GroundTruthStore from "@/stores/GroundTruthStore.js";


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
  localhost = window.location.hostname === "localhost";
  client;
  initialized = false;
  page = "source";
  subpage = undefined;
  expandedPanel = undefined;
  errorMessage = undefined;
  l10n = LocalizationEN;

  tenantContractId;
  signedToken;
  authToken;

  libraryIds = {};
  versionHashes = {};

  selectedObjectId;
  selectedObjectName = "";

  _resources = {};
  logTiming = new URLSearchParams(window.location.search).has("logTiming") || sessionStorage.getItem("log-timing");

  constructor() {
    makeAutoObservable(this);

    this.aiStore = new AIStore(this);
    this.assetStore = new AssetStore(this);
    this.browserStore = new BrowserStore(this);
    this.compositionStore = new CompositionStore(this);
    this.downloadStore = new DownloadStore(this);
    this.editStore = new EditStore(this);
    this.fileBrowserStore = new FileBrowserStore(this);
    this.groundTruthStore = new GroundTruthStore(this);
    this.keyboardControlStore = new KeyboardControlStore(this);
    this.overlayStore = new OverlayStore(this);
    this.tagStore = new TagStore(this);
    this.trackStore = new TrackStore(this);
    this.videoStore = new VideoStore(this);

    this.InitializeClient();

    if(this.logTiming) {
      sessionStorage.setItem("log-timing", "true");
    }

    window.rootStore = this;
  }

  Reset() {
    [
      this.tagStore,
      this.overlayStore,
      this.trackStore,
      this.editStore,
      this.compositionStore,
      this.assetStore
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

  SetSelectedObjectId(selectedObjectId, name) {
    this.selectedObjectId = selectedObjectId;
    this.selectedObjectName = name || "";

    if(
      this.page !== "compositions" &&
      this.compositionStore.compositionObject &&
      this.compositionStore.compositionObject.objectId !== selectedObjectId
    ) {
      this.compositionStore.Reset();
    }
  }

  InitializeClient = flow(function * () {
    // Contained in IFrame
    const client = new FrameClient({
      target: window.parent,
      timeout: 120
    });

    this.client = client;

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

    //yield client.SetNodes({fabricURIs: ["https://host-76-74-28-230.contentfabric.io"]});

    this.address = yield this.client.CurrentAccountAddress();
    this.network = (yield this.client.NetworkInfo()).name;
    this.publicToken = client.utils.B64(JSON.stringify({qspace_id: yield this.client.ContentSpaceId()}));
    this.signedToken = yield client.CreateFabricToken({duration: 7 * 24 * 60 * 60 * 1000});

    this.tenantContractId = yield client.userProfileClient.TenantContractId();

    yield this.aiStore.LoadSearchIndexes();
    yield this.compositionStore.Initialize();
  });


  FabricUrl({libraryId, objectId, writeToken, versionHash, path="", auth, resolve=true, width}) {
    let url = new URL(
      this.network === "main" ?
        "https://main.net955305.contentfabric.io" :
        "https://demov3.net955210.contentfabric.io"
    );

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

  SetError(message) {
    this.errorMessage = message;
  }

  SetExpandedPanel(panel) {
    this.expandedPanel = panel;
  }

  NextId(uuid=false) {
    if(uuid) {
      return this.client.utils.B58(UUIDParse(UUID()));
    }

    return Id.next();
  }

  OpenExternalLink(url, filename) {
    if(filename) {
      url = new URL(url);
      url.searchParams.set("header-x_set_content_disposition", `attachment; filename="${filename}"`);
      url = url.toString();
    }

    this.client.SendMessage({
      options: {
        operation: "OpenExternalLink",
        url
      }
    });
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

  // Ensure the specified load method is called only once unless forced
  LoadResource = flow(function * ({key, id, force=false, ttl, Load, bind}) {
    if(force || (ttl && this._resources[key]?.[id] && Date.now() - this._resources[key][id].retrievedAt > ttl * 1000)) {
      // Force - drop all loaded content
      this._resources[key] = {};
    }

    this._resources[key] = this._resources[key] || {};

    if(force || !this._resources[key][id]) {
      if(bind) {
        Load = Load.bind(bind);
      }

      if(this.logTiming) {
        this._resources[key][id] = {
          promise: (async (...args) => {
            let start = Date.now();
            // eslint-disable-next-line no-console
            console.log(`Start Timing ${key.split("-").join(" ")} - ${id}`);
            const result = await Load(...args);
            // eslint-disable-next-line no-console
            console.log(`${(Date.now() - start)}ms | End Timing ${key.split("-").join(" ")} - ${id}`);

            return result;
          })(),
          retrievedAt: Date.now()
        };
      } else {
        this._resources[key][id] = {
          promise: Load(),
          retrievedAt: Date.now()
        };
      }
    }

    return yield this._resources[key][id].promise;
  });

  ClearResource({key, id}) {
    if(this._resources[key]) {
      delete this._resources[key][id];
    }
  }
}


const root = new RootStore();

export const rootStore = root;

export const aiStore = rootStore.aiStore;
export const assetStore = rootStore.assetStore;
export const browserStore = rootStore.browserStore;
export const compositionStore = rootStore.compositionStore;
export const downloadStore = rootStore.downloadStore;
export const editStore = rootStore.editStore;
export const fileBrowserStore = rootStore.fileBrowserStore;
export const groundTruthStore = rootStore.groundTruthStore;
export const keyboardControlsStore = rootStore.keyboardControlStore;
export const overlayStore = rootStore.overlayStore;
export const tagStore = rootStore.tagStore;
export const trackStore = rootStore.trackStore;
export const videoStore = rootStore.videoStore;
