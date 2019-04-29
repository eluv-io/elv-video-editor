import React from "react";
import PropTypes from "prop-types";
import FrameAccurateVideo, {FrameRates} from "../utils/FrameAccurateVideo";
import {IconButton} from "elv-components-js";

import PlayButton from "../static/icons/Play.svg";
import PauseButton from "../static/icons/Pause.svg";

import FrameForward from "../static/icons/Forward.svg";
import SecondForward from "../static/icons/DoubleForward.svg";
import FrameBackward from "../static/icons/Backward.svg";
import SecondBackward from "../static/icons/DoubleBackward.svg";

class VideoControls extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      playing: !this.props.video.paused
    };

    this.UpdateFrame = this.UpdateFrame.bind(this);
    this.PlayPause = this.PlayPause.bind(this);
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

    const onPause = this.props.video.onpause;
    this.props.video.onpause = () => {
      if(onPause) {
        onPause();
      }

      this.setState({
        playing: false
      });
    };

    const onPlay = this.props.video.onplay;
    this.props.video.onplay = () => {
      if(onPlay) {
        onPlay();
      }

      this.setState({
        playing: true
      });
    };
  }

  UpdateFrame({frame, smpte}) {
    this.setState({
      frame,
      smpte
    });
  }

  PlayPause() {
    return (
      <IconButton
        icon={this.state.playing ? PauseButton : PlayButton}
        onClick={() => {
          this.props.video.paused ? this.props.video.play() : this.props.video.pause();
        }}
      />
    );
  }

  FrameControl(forward=true, frame=true) {
    let icon;
    if(forward) {
      if(frame) {
        icon = FrameForward;
      } else {
        icon = SecondForward;
      }
    } else {
      if(frame) {
        icon = FrameBackward;
      } else {
        icon = SecondBackward;
      }
    }

    return (
      <IconButton
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
      <div key="video-controls" className="video-controls">
        { this.FrameControl(false, false) }
        { this.FrameControl(false, true) }
        { this.PlayPause() }
        { this.FrameControl(true, true) }
        { this.FrameControl(true, false) }
      </div>
    ];
  }
}

VideoControls.propTypes = {
  video: PropTypes.instanceOf(Element).isRequired
};

export default VideoControls;
