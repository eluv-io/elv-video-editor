import { makeAutoObservable } from "mobx";
import Id from "@/utils/Id";
import {DownloadFromUrl} from "@/utils/Utils";

class TagStore {
  tags = [];
  tagTime;
  selectedTag;

  hoverTags = [];
  hoverTrack;
  hoverTime;

  filter = "";

  editingTag = false;

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  Reset() {
    this.tags = [];
    this.tagTime = undefined;
    this.selectedTag = undefined;

    this.hoverTags = [];
    this.hoverTime = undefined;

    this.filter = "";

    this.editingTag = false;
  }

  TimeToSMPTE(time) {
    return this.rootStore.videoStore.TimeToSMPTE(time);
  }

  SetFilter(filter) {
    this.filter = filter;
  }

  ClearFilter() {
    this.filter = "";
  }

  FilteredTags(tags) {
    const formatString = string => (string || "").toString().toLowerCase();
    const filter = formatString(this.rootStore.tagStore.filter);

    const minTime = this.rootStore.videoStore.scaleMinTime;
    const maxTime = this.rootStore.videoStore.scaleMaxTime;

    return tags
      .filter(({startTime, endTime, textList}) =>
        (!filter || formatString(textList.join(" ")).includes(filter)) &&
        endTime >= minTime && startTime <= maxTime
      )
      .sort((a, b) => a.startTime < b.startTime ? -1 : 1);
  }

  PlayCurrentTag() {
    if(!this.selectedTag) { return; }

    this.PlayTag(this.SelectedTag());
  }

  PlayTag(tag) {
    if(!tag) { return; }

    this.rootStore.videoStore.PlaySegment(
      this.rootStore.videoStore.TimeToFrame(tag.startTime),
      this.rootStore.videoStore.TimeToFrame(tag.endTime),
      this.rootStore.trackStore.SelectedTrack().key
    );
  }

  SelectedTag() {
    return this.rootStore.trackStore.TrackTags(this.rootStore.trackStore.SelectedTrack().trackId)[this.selectedTag];
  }

  SetSelectedTag(tagId) {
    this.selectedTag = tagId;

    this.ClearEditing();
  }

  ClearSelectedTag() {
    this.selectedTag = undefined;

    if(this.tags.length === 1) {
      this.ClearTags();
    }

    this.ClearEditing();
  }

  Tags() {
    const tags = this.rootStore.trackStore.TrackTags(this.rootStore.trackStore.SelectedTrack().trackId);
    return this.tags.map(tagId => tags[tagId]);
  }

  SetTags(tags, time) {
    this.ClearSelectedTag();

    this.tags = tags || [];
    this.tagTime = time;

    if(tags.length === 1) {
      this.SetSelectedTag(tags[0]);
    }
  }

  SetHoverTags(tags, trackId, time) {
    this.hoverTags = tags || [];
    this.hoverTrack = trackId;
    this.hoverTime = time;
  }

  ClearHoverTags() {
    this.hoverTags = [];
    this.hoverTrack = undefined;
    this.hoverTime = undefined;
  }

  ClearTags() {
    this.tags = [];
    this.hoverTags = [];
    this.selectedTag = undefined;
  }

  SetEditing(tagId) {
    this.SetSelectedTag(tagId);

    this.editingTag = true;
  }

  ClearEditing() {
    this.editingTag = false;
  }

  CreateTag() {
    const tagId = Id.next();

    this.SetEditing(tagId);
  }

  ModifyTag({tagId, textList, startTime, endTime}) {
    this.rootStore.trackStore.ModifyTrack(track => {
      const tag = this.rootStore.trackStore.TrackTags(track.trackId)[tagId];

      if(tag) {
        tag.textList = textList;
        tag.startTime = startTime;
        tag.endTime = endTime;
      } else {
        tagId = this.rootStore.trackStore.AddTag({
          trackId: track.trackId,
          text: textList,
          startTime,
          endTime
        });
      }
    });

    this.SetSelectedTag(tagId);
    this.ClearEditing();
  }

  RemoveTag(tagId) {
    if(tagId === this.selectedTag) {
      this.ClearSelectedTag();
      this.tags = this.tags.filter(id => id !== tagId);
      this.hoverTags = this.hoverTags.filter(id => id !== tagId);
    }

    this.rootStore.trackStore.ModifyTrack(track => {
      delete this.rootStore.trackStore.TrackTags(track.trackId)[tagId];
    });
  }

  async DownloadSegment(tagId, callback) {
    const tag = this.rootStore.trackStore.TrackTags(this.rootStore.trackStore.SelectedTrack().trackId)[tagId];

    const partHash = tag.source;
    const startTime = this.TimeToSMPTE(tag.startTime);
    const endTime = this.TimeToSMPTE(tag.endTime);
    const type = tag.streamType;
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

export default TagStore;
