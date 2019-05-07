import React from "react";
import {inject, observer} from "mobx-react";
import {IconButton} from "elv-components-js";
import {FrameRates} from "../utils/FrameAccurateVideo";
import {Slider} from "./Slider";

import PlayButton from "../static/icons/Play.svg";
import PauseButton from "../static/icons/Pause.svg";
import Maximize from "../static/icons/Maximize.svg";

import FrameForward from "../static/icons/Forward.svg";
import SecondForward from "../static/icons/DoubleForward.svg";
import FrameBackward from "../static/icons/Backward.svg";
import SecondBackward from "../static/icons/DoubleBackward.svg";

import VolumeLow from "../static/icons/VolumeLow.svg";
import VolumeHigh from "../static/icons/VolumeHigh.svg";
import VolumeOff from "../static/icons/VolumeOff.svg";

@inject("video")
@observer
class VideoControls extends React.Component {
  constructor(props) {
    super(props);

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
          <option key={`video-rate-${rate}`} value={rate}>{`${rate}x`}</option>
        )}
      </select>
    );
  }

  FrameRate() {
    return (
      <select
        aria-label="Frame Rate"
        title="Frame Rate"
        value={this.props.video.frameRateKey}
        onChange={event => this.props.video.SetFrameRate(event.target.value)}
      >
        {Object.keys(FrameRates).map(frameRateKey =>
          <option key={`frame-rate-${frameRateKey}`} value={frameRateKey}>{frameRateKey}</option>
        )}
      </select>
    );
  }

  DropFrame() {
    if(this.props.video.frameRateKey !== "NTSC" && this.props.video.frameRateKey !== "NTSCHD") {
      return null;
    }

    return (
      <select
        aria-label="Drop Frame Notation"
        title="Drop Frame Notation"
        value={this.props.video.dropFrame}
        onChange={event => this.props.video.SetDropFrame(event.target.value === "true")}
      >
        <option value={false}>NDF</option>
        <option value={true}>DF</option>
      </select>
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

  Volume() {
    const icon = (this.props.video.muted || this.props.video.volume === 0) ? VolumeOff :
      this.props.video.volume < (this.props.video.scale / 2) ? VolumeLow : VolumeHigh;

    return (
      <div
        onWheel={({deltaY}) => this.props.video.ScrollVolume(deltaY)}
        className="video-volume-controls"
      >
        <IconButton
          icon={icon}
          onClick={() => this.props.video.SetMuted(!this.props.video.muted)}
          className="video-volume-icon"
        />
        <Slider
          min={0}
          max={this.props.video.scale}
          value={this.props.video.muted ? 0 : this.props.video.volume}
          tipFormatter={value => `${Math.floor((value / this.props.video.scale) * 100)}%`}
          onChange={(volume) => this.props.video.SetVolume(volume)}
        />
      </div>
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

  Controls() {
    return (
      <div key="video-controls" className="video-controls">
        <div className="controls left-controls">
          { this.PlaybackRate() }
          { this.FrameRate() }
          { this.DropFrame() }
        </div>
        <div className="controls center-controls">
          { this.FrameControl(false, false) }
          { this.FrameControl(false, true) }
          { this.PlayPause() }
          { this.FrameControl(true, true) }
          { this.FrameControl(true, false) }
        </div>
        <div className="controls right-controls">
          { this.Volume() }
          { this.Maximize() }
        </div>
      </div>
    );
  }

  render() {
    return [
      <div key="video-time" className="mono video-time">{Math.floor(this.props.video.frame) + " :: " + this.props.video.smpte}</div>,
      this.Controls(),
    ];
  }
}

export default VideoControls;
