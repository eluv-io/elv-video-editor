import React from "react";
import {inject, observer} from "mobx-react";
import {IconButton, ImageIcon, ToolTip} from "elv-components-js";
import Asset from "./Asset";
import {BackButton} from "../Components";
import MimeTypes from "mime-types";

import FileIcon from "../../static/icons/file.svg";
import PictureIcon from "../../static/icons/picture.svg";
import TagIcon from "../../static/icons/tag.svg";
import XIcon from "../../static/icons/X.svg";
import DownloadIcon from "../../static/icons/download.svg";
import {DownloadFromUrl} from "../../utils/Utils";

@inject("rootStore")
@inject("videoStore")
@observer
class AssetsList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      page: 1,
      perPage: 21,
      selectedAsset:
        props.rootStore.selectedAsset ?
          this.Assets()
            .findIndex(asset => asset.title === props.rootStore.selectedAsset) :
          undefined,
      filter: "",
      taggedOnly: false,
      imageOnly: false
    };

    window.SetPage = page => this.setState({page});
  }

  componentDidUpdate() {
    this.props.rootStore.SetSelectedAsset(this.Assets()[this.state.selectedAsset]?.title);
  }

  AssetIcon(assetKey, asset) {
    let icon = FileIcon;
    let contentType =
      asset.attachment_content_type ||
      MimeTypes.lookup(asset.filename) || "";

    if(
      contentType.toLowerCase().startsWith("image") ||
      asset.filename.toLowerCase().endsWith(".dng")
    ) {
      icon = this.props.videoStore.AssetLink(assetKey, 200);
    }

    return icon;
  }

  Assets() {
    return Object.keys(this.props.videoStore.metadata.assets || {})
      .map((assetKey, index) => ({
        ...this.props.videoStore.metadata.assets[assetKey],
        title: this.props.videoStore.metadata.assets[assetKey].title || assetKey,
        assetKey,
        index,
        filename: ((this.props.videoStore.metadata.assets[assetKey].file || {})["/"] || assetKey).split("/").slice(-1)[0] || ""
      }));
  }

  FilteredAssets() {
    let assets = this.Assets();

    if(this.state.imageOnly) {
      assets = assets.filter(asset => (asset.attachment_content_type || "").toLowerCase().startsWith("image"));
    }

    if(this.state.taggedOnly) {
      assets = assets.filter(asset =>
        asset.image_tags &&
        Object.keys(asset.image_tags || {}).length > 0 &&
        Object.keys(asset.image_tags).find(category => (asset.image_tags[category] || {}).tags)
      );
    }

    if(this.state.filter) {
      const filter = this.state.filter.toLowerCase();

      assets = assets.filter(asset =>
        asset.assetKey.toLowerCase().includes(filter) ||
        (asset.title || "").toLowerCase().includes(filter) ||
        (
          asset.image_tags &&
          Object.keys(asset.image_tags || {}).length > 0 &&
          Object.keys(asset.image_tags).find(category =>
            (((asset.image_tags[category] || {}).tags) || [])
              .find(tag => (tag.text || "").toLowerCase().includes(filter))
          )
        )
      );
    }

    return assets.sort((a, b) => a.title < b.title ? -1 : 1);
  }

  AssetsList() {
    const assets = this.FilteredAssets()
      .slice(
        (this.state.page - 1) * this.state.perPage,
        (this.state.page) * this.state.perPage
      );

    if(!assets || assets.length === 0) {
      return (
        <div className="assets-list empty">
          No Assets
        </div>
      );
    }

    return (
      <div className="assets-list">
        {
          assets.map(asset => {
            const hasTags = asset.image_tags && Object.keys(asset.image_tags || {}).length > 0 &&
              Object.keys(asset.image_tags).find(category => (asset.image_tags[category] || {}).tags);

            return (
              <div
                className="asset-entry"
                key={`asset-${asset.assetKey}`}
                onClick={() =>
                  this.setState({
                    selectedAsset: asset.index,
                    scrollY: window.scrollY
                  })
                }
              >
                <ImageIcon
                  className="asset-icon"
                  icon={this.AssetIcon(asset.assetKey, asset)}
                  alternateIcon={FileIcon}
                  loading="lazy"
                />
                <div className="asset-title">
                  { asset.title || asset.attachment_file_name }
                  { hasTags ? <ImageIcon className="tag-icon" icon={TagIcon} /> : null }
                </div>
              </div>
            );
          })
        }
      </div>
    );
  }

  SortFilter() {
    if(typeof this.state.selectedAsset !== "undefined") { return null; }

    return (
      <div className="asset-sort-filter">
        <ToolTip content="Show only image assets">
          <IconButton
            icon={PictureIcon}
            className={`asset-filter-button asset-image-only ${this.state.imageOnly ? "active" : ""}`}
            onClick={() => this.setState({imageOnly: !this.state.imageOnly})}
          />
        </ToolTip>
        <ToolTip content="Show only tagged assets">
          <IconButton
            icon={TagIcon}
            className={`asset-filter-button asset-tagged-only ${this.state.taggedOnly ? "active" : ""}`}
            onClick={() => this.setState({taggedOnly: !this.state.taggedOnly})}
          />
        </ToolTip>
        <div className="asset-filter">
          <input
            className="asset-filter-input"
            value={this.state.filter}
            placeholder="Filter assets..."
            onChange={event => this.setState({filter: event.target.value})}
          />
          <IconButton
            icon={XIcon}
            className="asset-filter-clear"
            onClick={() => this.setState({filter: ""})}
          />
        </div>
      </div>
    );
  }

  PageButtons(selectedAsset) {
    const assets = this.FilteredAssets();

    if(typeof this.state.selectedAsset === "undefined") {
      const start = Math.max(1, this.state.perPage * (this.state.page - 1));
      const end = Math.min(assets.length, this.state.perPage * this.state.page);

      return (
        <div className="asset-list-page-buttons">
          <button
            disabled={this.state.page <= 1}
            onClick={() => this.setState({page: this.state.page - 1})}
          >
            Previous Page
          </button>
          <span>Showing {start} to {end} of {assets.length}</span>
          <button
            disabled={this.state.page >= Math.ceil(assets.length / this.state.perPage)}
            onClick={() => this.setState({page: this.state.page + 1})}
          >
            Next Page
          </button>
        </div>
      );
    }

    return (
      <div className="asset-page-buttons">
        <IconButton
          icon={DownloadIcon}
          onClick={() => DownloadFromUrl(this.props.videoStore.AssetLink(selectedAsset.assetKey), selectedAsset.assetKey, {target: "_blank"})}
          className="download-button"
        />

        <button
          disabled={this.state.selectedAsset <= 0}
          onClick={() => this.setState({selectedAsset: this.state.selectedAsset - 1})}
        >
          Previous
        </button>
        <button
          disabled={this.state.selectedAsset >= assets.length - 1}
          onClick={() => this.setState({selectedAsset: this.state.selectedAsset + 1})}
        >
          Next
        </button>
      </div>
    );
  }

  render() {
    const selectedAsset = typeof this.state.selectedAsset === "undefined" ?
      undefined :
      this.FilteredAssets()[this.state.selectedAsset];

    return (
      <div className="assets-page">
        <h2 className="assets-page-header">
          { selectedAsset ?
            <BackButton
              onClick={async () => {
                this.setState({
                  selectedAsset: undefined
                }, () => window.scrollTo(0, this.state.scrollY));
              }}
            /> :
            null
          }
          Assets
          { selectedAsset ? ` - ${selectedAsset.title || selectedAsset.attachment_file_name || selectedAsset.assetKey}` : "" }
          { this.SortFilter() }
          { this.PageButtons(selectedAsset) }
        </h2>
        {
          selectedAsset ?
            <Asset assetKey={selectedAsset.assetKey} key={`asset-${selectedAsset.assetKey}`} /> :
            this.AssetsList()
        }
      </div>
    );
  }
}

export default AssetsList;
