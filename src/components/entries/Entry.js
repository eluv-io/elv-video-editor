import React, {useState} from "react";
import {inject, observer} from "mobx-react";
import {BackButton} from "../Components";
import {Confirm} from "elv-components-js";

const DownloadButton = ({Download}) => {
  const [progress, setProgress] = useState({bytesFinished: 0, bytesTotal: 1});
  const [downloading, setDownloading] = useState(false);

  if(!downloading) {
    return (
      <button
        tabIndex={0}
        onClick={() => {
          setDownloading(true);
          Download({callback: setProgress});
        }}
      >
        Download
      </button>
    );
  } else {
    return (
      <div className="progress-bar-container">
        <div className="progress-bar" style={{width: `${progress.bytesFinished * 100 / progress.bytesTotal}%`}} />
      </div>
    );
  }
};

@inject("entry")
@observer
class Entry extends React.Component {
  constructor(props) {
    super(props);

    this.HandleDelete = this.HandleDelete.bind(this);
  }

  async HandleDelete() {
    await Confirm({
      message: "Are you sure you want to remove this tag?",
      onConfirm: async () => {
        this.props.entry.RemoveEntry(this.props.entry.selectedEntry);
      }
    });
  }

  Actions(entry) {
    const playable = ["vtt", "metadata", "clip", "segment"].includes(entry.entryType);
    const editable = ["metadata", "overlay", "clip"].includes(entry.entryType);
    const downloadable = ["segment"].includes(entry.entryType);

    return (
      <div className="entry-actions-container">
        <BackButton onClick={this.props.entry.ClearSelectedEntry}/>
        <div className="entry-actions">
          <button
            hidden={!playable}
            tabIndex={0}
            onClick={this.props.entry.PlayCurrentEntry}
          >
            Play
          </button>
          <button
            hidden={!editable}
            tabIndex={0}
            onClick={() => this.props.entry.SetEditing(entry.entryId)}
          >
            Edit
          </button>
          <button
            hidden={!editable}
            tabIndex={0}
            onClick={this.HandleDelete}
          >
            Remove
          </button>
          {
            downloadable ?
              <DownloadButton key={`download-${entry.entryId}`} Download={({callback}) => this.props.entry.DownloadSegment(entry.entryId, callback)} /> :
              null
          }
        </div>
      </div>
    );
  }

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

  Content(entry) {
    if(entry.entryType === "vtt") {
      return this.VttEntry(entry);
    } else if(entry.entryType === "overlay") {
      return this.OverlayEntry(entry);
    } else {
      return this.TagEntry(entry);
    }
  }

  render() {
    const entry = this.props.entry.SelectedEntry();

    if(!entry) { return null; }

    return (
      <div className="entry-container">
        { this.Actions(entry) }
        { this.Content(entry) }
      </div>
    );
  }
}

export default Entry;
