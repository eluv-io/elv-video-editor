import React from "react";
import {inject, observer} from "mobx-react";
import Dash from "dashjs";
import VideoControls from "./VideoControls";

@inject("video")
@observer
class Video extends React.Component {
  constructor(props) {
    super(props);

    //const url = "http://38.142.50.107/qlibs/ilib25dkW5Gp96LMxBcWnLks77tNtbT9/q/iq__3DW6PNhUTrabuBgZwzS3baDyUgrC/rep/dash/en/dash.mpd";
    //const url = "https://bitmovin-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd";
    //const url = "http://livesim.dashif.org/livesim/testpic_2s/Manifest_stpp.mpd";
    //const dashPlayer = Dash.MediaPlayer().create();
    //dashPlayer.initialize(null, url, false);
    //dashPlayer.preload();

    this.state = {
      //dashPlayer
    };

    this.InitializeVideo = this.InitializeVideo.bind(this);
  }

  InitializeVideo(video) {
    //this.state.dashPlayer.attachView(video);
    //this.props.video.volume = 0;
    this.props.video.Initialize({video});
  }

  render() {
    const controls = this.props.video.initialized ? <VideoControls /> : null;

    return (
      <div className="video">
        <div className="video-container">
          <video
            id="video"
            //src="http://brenopolanski.com/html5-video-webvtt-example/MIB2.webm"
            crossOrigin="anonymous"
            // 30 fps
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__GUow8e5MBR2Z1Kuu6fDSw2bYBZo/data/hqp_QmXHvrBRRJ3kbEvKgfqYytHX3Zg49sCXvcHAV7xvhta7mA"
            // 60 fps
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__3nvTFKUg32AfyG6MSc1LMtt4YGj5/data/hqp_Qmb1NZ5CMU6DXErMrHqt5RRvKKP5F5CfYT2oTfZoH1FwU8"
            // Non drop-frame 24000/1001
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__3LNTS4eA7LAygQee7MQ78k2ivvnC/data/hqp_QmS5PeFJFycWLMiADhb2Sv7SwHQWXCjEqmHEgYCRxZLWMw"
            // Non drop-frame 30000/1001
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__2wf1V2eo5QE5hsip7JHoByBnWahU/data/hqp_QmT4q6NaMBnATtWmSVjcHmc66m34wSEWbogzr2HW8A9UwT"
            // Drop frame 30000/1001
            //src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__2aF5AN7fStTc8XEwq9c1LRwbe4qw/data/hqp_Qmcdww5ssDf9yyvL81S7Tym4DUv8mJsPLxS4poXxp89Do7"
            ref={this.InitializeVideo}
            muted={true}
            autoPlay={false}
            controls={false}
            preload="auto"
            onWheel={({deltaY}) => this.props.video.ScrollVolume(deltaY)}
          >
            <source src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./ttml-example.mp4" type="video/mp4" />
            <track default={true} kind="subtitles" label="English" src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./webvtt-example.vtt" srcLang="English" />

            <source src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./with-subtitles.webm" type="video/webm" />
            <track default={true} kind="subtitles" label="pt" src="http://localhost:8008/qlibs/ilib2f4xqtz5RnovfF5ccDrPxjmP3ont/q/iq__4KrQ5km8o7GnD4kGQ6K4gSp5KSZY/files/./MIB2-subtitles-pt-BR.vtt" srcLang="pt" />
          </video>
        </div>
        { controls }
      </div>
    );
  }
}

export default Video;
