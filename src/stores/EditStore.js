import {flow, makeAutoObservable } from "mobx";

class EditStore {
  saving = false;
  writeInfo = {};
  editInfo = {};

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;

    this.Reset();
  }

  get client() {
    return this.rootStore.client;
  }

  get page() {
    return this.rootStore.page;
  }

  get position() {
    return this.editInfo[this.page]?.position;
  }

  get hasUnsavedChanges() {
    return this.position > 0;
  }

  // Undo / redo segregated by subpage, e.g. different assets
  get undoStack() {
    return this.editInfo[this.page]?.actionStack?.filter(action =>
      action.subpage === this.rootStore.subpage
    );
  }

  get redoStack() {
    return this.editInfo[this.page]?.redoStack?.filter(action =>
      action.subpage === this.rootStore.subpage
    );
  }

  get nextUndoAction() {
    return this.undoStack?.slice(-1)[0];
  }

  get nextRedoAction() {
    return this.redoStack?.slice(-1)[0];
  }

  Reset() {
    this.saving = false;

    this.editInfo = {
      tags: {
        position: 0,
        actionStack: [],
        redoStack: []
      },
      clips: {
        position: 0,
        actionStack: [],
        redoStack: []
      },
      assets: {
        position: 0,
        actionStack: [],
        redoStack: []
      }
    };
  }

  PerformAction({label, Action, Undo, ...attrs}, fromRedo=false) {
    const result = Action();

    this.editInfo[this.page].actionStack.push({
      id: this.rootStore.NextId(),
      label,
      Action,
      Undo,
      page: this.rootStore.page,
      subpage: this.rootStore.subpage,
      addedAt: Date.now(),
      ...attrs
    });

    this.editInfo[this.page].position += 1;

    // Undid action(s), but performed new action - Drop redo stack for this context
    if(!fromRedo) {
      this.editInfo[this.page].redoStack = this.editInfo[this.page].redoStack.filter(action =>
        action.subpage !== this.rootStore.subpage
      );
    }

    return result;
  }

  Undo() {
    if(this.undoStack.length === 0) { return; }

    const action = this.nextUndoAction;
    this.editInfo[this.page].actionStack = this.editInfo[this.page].actionStack
      .filter(otherAction => otherAction.id !== action.id);

    action.Undo();

    this.editInfo[this.page].redoStack.push(action);
    this.editInfo[this.page].position -= 1;
  }

  Redo() {
    if(this.redoStack.length === 0) { return; }

    const action = this.nextRedoAction;

    this.editInfo[this.page].redoStack = this.editInfo[this.page].redoStack
      .filter(otherAction => otherAction.id !== action.id);

    this.PerformAction(action, true);
  }

  WriteToken({objectId}) {
    return this.writeInfo[objectId]?.write_token;
  }

  DiscardWriteToken({objectId}) {
    delete this.writeInfo[objectId];
  }

  InitializeWrite = flow(function * ({objectId}) {
    if(!this.writeInfo[objectId]) {
      const libraryId = yield this.rootStore.LibraryId({objectId});

      this.writeInfo[objectId] = yield this.client.EditContentObject({
        libraryId,
        objectId
      });
    }

    return this.writeInfo[objectId].write_token;
  });

  Finalize = flow(function * ({objectId, commitMessage}) {
    const libraryId = yield this.rootStore.LibraryId({objectId});

    const writeInfo = this.writeInfo[objectId];

    if(!writeInfo) {
      return;
    }

    const response = yield this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: writeInfo.writeToken,
      commitMessage
    });

    this.DiscardWriteToken({objectId});

    return response;
  });


  SaveClips = flow(function * () {

  });

  /*

  Save2 = flow(function * ({trimOfferings}) {
    if(this.saving || this.rootStore.videoStore.loading) { return; }

    this.saving = true;

    try {
      const client = this.rootStore.client;
      const libraryId = this.rootStore.menuStore.selectedObject.libraryId;
      const objectId = this.rootStore.menuStore.selectedObject.objectId;
      const originalVersionHash = this.rootStore.menuStore.selectedObject.versionHash;

      let metadata = {};
      try {
        metadata = yield client.LinkData({
          libraryId,
          objectId,
          versionHash: originalVersionHash,
          linkPath: "video_tags/metadata_tags"
        });

        metadata = metadata.metadata_tags || {};
      } catch(error) {
        // eslint-disable-next-line no-console
        console.error("Unable to retrieve existing tags");
      }

      let newMetadata = {};
      let updatedMetadata = {};

      const metadataTracks = this.rootStore.trackStore.tracks.filter(track => track.trackType === "metadata");

      metadataTracks.forEach(track => {
        const tags = this.rootStore.trackStore.TrackTags(track.trackId);
        const tagMetadata = Object.values(tags).map(tag => ({
          ...tag.tag,
          text: tag.content ? tag.content : tag.textList,
          start_time: Math.floor(tag.startTime * 1000),
          end_time: Math.floor(tag.endTime * 1000)
        }));

        const originalMetadata = metadata[track.key] || {};

        const trackMetadata = {
          ...originalMetadata,
          version: 1,
          label: track.label,
          tags: SortTags(tagMetadata)
        };

        newMetadata[track.key] = trackMetadata;

        if(originalMetadata) {
          originalMetadata.tags = SortTags(originalMetadata.tags || []);

          const trackDiff = diff(
            originalMetadata,
            trackMetadata
          );

          if(Object.keys(trackDiff).length === 0) {
            return;
          }
        }

        updatedMetadata[track.key] = trackMetadata;
      });

      const keys = metadataTracks.map(track => track.key);
      const keysToDelete = Object.keys(metadata)
        .filter(key => !keys.includes(key));

      const {
        clipChanged,
        startTimeRat,
        endTimeRat
      } = this.DetermineTrimChange();

      const metadataChanged = Object.keys(updatedMetadata).length > 0 || keysToDelete.length > 0;

      // No difference between current tags and saved tags, or clip timing
      if(!metadataChanged && !clipChanged) {
        this.saving = false;
        this.saveFailed = false;
        return;
      }

      const {write_token} = yield client.EditContentObject({
        libraryId,
        objectId
      });

      if(metadataChanged) {
        // Upload new JSON file
        newMetadata = {
          ...this.rootStore.videoStore.tags,
          metadata_tags: newMetadata
        };

        const data = (new TextEncoder()).encode(JSON.stringify(newMetadata));
        yield client.UploadFiles({
          libraryId,
          objectId,
          writeToken: write_token,
          fileInfo: [{
            path: "MetadataTags.json",
            mime_type: "application/json",
            size: data.length,
            data: data.buffer
          }]
        });

        // Update link to tags
        yield client.CreateLinks({
          libraryId,
          objectId,
          writeToken: write_token,
          links: [{
            path: "video_tags/metadata_tags",
            target: "MetadataTags.json",
            type: "file"
          }]
        });
      }

      if(clipChanged) {
        for(let i = 0; i < trimOfferings.length; i++) {
          const offering = (trimOfferings || [this.rootStore.videoStore.offeringKey])[i];
          yield client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken: write_token,
            metadataSubtree: `offerings/${offering}/tag_point_rat`,
            metadata: startTimeRat
          });

          yield client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken: write_token,
            metadataSubtree: `offerings/${offering}/exit_point_rat`,
            metadata: endTimeRat
          });
        }
      }

      const {hash} = yield client.FinalizeContentObject({
        libraryId,
        objectId,
        writeToken: write_token,
        commitMessage: "Video Editor"
      });

      this.rootStore.menuStore.UpdateVersionHash(hash);

      yield this.rootStore.videoStore.ReloadMetadata();
      this.rootStore.videoStore.availableOfferings = this.rootStore.videoStore.SetOfferingClipDetails({
        metadata: this.rootStore.videoStore.metadata,
        availableOfferings: this.rootStore.videoStore.availableOfferings,
      });

      this.saveFailed = false;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error(error);
      this.saveFailed = true;
    }

    this.saving = false;
  });

  DetermineTrimChange = () => {
    // Start/end time clip
    const {startTime, endTime} = this.rootStore.trackStore.ClipInfo();

    const startFrame = this.rootStore.videoStore.videoHandler.TimeToFrame(startTime);
    const startTimeRat = this.rootStore.videoStore.videoHandler.FrameToRat(startFrame);
    const endFrame = this.rootStore.videoStore.videoHandler.TimeToFrame(endTime);
    const endTimeRat = this.rootStore.videoStore.videoHandler.FrameToRat(endFrame);

    const offering = this.rootStore.videoStore.metadata.offerings[this.rootStore.videoStore.offeringKey];

    const clipChanged = offering.tag_point_rat !== startTimeRat || offering.exit_point_rat !== endTimeRat;

    return {
      clipChanged,
      endTimeRat,
      startTimeRat,
      tagRevised: this.rootStore.videoStore.TimeToSMPTE(FrameAccurateVideo.ParseRat(startTimeRat)),
      exitRevised: this.rootStore.videoStore.TimeToSMPTE(FrameAccurateVideo.ParseRat(endTimeRat)),
      durationUntrimmed: this.rootStore.videoStore.scaleMaxSMPTE,
      durationTrimmed: this.rootStore.videoStore.TimeToSMPTE(FrameAccurateVideo.ParseRat(endTimeRat) - FrameAccurateVideo.ParseRat(startTimeRat))
    };
  };

  UploadMetadataTags = flow(function * ({metadataFiles, metadataFilesRemote, overlayFiles=[], overlayFilesRemote=[]}) {
    if(this.rootStore.videoStore.loading) {
      return;
    }

    const ReadFile = async file => await new Response(file).json();

    let metadataTags, overlayTags;

    // Read files and verify contents

    if(metadataFiles.length > 0) {
      metadataFiles = Array.from(metadataFiles).sort((a, b) => a.name < b.name);

      metadataTags = yield Promise.all(
        Array.from(metadataFiles).map(async file => {
          const tags = await ReadFile(file);

          if(!tags.metadata_tags && !tags.video_level_tags) {
            throw Error(`No metadata tags present in ${file.name}`);
          }

          return {
            tags
          };
        })
      );
    }

    if(overlayFiles.length > 0) {
      overlayTags = yield Promise.all(
        Array.from(overlayFiles).map(async file => {
          const tags = await ReadFile(file);

          if(!tags.overlay_tags) {
            throw Error(`No overlay tags present in ${file.name}`);
          }

          const frames = Object.keys(tags.overlay_tags.frame_level_tags).map(frame => parseInt(frame));

          return {
            tags,
            startFrame: Math.min(...frames),
            endFrame: Math.max(...frames)
          };
        })
      );
    }

    if(!metadataTags && !overlayTags && metadataFilesRemote.length === 0 && overlayFilesRemote.length === 0) {
      return;
    }

    const client = this.rootStore.client;
    const libraryId = this.rootStore.menuStore.selectedObject.libraryId;
    const objectId = this.rootStore.menuStore.selectedObject.objectId;

    const {write_token} = yield client.EditContentObject({
      libraryId,
      objectId
    });

    // Local metadata tag files
    if(metadataTags || metadataFilesRemote) {
      // Clear any existing tags
      yield client.DeleteMetadata({
        libraryId,
        objectId,
        writeToken: write_token,
        metadataSubtree: "video_tags/metadata_tags"
      });
    }

    if(metadataTags) {
      // Upload and create a link to each metadata tag file
      for(let i = 0; i < metadataTags.length; i++) {
        const data = (new TextEncoder()).encode(JSON.stringify(metadataTags[i].tags));
        const filename = `video_tags/MetadataTags-${(i + 1).toString().padStart(3, "0")}.json`;
        yield client.UploadFiles({
          libraryId,
          objectId,
          writeToken: write_token,
          fileInfo: [{
            path: filename,
            mime_type: "application/json",
            size: data.length,
            data: data.buffer
          }]
        });

        yield client.CreateLinks({
          libraryId,
          objectId,
          writeToken: write_token,
          links: [{
            path: `video_tags/metadata_tags/${i}`,
            target: filename,
            type: "file"
          }]
        });
      }
    }

    // Remote metadata tag files
    if(metadataFilesRemote.length > 0) {
      for(let i = 0; i < metadataFilesRemote.length; i++) {
        yield client.CreateLinks({
          libraryId,
          objectId,
          writeToken: write_token,
          links: [{
            path: `video_tags/metadata_tags/${i}`,
            target: metadataFilesRemote[i],
            type: "file"
          }]
        });
      }
    }

    // Local overlay files
    if(overlayTags) {
      // Sort overlay tags by start frame
      overlayTags = overlayTags.sort((a, b) => a.startFrame < b.startFrame ? -1 : 1);

      // Clear any existing tags
      yield client.DeleteMetadata({
        libraryId,
        objectId,
        writeToken: write_token,
        metadataSubtree: "video_tags/overlay_tags"
      });

      // Upload and create a link to each overlay tag file
      for(let i = 0; i < overlayTags.length; i++) {
        const data = (new TextEncoder()).encode(JSON.stringify(overlayTags[i].tags));
        const filename = `video_tags/OverlayTags-${(i + 1).toString().padStart(3, "0")}.json`;
        yield client.UploadFiles({
          libraryId,
          objectId,
          writeToken: write_token,
          fileInfo: [{
            path: filename,
            mime_type: "application/json",
            size: data.length,
            data: data.buffer
          }]
        });

        // TODO: Add start/end info to links
        yield client.CreateLinks({
          libraryId,
          objectId,
          writeToken: write_token,
          links: [{
            path: `video_tags/overlay_tags/${i}`,
            target: filename,
            type: "file"
          }]
        });
      }
    }

    // Remote overlay files
    if(overlayFilesRemote.length > 0) {
      for(let i = 0; i < overlayFilesRemote.length; i++) {
        yield client.CreateLinks({
          libraryId,
          objectId,
          writeToken: write_token,
          links: [{
            path: `video_tags/overlay_tags/${i}`,
            target: overlayFilesRemote[i],
            type: "file"
          }]
        });
      }
    }

    const {hash} = yield client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: write_token
    });

    // Reload video
    this.rootStore.menuStore.SelectVideo({
      libraryId,
      objectId,
      versionHash: hash
    });
  });



   */
}

export default EditStore;
