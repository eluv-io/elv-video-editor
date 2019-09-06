import {observable, action, toJS} from "mobx";

class EntryStore {
  @observable entries = [];
  @observable entryTime;
  @observable selectedEntry;

  @observable hoverEntries = [];
  @observable hoverTime;

  @observable filter = "";

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  Reset() {
    this.entries = [];
    this.entryTime = undefined;
    this.selectedEntry = undefined;

    this.hoverEntries = [];
    this.hoverTime = undefined;

    this.filter = "";
  }

  @action.bound
  SetFilter(filter) {
    this.filter = filter;
  }

  @action.bound
  ClearFilter() {
    this.filter = "";
  }

  @action.bound
  FilteredEntries(entries) {
    const formatString = string => string.toString().toLowerCase();
    const filter = formatString(this.rootStore.entryStore.filter);

    const minTime = this.rootStore.videoStore.scaleMinTime;
    const maxTime = this.rootStore.videoStore.scaleMaxTime;

    return entries.filter(({startTime, endTime, text}) =>
      (!filter || formatString(text).includes(filter)) &&
      endTime >= minTime && startTime <= maxTime
    );
  }

  @action.bound
  PlayCurrentEntry() {
    if(!this.selectedEntry) { return; }

    this.rootStore.videoStore.PlaySegment(
      this.rootStore.videoStore.TimeToFrame(this.selectedEntry.startTime),
      this.rootStore.videoStore.TimeToFrame(this.selectedEntry.endTime)
    );
  }

  @action.bound
  PlayEntry(entry) {
    if(!entry) { return; }

    this.rootStore.videoStore.PlaySegment(
      this.rootStore.videoStore.TimeToFrame(entry.startTime),
      this.rootStore.videoStore.TimeToFrame(entry.endTime)
    );
  }

  SelectedEntry() {
    return this.rootStore.trackStore.SelectedTrack().entries
      .find(entry => entry.entryId === this.selectedEntry.entryId);
  }

  @action.bound
  SetSelectedEntry(entry) {
    this.selectedEntry = entry;
  }

  @action.bound
  ClearSelectedEntry() {
    this.selectedEntry = undefined;
  }

  @action.bound
  SetEntries(entries, time) {
    this.ClearSelectedEntry();

    this.entries = entries || [];
    this.entryTime = time;
  }

  @action.bound
  SetHoverEntries(entries, time) {
    this.hoverEntries = entries || [];
    this.hoverTime = time;
  }

  @action.bound
  ClearHoverEntries() {
    this.hoverEntries = [];
    this.hoverTime = undefined;
  }

  @action.bound
  ClearEntries() {
    this.entries = [];
    this.hoverEntries = [];
  }

  @action.bound
  ModifyEntry(entryId, attribute, value) {
    const track = this.rootStore.trackStore.SelectedTrack();

    const entry = track.entries.find(entry => entry.entryId = entryId);

    console.log(entry);

    if(!entry) { return; }

    console.log("updating", attribute, value);
    console.log(toJS(entry));
    entry[attribute] = value;
    console.log(toJS(entry));
  }
}

export default EntryStore;
