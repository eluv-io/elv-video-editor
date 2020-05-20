import React from "react";
import PropTypes from "prop-types";
import {inject, observer} from "mobx-react";
import EntryDetails from "./Entry";
import EntryForm from "./EntryForm";
import {BackButton} from "../Components";
import {IconButton, ImageIcon, onEnterPressed} from "elv-components-js";
import {Input} from "../../utils/Utils";
import TrackForm from "./TrackForm";

import PlayIcon from "../../static/icons/Play.svg";
import EditIcon from "../../static/icons/Edit.svg";

@inject("video")
@inject("tracks")
@inject("entry")
@observer
class EntryList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      entryStart: 0,
      entryEnd: 100,
      initialElementEntryId: undefined
    };
  }

  componentDidMount() {
    // Scroll to current time on mount - determine which entry is 'current'
    const entries = this.FilteredEntries();
    const initialElementIndex = entries
      .findIndex(entry => entry.endTime > this.props.video.currentTime);

    if(initialElementIndex >= 0) {
      const initialElementEntryId = entries[initialElementIndex].entryId;
      const end = 100 * (Math.floor(initialElementIndex / 100) + 1);
      const start = end - 100;
      this.setState({
        initialElementEntryId,
        entryStart: start,
        entryEnd: end
      });
    }
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

  FilteredEntries() {
    const entriesSelected = this.props.entry.entries.length > 0;
    const entryList = entriesSelected ?
      this.props.entry.Entries() :
      Object.values(this.props.tracks.TrackEntries(this.props.track.trackId));

    return this.props.entry.FilteredEntries(entryList);
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

    // Scroll to current time on mount
    let HandleScroll;
    if(this.state.initialElementEntryId && entry.entryId === this.state.initialElementEntryId) {
      HandleScroll = element => {
        if(!element) { return; }

        this.setState({initialElementEntryId: undefined});

        element.parentNode.scroll(0, Math.max(0, element.offsetTop - 10));
      };
    }

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
        ref={HandleScroll}
      >
        <div className="entry-text">
          {entry.text} {entry.entryId}
        </div>
        <div className="entry-time-range">
          {this.props.entry.TimeToSMPTE(entry.startTime)} - {this.props.entry.TimeToSMPTE(entry.endTime)}
        </div>
        { this.PlayEntry(entry, playable) }
      </div>
    );
  }

  render() {
    const entries = this.FilteredEntries();
    const activeEntryIds = this.props.tracks.TrackEntryIntervalTree(this.props.track.trackId).search(
      this.props.video.currentTime,
      this.props.video.currentTime
    );
    const hoverEntryIds = this.props.entry.hoverEntries;
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

    let loadPreviousButton;
    if(this.state.entryStart > 0) {
      loadPreviousButton = (
        <div className="entry">
          <div className="load-entries-button" onClick={() => this.setState({entryStart: Math.max(0, this.state.entryStart - 100)})}>
            Load Previous...
          </div>
        </div>
      );
    }

    let loadNextButton;
    if(entries.length > this.state.entryEnd) {
      loadNextButton = (
        <div className="entry">
          <div className="load-entries-button" onClick={() => this.setState({entryEnd: this.state.entryEnd + 100})}>
            Load More...
          </div>
        </div>
      );
    }

    return (
      <div className="entries">
        { this.Filter() }
        { actions }
        { loadPreviousButton }
        { entries
          .slice(this.state.entryStart, this.state.entryEnd)
          .map(entry =>
            this.Entry(
              entry,
              activeEntryIds.includes(entry.entryId),
              hoverEntryIds.includes(entry.entryId),
              playable
            )
          )}
        { loadNextButton }
      </div>
    );
  }
}

@inject("video")
@inject("tracks")
@inject("entry")
@observer
class Entries extends React.Component {
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
    const editable = this.props.track.trackType === "metadata";

    let header = <h4>{this.props.track.label} - Track</h4>;
    switch(this.props.track.trackType) {
      case "audio":
        header = <h4>{this.props.track.label} - Audio Track</h4>;
        break;
      case "clip":
        header = <h4>{this.props.track.label} (Trim Playout)</h4>;
        break;
      case "metadata":
        header = <h4>{this.props.track.label} - Metadata Track</h4>;
        break;
      case "preview":
        header = <h4>{this.props.track.label} - Preview Track</h4>;
        break;
      case "segments":
        header = <h4>{this.props.track.label}</h4>;
        break;
      case "vtt":
        header = <h4>{this.props.track.label} - WebVTT Track</h4>;
        break;
    }

    return (
      <div
        onClick={editable ? () => this.props.tracks.SetEditing(this.props.track.trackId) : undefined}
        tabIndex={editable ? 0 : undefined}
        className={`entries-header ${editable ? "modifiable" : ""}`}
      >
        { header }
        <div className="entries-time-range">
          {this.props.video.scaleMinSMPTE} - {this.props.video.scaleMaxSMPTE}
        </div>
        { editable ? <ImageIcon className="track-edit-icon" icon={EditIcon} /> : null }
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

  Content() {
    if(this.props.tracks.editingTrack) {
      return <TrackForm track={this.props.track} />;
    } else if(this.props.entry.selectedEntry) {
      return this.SelectedEntry();
    } else {
      return <EntryList track={this.props.track} />;
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
