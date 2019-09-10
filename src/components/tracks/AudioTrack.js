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
      context: undefined,
      canvasHeight: 0,
      canvasWidth: 0
    };

    this.OnCanvasResize = this.OnCanvasResize.bind(this);
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
          width: this.state.canvasWidth,
          height: this.state.canvasHeight
        }),
        ({width, height}) => {
          if(this.state.context) {
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

  OnCanvasResize({height, width}) {
    this.setState({
      canvasHeight: height,
      canvasWidth: width
    });
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

    context.fillStyle = "#acacac";
    context.strokeStyle = "#acacac";

    const minTime = this.props.video.ScaleMinTime();
    const maxTime = this.props.video.ScaleMaxTime();

    let minStartTime = Infinity;
    let maxEndTime = -Infinity;

    let entries = this.props.track.entries
      .flat()
      .filter(entry => entry.startTime >= minTime && entry.endTime <= maxTime);

    // If scale is large and there are many entries, skip some entries
    // based on number of entries relative to rendered range on canvas
    entries.forEach(entry => {
      if(entry.startTime < minStartTime) { minStartTime = entry.startTime; }
      if(entry.endTime > maxEndTime) { maxEndTime = entry.endTime; }
    });

    const entryRatio = (maxEndTime - minStartTime) / (maxTime - minTime);
    const renderEvery = Math.floor(entries.length * entryRatio / (this.state.canvasWidth * 2)) || 1;

    const scale = 1 / (this.props.track.max * 1.1);

    context.beginPath();
    for(let i = 0; i < entries.length; i++) {
      if(renderEvery > 1 && i % renderEvery !== 0) {
        continue;
      }

      const entry = entries[i];
      const entryWidth = (entry.endTime - entry.startTime) * renderEvery + (renderEvery > 2 ? 1 : 0);
      const nextEntry = i < entries.length - 1 ? entries[i + 1] : entry;

      const startX = Math.floor((entry.startTime - startOffset) * widthRatio);
      const endX = Math.floor((entry.startTime + entryWidth - startOffset) * widthRatio);

      const startY = Math.floor(halfHeight * entry.max * scale);
      const endY = Math.floor(halfHeight * nextEntry.max * scale);

      context.moveTo(startX, halfHeight + startY);
      context.lineTo(endX, halfHeight + endY);
      context.lineTo(endX, halfHeight - endY);
      context.lineTo(startX, halfHeight - startY);
    }

    context.closePath();
    context.fill();
  }

  Canvas() {
    return (
      <TrackCanvas
        className="track"
        HandleResize={this.OnCanvasResize}
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
  video: PropTypes.object
};

export default AudioTrack;
