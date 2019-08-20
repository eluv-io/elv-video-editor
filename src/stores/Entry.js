import {observable, action} from "mobx";

class EntryStore {
  @observable entries = [];
  @observable entryTime;
  @observable selectedEntry;

  @observable hoverEntries = [];
  @observable hoverTime;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  Reset() {
    this.entries = [];
    this.entryTime = undefined;
    this.selectedEntry = undefined;

    this.hoverEntries = [];
    this.hoverTime = undefined;
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
}

export default EntryStore;
