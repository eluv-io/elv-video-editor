import { makeAutoObservable } from "mobx";
import Id from "@/utils/Id";
import {DownloadFromUrl} from "@/utils/Utils";

class TagStore {
  selectedTime;
  selectedTagIds = [];
  selectedTagId;
  selectedTagTrackId;

  hoverTags = [];
  hoverTrack;
  hoverTime;

  filter = "";

  editingTag = false;

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  get assets() {
    const assets = this.rootStore.videoStore.metadata?.assets || {};

    return Object.keys(assets)
      .sort()
      .map(filename => ({
        filename,
        ...assets[filename],
      }));
  }

  get selectedTag() {
    return this.rootStore.trackStore.TrackTags(this.selectedTagTrackId)[this.selectedTagId];
  }

  get selectedTags() {
    return this.selectedTagIds.map(tagId =>
      this.rootStore.trackStore.TrackTags(this.selectedTagTrackId)[tagId]
    );
  }

  Reset() {
    this.ClearTags();
    this.ClearHoverTags();
    this.SetEditing(false);
    this.filter = "";
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
    this.selectedTag && this.PlayTag(this.selectedTag);
  }

  PlayTag(tag) {
    if(!tag) { return; }

    this.rootStore.videoStore.PlaySegment(
      this.rootStore.videoStore.TimeToFrame(tag.startTime),
      this.rootStore.videoStore.TimeToFrame(tag.endTime)
    );
  }

  SetSelectedTag(tagId) {
    this.selectedTagId = tagId;

    this.SetEditing(false);
  }

  ClearSelectedTag() {
    this.selectedTagId = undefined;

    if(this.selectedTagIds.length === 1) {
      this.ClearTags();
    }

    this.SetEditing(false);
  }

  Tags({startFrame=0, endFrame, limit=100}={}) {
    const startTime = startFrame && this.rootStore.videoStore.FrameToTime(startFrame);
    const endTime = endFrame && this.rootStore.videoStore.FrameToTime(endFrame);

    let tracks = this.rootStore.trackStore.metadataTracks;
    if(this.rootStore.trackStore.tracksSelected) {
      // Selected tracks only
      tracks = tracks.filter(track => this.rootStore.trackStore.selectedTracks[track.key]);
    }

    const filter = (this.filter || "").toLowerCase();

    return tracks
      .map(track =>
        Object.values(this.rootStore.trackStore.TrackTags(track.trackId) || {})
          .filter(tag =>
            (!startTime || tag.startTime >= startTime) &&
            (!endTime || tag.endTime <= endTime) &&
            (!filter || (tag.textList?.join(" ") || JSON.stringify(tag.content || {})).toLowerCase().includes(filter))
          )
          .sort((a, b) => a.startTime < b.startTime ? -1 : 1)
          .slice(0, limit))
      .flat()
      .sort((a, b) => a.startTime < b.startTime ? -1 : 1)
      .slice(0, limit);
  }

  SetTags(trackId, tags=[], time) {
    this.ClearSelectedTag();

    if(!Array.isArray(tags)) {
      tags = [tags];
    }

    this.selectedTagTrackId = trackId;
    this.selectedTagIds = tags;
    this.selectedTagId = tags[0];
    this.selectedTime = time;

    this.SetEditing(false);
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
    this.selectedTagIds = [];
    this.selectedTagId = undefined;
    this.selectedTime = undefined;
    this.selectedTagTrackId = undefined;
  }

  SetEditing(tagId) {
    if(!tagId) {
      this.editingTag = false;
      return;
    }

    this.SetSelectedTag(tagId);

    this.editingTag = true;
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
    this.SetEditing(false);
  }

  RemoveTag(tagId) {
    if(tagId === this.selectedTagId) {
      this.ClearSelectedTag();
      this.selectedTagIds = this.selectedTagIds.filter(id => id !== tagId);
      this.hoverTags = this.hoverTags.filter(id => id !== tagId);
    }

    this.rootStore.trackStore.ModifyTrack(track => {
      delete this.rootStore.trackStore.TrackTags(track.trackId)[tagId];
    });
  }

  async DownloadSegment(tagId, callback) {
    const tag = this.rootStore.trackStore.TrackTags(this.rootStore.trackStore.selectedTagTrackId)[tagId];

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
