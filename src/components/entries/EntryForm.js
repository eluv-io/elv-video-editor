import React from "react";
import {inject, observer} from "mobx-react";
import {Input} from "../../utils/Utils";
import {Confirm, IconButton, LabelledField, onEnterPressed} from "elv-components-js";
import ClockIcon from "../../static/icons/Clock.svg";
import ListField from "../../utils/ListField";

@inject("video")
@inject("entry")
@observer
class EntryForm extends React.Component {
  constructor(props) {
    super(props);

    let entry = this.props.entry.SelectedEntry();
    const createForm = !entry;
    entry = entry || {};

    const startTime = entry.startTime === undefined ? props.video.currentTime : entry.startTime;
    const endTime = entry.endTime === undefined ? props.video.currentTime + 1 : entry.endTime;

    this.state = {
      createForm,
      entryId: entry.entryId,
      textList: entry.textList || [],
      startTime,
      startTimeValid: true,
      endTime,
      endTimeValid: true,
      validText: true,
    };

    this.HandleTimeChange = this.HandleTimeChange.bind(this);
    this.HandleSubmit = this.HandleSubmit.bind(this);
    this.HandleDelete = this.HandleDelete.bind(this);
    this.HandleCancel = this.HandleCancel.bind(this);
  }

  HandleTimeChange(event) {
    const Valid = time => time >= 0 && time <= this.props.video.duration + 1;

    this.setState({
      [event.target.name]: parseFloat(event.target.value)
    }, () => {
      // Update time validity
      if(this.state.startTime >= this.state.endTime) {
        this.setState({
          startTimeValid: false,
          endTimeValid: false,
        });
      } else {
        this.setState({
          startTimeValid: Valid(this.state.startTime),
          endTimeValid: Valid(this.state.endTime)
        });
      }
    });
  }

  HandleSubmit() {
    if(!this.state.validText || !this.state.startTimeValid || !this.state.endTimeValid) {
      return;
    }

    this.props.entry.ModifyEntry({
      entryId: this.state.entryId,
      textList: this.state.textList,
      startTime: this.state.startTime,
      endTime: this.state.endTime
    });
  }

  async HandleDelete() {
    await Confirm({
      message: "Are you sure you want to remove this tag?",
      onConfirm: async () => {
        this.props.entry.RemoveEntry(this.state.entryId);
      }
    });
  }

  HandleCancel() {
    this.state.createForm ?
      this.props.entry.ClearSelectedEntry() :
      this.props.entry.ClearEditing();
  }

  CurrentTimeButton(name) {
    return (
      <IconButton
        icon={ClockIcon}
        label="Set to current video time"
        onClick={() => {
          const time = this.props.video.FrameToTime(this.props.video.frame);
          this.HandleTimeChange({target: {name, value: time}});
        }}
      />
    );
  }

  render() {
    const submittable = this.state.validText && this.state.startTimeValid && this.state.endTimeValid;

    return (
      <div className="entry-form">
        <div className="entry-form-content">
          <ListField
            name="Text"
            label="Text"
            values={this.state.textList}
            Update={(_, newValues) => this.setState({textList: newValues})}
          />

          <LabelledField label="Start Time">
            <div className="time-input">
              <Input
                type="number"
                step={0.000001}
                name="startTime"
                value={this.state.startTime}
                onChange={this.HandleTimeChange}
                onKeyPress={onEnterPressed(this.HandleSubmit)}
                required
                className={this.state.startTimeValid ? "" : "invalid"}
              />
              <div className="entry-form-smpte-time">{ this.props.video.TimeToSMPTE(this.state.startTime) }</div>
              { this.CurrentTimeButton("startTime") }
            </div>
          </LabelledField>

          <LabelledField label="End Time">
            <div className="time-input">
              <Input
                type="number"
                step={0.000001}
                name="endTime"
                value={this.state.endTime}
                onChange={this.HandleTimeChange}
                onKeyPress={onEnterPressed(this.HandleSubmit)}
                required
                className={this.state.endTimeValid ? "" : "invalid"}
              />
              <div className="entry-form-smpte-time">{ this.props.video.TimeToSMPTE(this.state.endTime) }</div>
              { this.CurrentTimeButton("endTime") }
            </div>
          </LabelledField>
        </div>
        <div className="entry-actions-container">
          <button className="cancel-button" onClick={this.HandleCancel}>
            Cancel
          </button>
          <button className={submittable ? "" : "invalid"} onClick={this.HandleSubmit}>
            Done
          </button>
        </div>
      </div>
    );
  }
}

export default EntryForm;
