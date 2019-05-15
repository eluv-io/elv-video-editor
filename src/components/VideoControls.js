import React from "react";
import {inject, observer} from "mobx-react";
import {
  DropFrame,
  FrameControl,
  FrameRate,
  Maximize,
  PlaybackRate,
  PlayPause,
  Scale,
  Seek,
  Volume
} from "./controls/Controls";

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
          <FrameControl forward={false} frame={false} />
          <FrameControl forward={false} frame={true} />
          <PlayPause />
          <FrameControl forward={true} frame={true} />
          <FrameControl forward={true} frame={false} />
        </div>
        <div className="controls right-controls">
          <Volume />
          <Maximize />
        </div>
      </div>
    );
  }

  render() {
    return [
      <div key="video-time" className="mono video-time">{Math.floor(this.props.video.frame) + " :: " + this.props.video.smpte}</div>,
      this.Controls(),
      this.Seek(),
      this.Scale()
    ];
  }
}

export default VideoControls;
