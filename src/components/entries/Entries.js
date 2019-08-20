import React from "react";
import PropTypes from "prop-types";
import {inject, observer} from "mobx-react";
import EntryDetails from "./Entry";
import {BackButton} from "../Components";

import PlayIcon from "../../static/icons/Play.svg";
import {IconButton, onEnterPressed} from "elv-components-js";

@inject("video")
@inject("entry")
@observer
class Entries extends React.Component {
  constructor(props) {
    super(props);

    // TODO: reaction to set limit back to 100
    this.state = {
      entryLimit: 100
    };
  }

  Entries() {
    if(this.props.entry.entries.length > 0) {
      return this.props.entry.entries;
    }

    const minTime = this.props.video.scaleMinTime;
    const maxTime = this.props.video.scaleMaxTime;

    return (
      this.props.track.entries
        .filter(({startTime, endTime}) =>
          endTime >= minTime && startTime <= maxTime
        )
    );
  }

  Header() {
    let header;
    if(this.props.track.trackType === "vtt") {
      header = <h4>{this.props.track.label} - WebVTT Track</h4>;
    } else {
      header = <h4>{this.props.track.label} - Metadata Track</h4>;
    }

    return (
      <div className="entries-header">
        { header }
        <div className="entries-time-range">
          {this.props.video.scaleMinSMPTE} - {this.props.video.scaleMaxSMPTE}
        </div>
      </div>
    );
  }

  PlayEntry(entry, playable) {
    if(!playable) { return; }

    return (
      <IconButton
        className="entry-play-icon"
        label="Play Segment"
        icon={PlayIcon}
        onClick={event => {
          event.stopPropagation();
          this.props.entry.PlayEntry(entry);
        }}
      />
    );
  }

  Entry(entry, active, hover, playable=false) {
    const onClick = () => this.props.entry.SetSelectedEntry(entry);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyPress={onEnterPressed(onClick)}
        onMouseEnter={() => this.props.entry.SetHoverEntries([entry], entry.startTime)}
        onMouseLeave={() => this.props.entry.ClearHoverEntries()}
        className={`entry ${active ? "entry-active" : ""} ${hover ? "entry-hover" : ""}`}
        key={`entry-${entry.entryId}`}
      >
        <div className="entry-text">
          {entry.text}
        </div>
        <div className="entry-time-range">
          {entry.startTimeSMPTE} - {entry.endTimeSMPTE}
        </div>
        { this.PlayEntry(entry, playable) }
      </div>
    );
  }

  SelectedEntry() {
    return <EntryDetails />;
  }

  EntryList() {
    const entries = this.Entries();
    const activeEntries = this.props.track.intervalTree.search(
      this.props.video.currentTime,
      this.props.video.currentTime
    )
      .map(entry => entry.entryId);
    const hoverEntries = this.props.entry.hoverEntries.map(entry => entry.entryId);
    const playable = ["vtt", "metadata"].includes(this.props.track.trackType);


    let actions;
    if(this.props.entry.entries.length > 0) {
      actions = (
        <div className="entry-actions">
          <BackButton onClick={this.props.entry.ClearEntries}/>
          { this.props.entry.entryTime }
        </div>
      );
    }

    let loadMoreButton;
    if(entries.length > this.state.entryLimit) {
      loadMoreButton = (
        <div className="entry">
          <div className="load-entries-button" onClick={() => this.setState({entryLimit: this.state.entryLimit + 100})}>
            Load More...
          </div>
        </div>
      );
    }

    return (
      <div className="entries">
        { actions }
        { entries
          .slice(0, this.state.entryLimit)
          .map(entry =>
            this.Entry(
              entry,
              activeEntries.includes(entry.entryId),
              hoverEntries.includes(entry.entryId),
              playable
            )
          )}
        {loadMoreButton}
      </div>
    );
  }

  render() {
    return (
      <div className="entries-container">
        { this.Header() }
        { this.props.entry.selectedEntry ? this.SelectedEntry() : this.EntryList() }
      </div>
    );
  }
}

Entries.propTypes = {
  track: PropTypes.object.isRequired
};

export default Entries;
