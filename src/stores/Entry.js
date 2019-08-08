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

  @action.bound
  SetEntries(entries, time) {
    this.entries = entries || [];
    this.entryTime = time;
  }

  @action.bound
  SetSelectedEntry(entryId) {
    this.selectedEntry = entryId;
  }

  @action.bound
  SetHoverEntries(entries, time) {
    this.hoverEntries = entries || [];
    this.hoverTime = time;
  }

  @action.bound
  ClearEntries() {
    this.entries = [];
    this.hoverEntries = [];
  }

  @action.bound
  ClearSelectedEntry() {
    this.selectedEntry = undefined;
  }
}

export default EntryStore;
