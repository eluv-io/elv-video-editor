import {flow, makeAutoObservable} from "mobx";
import {HashString} from "@/utils/Utils.js";

class TitleStore {
  DEFAULT_SEARCH_SETTINGS = {
    query: "",
    genres: [],
    yearMin: 0,
    yearMax: 9999,
    key: 0
  };

  selectedSearchIndexId;
  searchSettings = this.DEFAULT_SEARCH_SETTINGS;
  searchResults = {};
  searchImageFrame;
  searchImageFrameUrl;

  titles = {};

  constructor(rootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  get client() {
    return this.rootStore.client;
  }

  get customSearchSettingsActive() {
    return (
      HashString(JSON.stringify({...this.searchSettings, key: 0})) !==
      HashString(JSON.stringify({...this.rootStore?.aiStore?.DEFAULT_SEARCH_SETTINGS, key: 0}))
    );
  }

  SetSelectedSearchIndex(id) {
    this.searchSettings = this.rootStore.aiStore.DEFAULT_SEARCH_SETTINGS;
    this.selectedSearchIndexId = id;
  }

  SetSearchSettings(options) {
    const searchIndexId = options.searchIndexId || this.selectedSearchIndexId;

    delete options.key;
    delete options.searchIndexId;

    this.SetSelectedSearchIndex(searchIndexId);

    this.searchSettings = {
      ...options,
      key: HashString(JSON.stringify(options))
    };
  }

  LoadTitle = flow(function * ({titleId}) {
    return yield this.rootStore.LoadResource({
      id: "titles",
      key: titleId,
      bind: this,
      Load: flow(function * () {
        const versionHash = yield this.client.LatestVersionHash({objectId: titleId});
        const libraryId = yield this.client.ContentObjectLibraryId({objectId: titleId});
        const metadata = yield this.client.ContentObjectMetadata({
          versionHash,
          metadataSubtree: "/public/",
          select: [
            "name",
            "asset_metadata"
          ]
        });

        this.titles[titleId] = {
          libraryId,
          objectId: titleId,
          versionHash,
          name: metadata?.name,
          title: metadata?.asset_metadata?.display_title || metadata?.asset_metadata?.title || metadata?.name,
          metadata: metadata?.asset_metadata
        };

        return this.titles[titleId];
      })
    });
  });
}

export default TitleStore;
