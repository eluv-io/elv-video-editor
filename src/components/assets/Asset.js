import React, { useState } from "react";
import {inject, observer} from "mobx-react";
import Overlay from "../Overlay";

import Tiff from "tiff.js";
import {LoadingElement} from "elv-components-js";

const TiffImage = ({url, setRef}) => {
  let [canvas, setCanvas] = useState(undefined);
  let [loading, setLoading] = useState(true);

  const LoadTiff = async (canvas, retries=0) => {
    try {
      const tiffData = await (await fetch(url)).arrayBuffer();
      const tiff = new Tiff({buffer: tiffData});
      const width = tiff.width();
      const height = tiff.height();
      const image = tiff.toCanvas().getContext("2d").getImageData(0, 0, width, height);

      canvas.width = image.width;
      canvas.height = image.height;

      canvas.getContext("2d").putImageData(image, 0, 0);

      setLoading(false);
    } catch(error) {
      if(retries < 5) {
        // First time you load a TIFF on the page fails for some reason, retry a few times
        await new Promise(resolve => setTimeout(resolve, 1000));

        await LoadTiff(canvas, retries+1);
      } else {
        // eslint-disable-next-line no-console
        console.error("Failed to load tiff: ");
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }
  };

  return (
    <React.Fragment>
      <canvas
        className="tiff-canvas"
        ref={async element => {
          if(!element || canvas) { return; }

          setCanvas(element);

          await LoadTiff(element);

          if(setRef) {
            await new Promise(resolve => setTimeout(resolve, 250));

            setRef(element);
          }
        }}
      />
      { loading ? <LoadingElement loading /> : null }
    </React.Fragment>
  );
};

@inject("videoStore")
@observer
class Asset extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      imageElement: undefined
    };
  }

  AssetImage(assetKey, asset) {
    if(!(asset.attachment_content_type || "").toLowerCase().startsWith("image")) {
      return null;
    }

    const url = this.props.videoStore.AssetLink(assetKey);

    let image;
    if((asset.attachment_content_type || "").toLowerCase() === "image/tiff") {
      image = (
        <TiffImage
          url={url}
          setRef={element => {
            if(!element || this.state.imageElement) { return; }

            this.setState({imageElement: element});
          }}
        />
      );
    } else {
      image = (
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
    }

    return (
      <div className="asset-image-container">
        { image }
        { asset.image_tags && this.state.imageElement ?
          <Overlay element={this.state.imageElement} asset={asset} /> : null
        }
      </div>
    );
  }

  render() {
    const asset = this.props.videoStore.metadata.assets[this.props.assetKey];

    let additionalTags = [];
    Object.keys(asset.image_tags || {}).forEach(category => {
      if(!asset.image_tags[category].tags) { return; }

      asset.image_tags[category].tags.forEach(tag => {
        if(tag.box) { return; }

        additionalTags.push(tag.text);
      });
    });

    return (
      <div className="asset-info">
        { this.AssetImage(this.props.assetKey, asset) }
        {
          additionalTags.length === 0 ? null :
            <div className="additional-tags">
              <h3>Additional Tags</h3>
              { additionalTags.map((tag, i) => <div className="additional-tag" key={`tag-${i}`}>{ tag }</div>) }
            </div>
        }
      </div>
    );
  }
}

export default Asset;
