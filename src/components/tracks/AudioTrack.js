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
        {delay: 250}
      ),
      // Resize reaction: Ensure canvas dimensions are updated on resize
      DisposeResizeReaction: reaction(
        () => ({
          width: this.props.width,
          height: this.props.height
        }),
        ({width, height}) => {
          if(this.state.context && this.state.context.canvas) {
            this.state.context.canvas.width = width;
            this.state.context.canvas.height = height;

            this.Draw();
          }
        },
        {delay: 250}
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
    const halfHeight = context.canvas.offsetHeight * 0.5;

    context.fillStyle = "#ffffff";
    context.strokeStyle = "#ffffff";

    const minTime = this.props.video.ScaleMinTime();
    const maxTime = this.props.video.ScaleMaxTime();

    const entries = this.props.track.entries
      .filter(entry => entry.startTime >= minTime && entry.endTime <= maxTime);

    const scale = 1 / (this.props.track.max * 1.1);

    for(let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const nextEntry = i === (entries.length - 1) ? entry : entries[i+1];

      const startX = (Fraction(entry.startTime).sub(startOffset)).mul(widthRatio).floor().valueOf();
      const endX = (Fraction(entry.endTime).sub(startOffset)).mul(widthRatio).floor().valueOf();

      const startY = (halfHeight * entry.max * scale);
      const endY = (halfHeight * nextEntry.max * scale);

      context.beginPath();

      context.moveTo(startX, halfHeight + startY);
      context.lineTo(endX, halfHeight + endY);
      context.lineTo(endX, halfHeight - endY);
      context.lineTo(startX, halfHeight - startY);
      context.closePath();
      context.fill();
    }
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
