import React, {useState} from "react";
import {inject, observer} from "mobx-react";
import {BackButton} from "../Components";
import {Confirm, IconButton, ToolTip} from "elv-components-js";

import PlayIcon from "../../static/icons/Play.svg";
import EditIcon from "../../static/icons/Edit.svg";
import DeleteIcon from "../../static/icons/trash.svg";

const DownloadButton = ({Download}) => {
  const [progress, setProgress] = useState({bytesFinished: 0, bytesTotal: 1});
  const [downloading, setDownloading] = useState(false);

  if(!downloading) {
    return (
      <ToolTip content="Download">
        <button
          tabIndex={0}
          onClick={() => {
            setDownloading(true);
            Download({callback: setProgress});
          }}
        >
          Download
        </button>
      </ToolTip>
    );
  } else {
    return (
      <div className="progress-bar-container">
        <div className="progress-bar" style={{width: `${progress.bytesFinished * 100 / progress.bytesTotal}%`}} />
      </div>
    );
  }
};

@inject("entryStore")
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
        this.props.entryStore.RemoveEntry(this.props.entryStore.selectedEntry);
      }
    });
  }

  Actions(entry) {
    const playable = ["vtt", "metadata", "clip", "segment"].includes(entry.entryType);
    const editable = !entry.content && ["metadata", "overlay", "clip"].includes(entry.entryType);
    const downloadable = ["segment"].includes(entry.entryType);

    return (
      <div className="entry-actions-container">
        <BackButton onClick={this.props.entryStore.ClearSelectedEntry}/>
        <div className="entry-actions">
          <ToolTip content="Play Tag">
            <IconButton
              icon={PlayIcon}
              hidden={!playable}
              tabIndex={0}
              onClick={this.props.entryStore.PlayCurrentEntry}
            >
              Play
            </IconButton>
          </ToolTip>
          <ToolTip content="Edit Tag">
            <IconButton
              icon={EditIcon}
              hidden={!editable}
              tabIndex={0}
              onClick={() => this.props.entryStore.SetEditing(entry.entryId)}
            >
              Edit
            </IconButton>
          </ToolTip>
          <ToolTip content="Remove Tag">
            <IconButton
              icon={DeleteIcon}
              hidden={!editable}
              tabIndex={0}
              onClick={this.HandleDelete}
            >
              Remove
            </IconButton>
          </ToolTip>
          {
            downloadable ?
              <DownloadButton key={`download-${entry.entryId}`} Download={({callback}) => this.props.entryStore.DownloadSegment(entry.entryId, callback)} /> :
              null
          }
        </div>
      </div>
    );
  }

  EntryContent(entry) {
    let content;
    if(entry.content) {
      content = <pre>{ JSON.stringify(entry.content, null, 2) }</pre>;
    } else if(entry.textList) {
      content = <div>{ entry.textList.join(", ") }</div>;
    }

    return content;
  }

  VttEntry(entry) {
    const cue = entry.entry;

    return (
      <div className="entry-details">
        <label>Content</label>
        { this.EntryContent(cue)}

        <label>Start Time</label>
        <span>{ this.props.entryStore.TimeToSMPTE(entry.startTime) }</span>

        <label>End Time</label>
        <span>{ this.props.entryStore.TimeToSMPTE(entry.endTime) }</span>

        <label>Duration</label>
        <span>{ this.props.entryStore.TimeToSMPTE(entry.endTime - entry.startTime) }</span>

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
        <label>Content</label>
        { this.EntryContent(entry)}

        <label>Start Time</label>
        <span>{ this.props.entryStore.TimeToSMPTE(entry.startTime) }</span>

        <label>End Time</label>
        <span>{ this.props.entryStore.TimeToSMPTE(entry.endTime) }</span>

        <label>Duration</label>
        <span>{ this.props.entryStore.TimeToSMPTE(entry.endTime - entry.startTime) }</span>
      </div>
    );
  }

  OverlayEntry(entry) {
    return (
      <div className="entry-details">
        <label>Content</label>
        { this.EntryContent(entry)}

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
    const entry = this.props.entryStore.SelectedEntry();

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
