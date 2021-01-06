import React from "react";
import {inject, observer} from "mobx-react";
import {
  ClipIn,
  ClipOut,
  ClipSeek,
  DropFrame,
  FrameControl,
  FrameRate,
  FullscreenToggle,
  PlaybackLevel,
  PlaybackRate,
  PlayPause, SaveClip,
  SaveFrame,
  Scale,
  Volume
} from "./controls/Controls";
import FrameForward from "../static/icons/Forward.svg";
import SecondForward from "../static/icons/DoubleForward.svg";
import FrameBackward from "../static/icons/Backward.svg";
import SecondBackward from "../static/icons/DoubleBackward.svg";

@inject("videoStore")
@inject("clipVideoStore")
@observer
class VideoControls extends React.Component {
  Store() {
    return this.props.clip ? this.props.clipVideoStore : this.props.videoStore;
  }

  Seek() {
    if(!this.Store().fullScreen) { return null; }

    return <ClipSeek clip={this.props.clip} />;
  }

  Scale() {
    if(!this.Store().fullScreen) { return null; }

    return <Scale clip={this.props.clip} />;
  }

  Controls() {
    return (
      <div className="video-controls">
        <div className="controls left-controls">
          <div className="top-controls">
            <ClipIn clip={this.props.clip} />
            <ClipOut clip={this.props.clip} />
            { this.props.clippable ? <SaveClip clip={this.props.clip} /> : null }
          </div>
          <div className="bottom-controls">
            <PlaybackRate clip={this.props.clip} />
            <FrameRate clip={this.props.clip} />
            <DropFrame clip={this.props.clip} />
            <PlaybackLevel clip={this.props.clip} />
          </div>
        </div>
        <div className="controls center-controls">
          <div className="center-top-controls">
            <div className="mono video-time">{this.Store().smpte}</div>
          </div>
          <div className="center-bottom-controls">
            <FrameControl clip={this.props.clip} label="Backward 1 Second" seconds={-1} icon={SecondBackward} />
            <FrameControl clip={this.props.clip} label="Backward 1 Frame" frames={-1} icon={FrameBackward} />
            <PlayPause clip={this.props.clip} />
            <FrameControl clip={this.props.clip} label="Forward 1 Frame" frames={1} icon={FrameForward} />
            <FrameControl clip={this.props.clip} label="Forward 1 Second" seconds={1} icon={SecondForward} />
          </div>
        </div>
        <div className="controls right-controls">
          <div className="top-controls">
          </div>
          <div className="bottom-controls">
            <Volume clip={this.props.clip} />
            <FullscreenToggle clip={this.props.clip} />
            <SaveFrame clip={this.props.clip} />
          </div>
        </div>
      </div>
    );
  }

  render() {
    if(!this.Store().initialized) { return null; }

    return (
      <div className={`video-controls-container ${this.Store().fullScreen ? "fullscreen" : ""}`}>
        { this.Controls() }
        { this.Seek() }
        { this.Scale() }
      </div>
    );
  }
}

export default VideoControls;
