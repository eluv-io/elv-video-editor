import React from "react";
import {inject, observer} from "mobx-react";
import {ImageIcon} from "elv-components-js";
import Asset from "./Asset";
import {BackButton} from "../Components";

import FileIcon from "../../static/icons/file.svg";
import PictureIcon from "../../static/icons/image.svg";
import TagIcon from "../../static/icons/tag.svg";

@inject("videoStore")
@observer
class AssetsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedAsset: undefined
    };
  }

  AssetIcon(assetKey, asset) {
    let icon = FileIcon;
    if((asset.attachment_content_type || "").toLowerCase() === "image/tiff") {
      icon = PictureIcon;
    } else if((asset.attachment_content_type || "").toLowerCase().startsWith("image")) {
      icon = this.props.videoStore.AssetLink(assetKey, 200);
    }

    return icon;
  }

  AssetsList() {
    const assets = this.props.videoStore.metadata.assets;
    if(!assets) {
      return (
        <div>
          No Assets
        </div>
      );
    }

    return (
      <div className="assets-list">
        {
          Object.keys(this.props.videoStore.metadata.assets)
            .sort((a, b) => this.props.videoStore.metadata.assets[a].title < this.props.videoStore.metadata.assets[b].title ? -1 : 1)
            .map((assetKey, i) => {
              const asset = this.props.videoStore.metadata.assets[assetKey];
              const hasTags = asset.image_tags && Object.keys(asset.image_tags || {}).length > 0 &&
                Object.keys(asset.image_tags).find(category => (asset.image_tags[category] || {}).tags);

              return (
                <div
                  className="asset-entry"
                  key={`asset-${i}`}
                  onClick={() =>
                    this.setState({
                      selectedAsset: assetKey,
                      scrollY: window.scrollY
                    })
                  }
                >
                  <ImageIcon
                    className="asset-icon"
                    icon={this.AssetIcon(assetKey, asset)}
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

  render() {
    if(!this.props.videoStore.metadata || !this.props.videoStore.metadata.assets) {
      return null;
    }

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

export default AssetsView;
