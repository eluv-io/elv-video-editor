import {makeAutoObservable} from "mobx";
import UrlJoin from "url-join";
import {Capitalize} from "@/utils/Utils.js";

class AssetStore {
  filter = "";
  selectedTracks = {};

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  get assetList() {
    const assetMap = this.rootStore.videoStore.metadata?.assets || {};

    return Object.keys(assetMap).map((key, index) => ({
      ...assetMap[key],
      key,
      index
    }));
  }

  get filteredAssetList() {
    const filterTerms = (this.filter
      .toLowerCase()
      .trim()
      // Split by space, except in quotes
      .match(/(".*?"|[^"\s]+)+(?=\s*|\s*$)/g) || [])
      // Remove quotes from start and end
      .map(token => token.replace(/^"(.+)"$/, "$1"));

    const selectedTracks = Object.keys(this.selectedTracks);
    return this.assetList
      .filter(asset =>
        // If tag categories are selected, filter only assets that are tagged with one or more of those categories
        selectedTracks.length === 0 ?
          true :
          Object.keys(asset.image_tags || {})
            .find(key =>
              this.selectedTracks[key] &&
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
              .filter(category => selectedTracks.length === 0 || selectedTracks.includes(category))
              .find(category =>
                (((asset.image_tags[category] || {}).tags) || [])
                  .find(tag => (tag.text || "").toLowerCase().includes(term))
              )
          )
        )
      );
  }

  get tracksSelected() {
    return Object.keys(this.selectedTracks).length > 0;
  }

  get assetTracks() {
    let tracks = {};
    this.assetList.forEach(asset =>
      Object.keys(asset.image_tags || {}).forEach(trackKey =>
        tracks[trackKey] = true
      )
    );

    Object.keys(tracks).forEach(trackKey =>
      tracks[trackKey] = this.__CreateAssetTrack(trackKey)
    );

    return Object.values(tracks);
  }

  __CreateAssetTrack(key) {
    return {
      key,
      color: this.rootStore.trackStore.TrackColor(key),
      label: key
        .split("_")
        .map(str => str.toLowerCase() === "llava" ? "LLAVA" : Capitalize(str))
        .join(" ")
    };
  }

  AssetTrack(key) {
    return (
      this.assetTracks.find(track => track.key === key) ||
      this.__CreateAssetTrack(key)
    );
  }

  Asset(key) {
    const asset =
      this.rootStore.videoStore.metadata.assets?.[key] ||
      this.rootStore.videoStore.metadata.assets?.[key && this.rootStore.client.utils.FromB64(key)];

    if(asset) {
      asset.key = key;
    }

    return asset;
  }

  AssetLink(assetKey, options={}) {
    const asset = this.Asset(assetKey);

    if(!asset) { return ""; }

    const filePath = asset.file?.["/"].split("/files/").slice(1).join("/");

    const url = new URL(this.rootStore.videoStore.baseStateChannelUrl);
    url.pathname = UrlJoin(url.pathname, "rep", "thumbnail", "files", filePath);

    if(options) {
      Object.keys(options).forEach(key =>
        url.searchParams.set(key, options[key])
      );
    }

    return url.toString();
  }

  SetFilter(filter) {
    this.filter = filter;
  }

  ToggleTrackSelected(key) {
    if(this.selectedTracks[key]) {
      delete this.selectedTracks[key];
    } else {
      this.selectedTracks[key] = true;
    }
  }
}

export default AssetStore;
