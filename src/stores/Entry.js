import {observable, action} from "mobx";

class EntryStore {
  @observable entries = [];
  @observable entryTime;

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
  SetHoverEntries(entries, time) {
    this.hoverEntries = entries || [];
    this.hoverTime = time;
  }
}

export default EntryStore;
