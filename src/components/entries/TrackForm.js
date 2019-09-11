import React from "react";
import PropTypes from "prop-types";
import {Input} from "../../utils/Utils";
import {onEnterPressed} from "elv-components-js";
import {inject, observer} from "mobx-react";
import {Confirm} from "elv-components-js";

@inject("tracks")
@observer
class TrackForm extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      trackLabel: props.track.label,
      trackKey: props.track.key
    };

    this.HandleTextChange = this.HandleTextChange.bind(this);
    this.HandleSubmit = this.HandleSubmit.bind(this);
    this.HandleDelete = this.HandleDelete.bind(this);
  }

  HandleTextChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  HandleSubmit() {
    this.props.tracks.EditTrack({
      trackId: this.props.track.trackId,
      label: this.state.trackLabel,
      key: this.state.trackKey
    });
  }

  async HandleDelete() {
    await Confirm({
      message: "Are you sure you want to remove this track?",
      onConfirm: async () => {
        this.props.tracks.RemoveTrack(this.props.track.trackId);
      }
    });
  }

  render() {
    const submittable = this.state.trackLabel && this.state.trackKey;

    return (
      <div className="entry-form">
        <div className="entry-details">
          <label>Label</label>
          <Input
            name="trackLabel"
            value={this.state.trackLabel}
            onChange={this.HandleTextChange}
            onKeyPress={onEnterPressed(this.HandleSubmit)}
            required
          />

          <label>Metadata Key</label>
          <Input
            name="trackKey"
            value={this.state.trackKey}
            onChange={this.HandleTextChange}
            onKeyPress={onEnterPressed(this.HandleSubmit)}
            required
          />
        </div>
        <div className="entry-actions-container">
          <button className={submittable ? "" : "invalid"} onClick={this.HandleSubmit}>
            Done
          </button>
        </div>

        <div className="delete-button">
          <button onClick={this.HandleDelete}>
            Remove Track
          </button>
        </div>
      </div>
    );
  }
}

TrackForm.propTypes = {
  track: PropTypes.object.isRequired
};

export default TrackForm;
