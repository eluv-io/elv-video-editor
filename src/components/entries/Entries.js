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
      Object.values(this.props.track.entries);

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
    const activeEntryIds = this.props.track.intervalTree.search(
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
