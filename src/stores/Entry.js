import {observable, action} from "mobx";
import Id from "../utils/Id";
import {DownloadFromUrl} from "../utils/Utils";

class EntryStore {
  @observable entries = [];
  @observable entryTime;
  @observable selectedEntry;

  @observable hoverEntries = [];
  @observable hoverTrack;
  @observable hoverTime;

  @observable filter = "";

  @observable editingEntry = false;

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

    this.editingEntry = false;
  }

  TimeToSMPTE(time) {
    return this.rootStore.videoStore.TimeToSMPTE(time);
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

    return entries
      .filter(({startTime, endTime, text}) =>
        (!filter || formatString(text).includes(filter)) &&
        endTime >= minTime && startTime <= maxTime
      )
      .sort((a, b) => a.startTime < b.startTime ? -1 : 1);
  }

  @action.bound
  PlayCurrentEntry() {
    if(!this.selectedEntry) { return; }

    const entry = this.SelectedEntry();

    this.rootStore.videoStore.PlaySegment(
      this.rootStore.videoStore.TimeToFrame(entry.startTime),
      this.rootStore.videoStore.TimeToFrame(entry.endTime)
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
    return this.rootStore.trackStore.SelectedTrack().entries[this.selectedEntry];
  }

  @action.bound
  SetSelectedEntry(entryId) {
    this.selectedEntry = entryId;

    this.ClearEditing();
  }

  @action.bound
  ClearSelectedEntry() {
    this.selectedEntry = undefined;

    if(this.entries.length === 1) {
      this.ClearEntries();
    }

    this.ClearEditing();
  }

  Entries() {
    return this.entries.map(entryId =>
      this.rootStore.trackStore.SelectedTrack().entries[entryId]
    );
  }

  @action.bound
  SetEntries(entries, time) {
    this.ClearSelectedEntry();

    this.entries = entries || [];
    this.entryTime = time;

    if(entries.length === 1) {
      this.SetSelectedEntry(entries[0]);
    }
  }

  @action.bound
  SetHoverEntries(entries, trackId, time) {
    this.hoverEntries = entries || [];
    this.hoverTrack = trackId;
    this.hoverTime = time;
  }

  @action.bound
  ClearHoverEntries() {
    this.hoverEntries = [];
    this.hoverTrack = undefined;
    this.hoverTime = undefined;
  }

  @action.bound
  ClearEntries() {
    this.entries = [];
    this.hoverEntries = [];
    this.selectedEntry = undefined;
  }

  @action.bound
  SetEditing(entryId) {
    this.SetSelectedEntry(entryId);

    this.editingEntry = true;
  }

  @action.bound
  ClearEditing() {
    this.editingEntry = false;
  }

  @action.bound
  CreateEntry() {
    const entryId = Id.next();

    this.SetEditing(entryId);
  }

  @action.bound
  ModifyEntry({entryId, text, startTime, endTime}) {
    this.rootStore.trackStore.ModifyTrack(track => {
      const entry = track.entries[entryId];

      if(entry) {
        entry.text = text;
        entry.startTime = startTime;
        entry.endTime = endTime;
      } else {
        entryId = this.rootStore.trackStore.AddEntry({
          trackId: track.trackId,
          text,
          startTime,
          endTime
        });
      }
    });

    this.SetSelectedEntry(entryId);
    this.ClearEditing();
  }

  @action.bound
  RemoveEntry(entryId) {
    if(entryId === this.selectedEntry) {
      this.ClearSelectedEntry();
      this.entries = this.entries.filter(id => id !== entryId);
      this.hoverEntries = this.hoverEntries.filter(id => id !== entryId);
    }

    this.rootStore.trackStore.ModifyTrack(track => {
      delete track.entries[entryId];
    });
  }

  async DownloadSegment(entryId, callback) {
    const entry = this.rootStore.trackStore.SelectedTrack().entries[entryId];

    const partHash = entry.source;
    const startTime = this.TimeToSMPTE(entry.startTime);
    const endTime = this.TimeToSMPTE(entry.endTime);
    const type = entry.streamType;
    const name = this.rootStore.videoStore.name.substring(0, 10);

    const filename = `${name}-${type}--${startTime}-${endTime}.mp4`;

    const client = this.rootStore.client;
    const data = await client.DownloadPart({
      libraryId: this.rootStore.menuStore.libraryId,
      objectId: this.rootStore.menuStore.objectId,
      versionHash: this.rootStore.videoStore.versionHash,
      partHash,
      callback,
      format: "blob"
    });

    const downloadUrl = window.URL.createObjectURL(data);

    DownloadFromUrl(downloadUrl, filename);
  }
}

export default EntryStore;
