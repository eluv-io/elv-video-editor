import React from "react";
import {inject, observer} from "mobx-react";

@inject("entry")
@observer
class Entry extends React.Component {
  constructor(props) {
    super(props);

  }

  CueEntry() {
    const entry = this.props.entry.hoverEntry || this.props.entry.entry;
    const cue = entry.entry;

    return (
      <div className="entry-container">
        <h4>{entry.label} - WebVTT Cue</h4>

        <div className="entry">
          <label>ID</label>
          <span>{cue.id}</span>

          <label>Start Time</label>
          <span>{`${cue.startTime} (${entry.startTimeSMPTE})`}</span>

          <label>End Time</label>
          <span>{`${cue.endTime} (${entry.endTimeSMPTE})`}</span>

          <label>Align</label>
          <span>{cue.align}</span>

          <label>Line</label>
          <span>{cue.line}</span>

          <label>Line Align</label>
          <span>{cue.lineAlign}</span>

          <label>Position</label>
          <span>{cue.position}</span>

          <label>Position Align</label>
          <span>{cue.positionAlign}</span>

          <label>Region</label>
          <span>{cue.region}</span>

          <label>Size</label>
          <span>{cue.size}</span>

          <label>Snap to Lines</label>
          <span>{cue.snapToLines}</span>

          <label>Vertical</label>
          <span>{cue.vertical}</span>
        </div>
      </div>
    );
  }

  render() {
    if(!this.props.entry.entry) {
      return null;
    }

    return (
      <div className="side-panel">
        { this.CueEntry() }
      </div>
    );
  }
}

export default Entry;
