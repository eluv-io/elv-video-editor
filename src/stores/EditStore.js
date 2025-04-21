import {flow, makeAutoObservable } from "mobx";
import UrlJoin from "url-join";
import {Unproxy} from "@/utils/Utils.js";

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

  HasUnsavedChanges(type) {
    return this.editInfo[type]?.position > 0;
  }

  Reset() {
    this.saving = false;

    this.ResetPage("tags");
    this.ResetPage("clips");
    this.ResetPage("assets");
  }

  ResetPage(page) {
    this.editInfo[page] = {
      position: 0,
      actionStack: [],
      redoStack: []
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

  FormatActions(actions, types=[]) {
    types = Array.isArray(types) ? types : [types];

    // Collapse actions by unique tag
    let formattedActions = [];
    actions.forEach(action => {
      if(!types.includes(action.type)) {
        // Not the right type
        return;
      }

      if(formattedActions.find(otherAction => otherAction.modifiedItem.tagId === action.modifiedItem.tagId)) {
        // Only the most recent action matters per tag, disregard older actions on this tag
        return;
      }

      formattedActions.push({
        ...action,
        // If modified tag has no origin, it is a modification of a newly created tag
        action: action.action === "modify" && !action.modifiedItem.o ? "create" : action.action
      });
    });

    // Remove unnecessary delete of new tags and convert modification of ML tag to delete + create user tag
    return formattedActions.map(action => {
      if(action.action === "delete" && !action.modifiedItem.o) {
        // Deletion of newly created tag
        return;
      }

      if(action.action !== "modify" || !action.modifiedItem.o || action.modifiedItem.o.lk === "user") {
        return action;
      }

      // Modification of ML tag
      return [
        {
          ...action,
          action: "create"
        },
        {
          ...action,
          action: "delete"
        }
      ];
    })
      .flat()
      .filter(a => a)
      // Sort modifications by highest index first so deletes will not interfere with indices of other actions
      .sort((a, b) => a.modifiedItem.o?.ti < b.modifiedItem.o?.ti ? 1 : -1);
  }

  Save = flow(function * () {
    yield this.SaveTags();
    yield this.SaveOverlayTags();

    const objectId = this.rootStore.videoStore.videoObject.objectId;
    yield this.Finalize({
      objectId,
      commitMessage: "EVIE - Update tags"
    });

    this.ResetPage("tags");
    this.rootStore.videoStore.Reload();
  });

  SaveTags = flow(function * () {
    // Most recent actions first so older actions can be ignored
    const actions = [
      ...this.rootStore.editStore.editInfo.tags.actionStack,
      ...this.rootStore.editStore.editInfo.clips.actionStack
    ].reverse();

    if(actions.length === 0) { return; }

    const objectId = this.rootStore.videoStore.videoObject.objectId;
    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});

    let modifiedFiles = {};
    const LoadTagFile = async linkKey => {
      if(modifiedFiles[linkKey]) { return; }

      // Clips are not actually saved into a file, but into metadata
      if(linkKey === "clips") {
        modifiedFiles[linkKey] = await this.client.ContentObjectMetadata({
          libraryId,
          objectId,
          metadataSubtree: "/clips",
          remove: "overlay_tags"
        });
      } else {
        modifiedFiles[linkKey] = await this.client.LinkData({
          libraryId,
          objectId,
          linkPath: UrlJoin("video_tags", "metadata_tags", linkKey),
          format: "json"
        });
      }

      if(!modifiedFiles[linkKey] || modifiedFiles[linkKey]?.errors || !modifiedFiles[linkKey]?.metadata_tags) {
        modifiedFiles[linkKey] = {
          version: 1,
          new: true,
          metadata_tags: {}
        };
      }
    };

    const formattedActions = this.FormatActions(actions, ["tag", "clip"]);

    if(formattedActions.length === 0) { return;}

    for(const action of formattedActions) {
      const tag = action.modifiedItem;
      const tagOrigin = action.modifiedItem.o;
      let linkKey = tagOrigin ? tagOrigin.lk :
        action.type === "tag" ? "user" : "clips";

      yield LoadTagFile(linkKey);

      switch(action.action) {
        // Create new tag
        case "create":
          linkKey = action.type === "tag" ? "user" : "clips";
          yield LoadTagFile(linkKey);

          // Ensure track is present in file
          if(!modifiedFiles[linkKey].metadata_tags[tag.trackKey]) {
            modifiedFiles[linkKey].metadata_tags[tag.trackKey] = {
              label: this.rootStore.trackStore.Track(tag.trackKey).label,
              tags: [],
              version: 1
            };
          }

          modifiedFiles[linkKey].metadata_tags[tag.trackKey].tags.push({
            text: tag.text,
            start_time: Math.floor(tag.startTime * 1000),
            end_time: Math.ceil(tag.endTime * 1000),
          });

          break;

        case "modify":
          modifiedFiles[linkKey].metadata_tags[tag.trackKey].tags[tagOrigin.ti] = {
            ...modifiedFiles[linkKey].metadata_tags[tag.trackKey].tags[tagOrigin.ti],
            text: tag.text,
            start_time: Math.floor(tag.startTime * 1000),
            end_time: Math.ceil(tag.endTime * 1000),
          };

          break;

        case "delete":
          modifiedFiles[linkKey].metadata_tags[tag.trackKey].tags =
            modifiedFiles[linkKey].metadata_tags[tag.trackKey].tags
              .filter((_, i) => i !== tagOrigin.ti);

          break;
      }
    }

    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    const linkInfo = yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/video_tags/metadata_tags"
    });

    let fileInfo = [];
    yield Promise.all(
      Object.keys(modifiedFiles).map(async linkKey => {
        // Save clips to metadata
        if(linkKey === "clips") {
          delete modifiedFiles[linkKey].new;

          await this.client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken,
            metadataSubtree: "/clips/metadata_tags",
            metadata: Unproxy(modifiedFiles[linkKey]?.metadata_tags)
          });

          return;
        }

        const filePath = linkKey === "user" ?
          "/video_tags/source_tags/user/user-tags.json" :
          UrlJoin("/video_tags", linkInfo[linkKey]["/"].split("/").slice(-1)[0]);

        if(modifiedFiles[linkKey].new) {
          await this.client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken,
            metadataSubtree: UrlJoin("/video_tags", "metadata_tags", linkKey),
            metadata: {
              "/": UrlJoin("./files/", filePath)
            }
          });
        }

        delete modifiedFiles[linkKey].new;

        const data = new TextEncoder().encode(JSON.stringify(modifiedFiles[linkKey])).buffer;
        fileInfo.push({
          mime_type: "application/json",
          path: filePath,
          size: data.byteLength,
          data
        });
      })
    );

    if(fileInfo.length > 0) {
      yield this.client.UploadFiles({
        libraryId,
        objectId,
        writeToken,
        fileInfo
      });
    }
  });

  SaveOverlayTags = flow(function * () {
    // Most recent actions first so older actions can be ignored
    const actions = [
      ...this.rootStore.editStore.editInfo.tags.actionStack,
      ...this.rootStore.editStore.editInfo.clips.actionStack
    ].reverse();

    if(actions.length === 0) { return; }

    const objectId = this.rootStore.videoStore.videoObject.objectId;
    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});

    let modifiedFiles = {};
    const LoadTagFile = async linkKey => {
      if(modifiedFiles[linkKey]) {
        return;
      }

      if(linkKey === "clips") {
        // Clip tags are saved to metadata
        modifiedFiles[linkKey] = await this.client.ContentObjectMetadata({
          libraryId,
          objectId,
          metadataSubtree: "/clips",
          remove: "metadata_tags"
        });
      } else {
        modifiedFiles[linkKey] = await this.client.LinkData({
          libraryId,
          objectId,
          linkPath: UrlJoin("video_tags", "overlay_tags", linkKey),
          format: "json"
        });
      }

      if(!modifiedFiles[linkKey] || modifiedFiles[linkKey]?.errors || !modifiedFiles[linkKey]?.overlay_tags) {
        modifiedFiles[linkKey] = {
          version: 1,
          new: true,
          overlay_tags: {
            frame_level_tags: {}
          }
        };
      }
    };

    const formattedActions = this.FormatActions(actions, "overlay");

    if(formattedActions.length === 0) { return;}

    for(const action of formattedActions) {
      const tag = action.modifiedItem;
      const tagOrigin = action.modifiedItem.o;
      let linkKey = tagOrigin ? tagOrigin.lk :
        action.page === "clips" ? "clips" : "user";
      const frame = tag.frame.toString();
      const trackKey = this.rootStore.trackStore.Track(tag.trackId).key;

      yield LoadTagFile(linkKey);

      switch(action.action) {
        // Create new overlay tag
        case "create":
          linkKey = action.page === "clips" ? "clips" : "user";
          yield LoadTagFile(linkKey);

          // Ensure frame and track are initialized
          if(!modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame]) {
            modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame] = {
              timestamp_sec: this.rootStore.videoStore.FrameToTime(parseInt(frame))
            };
          }

          if(!modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey]) {
            modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey] = {
              tags: []
            };
          }

          modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey].tags.push({
            text: tag.text,
            box: tag.box,
            confidence: tag.confidence
          });

          break;

        case "modify":
          modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey].tags[tagOrigin.ti] = {
            ...modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey].tags[tagOrigin.ti],
            text: tag.text,
            box: tag.box,
            confidence: tag.confidence
          };

          break;

        case "delete":
          modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey].tags =
            modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey].tags
              .filter((_, i) => i !== tagOrigin.ti);
          break;
      }
    }

    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    const linkInfo = yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/video_tags/overlay_tags"
    });

    let fileInfo = [];
    yield Promise.all(
      Object.keys(modifiedFiles).map(async linkKey => {
        if(linkKey === "clips") {
          await this.client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken,
            metadataSubtree: "/clips/overlay_tags",
            metadata: Unproxy(modifiedFiles[linkKey]?.overlay_tags)
          });

          return;
        }

        const filePath = linkKey === "user" ?
          "/video_tags/source_tags/user/user-tags-overlay.json" :
          UrlJoin("/video_tags", linkInfo[linkKey]["/"].split("/").slice(-1)[0]);

        if(modifiedFiles[linkKey].new) {
          await this.client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken,
            metadataSubtree: UrlJoin("/video_tags", "overlay_tags", linkKey),
            metadata: {
              "/": UrlJoin("./files/", filePath)
            }
          });
        }

        delete modifiedFiles[linkKey].new;

        const data = new TextEncoder().encode(JSON.stringify(modifiedFiles[linkKey])).buffer;
        fileInfo.push({
          mime_type: "application/json",
          path: filePath,
          size: data.byteLength,
          data
        });
      })
    );

    if(fileInfo.length > 0) {
      yield this.client.UploadFiles({
        libraryId,
        objectId,
        writeToken,
        fileInfo
      });
    }
  });
}

export default EditStore;
