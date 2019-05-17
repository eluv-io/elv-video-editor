import React from "react";
import {inject, observer} from "mobx-react";

@inject("entry")
@observer
class Entry extends React.Component {
  Entry() {
    return this.props.entry.hoverEntry || this.props.entry.entry;
  }

  VttEntry() {
    const entry = this.Entry();
    const cue = entry.entry;

    return (
      <div className="entry-container">
        <h4>{entry.label} - WebVTT Cue</h4>

        <div className="entry">
          <label>Text</label>
          <div>{cue.text}</div>

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

  CustomEntry() {
    const entry = this.Entry();

    return (
      <div className="entry-container">
        <h4>{entry.label}</h4>

        <div className="entry">
          { entry.text ? <label>Text</label> : null }
          { entry.text ? <div>{entry.text}</div> : null }

          <label>Start Time</label>
          <span>{`${entry.startTime.toFixed(3)} (${entry.startTimeSMPTE})`}</span>

          <label>End Time</label>
          <span>{`${entry.endTime.toFixed(3)} (${entry.endTimeSMPTE})`}</span>
        </div>
      </div>
    );
  }

  render() {
    // Hide panel if no entry is selected
    if(!this.props.entry.entry) {
      return null;
    }

    const entry = this.Entry();

    return (
      <div className="side-panel">
        { entry.vttEntry ? this.VttEntry() : this.CustomEntry() }
      </div>
    );
  }
}

export default Entry;
