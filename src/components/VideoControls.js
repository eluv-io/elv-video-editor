import React from "react";
import {inject, observer} from "mobx-react";
import Fraction from "fraction.js";
import {IconButton} from "elv-components-js";

import PlayButton from "../static/icons/Play.svg";
import PauseButton from "../static/icons/Pause.svg";
import Maximize from "../static/icons/Maximize.svg";

import FrameForward from "../static/icons/Forward.svg";
import SecondForward from "../static/icons/DoubleForward.svg";
import FrameBackward from "../static/icons/Backward.svg";
import SecondBackward from "../static/icons/DoubleBackward.svg";

@inject("video")
@observer
class VideoControls extends React.Component {
  constructor(props) {
    super(props);

    this.Seek = this.Seek.bind(this);
    this.PlaybackRate = this.PlaybackRate.bind(this);
    this.PlayPause = this.PlayPause.bind(this);
    this.Maximize = this.Maximize.bind(this);
    this.FrameControl = this.FrameControl.bind(this);
  }

  PlaybackRate() {
    // TODO: Negative rates
    const rates = [
      0.1,
      0.25,
      0.5,
      0.75,
      1,
      2,
      4,
      8,
      16,
      32,
      64
    ];

    return (
      <select
        aria-label="Playback Rate"
        title="Playback Rate"
        className="video-playback-rate"
        value={this.props.video.playbackRate}
        onChange={event => this.props.video.SetPlaybackRate(event.target.value)}
      >
        {rates.map(rate =>
          <option key={`video-rate-${rate}`} value={rate}>{`${rate}X`}</option>
        )}
      </select>
    );
  }

  Seek() {
    const scale = 10000;
    return (
      <input
        key="video-progress"
        type="range"
        className="video-seek"
        min={0}
        max={scale}
        value={(this.props.video.progress * scale) || 0}
        onChange={(event) => this.props.video.Seek(Fraction(event.target.value).div(scale))}
      />
    );
  }

  PlayPause() {
    return (
      <IconButton
        label={this.props.video.playing ? "Pause" : "Play"}
        icon={this.props.video.playing ? PauseButton : PlayButton}
        onClick={this.props.video.PlayPause}
      />
    );
  }

  Maximize() {
    return (
      <IconButton
        label="Full Screen"
        icon={Maximize}
        onClick={this.props.video.ToggleFullscreen}
      />
    );
  }

  FrameControl(forward=true, frame=true) {
    let icon, label;
    if(forward) {
      if(frame) {
        icon = FrameForward;
        label = "Forward 1 Frame";
      } else {
        icon = SecondForward;
        label = "Forward 1 Second";
      }
    } else {
      if(frame) {
        icon = FrameBackward;
        label = "Backward 1 Frame";
      } else {
        icon = SecondBackward;
        label = "Backward 1 Second";
      }
    }

    return (
      <IconButton
        label={label}
        icon={icon}
        onClick={() => {
          let frames = 1;
          if(!frame) {
            frames = this.props.video.frameRate.ceil();
          }

          if(forward) {
            this.props.video.SeekForward(frames);
          } else {
            this.props.video.SeekBackward(frames);
          }
        }}
      />
    );
  }

  render() {
    return [
      <div key="video-time" className="mono video-time">{this.props.video.smpte}</div>,
      this.Seek(),
      <div key="video-controls" className="video-controls">
        <div className="controls left-controls">
          { this.PlaybackRate() }
        </div>
        <div className="controls center-controls">
          { this.FrameControl(false, false) }
          { this.FrameControl(false, true) }
          { this.PlayPause() }
          { this.FrameControl(true, true) }
          { this.FrameControl(true, false) }
        </div>
        <div className="controls right-controls">
          { this.Maximize() }
        </div>
      </div>
    ];
  }
}

export default VideoControls;
