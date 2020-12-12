import React from "react";
import PropTypes from "prop-types";
import TrackCanvas from "./TrackCanvas";
import {inject, observer} from "mobx-react";
import {reaction, toJS} from "mobx";

import AudioTrackWorker from "../../workers/AudioTrackWorker";
import Fraction from "fraction.js/fraction";
import {StopScroll} from "../../utils/Utils";

@inject("videoStore")
@inject("entryStore")
@inject("tracksStore")
@observer
class AudioTrack extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      context: undefined,
      canvasHeight: 0,
      canvasWidth: 0
    };

    this.activeEntryIds = [];

    this.OnCanvasResize = this.OnCanvasResize.bind(this);
  }

  componentDidMount() {
    // Initialize reactionary re-draw handlers
    this.setState({
      reactions: [
        // Update on entries change
        reaction(
          () => ({
            version: this.props.track.version,
            entries: this.props.track.entries.length
          }),
          () => {
            this.state.worker.postMessage({
              operation: "SetEntries",
              trackId: this.props.track.trackId,
              entries: toJS(this.props.track.entries).flat()
            });
          },
          {delay: 500}
        ),
        // Update on scale change
        reaction(
          () => ({
            scale: 100,
            scaleMax: this.props.videoStore.scaleMax,
            scaleMin: this.props.videoStore.scaleMin,
            duration: this.props.videoStore.duration,
            max: this.props.track.max
          }),
          () => {
            this.state.worker.postMessage({
              operation: "SetScale",
              trackId: this.props.track.trackId,
              scale: {
                scale: 100,
                scaleMin: this.props.videoStore.scaleMin,
                scaleMax: this.props.videoStore.scaleMax,
              },
              duration: this.props.videoStore.duration,
              max: this.props.track.max
            });
          },
          {delay: 50}
        ),
        // Update on resize
        reaction(
          () => ({
            width: this.state.canvasWidth,
            height: this.state.canvasHeight
          }),
          ({width, height}) => {
            if(this.state.context) {
              this.state.context.canvas.width = width;
              this.state.context.canvas.height = height;

              this.state.worker.postMessage({
                operation: "Resize",
                trackId: this.props.track.trackId,
                width: this.state.canvasWidth,
                height: this.state.canvasHeight
              });
            }
          },
          {delay: 100}
        )
      ]
    });
  }

  componentWillUnmount() {
    (this.state.reactions || []).forEach(dispose => dispose());

    if(this.state.worker) {
      this.state.worker.postMessage({
        operation: "Destroy",
        trackId: this.props.track.trackId
      });
    }
  }

  // X position of mouse over canvas (as percent)
  ClientXToCanvasPosition(clientX) {
    return Fraction(clientX - this.state.context.canvas.offsetLeft).div(this.state.context.canvas.offsetWidth).valueOf();
  }

  OnCanvasResize({height, width}) {
    this.setState({
      canvasHeight: height,
      canvasWidth: width
    });
  }

  Canvas() {
    return (
      <TrackCanvas
        className="track"
        HandleResize={this.OnCanvasResize}
        SetRef={context => {
          this.setState({context});

          const worker = new AudioTrackWorker();

          worker.postMessage({
            operation: "Initialize",
            trackId: this.props.track.trackId,
            width: this.state.canvasWidth,
            height: this.state.canvasHeight,
            entries: toJS(this.props.track.entries).flat(),
            max: this.props.track.max,
            scale: {
              scale: 100,
              scaleMin: this.props.videoStore.scaleMin,
              scaleMax: this.props.videoStore.scaleMax
            },
            duration: this.props.videoStore.duration
          });

          // Paint image from worker
          worker.onmessage = e => {
            if(e.data.trackId !== this.props.track.trackId) {
              return;
            }

            const {data, width, height} = e.data.imageData;

            this.state.context.putImageData(
              new ImageData(data, width, height),
              0, 0,
              0, 0,
              width, height
            );
          };

          this.setState({worker});
        }}
      />
    );
  }

  render() {
    return (
      <div
        ref={StopScroll({shift: true})}
        onWheel={({deltaY, clientX, shiftKey}) => shiftKey && this.props.videoStore.ScrollScale(this.ClientXToCanvasPosition(clientX), deltaY)}
        className="track-container"
      >
        { this.Canvas() }
      </div>
    );
  }
}

AudioTrack.propTypes = {
  track: PropTypes.object.isRequired,
  entry: PropTypes.object
};

export default AudioTrack;
