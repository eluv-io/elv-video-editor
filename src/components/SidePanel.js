import React from "react";
import {ResizableBox} from "react-resizable";
import Entries from "./entries/Entries";
import {inject, observer} from "mobx-react";

@inject("tracks")
@observer
class SidePanel extends React.Component {
  Entries() {
    if(!this.props.tracks.selectedTrack) { return null; }

    const track = this.props.tracks.SelectedTrack();

    return <Entries track={track} key={`entries-${track.trackId}`}/>;
  }

  render() {
    return (
      <ResizableBox
        className={`side-panel ${this.props.tracks.selectedTrack ? "" : "hidden"}`}
        height={Infinity}
        width={500}
        handle={<div className="resize-handle"/>}
      >
        <div className="side-panel-content">
          { this.Entries() }
        </div>
      </ResizableBox>
    );
  }
}

export default SidePanel;
