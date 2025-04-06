import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";
import {Capitalize, Unproxy} from "@/utils/Utils.js";

class AssetStore {
  filter = "";
  tracks = [];
  activeTracks = {};
  assets = [];

  _selectedTags = [];
  _selectedTag;

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  get hasUnsavedChanges() {
    return this.rootStore.editStore.hasUnsavedChanges;
  }

  get filteredAssetList() {
    const filterTerms = (this.filter
      .toLowerCase()
      .trim()
      // Split by space, except in quotes
      .match(/(".*?"|[^"\s]+)+(?=\s*|\s*$)/g) || [])
      // Remove quotes from start and end
      .map(token => token.replace(/^"(.+)"$/, "$1"));

    const activeTracks = Object.keys(this.activeTracks);
    return this.assets
      .filter(asset =>
        // If tag categories are selected, filter only assets that are tagged with one or more of those categories
        activeTracks.length === 0 ?
          true :
          Object.keys(asset.image_tags || {})
            .find(key =>
              this.activeTracks[key] &&
              asset.image_tags[key]?.tags?.length > 0
            )
      )
      .filter(asset =>
        filterTerms.every(term =>
          asset.key.toLowerCase().includes(term) ||
          (asset.title || "").toLowerCase().includes(term) ||
          (
            asset.image_tags &&
            Object.keys(asset.image_tags || {}).length > 0 &&
            Object.keys(asset.image_tags)
              .filter(category => activeTracks.length === 0 || activeTracks.includes(category))
              .find(category =>
                (((asset.image_tags[category] || {}).tags) || [])
                  .find(tag => (tag.text || "").toLowerCase().includes(term))
              )
          )
        )
      );
  }

  get selectedAsset() {
    return this.Asset(this.rootStore.subpage);
  }

  // Actual tag info must be pulled from asset
  get selectedTags() {
    if(this.rootStore.tagStore.editedAssetTag) {
      return [ this.rootStore.tagStore.editedAssetTag ];
    }

    return this._selectedTags
      .map(tag =>
        this.Asset(tag.assetKey)?.image_tags?.[tag.trackKey]?.tags
          ?.find(t => t.tagId === tag.tagId)
      )
      .filter(tag => tag);
  }

  get selectedTag() {
    return this.Asset(this._selectedTag?.assetKey)
      ?.image_tags
      ?.[this._selectedTag.trackKey]?.tags
      ?.find(t => t.tagId === this._selectedTag?.tagId) ||
      this.rootStore.tagStore.editedAssetTag;
  }

  SetSelectedTags(tags=[], autoselectSingle=false) {
    this.ClearSelectedTags();

    this._selectedTags = Unproxy(tags);

    if(tags.length === 1 && autoselectSingle) {
      this.SetSelectedTag(tags[0]);
    }
  }

  ClearSelectedTags() {
    this.ClearSelectedTag();

    this._selectedTags = [];
  }

  SetSelectedTag(tag) {
    this._selectedTag = Unproxy(tag);
  }

  ClearSelectedTag() {
    this._selectedTag = undefined;

    if(this._selectedTags.length === 1) {
      this._selectedTags = [];
    }
  }

  SetAssets(assets={}) {
    let tagTracks = {
      celebrity_detection: true,
      llava_caption: true,
      logo_detection: true,
      object_detection: true,
      optical_character_recognition: true
    };

    this.assets = Object.keys(assets).sort().map(key => {
      let assetId = this.rootStore.NextId();
      let tags = assets[key].image_tags || {};
      Object.keys(tags).forEach(trackKey => {
        if(!tags[trackKey]?.tags) { return; }

        tagTracks[trackKey] = true;

        tags[trackKey].tags = tags[trackKey].tags.map(tag => ({
          ...tag,
          assetKey: key,
          assetId,
          trackKey,
          tagId: this.rootStore.NextId()
        }));
      });

      return {
        ...assets[key],
        assetId,
        image_tags: tags,
        key
      };
    });

    this.tracks = Object.keys(tagTracks)
      .sort()
      .map(key => this.__CreateAssetTrack(key));
  }

  __CreateAssetTrack(key) {
    return {
      key,
      trackId: this.rootStore.NextId(),
      color: this.rootStore.trackStore.TrackColor(key),
      label: key
        .split("_")
        .map(str => str.toLowerCase() === "llava" ? "LLAVA" : Capitalize(str))
        .join(" ")
    };
  }

  AssetTrack(trackKeyOrId) {
    return (
      this.tracks.find(track => track.key === trackKeyOrId || track.trackId === trackKeyOrId) ||
      this.__CreateAssetTrack(trackKeyOrId)
    );
  }

  Asset(key) {
    return this.assets.find(asset =>
      asset.key === key ||
      this.rootStore.client.utils.B64(asset.key) === key
    );
  }

  AssetLink(assetKey, options={}) {
    const asset = assetKey === "edited" ? this.rootStore.tagStore.editedAsset : this.Asset(assetKey);

    if(!asset || !asset.file || !asset.file["/"]) { return ""; }

    const filePath = asset.file?.["/"]?.split("/files/").slice(1).join("/");

    const url = new URL(this.rootStore.videoStore.baseStateChannelUrl);
    url.pathname = UrlJoin(url.pathname, "rep", "thumbnail", "files", filePath || "");

    if(options) {
      Object.keys(options).forEach(key =>
        url.searchParams.set(key, options[key])
      );
    }

    return url.toString();
  }

  AddAsset(addedAsset) {
    this.assets.push(addedAsset);
  }

  DeleteAsset(deletedAsset) {
    this.assets = this.assets.filter(asset => asset.assetId !== deletedAsset.assetId);
  }

  AddAssetTag(addedTag) {
    const assetIndex = this.assets.findIndex(asset => asset.key === addedTag.assetKey);

    if(assetIndex < 0) {
      return;
    }

    this.assets[assetIndex].image_tags = this.assets[assetIndex].image_tags || {};
    this.assets[assetIndex].image_tags[addedTag.trackKey] =
      this.assets[assetIndex].image_tags[addedTag.trackKey] || { tags: [] };
    this.assets[assetIndex].image_tags[addedTag.trackKey].tags =
      this.assets[assetIndex].image_tags[addedTag.trackKey].tags || [];

    this.assets[assetIndex].image_tags[addedTag.trackKey].tags.push(addedTag);
  }

  DeleteAssetTag(deletedTag) {
    const assetIndex = this.assets.findIndex(asset => asset.key === deletedTag.assetKey);

    if(assetIndex < 0) {
      return;
    }

    this.assets[assetIndex].image_tags[deletedTag.trackKey].tags =
      this.assets[assetIndex].image_tags[deletedTag.trackKey].tags
        .filter(tag => tag.tagId !== deletedTag.tagId);

    this.SetSelectedTags(
      this._selectedTags.filter(tag => tag.tagId !== deletedTag.tagId)
    );
  }

  ModifyAsset(modifiedAsset) {
    const assetIndex = this.assets.findIndex(asset => asset.assetId === modifiedAsset.assetId);

    if(assetIndex < 0) {
      return;
    }

    this.assets[assetIndex] = Unproxy(modifiedAsset);
  }

  ModifyAssetTag(modifiedTag) {
    const assetIndex = this.assets.findIndex(asset => asset.key === modifiedTag.assetKey);

    if(assetIndex < 0) {
      return;
    }

    this.assets[assetIndex].image_tags[modifiedTag.trackKey].tags =
      this.assets[assetIndex].image_tags[modifiedTag.trackKey].tags
        .map(tag =>
          tag.tagId === modifiedTag.tagId ?
            modifiedTag : tag
        );
  }

  SetFilter(filter) {
    this.filter = filter;
  }

  ToggleTrackSelected(key, value) {
    if(typeof value !== "undefined") {
      value ?
        this.activeTracks[key] = true :
        delete this.activeTracks[key];

      return;
    }

    if(this.activeTracks[key]) {
      delete this.activeTracks[key];
    } else {
      this.activeTracks[key] = true;
    }
  }

  SaveAssets = flow(function * () {
    const actions = this.rootStore.editStore.editInfo.assets.actionStack;

    if(actions.length === 0) { return; }

    const objectId = this.rootStore.videoStore.videoObject.objectId;
    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});
    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    let assetsWithChangedTags = {};
    for(const action of actions) {
      if(action.type === "asset") {
        let assetFields = ["asset_type", "attachment_content_type", "image_tags", "file", "display_metadata", "manual_metadata", "raw_metadata"];

        switch(action.action) {
          // Create new asset
          case "create":
            let newAsset = {};
            assetFields.forEach(key => {
              if(action.modifiedItem[key]) {
                newAsset[key] = action.modifiedItem[key];
              }
            });

            yield this.rootStore.client.ReplaceMetadata({
              libraryId,
              objectId,
              writeToken,
              metadataSubtree: UrlJoin("/assets", action.modifiedItem.key),
              metadata: Unproxy(newAsset)
            });

            break;

          case "modify":
            // Modify asset file
            yield this.rootStore.client.ReplaceMetadata({
              libraryId,
              objectId,
              writeToken,
              metadataSubtree: UrlJoin("/assets", action.modifiedItem.key, "file"),
              metadata: {
                "/": action.modifiedItem.file["/"]
              }
            });

            break;

          case "delete":
            // Remove asset
            yield this.rootStore.client.DeleteMetadata({
              libraryId,
              objectId,
              writeToken,
              metadataSubtree: UrlJoin("/assets", action.modifiedItem.key)
            });

            // Ignore any changes to tags
            delete assetsWithChangedTags[action.modifiedItem.key];

            break;
        }
      } else if(action.type === "assetTag") {
        // Since fabric lists don't allow arbitrary inserts(?), let's just determine which asset + tracks changed and update all of them
        if(!assetsWithChangedTags[action.modifiedItem.assetKey]) {
          assetsWithChangedTags[action.modifiedItem.assetKey] = {};
        }

        if(!assetsWithChangedTags[action.modifiedItem.assetKey][action.modifiedItem.trackKey]) {
          assetsWithChangedTags[action.modifiedItem.assetKey][action.modifiedItem.trackKey] = true;
        }
      }
    }

    let tagFields = ["box", "confidence", "text"];
    for(const assetKey of Object.keys(assetsWithChangedTags)) {
      for(const trackKey of Object.keys(assetsWithChangedTags[assetKey])) {
        const updatedTags = this.assets
          .find(asset => asset.key === assetKey).image_tags[trackKey].tags || []
          .map(assetTag => {
            let updatedTag = {};
            tagFields.forEach(key => {
              if(assetTag[key]) {
                updatedTag[key] = assetTag[key];
              }
            });

            return updatedTag;
          });

        yield this.rootStore.client.ReplaceMetadata({
          libraryId,
          objectId,
          writeToken,
          metadataSubtree: UrlJoin("/assets", assetKey, "image_tags", trackKey, "tags"),
          metadata: Unproxy(updatedTags)
        });
      }
    }

    yield this.rootStore.editStore.Finalize({
      objectId,
      commitMessage: "EVIE - Update assets"
    });
  });

  GenerateSummary = flow(function * ({objectId, asset}) {
    const filePath = asset?.file?.["/"]?.replace("./files/", "");

    return yield (yield this.rootStore.compositionStore.QueryAIAPI({
      server: "ai-02",
      method: "GET",
      path: UrlJoin("ml", "summary", "q", objectId, "rep", "image_summarize"),
      objectId,
      channelAuth: true,
      queryParams: { path: filePath, engine: "caption" }
    })).json();
  });
}

export default AssetStore;
