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
import {rootStore} from "../../stores";

@inject("videoStore")
@observer
class AssetsList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedAsset:
        rootStore.selectedAsset ?
          this.Assets()
            .findIndex(asset => asset.title === rootStore.selectedAsset) :
          undefined,
      filter: "",
      taggedOnly: false,
      imageOnly: false
    };
  }

  componentDidUpdate() {
    rootStore.SetSelectedAsset(this.Assets()[this.state.selectedAsset]?.title);
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
      .map(assetKey => ({
        ...this.props.videoStore.metadata.assets[assetKey],
        title: this.props.videoStore.metadata.assets[assetKey].title || assetKey,
        assetKey,
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
      assets = assets.filter(asset =>
        (asset.title || "").toLowerCase().includes(this.state.filter) ||
        (
          asset.image_tags &&
          Object.keys(asset.image_tags || {}).length > 0 &&
          Object.keys(asset.image_tags).find(category =>
            (((asset.image_tags[category] || {}).tags) || [])
              .find(tag => (tag.text || "").toLowerCase().includes(this.state.filter))
          )
        )
      );
    }

    return assets.sort((a, b) => a.title < b.title ? -1 : 1);
  }

  AssetsList() {
    const assets = this.FilteredAssets();

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
          assets.map((asset, i) => {
            const hasTags = asset.image_tags && Object.keys(asset.image_tags || {}).length > 0 &&
              Object.keys(asset.image_tags).find(category => (asset.image_tags[category] || {}).tags);

            return (
              <div
                className="asset-entry"
                key={`asset-${i}`}
                onClick={() =>
                  this.setState({
                    selectedAsset: i,
                    scrollY: window.scrollY
                  })
                }
              >
                <ImageIcon
                  className="asset-icon"
                  icon={this.AssetIcon(asset.assetKey, asset)}
                  alternateIcon={FileIcon}
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

  PageButtons() {
    if(typeof this.state.selectedAsset === "undefined") { return null; }

    const assets = this.FilteredAssets();
    return (
      <div className="asset-page-buttons">
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
          { this.PageButtons() }
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
