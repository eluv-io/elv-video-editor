import React from "react";
import PropTypes from "prop-types";
import TrackCanvas from "./TrackCanvas";
import {inject, observer} from "mobx-react";
import Fraction from "fraction.js";
import {reaction} from "mobx";

@inject("video")
@inject("tracks")
@observer
class AudioTrack extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      context: undefined
    };

    this.Draw = this.Draw.bind(this);
  }

  componentDidMount() {
    // Initialize reactionary re-draw handlers

    this.setState({
      // Draw reaction - Ensure canvas gets redrawn when state changes
      DisposeDrawReaction: reaction(
        () => ({
          entries: this.props.track.entries.length,
          duration: this.props.video.duration,
          scale: this.props.video.scale,
          scaleMax: this.props.video.scaleMax,
          scaleMin: this.props.video.scaleMin
        }),
        () => this.Draw(),
        {delay: 500}
      ),
      // Resize reaction: Ensure canvas dimensions are updated on resize
      DisposeResizeReaction: reaction(
        () => ({
          width: this.props.width,
          height: this.props.height
        }),
        ({width, height}) => {
          if (this.state.context && this.state.context.canvas) {
            this.state.context.canvas.width = width;
            this.state.context.canvas.height = height;

            this.Draw();
          }
        },
        {delay: 500}
      )
    });
  }

  componentWillUnmount() {
    this.state.DisposeDrawReaction();
    this.state.DisposeResizeReaction();
  }

  // X position of mouse over canvas (as percent)
  ClientXToCanvasPosition(clientX) {
    return Fraction(clientX - this.state.context.canvas.offsetLeft).div(this.state.context.canvas.offsetWidth).valueOf();
  }

  Draw() {
    if(!this.state.context || !this.state.context.canvas) {
      return;
    }

    const context = this.state.context;

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    // How much of the duration of the video is currently visible
    const duration = Fraction(this.props.video.scaleMax - this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    // Where the currently visible segment starts
    const startOffset = Fraction(this.props.video.scaleMin).div(this.props.video.scale).mul(this.props.video.duration);

    const widthRatio = Fraction(context.canvas.offsetWidth).div(duration);
    const height = context.canvas.offsetHeight;

    context.fillStyle = "#ffffff";
    context.strokeStyle = "#ffffff";

    const max = Math.max(...(this.props.track.entries.map(sample => sample.max)));
    const scale = 1 / (max * 1.1);

    this.props.track.entries.forEach(entry => {
      const startPixel = (Fraction(entry.startTime).sub(startOffset)).mul(widthRatio).floor().valueOf();
      const endPixel = (Fraction(entry.endTime).sub(startOffset)).mul(widthRatio).floor().valueOf();


      if(endPixel.valueOf() < 0 || startPixel.valueOf() > context.canvas.offsetWidth) {
        return;
      }

      const maxHeight = height * entry.max * scale;

      context.beginPath();
      context.fillRect(startPixel, height - maxHeight, endPixel - startPixel, maxHeight);
      context.stroke();
    });
  }

  Canvas() {
    return (
      <TrackCanvas
        className="track"
        SetRef={context => this.setState({context})}
      />
    );
  }

  render() {
    return (
      <div
        onWheel={({deltaY, clientX}) => this.props.video.ScrollScale(this.ClientXToCanvasPosition(clientX), deltaY)}
        className="track-container"
      >
        { this.Canvas() }
      </div>
    );
  }
}

AudioTrack.propTypes = {
  track: PropTypes.object.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  video: PropTypes.object
};

export default AudioTrack;
