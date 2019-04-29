import React from "react";
import Dash from "dashjs";
import VideoControls from "./VideoControls";

class Video extends React.PureComponent {
  constructor(props) {
    super(props);

    const url = "http://38.142.50.107/qlibs/ilib25dkW5Gp96LMxBcWnLks77tNtbT9/q/iq__3DW6PNhUTrabuBgZwzS3baDyUgrC/rep/dash/en/dash.mpd";
    const dashPlayer = Dash.MediaPlayer().create();
    dashPlayer.initialize(null, url, false);
    dashPlayer.preload();

    this.state = {
      dashPlayer,
      videoRef: React.createRef()
    };

    this.InitializeVideo = this.InitializeVideo.bind(this);
  }

  InitializeVideo(video) {
    this.state.dashPlayer.attachView(video);

    this.setState({
      video
    });
  }

  render() {
    const controls = this.state.video ? <VideoControls video={this.state.video} /> : null;

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
