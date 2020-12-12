import React from "react";
import {inject, observer} from "mobx-react";
import {Range} from "elv-components-js";
import PreviewReel from "../PreviewReel";
import ResizeObserver from "resize-observer-polyfill";

@inject("clipStore")
@inject("clipVideoStore")
@inject("videoStore")
@observer
class ClipTimeline extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      height: 0,
      width: 0,
      left: 0
    };

    this.WatchResize = this.WatchResize.bind(this);
  }

  componentWillUnmount() {
    if(this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }

  WatchResize(element) {
    if(!element) { return; }

    this.resizeObserver = new ResizeObserver(entries => {
      const { width, height, left } = entries[0].target.getBoundingClientRect();
      this.setState({width, height, left});
    });

    this.resizeObserver.observe(element);
  }

  Clip({start, end}) {
    const range = this.props.clipStore.scaleEndFrame - this.props.clipStore.scaleStartFrame;
    const width = this.state.width * ((end - start) / range);
    const startPixel = this.state.width * ((start - this.props.clipStore.scaleStartFrame) / range);

    return (
      <div
        style={{
          left: startPixel,
          width
        }}
        className="clip-timeline-clip"
      >
        <div className={`clip-info ${width < 200 ? "clip-info-hidden" : ""}`}>
          <div className="clip-time">
            { this.props.videoStore.FrameToSMPTE(start) }
          </div>
          &nbsp; - &nbsp;
          <div className="clip-time">
            { this.props.videoStore.FrameToSMPTE(end) }
          </div>
        </div>
        <PreviewReel
          minFrame={start}
          maxFrame={end}
          RetrievePreview={() => "https://i.imgflip.com/oigoe.jpg"}
        />
      </div>
    );
  }

  render() {
    return (
      <div className="clip-timeline-container">
        <div className="clip-timeline" ref={this.WatchResize}>
          { this.Clip({start: 500, end: 2000}) }
          { this.Clip({start: 2100, end: 3000}) }
        </div>
        <Range
          marks={this.props.clipVideoStore.sliderMarks}
          markTextEvery={this.props.clipVideoStore.majorMarksEvery}
          showMarks
          handleControlOnly
          handles={[
            {
              position: this.props.clipStore.scaleMin,
              style: "circle"
            },
            {
              position: this.props.clipVideoStore.seek,
              disabled: true,
              className: "video-seek-handle",
              style: "arrow"
            },
            {
              position: this.props.clipStore.scaleMax,
              style: "circle"
            }
          ]}
          min={0}
          max={100}
          renderToolTip={value => <span>{this.props.clipStore.ProgressToSMPTE(value)}</span>}
          onChange={([scaleMin, seek, scaleMax]) => this.props.clipStore.SetScale(scaleMin, seek, scaleMax)}
          className="clip-timeline-scale"
        />
      </div>
    );
  }
}

export default ClipTimeline;
