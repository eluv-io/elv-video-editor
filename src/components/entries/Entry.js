import React from "react";
import {inject, observer} from "mobx-react";
import {BackButton} from "../Components";
import {Input} from "../../utils/Utils";
import {onEnterPressed} from "elv-components-js";

@inject("video")
@inject("entry")
@observer
class EntryForm extends React.Component {
  constructor(props) {
    super(props);

    const entry = this.props.entry.SelectedEntry();

    this.state = {
      entryId: entry.entryId,
      text: entry.text,
      startTime: entry.startTime,
      endTime: entry.endTime,
      validText: true,
      validStartTime: true,
      validEndTime: true
    };

    this.HandleTextChange = this.HandleTextChange.bind(this);
    this.HandleStartTimeChange = this.HandleStartTimeChange.bind(this);
    this.HandleEndTimeChange = this.HandleEndTimeChange.bind(this);
    this.HandleSubmit = this.HandleSubmit.bind(this);
  }

  HandleTextChange(event) {
    const text = event.target.value;

    this.setState({
      text,
      validText: text.length > 0
    });
  }

  HandleStartTimeChange(event) {
    const startTime = parseFloat(event.target.value);

    let valid = startTime > 0 && startTime < this.props.video.duration;

    if(this.state.endTime) {
      valid = valid && startTime < this.state.endTime;
    }

    this.setState({
      startTime,
      validStartTime: valid
    });
  }

  HandleEndTimeChange(event) {
    const endTime = parseFloat(event.target.value);

    let valid = endTime > 0 && endTime < this.props.video.duration;

    if(this.state.startTime) {
      valid = valid && this.state.startTime < endTime;
    }

    this.setState({
      endTime,
      validEndTime: valid
    });
  }

  HandleSubmit() {
    if(!this.state.validText || !this.state.validStartTime || !this.state.validEndTime) {
      return;
    }

    this.props.entry.ModifyEntry({
      entryId: this.state.entryId,
      text: this.state.text,
      startTime: this.state.startTime,
      endTime: this.state.endTime
    });

    this.props.Back();
  }

  render() {
    const submittable = this.state.validText && this.state.validStartTime && this.state.validEndTime;

    return (
      <div className="entry-form">
        <div className="entry-details">
          <label>Text</label>
          <Input
            name="text"
            value={this.state.text}
            onChange={this.HandleTextChange}
            onKeyPress={onEnterPressed(this.HandleSubmit)}
            required
          />

          <label>Start Time</label>
          <Input
            type="number"
            name="startTime"
            value={this.state.startTime}
            onChange={this.HandleStartTimeChange}
            onKeyPress={onEnterPressed(this.HandleSubmit)}
            required
            className={this.state.validStartTime ? "" : "invalid"}
          />

          <label>End Time</label>
          <Input
            type="number"
            name="endTime"
            value={this.state.endTime}
            onChange={this.HandleEndTimeChange}
            onKeyPress={onEnterPressed(this.HandleSubmit)}
            required
            className={this.state.validEndTime ? "" : "invalid"}
          />
        </div>
        <div className="entry-actions-container">
          <button className={submittable ? "" : "invalid"} onClick={this.HandleSubmit}>
            Save
          </button>
        </div>
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
        <span>{`${cue.startTime} (${this.props.entry.TimeToSMPTE(entry.startTime)})`}</span>

        <label>End Time</label>
        <span>{`${cue.endTime} (${this.props.entry.TimeToSMPTE(entry.endTime)})`}</span>

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
        <div>{entry.text}</div>

        <label>Start Time</label>
        <span>{`${entry.startTime} (${this.props.entry.TimeToSMPTE(entry.startTime)})`}</span>

        <label>End Time</label>
        <span>{`${entry.endTime} (${this.props.entry.TimeToSMPTE(entry.endTime)})`}</span>
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
    const entry = this.props.entry.SelectedEntry();

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
    const entry = this.props.entry.SelectedEntry();
    const playable = ["vtt", "metadata"].includes(entry.entryType);
    const editable = ["metadata", "overlay"].includes(entry.entryType);
    const back = () => this.state.editing ? this.setState({editing: false}) : this.props.entry.ClearSelectedEntry();

    return (
      <div className="entry-actions-container">
        <BackButton onClick={back}/>
        <div className="entry-actions">
          <button
            hidden={!playable}
            tabIndex={0}
            onClick={this.props.entry.PlayCurrentEntry}
          >
            Play
          </button>
          <button
            hidden={!editable || this.state.editing}
            tabIndex={0}
            onClick={() => this.setState({editing: true})}
          >
            Edit
          </button>
          <button
            hidden={!editable}
            tabIndex={0}
            onClick={() => this.props.entry.DeleteEntry(entry.entryId)}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="entry-container">
        { this.Actions() }
        { this.state.editing ? <EntryForm Back={() => this.setState({editing: false})}/> : <Entry/> }
      </div>
    );
  }
}

export default EntryContainer;
