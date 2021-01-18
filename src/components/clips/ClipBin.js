import React, { useState } from "react";
import {inject, observer} from "mobx-react";
import {ImageIcon, onEnterPressed, ToolTip} from "elv-components-js";

import EditIcon from "../../static/icons/Edit.svg";
import ClipIcon from "../../static/icons/film.svg";

const ClipLabel = ({label, editable=false, Update}) => {
  const [editing, SetEditing] = useState(false);
  const [newLabel, SetNewLabel] = useState(label);

  if(!editable) {
    return <div className="clip-label">{ label }</div>;
  }

  if(editing) {
    return (
      <div className="clip-label">
        <input
          draggable={false}
          value={newLabel}
          onChange={event => SetNewLabel(event.target.value)}
          onDragStart={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
          onKeyPress={onEnterPressed(() => {
            Update(newLabel);
            SetEditing(false);
          })}
        />
      </div>
    );
  }

  return (
    <div className="clip-label">
      { label }
      <ToolTip content="Edit Clip Label">
        <ImageIcon
          className="clip-label-edit"
          icon={EditIcon}
          onClick={() => SetEditing(true)}
        />
      </ToolTip>
    </div>
  );
};

@inject("clipStore")
@inject("videoStore")
@observer
class ClipBin extends React.Component {
  Clip(clip) {
    const image =  "https://i.imgflip.com/oigoe.jpg";

    const selected = this.props.clipStore.selectedClipId === clip.clipBinId;
    return (
      <div
        draggable
        onClick={event => {
          event.stopPropagation();
          this.props.clipStore.SelectClip(clip.clipBinId);
        }}
        onDragStart={() => this.props.clipStore.HoldClip(clip)}
        onDragEnd={() => setTimeout(this.props.clipStore.ReleaseClip, 100)}
        className={`clip ${selected ? "selected" : ""}`}
        key={`clip-${clip.clipBinId}`}
      >
        <div className="clip-preview-container">
          <ImageIcon draggable={false} icon={image || ClipIcon} alternateIcon={ClipIcon} className="clip-preview" />
        </div>
        <div className="clip-info">
          <ClipLabel label={clip.label} key={`clip-label-${selected}`} editable={selected} Update={this.props.clipStore.UpdateSelectedClipLabel} />
          <div className="clip-label clip-smpte-label">
            { this.props.videoStore.FrameToSMPTE(clip.start) }
            &nbsp; - &nbsp;
            { this.props.videoStore.FrameToSMPTE(clip.end) }
          </div>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div
        className="clip-bin-container"
        onClick={() => this.props.clipStore.ClearSelectedClip()}
        onDragOver={event => event.preventDefault()}
        onDrop={() => {
          if(!this.props.clipStore.heldClip) { return; }

          this.props.clipStore.SaveClip({start: this.props.clipStore.heldClip.start, end: this.props.clipStore.heldClip.end});
        }}
      >
        <div className="clip-bin">
          { this.props.clipStore.clipBin.length === 0 ? <div className="drop-hint">Saved Clips</div> : null }
          { this.props.clipStore.clipBin.map(clip => this.Clip(clip)) }
        </div>
      </div>
    );
  }
}

export default ClipBin;
