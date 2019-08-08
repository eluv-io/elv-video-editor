import React from "react";
import { inject, observer } from "mobx-react";
import { Action } from "elv-components-js";

@inject("entry")
@observer
class Entry extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentEntry: 0
    };
  }

  Entries() {
    return this.props.entry.hoverEntries.length > 0 ?
      this.props.entry.hoverEntries : this.props.entry.entries;
  }

  EntryTime() {
    return this.props.entry.hoverEntries.length > 0 ?
      this.props.entry.hoverTime : this.props.entry.entryTime;
  }

  VttEntry(entry) {
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

  CustomEntry(entry) {
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

  OverlayEntry(entry) {
    return (
      <div className="entry-container">
        <h4>{entry.overlayTrack} - Overlay</h4>

        <div className="entry">
          <label>Label</label>
          <div>{entry.label}</div>

          <label>Confidence</label>
          <div>{entry.confidence.toFixed(3)}</div>

          <label>Bounding Box</label>
          <div></div>

          <div className="entry indented">
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
      </div>
    );
  }

  EntrySelection() {
    const previousButton = (
      <Action
        className="entry-page-button"
        disabled={this.state.currentEntry <= 0}
        onClick={() => this.setState({currentEntry: this.state.currentEntry - 1})}
      >
        Previous
      </Action>
    );

    const nextButton = (
      <Action
        className="entry-page-button"
        disabled={this.state.currentEntry >= this.Entries().length - 1}
        onClick={() => this.setState({currentEntry: this.state.currentEntry + 1})}
      >
        Next
      </Action>
    );

    return (
      <div className="entry-actions">
        { previousButton }
        <div className="entry-page">
          { `${this.state.currentEntry + 1} of ${this.Entries().length}` }
        </div>
        { nextButton }
      </div>
    );
  }

  RenderEntry(entry) {
    if(entry.entryType === "vtt") {
      return this.VttEntry(entry);
    } else if(entry.entryType === "overlay") {
      return this.OverlayEntry(entry);
    } else {
      return this.CustomEntry(entry);
    }
  }

  RenderEntries() {
    return (
      <div>
        { this.EntrySelection() }
        <div className="entry-time">
          { this.EntryTime() }
        </div>
        {
          this.Entries().map((entry, i) => (
            <div
              key={`entry-info-${i}`}
              className="entry-info-container"
              hidden={this.state.currentEntry !== i}
            >
              { this.RenderEntry(entry) }
            </div>
          ))
        }
      </div>
    );
  }

  render() {
    // Hide panel if no entry is selected
    if(this.props.entry.entries.length === 0) {
      return null;
    }

    return (
      <div className="side-panel">
        { this.RenderEntries() }
      </div>
    );
  }
}


// Container for Entry component to recreate component to reset page when entry changes
@inject("entry")
@observer
class EntryContainer extends React.Component {
  render() {
    if (!this.props.entry) {
      return null;
    }

    const entries = this.props.entry.entries.map(e => e.entryId).sort().toString();
    const hoverEntries = this.props.entry.hoverEntries.map(e => e.entryId).sort().toString();

    return <Entry key={`entry-${entries}-${hoverEntries}`} {...this.props} />;
  }
}


export default EntryContainer;
