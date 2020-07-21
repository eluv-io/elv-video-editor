import React from "react";
import PropTypes from "prop-types";
import ResizeObserver from "resize-observer-polyfill";

class TrackCanvas extends React.Component {
  shouldComponentUpdate() {
    return false;
  }

  constructor(props) {
    super(props);

    this.WatchResize = this.WatchResize.bind(this);
  }

  componentWillUnmount() {
    if(this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }

  // Keep track of track container height and track content width to properly render the time indicator
  WatchResize(element) {
    if(element) {
      this.resizeObserver = new ResizeObserver(entries => {
        const node = entries[0].target.parentNode;

        this.props.HandleResize({width: node.offsetWidth, height: node.offsetHeight});
      });

      this.resizeObserver.observe(element);
    }
  }

  render() {
    const otherProps = {...this.props};
    delete otherProps.SetRef;
    delete otherProps.HandleResize;

    return (
      <div ref={this.WatchResize} className="track-canvas-container">
        <canvas
          {...otherProps}
          width="50"
          height="50"
          className={this.props.className}
          ref={canvas => this.props.SetRef(canvas && canvas.getContext("2d"))}
        />
      </div>
    );
  }
}

TrackCanvas.propTypes = {
  SetRef: PropTypes.func.isRequired,
  HandleResize: PropTypes.func.isRequired
};

export default TrackCanvas;
