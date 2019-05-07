import React from "react";
import PropTypes from "prop-types";
import TrackCanvas from "./TrackCanvas";
import {inject, observer} from "mobx-react";
import Fraction from "fraction.js";

@inject("video")
@observer
class Track extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      context: undefined,
      ref: React.createRef(),
      draw: undefined
    };
  }

  componentDidUpdate() {
    this.Draw();
  }

  Draw() {
    if(!this.state.context || !this.state.context.canvas) { return; }
    const context = this.state.context;
    const cues = this.props.track.cues;
    if(!cues) { return; }

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.beginPath();
    context.fillStyle = "#aaa";
    context.strokeStyle = "#fff";

    // How much of the duration of the video is currently visible
    const duration = Fraction(this.props.video.scaleMax - this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Where the currently visible segment starts
    const startOffset = Fraction(this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    const widthRatio = Fraction(context.canvas.offsetWidth).div(duration);
    const halfHeight = Fraction(context.canvas.offsetHeight).div(2);
    const quarterHeight = halfHeight.div(2);
    const startY = quarterHeight.valueOf();

    for(let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const startPixel = (Fraction(cue.startTime).sub(startOffset)).mul(widthRatio).floor().valueOf();
      const endPixel = (Fraction(cue.endTime).sub(startOffset)).mul(widthRatio).floor().valueOf();

      if(endPixel.valueOf() < 0 || startPixel.valueOf() > context.canvas.offsetWidth) {
        continue;
      }

      context.fillRect(startPixel, startY, endPixel - startPixel, halfHeight);
      context.rect(startPixel, startY, endPixel - startPixel, halfHeight);
      context.stroke();
    }
  }

  Canvas() {
    if(!this.state.ref.current) { return null; }

    return (
      <TrackCanvas
        SetRef={context => {
          context.canvas.width = this.state.ref.current.offsetWidth;
          this.setState({context});
        }}
      />
    );
  }

  render() {
    return (
      <div className="track-container" ref={this.state.ref}>
        <div hidden={true}>{this.props.video.scaleMin + this.props.video.scaleMax + this.props.video.scale + this.props.video.duration || 0}</div>
        { this.Canvas() }
      </div>
    );
  }
}

Track.propTypes = {
  track: PropTypes.object.isRequired,
  video: PropTypes.object
};

export default Track;
