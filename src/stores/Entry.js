import {observable, action} from "mobx";

class EntryStore {
  @observable entry;
  @observable entryId;

  @observable hoverEntry;
  @observable hoverEntryId;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  SetEntry(entry) {
    this.entry = entry;

    this.entryId = entry ? entry.entryId : undefined;
  }

  @action.bound
  HoverEntry(entry) {
    this.hoverEntry = entry;

    this.hoverEntryId = entry ? entry.entryId : undefined;
  }
}

export default EntryStore;
