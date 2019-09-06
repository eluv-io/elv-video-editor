import React from "react";
import {inject, observer} from "mobx-react";
import {BackButton} from "../Components";
import {Input} from "../../utils/Utils";

@inject("entry")
@observer
class EntryForm extends React.Component {
  render() {
    const entry = this.props.entry.SelectedEntry();
    //const entry = this.props.entry.selectedEntry;

    return (
      <div className="entry-details">
        <label>Tag</label>
        <Input
          onChange={event => this.props.entry.ModifyEntry(entry.entryId, "text", event.target.value)}
          value={entry.text}
        />

        <label>Start Time</label>
        <Input value={entry.startTimeSMPTE} />

        <label>End Time</label>
        <Input value={entry.endTimeSMPTE} />
      </div>
    );
  }
}

@inject("entry")
@observer
class Entry extends React.Component {
  VttEntry(entry) {
    const cue = entry.entry;

    return (
      <div className="entry-details">
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
        <label>Tag</label>
        <div>{entry.text} {entry.entryId}</div>

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

  render() {
    const entry = this.props.entry.selectedEntry;

    if(entry.entryType === "vtt") {
      return this.VttEntry(entry);
    } else if(entry.entryType === "overlay") {
      return this.OverlayEntry(entry);
    } else {
      return this.TagEntry(entry);
    }
  }
}

@inject("entry")
@observer
class EntryContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      editing: false
    };
  }

  Actions() {
    const playable = ["vtt", "metadata"].includes(this.props.entry.selectedEntry.entryType);
    const editable = ["metadata", "overlay"].includes(this.props.entry.selectedEntry.entryType);
    const back = () => this.state.editing ? this.setState({editing: false}) : this.props.entry.ClearSelectedEntry();

    return (
      <div className="entry-actions-container">
        <BackButton onClick={back}/>
        <div className="entry-actions">
          <button
            hidden={!editable || this.state.editing}
            tabIndex={0}
            onClick={() => this.setState({editing: true})}
          >
            Edit
          </button>
          <button
            hidden={!playable}
            tabIndex={0}
            onClick={this.props.entry.PlayCurrentEntry}
          >
            Play
          </button>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="entry-container">
        { this.Actions() }
        { this.state.editing ? <EntryForm/> : <Entry/> }
      </div>
    );
  }
}

export default EntryContainer;
