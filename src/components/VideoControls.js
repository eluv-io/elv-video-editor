import React from "react";
import PropTypes from "prop-types";
import Fraction from "fraction.js";
import FrameAccurateVideo, {FrameRates} from "../utils/FrameAccurateVideo";
import {IconButton} from "elv-components-js";

import PlayButton from "../static/icons/Play.svg";
import PauseButton from "../static/icons/Pause.svg";
import Maximize from "../static/icons/Maximize.svg";

import FrameForward from "../static/icons/Forward.svg";
import SecondForward from "../static/icons/DoubleForward.svg";
import FrameBackward from "../static/icons/Backward.svg";
import SecondBackward from "../static/icons/DoubleBackward.svg";

class VideoControls extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      frame: 0,
      progress: 0,
      playing: !this.props.video.paused,
      playbackRate: 1
    };

    this.UpdateFrame = this.UpdateFrame.bind(this);
    this.Seek = this.Seek.bind(this);
    this.Rate = this.Rate.bind(this);
    this.PlayPause = this.PlayPause.bind(this);
    this.Maximize = this.Maximize.bind(this);
    this.FrameControl = this.FrameControl.bind(this);
  }

  componentWillMount() {
    this.setState({
      videoHandler: new FrameAccurateVideo({
        video: this.props.video,
        frameRate: FrameRates.NTSC,
        callback: this.UpdateFrame
      })
    });

    const AppendVideoCallback = (event, callback) => {
      const existingCallback = this.props.video[event];
      this.props.video[event] = (e) => {
        if(existingCallback) {
          existingCallback(e);
        }

        callback(e);
      };
    };

    AppendVideoCallback("onpause", () => this.setState({playing: false}));
    AppendVideoCallback("onplay", () => this.setState({playing: true}));
    AppendVideoCallback("onratechange", () => this.setState({playbackRate: this.props.video.playbackRate}));
  }

  UpdateFrame({frame, smpte, progress}) {
    this.setState({
      frame,
      smpte,
      progress
    });
  }

  Rate() {
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
        value={this.state.playbackRate}
        onChange={event => this.props.video.playbackRate = event.target.value}
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
        value={(this.state.progress * scale) || 0}
        onChange={(event) => {
          this.state.videoHandler.SeekPercentage(Fraction(event.target.value).div(scale));
        }}
      />
    );
  }

  PlayPause() {
    return (
      <IconButton
        label={this.state.playing ? "Pause" : "Play"}
        icon={this.state.playing ? PauseButton : PlayButton}
        onClick={() => {
          this.props.video.paused ? this.props.video.play() : this.props.video.pause();
        }}
      />
    );
  }

  Maximize() {
    return (
      <IconButton
        label="Full Screen"
        icon={Maximize}
        onClick={() => {
          if (this.props.video.requestFullscreen) {
            this.props.video.requestFullscreen();
          } else if (this.props.video.mozRequestFullScreen) {
            this.props.video.mozRequestFullScreen();
          } else if (this.props.video.webkitRequestFullscreen) {
            this.props.video.webkitRequestFullscreen();
          } else if (this.props.video.msRequestFullscreen) {
            this.props.video.msRequestFullscreen();
          }
        }}
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
            frames = this.state.videoHandler.frameRate.ceil();
          }

          if(forward) {
            this.state.videoHandler.SeekForward(frames);
          } else {
            this.state.videoHandler.SeekBackward(frames);
          }
        }}
      />
    );
  }

  render() {
    return [
      <div key="video-time" className="mono video-time">{this.state.smpte}</div>,
      this.Seek(),
      <div key="video-controls" className="video-controls">
        <div className="controls left-controls">
          { this.Rate() }
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

VideoControls.propTypes = {
  video: PropTypes.instanceOf(Element).isRequired
};

export default VideoControls;
