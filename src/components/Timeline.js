import React from "react";
import {inject, observer} from "mobx-react";
import Track from "./tracks/Track";
import {Range, Slider} from "./Slider";
import Fraction from "fraction.js/fraction";

@inject("video")
@observer
class Timeline extends React.Component {
  constructor(props) {
    super(props);
  }

  static TrackLane({label, content, key, active=false, onLabelClick}) {
    return (
      <div key={`track-lane-${key || label}`} className="track-lane">
        <div
          onClick={onLabelClick}
          className={`track-label ${active ? "track-label-active" : ""} ${onLabelClick ? "track-label-clickable" : ""}`}
        >
          {label}
        </div>
        { content }
      </div>
    );
  }

  Seek() {
    const scale = this.props.video.scale;

    // Make marks with SMPTE timestamps along the seek bar
    const nMarks = 10;
    const marks = {};
    if(this.props.video.duration) {
      const visibleScale = this.props.video.scaleMax - this.props.video.scaleMin;
      const step = visibleScale / nMarks;
      const startMark = this.props.video.scaleMin + visibleScale / (nMarks * 2);

      for (let i = startMark; i < this.props.video.scaleMax; i += step) {
        marks[i] = this.props.video.ProgressToSMPTE(i);
      }
    }

    return (
      <Slider
        key="video-progress"
        min={this.props.video.scaleMin}
        max={this.props.video.scaleMax}
        marks={marks}
        value={this.props.video.seek}
        tipFormatter={value => this.props.video.ProgressToSMPTE(value)}
        onChange={(value) => this.props.video.Seek(Fraction(value).div(scale))}
        className="video-seek"
      />
    );
  }

  Scale() {
    return (
      <Range
        key="video-scale"
        min={0}
        max={this.props.video.scale}
        value={[this.props.video.scaleMin, this.props.video.seek, this.props.video.scaleMax]}
        allowCross={false}
        tipFormatter={value => this.props.video.ProgressToSMPTE(value)}
        onChange={([scaleMin, seek, scaleMax]) => this.props.video.SetScale(scaleMin, seek, scaleMax)}
        className="video-scale"
      />
    );
  }

  Tracks() {
    return (
      <div className="tracks-container">
        {this.props.video.tracks.slice()
          .sort((a, b) => a.label > b.label ? 1 : -1)
          .map(track => {
            const toggle = () => this.props.video.ToggleTrack(track.label);

            return (
              Timeline.TrackLane({
                label: track.label,
                content: <Track track={track}/>,
                active: track.active,
                onLabelClick: toggle
              })
            );
          })
        }
      </div>
    );
  }

  render() {
    if(!this.props.video.initialized) { return null; }

    return (
      <div className="timeline">
        {Timeline.TrackLane({content: this.Seek(), key: "seek"})}
        {Timeline.TrackLane({content: <div className="video-seek-steps" /> , key: "seek-steps"})}
        {this.Tracks()}
        {Timeline.TrackLane({content: this.Scale(), key: "scale"})}
      </div>
    );
  }
}

export default Timeline;
