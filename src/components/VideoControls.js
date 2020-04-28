import React from "react";
import {inject, observer} from "mobx-react";
import {
  DropFrame,
  FrameControl,
  FrameRate,
  FullscreenToggle,
  PlaybackLevel,
  PlaybackRate,
  PlayPause,
  SaveFrame,
  Scale,
  Seek,
  Volume
} from "./controls/Controls";
import FrameForward from "../static/icons/Forward.svg";
import SecondForward from "../static/icons/DoubleForward.svg";
import FrameBackward from "../static/icons/Backward.svg";
import SecondBackward from "../static/icons/DoubleBackward.svg";

@inject("video")
@observer
class VideoControls extends React.Component {
  Seek() {
    if(!this.props.video.fullScreen) { return null; }

    return <Seek />;
  }

  Scale() {
    if(!this.props.video.fullScreen) { return null; }

    return <Scale />;
  }

  Controls() {
    return (
      <div className="video-controls">
        <div className="controls left-controls">
          <PlaybackRate />
          <FrameRate />
          <DropFrame />
        </div>
        <div className="controls center-controls">
          <div className="center-top-controls">
            <div className="mono video-time">{this.props.video.smpte}</div>
          </div>
          <div className="center-bottom-controls">
            <FrameControl label="Backward 1 Second" seconds={-1} icon={SecondBackward} />
            <FrameControl label="Backward 1 Frame" frames={-1} icon={FrameBackward} />
            <PlayPause />
            <FrameControl label="Forward 1 Frame" frames={1} icon={FrameForward} />
            <FrameControl label="Forward 1 Second" seconds={1} icon={SecondForward} />
          </div>
        </div>
        <div className="controls right-controls">
          <PlaybackLevel />
          <Volume />
          <FullscreenToggle />
          <SaveFrame />
        </div>
      </div>
    );
  }

  render() {
    if(!this.props.video.initialized) { return null; }

    return (
      <div className={`video-controls-container ${this.props.video.fullScreen ? "fullscreen" : ""}`}>
        { this.Controls() }
        { this.Scale() }
        { this.Seek() }
      </div>
    );
  }
}

export default VideoControls;
