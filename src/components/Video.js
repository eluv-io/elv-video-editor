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
    //this.props.video.volume = 0;
    this.props.video.Initialize({video});
  }

  render() {
    const controls = this.props.video.initialized ? <VideoControls /> : null;

    return (
      <div className="video">
        <div className="video-container">
          <video
            // 30 fps
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__GUow8e5MBR2Z1Kuu6fDSw2bYBZo/data/hqp_QmXHvrBRRJ3kbEvKgfqYytHX3Zg49sCXvcHAV7xvhta7mA"
            // 60 fps
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__3nvTFKUg32AfyG6MSc1LMtt4YGj5/data/hqp_Qmb1NZ5CMU6DXErMrHqt5RRvKKP5F5CfYT2oTfZoH1FwU8"
            // Non drop-frame 24000/1001
            src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__3LNTS4eA7LAygQee7MQ78k2ivvnC/data/hqp_QmS5PeFJFycWLMiADhb2Sv7SwHQWXCjEqmHEgYCRxZLWMw?authorization=eyJxc3BhY2VfaWQiOiJpc3BjNE1Iak5ibUZ5ODF0U1dSTDVSQkRUc01QUDRwWiIsInFsaWJfaWQiOiJpbGliMmY0eHF0ejVSbm92ZkY1Y2NEclB4am1QM29udCIsImFkZHIiOiIweDI2MTg5YzIxZTgzODdiOWM1MEI3ODBiOTFDZTAxMmZmNjc2ZWIwNTAiLCJ0eGlkIjoiMHg1YjZjZmNlY2YxMWQxY2YwZmYzOTMwMWE1MzU0ZWE3ODBjZTIzNThlNDA0Mzk2NDc1ZDRjYjYzZGJmODE5NGNlIn0%3D.U0lHTkFUVVJF"
            // Non drop-frame 30000/1001
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__2wf1V2eo5QE5hsip7JHoByBnWahU/data/hqp_QmT4q6NaMBnATtWmSVjcHmc66m34wSEWbogzr2HW8A9UwT"
            // Drop frame 30000/1001
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__2aF5AN7fStTc8XEwq9c1LRwbe4qw/data/hqp_Qmcdww5ssDf9yyvL81S7Tym4DUv8mJsPLxS4poXxp89Do7"
            ref={this.InitializeVideo}
            muted={true}
            autoPlay={false}
            controls={false}
            onWheel={({deltaY}) => this.props.video.ScrollVolume(deltaY)}
          />
        </div>
        { controls }
      </div>
    );
  }
}

export default Video;
