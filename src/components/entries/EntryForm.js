import React from "react";
import {inject, observer} from "mobx-react";
import {Confirm, IconButton, LabelledField, onEnterPressed, ToolTip} from "elv-components-js";
import ListField from "../../utils/ListField";

import ClockIcon from "../../static/icons/Clock.svg";
import MarkInIcon from "../../static/icons/marker-in.svg";
import MarkOutIcon from "../../static/icons/marker-out.svg";

@inject("videoStore")
@observer
class SMPTEInput extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      h: "00", m: "00", s: "00", f: "00",
      error: false
    };
  }

  componentDidMount() {
    this.Initialize();
  }

  componentDidUpdate(prevProps) {
    if(prevProps.value !== this.props.value) {
      this.Initialize();
    }
  }

  Initialize() {
    const [h, m, s, f] = this.props.videoStore.TimeToSMPTE(this.props.value).split(/[:;]/);

    this.setState({h, m, s, f});
  }

  SMTPE() {
    let smpte = `${this.state.h}:${this.state.m}:${this.state.s}`;
    smpte += this.props.videoStore.dropFrame ? `;${this.state.f}` : `:${this.state.f}`;
    return smpte;
  }

  Format() {
    try {
      const time = this.props.videoStore.SMPTEToTime(this.SMTPE()) + 0.01 / this.props.videoStore.frameRate;
      const [h, m, s, f] = this.props.videoStore.TimeToSMPTE(time).split(/[:;]/);

      this.setState({h, m, s, f});

      this.props.onChange(time);
    // eslint-disable-next-line no-empty
    } catch(error) {}
  }

  Update(key, value, format=false) {
    value = value.replace(/[^0-9]/, "");

    this.setState({
      [key]: value
    }, () => {

      try {
        this.props.videoStore.SMPTEToTime(this.SMTPE());
        this.setState({error: false});

        if(format) {
          this.Format();
        }
      } catch(error) {
        this.setState({error: true});
      }
    });
  }

  Input(name) {
    return (
      <input
        required
        value={this.state[name]}
        maxLength={2}
        onChange={event => this.Update(name, event.target.value)} onBlur={() => this.Format()}
        onKeyPress={onEnterPressed(() => this.Format())}
        onKeyDown={event => {
          if(event.key.toLowerCase() === "arrowdown") {
            this.Update(name, Math.max(0, parseInt(this.state[name]) - 1).toString(), true);
          } else if(event.key.toLowerCase() === "arrowup") {
            this.Update(name, (parseInt(this.state[name]) + 1).toString(), true);
          }
        }}
      />
    );
  }

  render() {
    return (
      <div className={`smpte-input ${this.state.error || this.props.error ? "error" : ""}`}>
        { this.Input("h") }
        <span className="colon">:</span>
        { this.Input("m") }
        <span className="colon">:</span>
        { this.Input("s") }
        <span className="colon">{ this.props.videoStore.dropFrame ? ";" : ":" }</span>
        { this.Input("f") }
      </div>
    );
  }
}

@inject("videoStore")
@inject("entryStore")
@observer
class EntryForm extends React.Component {
  constructor(props) {
    super(props);

    let entry = this.props.entryStore.SelectedEntry();
    const createForm = !entry;
    entry = entry || {};

    const startTime = entry.startTime === undefined ? props.videoStore.currentTime : entry.startTime;
    const endTime = entry.endTime === undefined ? props.videoStore.currentTime + 1 : entry.endTime;

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

  HandleTimeChange(name, value) {
    const Valid = time => time >= 0 && time <= this.props.videoStore.duration + 1;

    this.setState({
      [name]: parseFloat(value)
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

    this.props.entryStore.ModifyEntry({
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
        this.props.entryStore.RemoveEntry(this.state.entryId);
      }
    });
  }

  HandleCancel() {
    this.state.createForm ?
      this.props.entryStore.ClearSelectedEntry() :
      this.props.entryStore.ClearEditing();
  }

  CurrentTimeButton(name) {
    return (
      <ToolTip content="Set to current video time">
        <IconButton
          icon={ClockIcon}
          onClick={() => {
            const time = this.props.videoStore.FrameToTime(this.props.videoStore.frame);
            this.HandleTimeChange(name, time);
          }}
        />
      </ToolTip>
    );
  }

  render() {
    const submittable = this.state.validText && this.state.startTimeValid && this.state.endTimeValid;

    return (
      <div className="entry-form">
        <div className="entry-form-content">
          <ListField
            className="entry-text"
            name="Text"
            label="Text"
            values={this.state.textList}
            Update={(_, newValues) => this.setState({textList: newValues})}
          />

          <LabelledField label="Start Time">
            <div className="time-input">
              <SMPTEInput
                value={this.state.startTime}
                onChange={value => this.HandleTimeChange("startTime", value)}
                error={!this.state.startTimeValid}
              />
              { this.CurrentTimeButton("startTime") }
              <ToolTip content="Set to mark in">
                <IconButton
                  icon={MarkInIcon}
                  onClick={() => {
                    const time = this.props.videoStore.FrameToTime(this.props.videoStore.clipInFrame);
                    this.HandleTimeChange("startTime", time);
                  }}
                />
              </ToolTip>
            </div>
          </LabelledField>

          <LabelledField label="End Time">
            <div className="time-input">
              <SMPTEInput
                value={this.state.endTime}
                onChange={value => this.HandleTimeChange("endTime", value)}
                error={!this.state.endTimeValid}
              />
              { this.CurrentTimeButton("endTime") }
              <ToolTip content="Set to mark out">
                <IconButton
                  icon={MarkOutIcon}
                  onClick={() => {
                    const time = this.props.videoStore.FrameToTime(this.props.videoStore.clipOutFrame);
                    this.HandleTimeChange("endTime", time);
                  }}
                />
              </ToolTip>
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
