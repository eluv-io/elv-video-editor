import React from "react";
import {inject, observer} from "mobx-react";
import {
  DropFrame,
  FrameControl,
  FrameRate,
  FullscreenToggle,
  PlaybackRate,
  PlayPause,
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
      <div key="video-controls" className={`video-controls ${this.props.video.fullScreen ? "video-controls-fullscreen" : ""}`}>
        <div className="controls left-controls">
          <PlaybackRate />
          <FrameRate />
          <DropFrame />
        </div>
        <div className="controls center-controls">
          <FrameControl label="Backward 1 Second" seconds={-1} icon={SecondBackward} />
          <FrameControl label="Backward 1 Frame" frames={-1} icon={FrameBackward} />
          <PlayPause />
          <FrameControl label="Forward 1 Frame" frames={1} icon={FrameForward} />
          <FrameControl label="Forward 1 Second" seconds={1} icon={SecondForward} />
        </div>
        <div className="controls right-controls">
          <Volume />
          <FullscreenToggle />
        </div>
      </div>
    );
  }

  render() {
    if(!this.props.video.initialized) { return null; }

    return [
      <div key="video-time" className="mono video-time">{Math.floor(this.props.video.frame) + " :: " + this.props.video.smpte}</div>,
      this.Controls(),
      this.Seek(),
      this.Scale()
    ];
  }
}

export default VideoControls;
