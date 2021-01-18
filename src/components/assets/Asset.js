import React from "react";
import {inject, observer} from "mobx-react";
import Overlay from "../Overlay";

import {FormatName, ToolTip} from "elv-components-js";

@inject("videoStore")
@inject("overlayStore")
@observer
class Asset extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      imageElement: undefined,
      highlightEntry: undefined
    };
  }

  AssetImage(assetKey, asset) {
    if(!(
      (asset.attachment_content_type || "").toLowerCase().startsWith("image") ||
      (asset.title || "").toLowerCase().endsWith(".dng")
    )) {
      return null;
    }

    const url = this.props.videoStore.AssetLink(assetKey, window.innerHeight);

    const image = (
      <img
        className="asset-image"
        src={url}
        alt={asset.title || asset.attachment_file_name}
        ref={element => {
          if(!element || this.state.imageElement) { return; }

          this.setState({imageElement: element});
        }}
      />
    );

    return (
      <div className="asset-image-container">
        { image }
        { asset.image_tags && this.state.imageElement ?
          <Overlay
            element={this.state.imageElement}
            asset={asset}
            highlightEntry={this.state.highlightEntry}
          /> : null
        }
      </div>
    );
  }

  Tags(asset) {
    const AdjustColor = (value, adjustment=1) =>  Math.max(0, Math.min(255, adjustment * value));
    const RGBToHex = (c, adjust=1) => "#" + [AdjustColor(c.r, adjust), AdjustColor(c.g, adjust), AdjustColor(c.b, adjust)].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");

    const tags = (
      Object.keys(asset.image_tags || {}).map(category => {
        if(!asset.image_tags[category].tags) { return; }

        const trackInfo = this.props.overlayStore.TrackInfo(category);

        const categoryTags = asset.image_tags[category].tags.map((tag, i) => {
          return (
            <ToolTip
              content={<div className="asset-tag-tooltip">{ tag.text }</div>}
              onMouseEnter={() => this.setState({highlightEntry: tag})}
              onMouseLeave={() => this.setState({highlightEntry: undefined})}
            >
              <div
                style={{
                  backgroundColor: RGBToHex(trackInfo.color, 0.5)
                }}
                className="asset-tag"
                key={`asset-tag-${i}`}
              >
                { tag.text }
              </div>
            </ToolTip>
          );
        });

        return (
          <div className="asset-category-tags-container" key={`asset-category-tags-${category}`}>
            <h3>{ FormatName(category) }</h3>
            <div className="asset-category-tags">
              { categoryTags }
            </div>
          </div>
        );
      })
    );

    return (
      <div className="asset-tags">
        { tags }
      </div>
    );
  }

  render() {
    const asset = this.props.videoStore.metadata.assets[this.props.assetKey];

    return (
      <div className="asset-info">
        { this.AssetImage(this.props.assetKey, asset) }
        { this.Tags(asset) }
      </div>
    );
  }
}

export default Asset;
