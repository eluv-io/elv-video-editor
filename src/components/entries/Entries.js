import React from "react";
import PropTypes from "prop-types";
import {inject, observer} from "mobx-react";
import EntryDetails from "./Entry";
import EntryForm from "./EntryForm";
import {BackButton} from "../Components";
import PlayIcon from "../../static/icons/Play.svg";
import {IconButton, onEnterPressed} from "elv-components-js";
import {Input} from "../../utils/Utils";
import TrackForm from "./TrackForm";

@inject("video")
@inject("tracks")
@inject("entry")
@observer
class Entries extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      entryLimit: 100,
    };
  }

  Filter() {
    if(this.props.entry.selectedEntry) { return null; }

    return (
      <div className="entries-filter">
        <Input
          value={this.props.entry.filter}
          placeholder={"Filter..."}
          onChange={event => this.props.entry.SetFilter(event.target.value)}
        />
      </div>
    );
  }

  AddEntryButton() {
    if(
      this.props.track.trackType !== "metadata" ||
      this.props.tracks.editingTrack ||
      this.props.entry.editingEntry ||
      this.props.entry.selectedEntry
    ) {
      return null;
    }

    return (
      <div className="add-entry-button">
        <button onClick={this.props.entry.CreateEntry}>
          Add Tag
        </button>
      </div>
    );
  }

  Header() {
    const modifiable = this.props.track.trackType === "metadata";

    let header;
    if(this.props.track.trackType === "vtt") {
      header = <h4>{this.props.track.label} - WebVTT Track</h4>;
    } else {
      header = <h4>{this.props.track.label} - Metadata Track</h4>;
    }

    return (
      <div
        onClick={modifiable ? () => this.props.tracks.SetEditing(this.props.track.trackId) : undefined}
        tabIndex={modifiable ? 0 : undefined}
        className={`entries-header ${modifiable ? "modifiable" : ""}`}
      >
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
    const onClick = () => this.props.entry.SetSelectedEntry(entry.entryId);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyPress={onEnterPressed(onClick)}
        onMouseEnter={() => this.props.entry.SetHoverEntries([entry.entryId], entry.startTime)}
        onMouseLeave={() => this.props.entry.ClearHoverEntries()}
        className={`entry ${active ? "entry-active" : ""} ${hover ? "entry-hover" : ""}`}
        key={`entry-${entry.entryId}`}
      >
        <div className="entry-text">
          {entry.text}
        </div>
        <div className="entry-time-range">
          {this.props.entry.TimeToSMPTE(entry.startTime)} - {this.props.entry.TimeToSMPTE(entry.endTime)}
        </div>
        { this.PlayEntry(entry, playable) }
      </div>
    );
  }

  SelectedEntry() {
    if(this.props.entry.editingEntry) {
      return <EntryForm />;
    } else {
      return <EntryDetails/>;
    }
  }

  EntryList() {
    const entriesSelected = this.props.entry.entries.length > 0;
    const entryList = entriesSelected ?
      this.props.entry.Entries() :
      Object.values(this.props.track.entries);

    const entries = this.props.entry.FilteredEntries(entryList);
    const activeEntryIds = this.props.track.intervalTree.search(
      this.props.video.currentTime,
      this.props.video.currentTime
    );
    const hoverEntryIds = this.props.entry.hoverEntries;
    const playable = ["vtt", "metadata"].includes(this.props.track.trackType);

    let actions;
    if(entriesSelected) {
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
        { this.Filter() }
        { actions }
        { entries
          .slice(0, this.state.entryLimit)
          .map(entry =>
            this.Entry(
              entry,
              activeEntryIds.includes(entry.entryId),
              hoverEntryIds.includes(entry.entryId),
              playable
            )
          )}
        {loadMoreButton}
      </div>
    );
  }

  Content() {
    if(this.props.tracks.editingTrack) {
      return <TrackForm track={this.props.track} />;
    } else if(this.props.entry.selectedEntry) {
      return this.SelectedEntry();
    } else {
      return this.EntryList();
    }
  }

  render() {
    return (
      <div className="entries-container">
        { this.Header() }
        { this.AddEntryButton() }
        { this.Content() }
      </div>
    );
  }
}

Entries.propTypes = {
  track: PropTypes.object.isRequired
};

export default Entries;
