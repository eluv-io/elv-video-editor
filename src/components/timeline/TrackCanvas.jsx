import React from "react";
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
      <div ref={this.WatchResize} className={this.props.className || ""}>
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

export default TrackCanvas;
