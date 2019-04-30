import React from "react";
import {inject, observer} from "mobx-react";
import Dash from "dashjs";
import VideoControls from "./VideoControls";

@inject("video")
@observer
class Video extends React.Component {
  constructor(props) {
    super(props);

    const url = "http://38.142.50.107/qlibs/ilib25dkW5Gp96LMxBcWnLks77tNtbT9/q/iq__3DW6PNhUTrabuBgZwzS3baDyUgrC/rep/dash/en/dash.mpd";
    const dashPlayer = Dash.MediaPlayer().create();
    dashPlayer.initialize(null, url, false);
    dashPlayer.preload();

    this.state = {
      dashPlayer
    };

    this.InitializeVideo = this.InitializeVideo.bind(this);
  }

  InitializeVideo(video) {
    this.state.dashPlayer.attachView(video);
    this.props.video.Initialize({video});
  }

  render() {
    const controls = this.props.video.initialized ? <VideoControls /> : null;

    return (
      <div className="video">
        <div className="video-container">
          <video
            ref={this.InitializeVideo}
            autoPlay={false}
            controls={false}
          />
        </div>
        { controls }
      </div>
    );
  }
}

export default Video;
