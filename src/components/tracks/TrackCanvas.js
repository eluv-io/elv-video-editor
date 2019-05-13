import React from "react";
import PropTypes from "prop-types";

class TrackCanvas extends React.Component {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    const otherProps = {...this.props};
    delete otherProps.SetRef;

    return (
      <canvas
        {...otherProps}
        width="50"
        height="50"
        className={this.props.className}
        ref={canvas => this.props.SetRef(canvas && canvas.getContext("2d"))}
      />
    );
  }
}

TrackCanvas.propTypes = {
  SetRef: PropTypes.func.isRequired,
};

export default TrackCanvas;
