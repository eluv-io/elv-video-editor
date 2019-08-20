import React from "react";
import {inject, observer} from "mobx-react";
import {BackButton} from "../Components";

@inject("entry")
@observer
class Entry extends React.Component {
  Actions(playable) {
    return (
      <React.Fragment>
        <div className="entry-back">
          <BackButton onClick={this.props.entry.ClearSelectedEntry} />
        </div>
        <div>
          <button
            tabIndex={0}
            className="entry-play"
            onClick={this.props.entry.PlayCurrentEntry}
          >
            {playable ? "Play Segment" : ""}
          </button>
        </div>
      </React.Fragment>
    );
  }

  VttEntry(entry) {
    const cue = entry.entry;

    return (
      <div className="entry-details">
        { this.Actions(true) }

        <label>Text</label>
        <div>{cue.text}</div>

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
    );
  }

  TagEntry(entry) {
    return (
      <div className="entry-details">
        { this.Actions(true) }

        <label>Tag</label>
        <div>{entry.text}</div>

        <label>Start Time</label>
        <span>{`${entry.startTime.toFixed(3)} (${entry.startTimeSMPTE})`}</span>

        <label>End Time</label>
        <span>{`${entry.endTime.toFixed(3)} (${entry.endTimeSMPTE})`}</span>
      </div>
    );
  }

  OverlayEntry(entry) {
    return (
      <div className="entry-details">
        { this.Actions() }

        <label>Tag</label>
        <div>{entry.text}</div>

        <label>Confidence</label>
        <div>{entry.confidence.toFixed(3)}</div>

        <label>Bounding Box</label>
        <div></div>

        <div className="entry-details indented">
          <label>X1</label>
          <div>{entry.box.x1.toFixed(4)}</div>

          <label>Y1</label>
          <div>{entry.box.y1.toFixed(4)}</div>

          <label>X2</label>
          <div>{entry.box.x2.toFixed(4)}</div>

          <label>Y2</label>
          <div>{entry.box.y2.toFixed(4)}</div>
        </div>
      </div>
    );
  }

  RenderEntry(entry) {
    if(entry.entryType === "vtt") {
      return this.VttEntry(entry);
    } else if(entry.entryType === "overlay") {
      return this.OverlayEntry(entry);
    } else {
      return this.TagEntry(entry);
    }
  }

  render() {
    return (
      <div className="entry-container">
        { this.RenderEntry(this.props.entry.selectedEntry) }
      </div>
    );
  }
}

export default Entry;
