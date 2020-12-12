import React from "react";
import {inject, observer} from "mobx-react";
import PropTypes from "prop-types";
import ResizeObserver from "resize-observer-polyfill";
import {ImageIcon} from "elv-components-js";

import ClipIcon from "../static/icons/film.svg";

@inject("videoStore")
@inject("tracksStore")
@observer
class PreviewReel extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      height: 0,
      width: 0,
      left: 0
    };

    this.WatchResize = this.WatchResize.bind(this);
  }

  componentWillUnmount() {
    if(this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }

  WatchResize(element) {
    if(!element) { return; }

    this.resizeObserver = new ResizeObserver(entries => {
      const { width, height, left } = entries[0].target.getBoundingClientRect();
      this.setState({width, height, left});
    });

    this.resizeObserver.observe(element);
  }

  PreviewImages() {
    if(this.state.width === 0 || this.state.height === 0) {
      return;
    }

    // Based on height, how many 16:9 images can we fit?
    const imageWidth = this.state.height * 16 / 9;
    const imageCount = Math.ceil(this.state.width / imageWidth);

    return [...new Array(imageCount)].map((_, index) => {
      const startPixel = this.state.left + imageWidth * index;
      const startFraction = startPixel / this.state.width;
      const startFrame = Math.floor(this.props.minFrame + startFraction * (this.props.maxFrame - this.props.minFrame));

      return (
        <div
          style={{
            minWidth: imageWidth,
            maxWidth: imageWidth,
            minHeight: this.state.height,
            maxHeight: this.state.height
          }}
          key={`preview-image-${index}`}
          className="preview-reel-image-container"
        >
          <ImageIcon
            icon={this.props.RetrievePreview(startFrame) || ClipIcon}
            alternateIcon={ClipIcon}
            className="preview-reel-image"
          />
        </div>
      );
    });
  }

  render() {
    if(typeof this.props.minFrame === "undefined" || typeof this.props.maxFrame === "undefined") { return null; }

    return (
      <div
        ref={this.WatchResize}
        className={`preview-reel ${this.props.className || ""}`}
      >
        { this.PreviewImages() }
      </div>
    );
  }
}

PreviewReel.propTypes = {
  minFrame: PropTypes.number,
  maxFrame: PropTypes.number,
  RetrievePreview: PropTypes.func.isRequired,
  className: PropTypes.string
};

export default PreviewReel;
