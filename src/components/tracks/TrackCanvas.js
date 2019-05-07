import React from "react";
import PropTypes from "prop-types";

class TrackCanvas extends React.Component {
  shouldComponentUpdate(nextProps) {
    return this.props.width !== nextProps.width;
  }

  render() {
    return (
      <canvas
        width="50"
        height="30"
        className={this.props.className}
        ref={canvas => this.props.SetRef(canvas && canvas.getContext("2d"))}
      />
    );
  }
}

TrackCanvas.propTypes = {
  SetRef: PropTypes.func.isRequired
};

export default TrackCanvas;
