import {makeAutoObservable} from "mobx";
import {Unproxy} from "@/utils/Utils.js";
import {Cue} from "@/stores/Helpers.js";

class TagStore {
  selectedTrackId;

  scrollTagId;
  scrollSeekTime;
  selectedTime;
  selectedTagIds = [];
  selectedTagId;
  selectedTagTrackId;

  selectedOverlayTagFrame;
  selectedOverlayTagIds = [];
  selectedOverlayTagId;

  hoverTags = [];
  hoverTrack;
  hoverTime;

  editedTag;
  editedTrack;
  editedOverlayTag;
  editedAsset;
  editedAssetTag;
  editedGroundTruthAsset;

  isolatedTag;

  filter = "";

  editing = false;

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  get editPosition() {
    // This is referenced in computeds to force recomputation after undo/redo
    return this.rootStore.editStore.position;
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
    this.editPosition;

    return this.rootStore.page === "clips" ?
      this.rootStore.trackStore.clipTracks.find(track => track.trackId === this.selectedTrackId) :
      this.rootStore.trackStore.metadataTracks.find(track => track.trackId === this.selectedTrackId);
  }

  get selectedTag() {
    this.editPosition;

    if(typeof this.selectedTagTrackId === "undefined" || typeof this.selectedTagId === "undefined") {
      return undefined;
    }

    return this.rootStore.trackStore.TrackTags(this.selectedTagTrackId)[this.selectedTagId];
  }

  get selectedTags() {
    this.editPosition;

    if(typeof this.selectedTagTrackId === "undefined" || typeof this.selectedTagId === "undefined") {
      return [];
    }

    return this.selectedTagIds.map(tagId =>
      this.rootStore.trackStore.TrackTags(this.selectedTagTrackId)[tagId]
    );
  }

  get selectedTagTrack() {
    this.editPosition;

    return this.rootStore.trackStore.tracks.find(track => track.trackId === this.selectedTagTrackId);
  }

  get selectedOverlayTags() {
    this.editPosition;

    return this.rootStore.overlayStore.TagsAtFrame(this.selectedOverlayTagFrame)
      .filter(tag => this.selectedOverlayTagIds.includes(tag.tagId));
  }

  get selectedOverlayTag() {
    this.editPosition;
    return this.rootStore.overlayStore.TagsAtFrame(this.selectedOverlayTagFrame)
      .find(tag => tag.tagId === this.selectedOverlayTagId);
  }

  Reset() {
    this.ClearEditing(false);
    this.ClearSelectedTrack();
    this.ClearTags();
    this.ClearHoverTags();
    this.ClearIsolatedTag();
    this.ClearFilter();
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

  Tags({
    mode="tags",
    startFrame=0,
    endFrame,
    pages={previous: 1, next: 1},
    perPage=10,
    scrollTagId,
    scrollSeekTime,
    selectedOnly=false
  }={}) {
    const startTime = startFrame && this.rootStore.videoStore.FrameToTime(startFrame);
    const endTime = endFrame && this.rootStore.videoStore.FrameToTime(endFrame);

    let tracks;
    if(mode === "tags") {
      tracks = this.rootStore.trackStore.visibleMetadataTracks;
    } else {
      tracks = this.rootStore.trackStore.visibleClipTracks;

      if(!this.rootStore.trackStore.showPrimaryContent) {
        tracks = tracks.filter(track => track.key !== "primary-content");
      }
    }

    const filter = (this.filter || "").toLowerCase();

    let tags = tracks
      .map(track => {
        let trackTags = Object.values(this.rootStore.trackStore.TrackTags(track.trackId) || {})
          .filter(tag =>
            // Include tags that end after start time
            (!startTime || tag.endTime >= startTime) &&
            // Include tags that start before end time
            (!endTime || tag.startTime <= endTime) &&
            // Include tags that are within the isolated tag range
            (!this.isolatedTag || (tag.startTime < this.isolatedTag.endTime && tag.endTime > this.isolatedTag.startTime)) &&
            // Text filter
            (!filter || (tag.text || JSON.stringify(tag.content || {})).toLowerCase().includes(filter)) &&
            // Selected tags
            (!selectedOnly || this.selectedTagIds.length === 0 || this.selectedTagIds.includes(tag.tagId))
          );

        return trackTags;
      })
      .flat()
      .sort((a, b) => a.startTime < b.startTime ? -1 : 1);

    const total = tags.length;

    let startIndex = 0;
    let centerTagId;
    if(scrollTagId) {
      const tagIndex = tags.findIndex(tag => tag.tagId === scrollTagId);
      if(tagIndex >= 0) {
        startIndex = tagIndex;
        centerTagId = tags[tagIndex].tagId;
      }
    } else if(scrollSeekTime) {
      const tagIndex = tags.findIndex(tag => tag.startTime >= scrollSeekTime);
      if(tagIndex >= 0) {
        startIndex = tagIndex;
        centerTagId = tags[tagIndex].tagId;
      }
    }

    const minIndex = Math.max(0, startIndex - pages.previous * perPage);
    const maxIndex = startIndex + pages.next * perPage;
    tags = [
      ...tags.slice(minIndex, startIndex),
      ...tags.slice(startIndex, maxIndex)
    ];

    return { tags, min: minIndex, max: maxIndex, center: startIndex, centerTagId, total };
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

  IsolateTag(tag) {
    this.isolatedTag = tag;

    this.rootStore.videoStore.SetScale(
      this.rootStore.videoStore.TimeToProgress(tag.startTime) - 0.5,
      this.rootStore.videoStore.TimeToProgress(tag.endTime) + 0.5,
    );

    this.CancelIsolateListener = event => event.key === "Escape" && this.ClearIsolatedTag();
    document.body.addEventListener("keydown", this.CancelIsolateListener);
  }

  ClearIsolatedTag() {
    this.isolatedTag = undefined;
    document.body.removeEventListener("keydown", this.CancelIsolateListener);
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

  ClearSelectedTag(scrollToTag=false) {
    if(scrollToTag) {
      this.scrollTagId = this.selectedTagId || this.selectedTagIds[0];
      this.scrollSeekTime = undefined;
    } else {
      this.scrollTagId = undefined;
      this.scrollSeekTime = undefined;
    }

    if(this.selectedTagIds.length === 1) {
      this.ClearTags(scrollToTag);
    }

    this.selectedTagId = undefined;

    this.ClearEditing();
  }

  SetTags(trackId, tags=[], time) {
    this.ClearEditing();
    this.ClearSelectedTrack();
    this.ClearSelectedTag();
    this.ClearSelectedOverlayTags();

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

    this.scrollTagId = this.selectedTagId || this.selectedTagIds[0];
    this.scrollSeekTime = undefined;

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

  ClearTags(scrollToTag=false) {
    this.ClearEditing();

    if(scrollToTag) {
      this.scrollTagId = this.selectedTagId || this.selectedTagIds[0];
    } else {
      this.scrollTagId = undefined;
    }

    this.selectedTagIds = [];
    this.selectedTagId = undefined;
    this.selectedTime = undefined;
    this.selectedTagTrackId = undefined;

    this.ClearSelectedOverlayTags();
  }

  SetScrollSeekTime(time) {
    this.scrollSeekTime = time;
    this.scrollTagId = undefined;
  }

  SetSelectedOverlayTags(frame, tagIds=[]) {
    this.rootStore.videoStore.PlayPause(true);
    this.rootStore.videoStore.ToggleVideoControls(false);
    this.rootStore.videoStore.Seek(frame);
    this.rootStore.keyboardControlStore.ToggleKeyboardControls(false);

    this.ClearTags();

    this.selectedOverlayTagFrame = frame;
    this.selectedOverlayTagIds = tagIds;

    if(!tagIds || tagIds.length === 0) {
      this.ClearSelectedOverlayTags();
    } else if(tagIds.length === 1) {
      this.SetSelectedOverlayTag(frame, tagIds[0]);
    }
  }

  ClearSelectedOverlayTags() {
    this.selectedOverlayTagFrame = undefined;
    this.selectedOverlayTagIds = [];
    this.selectedOverlayTagId = undefined;

    this.rootStore.videoStore.ToggleVideoControls(true);
    this.rootStore.keyboardControlStore.ToggleKeyboardControls(true);
  }

  SetSelectedOverlayTag(frame, tagId) {
    this.rootStore.videoStore.Seek(frame);
    this.selectedOverlayTagFrame = frame;
    this.selectedOverlayTagId = tagId;

    this.rootStore.videoStore.PlayPause(true);
    this.rootStore.videoStore.ToggleVideoControls(false);
    this.rootStore.keyboardControlStore.ToggleKeyboardControls(false);
  }

  ClearSelectedOverlayTag() {
    this.selectedOverlayTagId = undefined;

    if(this.selectedOverlayTagIds.length === 1) {
      this.ClearSelectedOverlayTags();
    }
  }

  SetEditing({id, type="tag", frame, item}) {
    this.ClearEditing();

    if(!id) {
      this.editing = false;
      return;
    }

    if(["tag", "clip"].includes(type)) {
      this.SetSelectedTag(id);

      this.editedTag = {...(item || this.selectedTag)};
    } else if(type === "track") {
      this.SetSelectedTrack(id);

      this.editedTrack = {...(item || this.selectedTrack)};
    } else if(type === "overlay") {
      this.SetSelectedOverlayTag(frame, id);
      let tag = Unproxy(item || this.selectedOverlayTag);
      tag.mode = typeof tag.box.x3 === "undefined" ? "rectangle" : "polygon";
      this.editedOverlayTag = tag;
    } else if(type === "asset") {
      this.editedAsset = Unproxy(item || this.rootStore.assetStore.selectedAsset || {});
    } else if(type === "assetTag") {
      let tag = Unproxy(item || this.rootStore.assetStore.selectedTag);
      tag.mode = typeof tag.box?.x3 === "undefined" ? "rectangle" : "polygon";
      this.editedAssetTag = tag;
    } else if(type === "groundTruthAsset") {
      this.editedGroundTruthAsset = {
        poolId: undefined,
        entityId: undefined,
        label: item?.label || "",
        description: "",
        frame,
        box: item?.box ||
          {
            x1: 0.25,
            y1: 0.25,
            x2: 0.75,
            y2: 0.75
          }
      };
    } else {
      // eslint-disable-next-line no-console
      console.error("Unknown editing type: " + type);
      return;
    }

    this.editing = true;
  }

  ClearEditing(save=true) {
    if(this.editing && save) {
      // Save edited item

      if(this.editedTrack) {
        // Track
        const originalTrack = Unproxy(this.selectedTrack);
        const modifiedTrack = Unproxy({...this.editedTrack, label: this.editedTrack.label || originalTrack.label});

        if(JSON.stringify(originalTrack) !== JSON.stringify(modifiedTrack)) {
          if(modifiedTrack.label !== originalTrack.label || modifiedTrack.description !== originalTrack.description) {
            // Color changes don't require modifying source files, only label or description modifications
            modifiedTrack.requiresSave = true;
          }

          this.rootStore.editStore.PerformAction({
            label: "Modify category",
            type: "track",
            action: "modify",
            modifiedItem: modifiedTrack,
            Action: () => this.rootStore.trackStore.ModifyTrack(modifiedTrack),
            Undo: () => this.rootStore.trackStore.ModifyTrack(originalTrack)
          });
        }

        this.lastSelectedTrackId = originalTrack.id;
      } else if(this.editedTag) {
        // Tag
        const tagType = this.editedTag.tagType === "clip" ? "Clip" : "Tag";
        if(this.editedTag.isNew) {
          const tag = Unproxy(this.editedTag);
          delete tag.isNew;

          this.rootStore.editStore.PerformAction({
            label: `Add ${tagType}`,
            type: tagType.toLowerCase(),
            action: "create",
            modifiedItem: tag,
            Action: () => this.rootStore.trackStore.AddTag({trackId: tag.trackId, tag}),
            Undo: () => this.rootStore.trackStore.DeleteTag({trackId: tag.trackId, tagId: tag.tagId})
          });

        } else {
          const originalTag = Unproxy(this.selectedTag);
          const modifiedTag = Unproxy(this.editedTag);

          if(JSON.stringify(originalTag) !== JSON.stringify(modifiedTag)) {
            this.rootStore.editStore.PerformAction({
              label: `Modify ${tagType}`,
              type: tagType.toLowerCase(),
              action: "modify",
              modifiedItem: modifiedTag,
              Action: () => this.rootStore.trackStore.ModifyTag({trackId: modifiedTag.trackId, modifiedTag}),
              Undo: () => this.rootStore.trackStore.ModifyTag({trackId: modifiedTag.trackId, modifiedTag: originalTag})
            });
          }
        }

        this.selectedTagId = this.editedTag.tagId;
        this.selectedTagTrackId = this.editedTag.trackId;
        this.selectedTime = this.editedTag.startTime;

        this.lastSelectedTrackId = this.selectedTagTrackId;
      } else if(this.editedOverlayTag) {
        // Overlay
        if(this.editedOverlayTag.isNew) {
          const tag = Unproxy(this.editedOverlayTag);
          delete tag.isNew;
          delete tag.mode;

          const trackKey = this.rootStore.trackStore.Track(tag.trackId)?.key;

          if(!trackKey) { return; }

          this.rootStore.editStore.PerformAction({
            label: "Add Overlay Tag",
            type: "overlay",
            action: "create",
            modifiedItem: tag,
            Action: () => this.rootStore.overlayStore.AddTag({frame: tag.frame, trackKey, tag}),
            Undo: () => this.rootStore.overlayStore.DeleteTag({frame: tag.frame, trackKey, tagId: tag.tagId})
          });
        } else {
          const originalTag = Unproxy(this.selectedOverlayTag);
          const modifiedTag = Unproxy(this.editedOverlayTag);
          delete modifiedTag.mode;
          const frame = modifiedTag.frame;

          if(JSON.stringify(originalTag) !== JSON.stringify(modifiedTag)) {
            this.rootStore.editStore.PerformAction({
              label: "Modify Overlay Tag",
              type: "overlay",
              action: "modify",
              modifiedItem: modifiedTag,
              Action: () => this.rootStore.overlayStore.ModifyTag({frame, modifiedTag}),
              Undo: () => this.rootStore.overlayStore.ModifyTag({frame, modifiedTag: originalTag})
            });
          }
        }

        this.selectedOverlayTagId = this.editedOverlayTag.tagId;
        this.selectedOverlayTagFrame = this.editedOverlayTag.frame;
      } else if(this.editedAsset) {
        // Asset
        if(this.editedAsset.isNew) {
          const asset = Unproxy(this.editedAsset);
          delete asset.isNew;

          this.rootStore.editStore.PerformAction({
            label: "Add Asset",
            type: "asset",
            action: "create",
            modifiedItem: asset,
            Action: () => this.rootStore.assetStore.AddAsset(asset),
            Undo: () => this.rootStore.assetStore.DeleteAsset(asset)
          });
        } else {
          const originalAsset = Unproxy(this.rootStore.assetStore.selectedAsset);
          const modifiedAsset = Unproxy(this.editedAsset);

          if(JSON.stringify(originalAsset) !== JSON.stringify(modifiedAsset)) {
            this.rootStore.editStore.PerformAction({
              label: "Modify Asset",
              type: "asset",
              action: "modify",
              modifiedItem: modifiedAsset,
              Action: () => this.rootStore.assetStore.ModifyAsset(modifiedAsset),
              Undo: () => this.rootStore.assetStore.ModifyAsset(originalAsset)
            });
          }
        }
      } else if(this.editedAssetTag) {
        // Asset tag
        if(this.editedAssetTag.isNew) {
          const tag = Unproxy(this.editedAssetTag);
          delete tag.isNew;
          delete tag.mode;

          const track = this.rootStore.assetStore.AssetTrack(tag.trackKey);

          if(!track) { return; }

          this.rootStore.editStore.PerformAction({
            label: "Add Asset Tag",
            type: "assetTag",
            action: "create",
            modifiedItem: tag,
            Action: () => this.rootStore.assetStore.AddAssetTag(tag),
            Undo: () => this.rootStore.assetStore.DeleteAssetTag(tag)
          });
        } else {
          const originalTag = Unproxy(this.rootStore.assetStore.selectedTag);
          const modifiedTag = Unproxy(this.editedAssetTag);
          delete modifiedTag.mode;

          if(JSON.stringify(originalTag) !== JSON.stringify(modifiedTag)) {
            this.rootStore.editStore.PerformAction({
              label: "Modify Asset Tag",
              type: "assetTag",
              action: "modify",
              modifiedItem: modifiedTag,
              Action: () => this.rootStore.assetStore.ModifyAssetTag(modifiedTag),
              Undo: () => this.rootStore.assetStore.ModifyAssetTag(originalTag)
            });
          }
        }
      } else if(this.editedGroundTruthAsset) {
        const tag = this.editedGroundTruthAsset;
        this.rootStore.groundTruthStore.AddAssetFromUrl({
          poolId: tag.poolId,
          entityId: tag.entityId,
          label: tag.label,
          description: tag.description,
          image: tag.image,
          source: {
            objectId: this.rootStore.videoStore.videoObject.objectId,
            smpte: this.rootStore.videoStore.smpte,
            frame: this.rootStore.videoStore.frame,
            box: tag.box
          }
        });
      }
    }

    this.ClearEditedTrack();
    this.ClearEditedTag();
    this.ClearEditedOverlayTag();
    this.ClearEditedAsset();
    this.ClearEditedAssetTag();
    this.ClearEditedGroundTruthAsset();
    this.editing = false;
  }

  AddTrack({trackType="tags", key, label, description, color}) {
    const trackId = this.rootStore.NextId();
    this.rootStore.editStore.PerformAction({
      label: "Add Category",
      type: "track",
      action: "create",
      modifiedItem: { trackId, trackType, key, label, description, color, requiresSave: true },
      Action: () => this.rootStore.trackStore.AddTrack({
        trackId,
        key,
        label,
        description,
        color,
        type: trackType
      }),
      Undo: () => this.rootStore.trackStore.DeleteTrack({trackId})
    });

    this.SetSelectedTrack(trackId);
  }

  DeleteTrack({trackId}) {
    const originalTrack = this.rootStore.trackStore.Track(trackId);
    const originalTags = this.rootStore.trackStore.tags[trackId];

    if(!originalTrack) { return; }

    this.rootStore.editStore.PerformAction({
      label: "Remove Category",
      type: "track",
      action: "delete",
      modifiedItem: originalTrack,
      Action: () => this.rootStore.trackStore.DeleteTrack({trackId}),
      Undo: () => this.rootStore.trackStore.AddTrack({
        ...originalTrack,
        tags: originalTags,
      }),
    });

    this.ClearSelectedTrack();
  }

  AddTag({trackId, tagType="metadata", text}) {
    trackId = trackId || this.lastSelectedTrackId;
    let track = this.rootStore.trackStore.Track(trackId);

    if(!["metadata", "clip"].includes(track?.trackType)) {
      track = this.rootStore.trackStore.viewTracks[0];
      trackId = track?.trackId;
    }

    if(!track) { return; }

    let startTime, endTime;
    if(
      this.rootStore.videoStore.clipInFrame > 0 ||
      this.rootStore.videoStore.clipOutFrame < this.rootStore.videoStore.totalFrames - 1
    ) {
      startTime = this.rootStore.videoStore.FrameToTime(this.rootStore.videoStore.clipInFrame);
      endTime = this.rootStore.videoStore.FrameToTime(this.rootStore.videoStore.clipOutFrame);
    } else {
      startTime = this.rootStore.videoStore.currentTime;
      endTime = Math.min(startTime + 5, this.rootStore.videoStore.duration);
    }

    const tag = Cue({
      tagId: this.rootStore.NextId(true),
      trackId,
      trackKey: track.key,
      startTime,
      endTime,
      tagType,
      text,
      isNew: true
    });

    this.SetTags(trackId, [tag.tagId], startTime);
    this.SetSelectedTag(tag.tagId);
    this.SetEditing({
      id: tag.tagId,
      type: tagType === "metadata" ? "tag" : "clip",
      item: tag
    });
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

  AddOverlayTag({trackId, frame, text}) {
    frame = typeof frame !== "undefined" ? frame : this.rootStore.videoStore.frame;
    let track = this.rootStore.trackStore.Track(trackId);

    if(!["metadata", "clip"].includes(track?.trackType) || track?.key === "shot_detection") {
      track = this.rootStore.trackStore.viewTracks.filter(t => t.key !== "shot_detection")[0];
      trackId = track?.trackId;
    }

    if(!track) { return; }

    const tag = {
      trackId,
      tagId: this.rootStore.NextId(true),
      text,
      confidence: 1,
      frame,
      box: {
        x1: 0.25,
        y1: 0.25,
        x2: 0.75,
        y2: 0.75
      },
      isNew: true
    };

    this.SetSelectedOverlayTags(frame, [tag.tagId]);
    this.SetSelectedOverlayTag(frame, tag.tagId);
    this.SetEditing({
      id: tag.tagId,
      frame,
      type: "overlay",
      item: tag
    });
  }

  DeleteOverlayTag({frame, tag}) {
    const originalTag = Unproxy(tag);

    const trackKey = this.rootStore.trackStore.Track(tag.trackId)?.key;

    this.rootStore.editStore.PerformAction({
      label: "Delete Tag",
      type: "overlay",
      action: "delete",
      modifiedItem: tag,
      Action: () => this.rootStore.overlayStore.DeleteTag({frame, tagId: originalTag.tagId}),
      Undo: () => this.rootStore.overlayStore.AddTag({frame, trackKey, tag: originalTag})
    });
  }

  AddAsset() {
    const asset = {
      assetId: this.rootStore.NextId(),
      asset_type: "Image",
      attachment_content_type: "image",
      file: undefined,
      key: "",
      image_tags: {},
      isNew: true
    };

    this.SetEditing({
      id: asset.assetId,
      type: "asset",
      item: asset
    });
  }

  DeleteAsset(asset) {
    const originalAsset = Unproxy(asset);

    this.rootStore.editStore.PerformAction({
      label: "Delete Asset",
      type: "asset",
      action: "delete",
      modifiedItem: asset,
      Action: () => this.rootStore.assetStore.DeleteAsset(asset),
      Undo: () => this.rootStore.assetStore.AddAsset(originalAsset)
    });
  }

  AddAssetTag({asset}) {
    const track = this.rootStore.assetStore.tracks[0];

    if(!track) { return; }

    const tag = {
      assetKey: asset.key,
      trackKey: track.key,
      tagId: this.rootStore.NextId(),
      text: "<New Tag>",
      confidence: 1,
      box: {
        x1: 0.25,
        y1: 0.25,
        x2: 0.75,
        y2: 0.75
      },
      isNew: true
    };

    this.rootStore.assetStore.SetSelectedTags([tag], true);
    this.SetEditing({
      id: tag.tagId,
      type: "assetTag",
      item: tag
    });
  }

  DeleteAssetTag(tag) {
    const originalTag = Unproxy(tag);

    this.rootStore.editStore.PerformAction({
      label: "Delete Asset Tag",
      type: "assetTag",
      action: "delete",
      modifiedItem: tag,
      Action: () => this.rootStore.assetStore.DeleteAssetTag(tag),
      Undo: () => this.rootStore.assetStore.AddAssetTag(originalTag)
    });
  }

  AddGroundTruthAsset({label, box}={}) {
    this.SetEditing({
      id: this.rootStore.NextId(true),
      frame: this.rootStore.videoStore.frame,
      type: "groundTruthAsset",
      item: {
        label,
        box
      }
    });
  }

  UpdateEditedTrack(track) {
    this.editedTrack = track;
  }

  ClearEditedTrack() {
    this.editedTrack = undefined;
  }

  UpdateEditedTag(tag) {
    this.editedTag = tag;
  }

  ClearEditedTag() {
    this.editedTag = undefined;
  }

  UpdateEditedOverlayTag(tag) {
    this.editedOverlayTag = tag;
  }

  ClearEditedOverlayTag() {
    this.editedOverlayTag = undefined;
  }

  UpdateEditedAsset(asset) {
    this.editedAsset = asset;
  }

  ClearEditedAsset() {
    this.editedAsset = undefined;
  }

  UpdateEditedAssetTag(tag) {
    this.editedAssetTag = tag;
  }

  ClearEditedAssetTag() {
    this.editedAssetTag = undefined;
  }

  ClearEditedGroundTruthAsset() {
    this.editedGroundTruthAsset = undefined;
  }

  UpdateEditedGroundTruthAsset(asset) {
    this.editedGroundTruthAsset = asset;
  }
}

export default TagStore;
