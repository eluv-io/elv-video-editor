import React from "react";
import {inject, observer} from "mobx-react";
import {IconButton, ImageIcon, ToolTip} from "elv-components-js";
import Asset from "./Asset";
import {BackButton} from "../Components";

import FileIcon from "../../static/icons/file.svg";
import PictureIcon from "../../static/icons/image.svg";
import TagIcon from "../../static/icons/tag.svg";
import XIcon from "../../static/icons/X.svg";

@inject("videoStore")
@observer
class AssetsList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedAsset: undefined,
      filter: "",
      taggedOnly: false,
      imageOnly: false
    };
  }

  AssetIcon(assetKey, asset) {
    let icon = FileIcon;
    if((asset.attachment_content_type || "").toLowerCase().startsWith("image")) {
      icon = this.props.videoStore.AssetLink(assetKey, 200);
    }

    return icon;
  }

  FilteredAssets() {
    let assets = Object.keys(this.props.videoStore.metadata.assets || {})
      .map(assetKey => ({...this.props.videoStore.metadata.assets[assetKey], assetKey}));

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

    return assets;
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
          assets
            .sort((a, b) => a.title < b.title ? -1 : 1)
            .map((asset, i) => {
              const hasTags = asset.image_tags && Object.keys(asset.image_tags || {}).length > 0 &&
                Object.keys(asset.image_tags).find(category => (asset.image_tags[category] || {}).tags);

              return (
                <div
                  className="asset-entry"
                  key={`asset-${i}`}
                  onClick={() =>
                    this.setState({
                      selectedAsset: asset.assetKey,
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
    if(this.state.selectedAsset) { return null; }

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

  render() {
    const selectedAsset = this.state.selectedAsset ? this.props.videoStore.metadata.assets[this.state.selectedAsset] : undefined;

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
          { selectedAsset ? ` - ${selectedAsset.title || selectedAsset.attachment_file_name}` : "" }
          { this.SortFilter() }
        </h2>
        {
          selectedAsset ?
            <Asset assetKey={this.state.selectedAsset} /> :
            this.AssetsList()
        }
      </div>
    );
  }
}

export default AssetsList;
