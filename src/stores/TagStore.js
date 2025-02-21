import {makeAutoObservable} from "mobx";

class TagStore {
  selectedTrackId;

  selectedTime;
  selectedTagIds = [];
  selectedTagId;
  selectedTagTrackId;

  hoverTags = [];
  hoverTrack;
  hoverTime;

  editedItem;

  filter = "";

  editing = false;

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

  get selectedTrack() {
    return this.rootStore.view === "clips" ?
      this.rootStore.trackStore.clipTracks.find(track => track.trackId === this.selectedTrackId) :
      this.rootStore.trackStore.metadataTracks.find(track => track.trackId === this.selectedTrackId);
  }

  get selectedTag() {
    if(typeof this.selectedTagTrackId === "undefined" || typeof this.selectedTagId === "undefined") {
      return undefined;
    }

    // Note: this.editing argument is to force selectedTag to recompute when editing is toggled
    return this.rootStore.trackStore.TrackTags(
      this.selectedTagTrackId,
      this.rootStore.editStore.position
    )[this.selectedTagId];
  }

  get selectedTags() {
    if(typeof this.selectedTagTrackId === "undefined" || typeof this.selectedTagId === "undefined") {
      return [];
    }

    return this.selectedTagIds.map(tagId =>
      this.rootStore.trackStore.TrackTags(this.selectedTagTrackId)[tagId]
    );
  }

  get selectedTagTrack() {
    return this.rootStore.trackStore.tracks.find(track => track.trackId === this.selectedTagTrackId);
  }

  Reset() {
    this.ClearSelectedTrack();
    this.ClearTags();
    this.ClearHoverTags();
    this.ClearEditing();
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

  Tags({mode="tags", startFrame=0, endFrame, limit=100, selectedOnly=false}={}) {
    const startTime = startFrame && this.rootStore.videoStore.FrameToTime(startFrame);
    const endTime = endFrame && this.rootStore.videoStore.FrameToTime(endFrame);

    let tracks;
    if(mode === "tags") {
      tracks = this.rootStore.trackStore.metadataTracks;

      if(this.rootStore.trackStore.tracksSelected) {
        // Selected tracks only
        tracks = tracks.filter(track => this.rootStore.trackStore.activeTracks[track.key]);
      }
    } else {
      tracks = this.rootStore.trackStore.clipTracks;

      if(this.rootStore.trackStore.clipTracksSelected) {
        // Selected tracks only
        tracks = tracks.filter(track => this.rootStore.trackStore.activeClipTracks[track.key]);
      }

      if(!this.rootStore.trackStore.showPrimaryContent) {
        tracks = tracks.filter(track => track.key !== "primary-content");
      }
    }

    const filter = (this.filter || "").toLowerCase();

    let total = 0;
    let tags = tracks
      .map(track => {
        let trackTags = Object.values(this.rootStore.trackStore.TrackTags(track.trackId) || {})
          .filter(tag =>
            (!startTime || tag.startTime >= startTime) &&
            (!endTime || tag.endTime <= endTime) &&
            (!filter || (tag.textList?.join(" ") || JSON.stringify(tag.content || {})).toLowerCase().includes(filter)) &&
            (!selectedOnly || this.selectedTagIds.length === 0 || this.selectedTagIds.includes(tag.tagId))
          )
          .sort((a, b) => a.startTime < b.startTime ? -1 : 1);


        total += trackTags.length;

        return trackTags.slice(0, limit);
      })
      .flat()
      .sort((a, b) => a.startTime < b.startTime ? -1 : 1)
      .slice(0, limit);

    return { tags, total };
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

  SetSelectedTrack(trackId) {
    this.ClearTags();
    this.selectedTrackId = trackId;
  }

  ClearSelectedTrack() {
    this.selectedTrackId = undefined;
  }

  SetSelectedTag(tagId) {
    this.ClearSelectedTrack();

    this.selectedTagId = tagId;

    this.ClearEditing();
  }

  ClearSelectedTag() {
    this.selectedTagId = undefined;

    if(this.selectedTagIds.length === 1) {
      this.ClearTags();
    }

    this.ClearEditing();
  }

  SetTags(trackId, tags=[], time) {
    this.ClearEditing();
    this.ClearSelectedTrack();
    this.ClearSelectedTag();

    if(!Array.isArray(tags)) {
      tags = [tags];
    }

    this.selectedTagTrackId = trackId;
    this.selectedTime = time;

    if(tags.length === 1) {
      this.selectedTagId = tags[0];
    } else {
      this.selectedTagIds = tags;
    }

    this.ClearEditing();
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
    this.ClearEditing();

    this.selectedTagIds = [];
    this.selectedTagId = undefined;
    this.selectedTime = undefined;
    this.selectedTagTrackId = undefined;
  }

  SetEditing(id, type="tag") {
    if(!id) {
      this.editing = false;
      return;
    }

    if(type === "tag") {
      this.SetSelectedTag(id);

      this.editedItem = {...this.selectedTag};
    } else {
      this.SetSelectedTrack(id);

      this.editedItem = {...this.selectedTrack};
    }

    this.editing = true;
  }

  ClearEditing(save=true) {
    if(this.editing && this.editedItem && save) {
      if(this.selectedTrackId) {
        const originalTrack = {...this.selectedTrack};
        const modifiedTrack = {...this.editedItem};

        if(JSON.stringify(originalTrack) !== JSON.stringify(modifiedTrack)) {
          this.rootStore.editStore.PerformAction({
            label: "Modify category",
            type: "track",
            action: "modify",
            modifiedItem: modifiedTrack,
            Action: () => this.rootStore.trackStore.ModifyTrack(modifiedTrack),
            Undo: () => this.rootStore.trackStore.ModifyTrack(originalTrack)
          });
        }
      } else if(this.selectedTagId) {
        const trackId = this.selectedTagTrackId;
        const originalTag = {...this.selectedTag};
        const modifiedTag = {...this.editedItem};

        if(JSON.stringify(originalTag) !== JSON.stringify(modifiedTag)) {
          // TODO: Tag/clip
          this.rootStore.editStore.PerformAction({
            label: "Modify Tag",
            type: "tag",
            action: "modify",
            modifiedItem: modifiedTag,
            Action: () => this.rootStore.trackStore.ModifyTag({trackId, modifiedTag}),
            Undo: () => this.rootStore.trackStore.ModifyTag({trackId, modifiedTag: originalTag})
          });
        }
      }
    }

    this.editing = false;

    this.ClearEditedItem();
  }

  AddTag({trackId, tagType="metadata", startTime, endTime, text}) {
    const track = this.rootStore.trackStore.Track(trackId);

    if(!track) { return; }

    startTime = startTime || this.rootStore.videoStore.currentTime;
    const tag = this.rootStore.trackStore.Cue({
      trackId,
      trackKey: track.key,
      startTime,
      endTime: endTime || startTime + 5,
      tagType,
      text,
      textList: [
        text
      ],
    });

    this.rootStore.editStore.PerformAction({
      label: "Add Tag",
      type: "tag",
      action: "delete",
      modifiedItem: tag,
      Action: () => this.rootStore.trackStore.AddTag({trackId, tag}),
      Undo: () => this.rootStore.trackStore.DeleteTag({trackId, tagId: tag.tagId})
    });

    this.SetTags(trackId, [tag.tagId], startTime);
    this.SetSelectedTag(tag.tagId);
    this.SetEditing(tag.tagId, tagType === "metadata" ? "tag" : "clip");
  }

  DeleteTag({trackId, tag}) {
    const originalTag = {...tag};

    this.rootStore.editStore.PerformAction({
      label: "Delete Tag",
      type: "tag",
      action: "delete",
      modifiedItem: tag,
      Action: () => this.rootStore.trackStore.DeleteTag({trackId, tagId: originalTag.tagId}),
      Undo: () => this.rootStore.trackStore.AddTag({trackId, tag: originalTag})
    });
  }

  UpdateEditedItem(item) {
    this.editedItem = item;
  }

  ClearEditedItem() {
    this.editedItem = undefined;
  }

  /*
  CreateTag() {
    const tagId = Id.next();

    this.SetEditing(tagId, "tag");
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
    if(tagId === this.selectedTagId) {
      this.ClearSelectedTag();
      this.selectedTagIds = this.selectedTagIds.filter(id => id !== tagId);
      this.hoverTags = this.hoverTags.filter(id => id !== tagId);
    }

    this.rootStore.trackStore.ModifyTrack(track => {
      delete this.rootStore.trackStore.TrackTags(track.trackId)[tagId];
    });
  }

   */
}

export default TagStore;
