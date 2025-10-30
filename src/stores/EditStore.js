import {flow, makeAutoObservable, runInAction} from "mobx";
import UrlJoin from "url-join";
import {ConvertColor, ObjectsEqual, Unproxy} from "@/utils/Utils.js";
import ABRProfileLiveToVod from "@eluvio/elv-client-js/src/abr_profiles/abr_profile_live_to_vod.js";

class EditStore {
  saving = false;
  writeInfo = {};
  editInfo = {};
  liveToVodProgress = {};
  saveProgress = {
    tags: 0,
    clips: 0,
    aggregation: 0
  };

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

  HasUnsavedChanges(type, subpage) {
    if(!subpage) {
      return this.editInfo[type]?.position > 0;
    }

    return this.editInfo[type]?.actionStack
      ?.filter(action => action.subpage === subpage)
      ?.length > 0;
  }

  Reset() {
    this.saving = false;

    this.ResetPage("tags");
    this.ResetPage("clips");
    this.ResetPage("assets");
    this.ResetPage("groundTruth");
  }

  ResetPage(page) {
    this.editInfo[page] = {
      position: 0,
      actionStack: [],
      redoStack: []
    };
  }

  ResetSubpage(page, subpage) {
    const actionStack = this.editInfo[page].actionStack
      .filter(action => action.subpage !== subpage);
    const redoStack = this.editInfo[page].redoStack
      .filter(action => action.subpage !== subpage);

    this.editInfo[page] = {
      position: actionStack.length,
      actionStack,
      redoStack
    };
  }

  PerformAction({label, Action, Undo, page, subpage, ...attrs}, fromRedo=false) {
    page = page || this.page;
    const result = runInAction(() => Action());

    this.editInfo[page].actionStack.push({
      id: this.rootStore.NextId(),
      label,
      Action,
      Undo,
      page,
      subpage: subpage || this.rootStore.subpage,
      addedAt: Date.now(),
      ...attrs
    });

    this.editInfo[page].position += 1;

    // Undid action(s), but performed new action - Drop redo stack for this context
    if(!fromRedo) {
      this.editInfo[page].redoStack = this.editInfo[page].redoStack.filter(action =>
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

      const idField = action.type === "track" ? "trackId" : "tagId";
      if(formattedActions.find(otherAction => otherAction.modifiedItem[idField] === action.modifiedItem[idField])) {
        // Only the most recent action matters per item, disregard older actions on this tag
        return;
      }

      formattedActions.push({
        ...action,
        // If modified tag has no origin, it is a modification of a newly created tag
        action: action.type !== "track" && action.action === "modify" && !action.modifiedItem.o ? "create" : action.action
      });
    });

    // Remove unnecessary delete of new tags and convert modification of ML tag to delete + create user tag
    return formattedActions.map(action => {
      if(action.type === "track") { return action; }

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

  // Save tags and clips
  Save = flow(function * () {
    this.rootStore.tagStore.ClearEditing();

    this.saving = true;

    const objectId = this.rootStore.videoStore.videoObject.objectId;

    this.saveProgress = { tags: 0, overlay: 0, aggregation: 0 };

    yield this.SaveTags();
    yield this.SaveClips();

    this.saveProgress.tags = 1;

    yield this.SaveOverlayTags();

    this.saveProgress.overlay = 1;

    yield this.SavePrimaryClip();

    yield this.SaveTrackSettings();

    /*
    // Show some progress while aggregation is running
    const progressInterval = setInterval(() =>
      runInAction(() => this.saveProgress.aggregation = Math.min(1, this.saveProgress.aggregation + 0.05)),
      1000
    );

    yield this.rootStore.aiStore.AggregateUserTags({
      objectId,
      writeToken: yield this.rootStore.editStore.InitializeWrite({objectId})
    });

    clearInterval(progressInterval);

     */
    this.saveProgress.aggregation = 1;

    yield this.Finalize({
      objectId,
      commitMessage: "EVIE - Update tags"
    });

    this.saving = false;

    this.ResetPage("tags");
    this.ResetPage("clips");
    this.rootStore.videoStore.Reload();
  });

  SaveTrackSettings = flow(function * () {
    const objectId = this.rootStore.videoStore.videoObject.objectId;
    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});

    yield Promise.all(
      ["metadata", "clip"].map(async type => {
        const tracks = this.rootStore.trackStore.tracks.filter(track => track.trackType === type);
        let trackSettings = {};

        tracks.forEach(track =>
          trackSettings[track.key] = {
            key: track.key,
            label: track.label,
            color: ConvertColor({rgb: track.color})
          }
        );

        const currentSettings = await this.client.ContentObjectMetadata({
          libraryId,
          objectId,
          metadataSubtree: UrlJoin("/", type === "clip" ? "clips" : "video_tags", "evie", "tracks"),
        });

        if(!ObjectsEqual(currentSettings, trackSettings)) {
          // Only save if different
          const writeToken = await this.rootStore.editStore.InitializeWrite({objectId});
          await this.client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken,
            metadataSubtree: UrlJoin("/", type === "clip" ? "clips" : "video_tags", "evie", "tracks"),
            metadata: Unproxy(trackSettings)
          });
        }
      })
    );
  });

  SaveTags = flow(function * () {
    // Most recent actions first so older actions can be ignored
    const actions = [
      ...this.rootStore.editStore.editInfo.tags.actionStack,
      ...this.rootStore.editStore.editInfo.clips.actionStack
    ].reverse();

    if(actions.length === 0) { return; }

    const objectId = this.rootStore.videoStore.videoObject.objectId;

    const formattedActions = this.FormatActions(actions, ["tag", "track"]);

    if(formattedActions.length === 0) { return; }

    let tagsToAdd = {};
    for(const action of formattedActions) {
      if(action.type === "track") {
        // eslint-disable-next-line no-console
        console.warn("Warning: Track modification not yet supported in tagstore API. Changes have not been saved.");
        // TODO: Need track API
        /*
        const track = action.modifiedItem;

        // All of the files that need modification
        const linkKeys = action.page === "clips" ? ["clips"] : [...Object.keys(linkInfo), "user"];

        // Track modified
        switch(action.action) {
          // When tracks are changed, we must go into *all* files and modify it
          case "create":
          case "modify":
            // Label or color changed
            if(!track.requiresSave) {
              // Only color changed, no need to modify files
              continue;
            }

            yield Promise.all(
              linkKeys.map(async linkKey => {
                await LoadTagFile(linkKey);

                if(modifiedFiles[linkKey]?.metadata_tags?.[track.key]) {
                  modifiedFiles[linkKey].metadata_tags[track.key].label = track.label;
                  modifiedFiles[linkKey].metadata_tags[track.key].description = track.description;
                }
              })
            );

            break;

          case "delete":
            // Track deleted
            yield Promise.all(
              linkKeys.map(async linkKey => {
                await LoadTagFile(linkKey);

                if(modifiedFiles[linkKey]?.metadata_tags?.[track.key]) {
                  delete modifiedFiles[linkKey].metadata_tags[track.key];
                }
              })
            );
            break;
        }

         */

        // End of track handling
        continue;
      }

      // Tag modified
      const tag = action.modifiedItem;

      if(tag.trackKey === "primary-content") {
        // Primary content is handled elsewhere
        return;
      }

      switch(action.action) {
        // Create new tag
        case "create":
          if(!tagsToAdd[tag.trackKey]) {
            tagsToAdd[tag.trackKey] = [];
          }

          tagsToAdd[tag.trackKey].push(tag);

          break;

        case "modify":
          yield this.rootStore.aiStore.QueryAIAPI({
            objectId,
            path: UrlJoin("/tagstore", objectId, "tags", tag.tagId),
            channelAuth: true,
            method: "PATCH",
            body: {
              start_time: Math.floor(tag.startTime * 1000),
              end_time: Math.ceil(tag.endTime * 1000),
              tag: tag.text
            }
          });

          break;

        case "delete":
          yield this.rootStore.aiStore.QueryAIAPI({
            objectId,
            path: UrlJoin("/tagstore", objectId, "tags", tag.tagId),
            channelAuth: true,
            method: "DELETE"
          });

          break;
      }
    }

    const userAddress = yield this.rootStore.client.CurrentAccountAddress();

    yield Promise.all(
      Object.keys(tagsToAdd).map(async trackKey => {
        await this.rootStore.aiStore.QueryAIAPI({
          objectId,
          path: UrlJoin("/tagstore", objectId, "tags"),
          channelAuth: true,
          method: "POST",
          format: "JSON",
          body: {
            author: userAddress,
            track: trackKey,
            tags: tagsToAdd[trackKey].map(tag => ({
              start_time: Math.floor(tag.startTime * 1000),
              end_time: Math.ceil(tag.endTime * 1000),
              tag: tag.text
            }))
          }
        });
      })
    );
  });


  SaveClips = flow(function * () {
    // Most recent actions first so older actions can be ignored
    const actions = [
      ...this.rootStore.editStore.editInfo.tags.actionStack,
      ...this.rootStore.editStore.editInfo.clips.actionStack
    ].reverse();

    if(actions.length === 0) { return; }

    const objectId = this.rootStore.videoStore.videoObject.objectId;
    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});

    const clips = (yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/clips/metadata_tags"
    })) || {};

    const formattedActions = this.FormatActions(actions, ["clip"]);

    if(formattedActions.length === 0) { return; }

    for(const action of formattedActions) {
      if(action.type === "track") {
        const track = action.modifiedItem;

        // Track modified
        switch(action.action) {
          case "create":
          case "modify":
            // Label or color changed
            if(!track.requiresSave) {
              // Only color changed, no need to modify files
              continue;
            }

            if(!clips?.[track.key]) {
              clips[track.key] = { metadata_tags: [] };
            }

            clips[track.key].label = track.label || "";
            clips[track.key].description = track.description || "";

            break;

          case "delete":
            // Track deleted
            if(clips?.[track.key]) {
              delete clips[track.key];
            }

            break;
        }

        // End of track handling
        continue;
      }

      // Tag modified
      const tag = action.modifiedItem;
      const tagOrigin = tag.o || {};

      if(tag.trackKey === "primary-content") {
        // Primary content is handled elsewhere
        return;
      }

      switch(action.action) {
        // Create new tag
        case "create":
          // Ensure track is present in file
          if(!clips[tag.trackKey]) {
            clips[tag.trackKey] = {
              label: this.rootStore.trackStore.Track(tag.trackKey).label,
              tags: [],
              version: 1
            };
          }

          clips[tag.trackKey].tags.push({
            id: tag.tagId,
            text: tag.text,
            start_time: Math.floor(tag.startTime * 1000),
            end_time: Math.ceil(tag.endTime * 1000),
          });

          break;

        case "modify":
          clips[tag.trackKey].tags[tagOrigin.ti] = {
            tagId: tag.tagId,
            ...clips[tag.trackKey].tags[tagOrigin.ti],
            text: tag.text,
            start_time: Math.floor(tag.startTime * 1000),
            end_time: Math.ceil(tag.endTime * 1000),
          };

          break;

        case "delete":
          clips[tag.trackKey].tags =
            clips[tag.trackKey].tags
              .filter((_, i) => i !== tagOrigin.ti);

          break;
      }
    }

    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "/clips/metadata_tags",
      metadata: Unproxy(clips)
    });
  });

  SaveOverlayTags = flow(function * () {
    // Most recent actions first so older actions can be ignored
    const actions = [
      ...this.rootStore.editStore.editInfo.tags.actionStack,
      ...this.rootStore.editStore.editInfo.clips.actionStack
    ].reverse();

    if(actions.length === 0) { return; }

    // eslint-disable-next-line no-console
    console.warn("Warning: Overlay tag saving not yet supported in tagstore API. Changes have not been saved");
    return;

    const objectId = this.rootStore.videoStore.videoObject.objectId;
    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});

    let modifiedFiles = {};
    let fileHashes = {};
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

      // Hash the content so we can determine if the file was actually changed
      fileHashes[linkKey] = await this.CreateHash(JSON.stringify(modifiedFiles[linkKey]));
    };

    const formattedActions = this.FormatActions(actions, ["overlay", "track"]);

    if(formattedActions.length === 0) { return; }

    const linkInfo = (yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/video_tags/overlay_tags"
    })) || {};

    for(const action of formattedActions) {
      if(action.type === "track") {
        const track = action.modifiedItem;

        // All of the files that need modification
        const linkKeys = action.page === "clips" ? ["clips"] : [...Object.keys(linkInfo), "user"];

        // Track modified
        switch(action.action) {
          // No action needed for create - tracks are created automatically via adding tags
          // No action needed for modify - overlay tags don't carry any track info

          // When tracks deleted, we must go into *all* files and remove them
          case "delete":
            // Track deleted
            yield Promise.all(
              linkKeys.map(async linkKey => {
                await LoadTagFile(linkKey);

                Object.keys(modifiedFiles[linkKey]?.overlay_tags?.frame_level_tags || {}).forEach(frame => {
                  // Delete track
                  delete modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][track.key];

                  // Prune empty frame
                  if(
                    // Nothing left
                    Object.keys(modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame]).length === 0 ||
                    (
                      // or only timestamp_sec left
                      Object.keys(modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame]).length === 1 &&
                      modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame].timestamp_sec
                    )
                  ) {
                    // Delete frame
                    delete modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame];
                  }
                });
              })
            );
            break;
        }

        // End track handling
        continue;
      }

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
            id: tag.tagId,
            text: tag.text,
            box: tag.box,
            confidence: tag.confidence
          });

          break;

        case "modify":
          modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey].tags[tagOrigin.ti] = {
            id: tag.tagId,
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

          // Prune empty track
          if(modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey].tags.length === 0) {
            delete modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame][trackKey];
          }

          // Prune empty frame
          if(
            // Nothing left
            Object.keys(modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame]).length === 0 ||
            (
              // or only timestamp_sec left
              Object.keys(modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame]).length === 1 &&
              modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame].timestamp_sec
            )
          ) {
            // Delete frame
            delete modifiedFiles[linkKey].overlay_tags.frame_level_tags[frame];
          }
          break;
      }
    }

    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    let fileInfo = [];
    yield Promise.all(
      Object.keys(modifiedFiles).map(async linkKey => {
        if(fileHashes[linkKey] === await this.CreateHash(JSON.stringify(modifiedFiles[linkKey]))) {
          return;
        }

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
        fileInfo,
        callback: fileProgress => {
          const uploaded = Object.keys(fileProgress).map(filename => fileProgress[filename].uploaded)
            .reduce((acc, value) => acc + value, 0);
          const total = Object.keys(fileProgress).map(filename => fileProgress[filename].total)
            .reduce((acc, value) => acc + value, 0);

          runInAction(() => this.saveProgress.overlay = uploaded / total);
        }
      });
    }
  });

  SavePrimaryClip = flow(function * () {
    // Start/end time clip
    const {startTime, endTime} = this.rootStore.trackStore.ClipInfo();

    const startFrame = this.rootStore.videoStore.TimeToFrame(startTime);
    const endFrame = Math.min(
      this.rootStore.videoStore.TimeToFrame(endTime),
      this.rootStore.videoStore.totalFrames - 1
    );

    const startTimeRat = startFrame === 0 ? null :
      this.rootStore.videoStore.FrameToRat(startFrame);
    const endTimeRat = endFrame >= this.rootStore.videoStore.totalFrames - 1 ? null :
      this.rootStore.videoStore.FrameToRat(endFrame);

    const offering = this.rootStore.videoStore.metadata.offerings[this.rootStore.videoStore.offeringKey];

    if(offering.entry_point_rat === startTimeRat && offering.exit_point_rat === endTimeRat) {
      // Clip points not changed
      return;
    }

    const objectId = this.rootStore.videoStore.videoObject.objectId;
    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});
    const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken: writeToken,
      metadataSubtree: `offerings/${this.rootStore.videoStore.offeringKey}/entry_point_rat`,
      metadata: startTimeRat
    });

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken: writeToken,
      metadataSubtree: `offerings/${this.rootStore.videoStore.offeringKey}/exit_point_rat`,
      metadata: endTimeRat
    });
  });

  async CreateHash(content) {
    return Array.from(
      new Uint8Array(
        await window.crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(content)
        )
      )
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  RegenerateLiveToVOD = flow(function * ({liveObjectId, vodObjectId, vodObjectLibraryId, title}) {
    const progressKey = liveObjectId || vodObjectId;
    try {
      this.liveToVodProgress[progressKey] = 0;

      let liveObjectLibraryId, isNew;
      if(!vodObjectId) {
        // Find existing vod or create new one
        liveObjectLibraryId = yield this.client.ContentObjectLibraryId({objectId: liveObjectId});

        const vods = yield this.client.ContentObjectMetadata({
          libraryId: liveObjectLibraryId,
          objectId: liveObjectId,
          metadataSubtree: "live_recording_copies"
        });

        if(!vods || Object.keys(vods || {}).length === 0) {
          // Create vod object
          isNew = true;
          const contentTypes = yield this.client.ContentTypes();
          const contentType =
            contentTypes.find(type =>
              type.name?.toLowerCase()?.includes("title") &&
              !type.name?.toLowerCase()?.includes("master")
            ) ||
            contentTypes.find(type => type.name?.toLowerCase()?.includes("mez"));

          vodObjectId = (yield this.client.CreateAndFinalizeContentObject({
            libraryId: vodObjectLibraryId || liveObjectLibraryId,
            options: {
              type: contentType?.id,
              visibility: "editable"
            },
            commitMessage: `Create VoD from Live Object ${liveObjectId}`,
            callback: async ({objectId, writeToken}) => {
              await this.client.ReplaceMetadata({
                libraryId: liveObjectLibraryId,
                objectId,
                writeToken,
                metadata: {
                  name: title || "",
                  public: {
                    name: title,
                    asset_metadata: {
                      title,
                      display_title: title
                    }
                  },
                  live_recording_info: {
                    stream_version_hash: await this.client.LatestVersionHash({
                      objectId: liveObjectId
                    })
                  }
                }
              });
            }
          })).id;

          vodObjectLibraryId = liveObjectLibraryId;
        }

        vodObjectId = Object.keys(vods)[0];
      } else if(!liveObjectId && vodObjectId) {
        // Find live stream ID from vod
        vodObjectLibraryId = yield this.client.ContentObjectLibraryId({objectId: vodObjectId});

        const liveHash = yield this.client.ContentObjectMetadata({
          libraryId: vodObjectLibraryId,
          objectId: vodObjectId,
          metadataSubtree: "live_recording_info/stream_version_hash"
        });

        if(liveHash) {
          liveObjectId = this.client.utils.DecodeVersionHash(liveHash).objectId;
        }
      }

      if(!vodObjectId || !liveObjectId) {
        throw `VoD or Live Stream ID not determinable: ${vodObjectId}, ${liveObjectId}`;
      }

      vodObjectLibraryId = vodObjectLibraryId || (yield this.client.ContentObjectLibraryId({objectId: vodObjectId}));

      const liveHash = yield this.client.LatestVersionHash({objectId: liveObjectId});

      this.liveToVodProgress[progressKey] = 5;
      const vodWriteToken = (yield this.client.EditContentObject({
        libraryId: vodObjectLibraryId,
        objectId: vodObjectId
      })).writeToken;

      this.liveToVodProgress[progressKey] = 10;
      yield this.client.CallBitcodeMethod({
        libraryId: vodObjectLibraryId,
        objectId: vodObjectId,
        writeToken: vodWriteToken,
        method: "/media/live_to_vod/init",
        body: {
          "live_qhash": liveHash,
          "variant_key": "default",
          "include_tags": true, // Copy video tags from live stream,
          "recording_period": -1
        },
        constant: false,
        format: "text"
      });

      const abrMezInitBody = {
        abr_profile: ABRProfileLiveToVod,
        offering_key: "default",
        prod_master_hash: vodWriteToken,
        variant_key: "default",
        keep_other_streams: !isNew, // Preserve thumbnails
        additional_offering_specs: {
          // Default dash offering for chromecast
          default_dash: [
            {
              op: "replace",
              path: "/playout/playout_formats",
              value: {
                "dash-clear": {
                  "drm": null,
                  "protocol": {
                    "min_buffer_length": 2,
                    "type": "ProtoDash"
                  }
                }
              }
            }
          ]
        }
      };

      this.liveToVodProgress[progressKey] = 30;
      yield this.client.CallBitcodeMethod({
        libraryId: vodObjectLibraryId,
        objectId: vodObjectId,
        writeToken: vodWriteToken,
        method: "/media/abr_mezzanine/init",
        body: abrMezInitBody,
        constant: false,
        format: "text"
      });

      this.liveToVodProgress[progressKey] = 40;
      yield this.client.CallBitcodeMethod({
        libraryId: vodObjectLibraryId,
        objectId: vodObjectId,
        writeToken: vodWriteToken,
        method: "/media/live_to_vod/copy",
        body: {
          "variant_key": "default",
          "offering_key": "default",
        },
        constant: false,
        format: "text"
      });

      this.liveToVodProgress[progressKey] = 60;
      yield this.client.CallBitcodeMethod({
        libraryId: vodObjectLibraryId,
        objectId: vodObjectId,
        writeToken: vodWriteToken,
        method: "/media/abr_mezzanine/offerings/default/finalize",
        body: abrMezInitBody,
        constant: false,
        format: "text"
      });

      this.liveToVodProgress[progressKey] = 75;
      yield this.client.FinalizeContentObject({
        libraryId: vodObjectLibraryId,
        objectId: vodObjectId,
        writeToken: vodWriteToken,
        commitMessage: "EVIE: Generate live Stream to VoD"
      });

      this.liveToVodProgress[progressKey] = 90;


      if(this.rootStore.videoStore.initialized) {
        yield this.rootStore.videoStore.thumbnailStore.GenerateVideoThumbnails();
      }

      /*
      let thumbnailStatus = {};
      do {
        yield new Promise(resolve => setTimeout(resolve, 5000));
        thumbnailStatus = yield this.rootStore.videoStore.thumbnailStore.ThumbnailGenerationStatus();

        this.liveToVodProgress[progressKey] = 50 + (45 * (thumbnailStatus?.progress || 0) / 100);
      } while(!["failed", "finished"].includes(thumbnailStatus?.state));

      if(thumbnailStatus?.state === "finished") {
        yield this.rootStore.videoStore.thumbnailStore.ThumbnailGenerationStatus({finalize: true});
      }

       */


      if(this.rootStore.videoStore.videoObject?.objectId === vodObjectId) {
        this.rootStore.videoStore.Reload();
      }

      return vodObjectId;
    } catch(error) {
      console.error("Failed to update vod from live", liveObjectId, vodObjectId);
      console.error(error);
    } finally {
      delete this.liveToVodProgress[progressKey];
    }
  });
}

export default EditStore;
