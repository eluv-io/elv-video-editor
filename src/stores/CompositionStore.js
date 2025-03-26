import {flow, makeAutoObservable} from "mobx";
import VideoStore from "@/stores/VideoStore.js";
import {Unproxy} from "@/utils/Utils.js";
import UrlJoin from "url-join";
import {ExtractHashFromLink} from "@/stores/Helpers.js";
import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";

class CompositionStore {
  videoStore;
  name = "";
  loading = false;
  clipStores = {};

  filter = "";

  compositionObject;
  compositionPlayoutUrl;
  sourceClipId;
  writeTokenInfo = {};

  clips = {};
  clipIdList = [];
  selectedClipId;
  aiClipIds = [];

  draggingClip;
  showDragShadow = false;
  dropIndicatorIndex;

  mousePositionX = 0;
  mousePositionY = 0;

  clipMuted = true;
  clipVolume = 1;
  compositionMuted = true;
  compositionVolume = 1;

  saved = false;

  _actionStack = [];
  _redoStack = [];
  _position = 0;

  get client() {
    return this.rootStore.client;
  }

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;

    this.Reset();
  }

  get nextUndoAction() {
    return this._actionStack.slice(-1)[0];
  }

  get nextRedoAction() {
    return this._redoStack.slice(-1)[0];
  }

  get initialized() {
    return this.videoStore.initialized;
  }

  get ready() {
    return this.videoStore.ready;
  }

  get videoObject() {
    return this.videoStore.ready && this.videoStore.videoObject;
  }

  get compositionDurationFrames() {
    if(this.clipIdList.length === 0) {
      return this.videoStore.frameRate * 30;
    }

    return this.clipList.reduce((v, c) => v + (c.clipOutFrame + 1 - c.clipInFrame), 0);
  }

  get compositionDuration() {
    if(this.clipIdList.length === 0) {
      return 30;
    }

    return this.videoStore.FrameToTime(this.videoStore.totalFrames);
  }

  get clipList() {
    // Any time the clip list gets re-rendered, update the playout url
    this.UpdateComposition()
      .then(() => this.GetCompositionPlayoutUrl());

    let startFrame = 0;
    return this.clipIdList
      .map((clipId, index) => {
        const clip = this.clips[clipId];
        const clipStartFrame = startFrame;
        const clipEndFrame = clipStartFrame + (clip.clipOutFrame - clip.clipInFrame);

        startFrame += clip.clipOutFrame - clip.clipInFrame;

        return {
          ...clip,
          listIndex: index,
          startFrame: clipStartFrame,
          endFrame: clipEndFrame
        };
      });
  }

  get aiClips() {
    return this.aiClipIds
      .map(clipId => this.clips[clipId])
      .filter(clip =>
        !this.filter ||
        clip.name?.toLowerCase()?.includes(this.filter)
      );
  }

  get selectedClipStore() {
    return this.clipStores[this.selectedClip?.storeKey];
  }

  get selectedClip() {
    return this.clips[this.selectedClipId];
  }

  get sourceClip() {
    return this.clips[this.sourceClipId];
  }

  get sourceVideoStore() {
    return this.clipStores[this.sourceClip?.storeKey];
  }

  PerformAction({label, Action, ...attrs}, fromRedo=false) {
    const originalData = {
      clipIdList: Unproxy(this.clipIdList),
      clips: Unproxy(this.clips)
    };

    const result = Action();

    this._actionStack.push({
      id: this.rootStore.NextId(),
      label,
      Action,
      Undo: () => {
        this.clips = originalData.clips;
        this.clipIdList = originalData.clipIdList;
      },
      addedAt: Date.now(),
      ...attrs
    });

    this._position++;

    // Undid action(s), but performed new action - Drop redo stack for this context
    if(!fromRedo) {
      this._redoStack = [];
    }

    this.saved = false;

    return result;
  }

  SetCompositionName(name) {
    this.compositionObject.name = name;
  }

  ClipIndexAt(frame) {
    if(frame === 0) {
      return 0;
    }

    let index = this.clipList.findIndex(clip => clip.endFrame > frame);

    return index < 0 ? this.clipIdList.length : index;
  }

  ProgressToClipIndex(progress) {
    let index = this.clipIdList.length;
    if(progress <= 0) {
      index = 0;
    } else if(progress) {
      let p = 0;
      for(let i = 0 ; i < this.clipIdList.length ; i++) {
        const clip = this.clipList[i];
        const clipProgress = (clip.clipOutFrame - clip.clipInFrame) / this.compositionDurationFrames;

        if(progress <= p + clipProgress) {
          // Progress is within this clip - Determine if it's before or after the halfway point
          index = (progress - p) < clipProgress / 2 ? i : i + 1;

          break;
        }

        p += clipProgress;
      }
    }

    return index;
  }

  AppendClip(clip) {
    this.AddClip({...clip, clipId: "new"}, 100);
  }

  AddClip(clip, progress) {
    clip = Unproxy(clip);
    const clipId = clip.clipId === "new" ? this.rootStore.NextId() : clip.clipId;

    this.PerformAction({
      label: "Add Clip",
      Action: () => {
        this.clipIdList = this.clipIdList.filter(clipId => clipId !== clip.clipId);

        const index = this.ProgressToClipIndex(progress);

        this.clips[clipId] = {
          ...clip,
          clipId
        };

        this.clipIdList = this.clipIdList.toSpliced(index, 0, clipId);
      }
    });
  }

  ModifyClip({clipId, attrs={}, label}) {
    const clip = Unproxy(this.clips[clipId]);
    const Modify = () => {
      this.clips[clipId] = {
        ...clip,
        ...attrs
      };
    };

    if(clip.clipId === "new") {
      // No undo/redo for clips not on timeline
      Modify();
    } else {
      this.PerformAction({
        label: label || "Modify Clip",
        Action: Modify
      });
    }

  }

  RemoveClip(clipId) {
    this.PerformAction({
      label: "Remove Clip",
      Action: () => {
        this.clipIdList = this.clipIdList.filter(id => id !== clipId);
        delete this.clips[clipId];
      }
    });

    if(this.selectedClipId === clipId) {
      this.SetSelectedClip(this.sourceClipId);
    }
  }

  SplitClip(progress) {
    const frame = Math.floor(this.compositionDurationFrames * (progress / 100));
    const clipIndex = this.ClipIndexAt(frame);
    const clip = this.clips[this.clipIdList[clipIndex]];

    if(!clip) { return; }

    // Convert composition frame relative to clip
    const clipStartFrame = this.clipList[clipIndex].startFrame;
    const clipSplitFrame = frame - clipStartFrame;

    const clip1 = {
      ...clip,
      clipId: this.rootStore.NextId(),
      clipOutFrame: clip.clipInFrame + clipSplitFrame
    };

    const clip2 = {
      ...clip,
      clipId: this.rootStore.NextId(),
      clipInFrame: clip1.clipOutFrame + 1
    };

    if(
      clip1.clipOutFrame - clip1.clipInFrame < this.videoStore.frameRate ||
      clip2.clipOutFrame - clip2.clipInFrame < this.videoStore.frameRate
    ) {
      // Split results in a clip that is too small
      return;
    }

    this.PerformAction({
      label: "Split Clip",
      Action: () => {
        this.clips[clip1.clipId] = clip1;
        this.clips[clip2.clipId] = clip2;

        this.clipIdList = this.clipIdList
          .toSpliced(clipIndex, 0, clip2.clipId)
          .toSpliced(clipIndex, 0, clip1.clipId)
          .filter(id => id !== clip.clipId);

        delete this.clips[clip.clipId];
      }
    });

    if(this.selectedClipId === clip.clipId) {
      this.SetSelectedClip(clip1.clipId);
    }
  }

  SetDropIndicator(progress) {
    this.dropIndicatorIndex = this.ProgressToClipIndex(progress);
  }

  ClearDropIndicator() {
    this.dropIndicatorIndex = undefined;
  }

  SetMousePosition(event) {
    this.mousePositionX = event.clientX;
    this.mousePositionY = event.clientY;
  }

  SetDragging({clip, showDragShadow, createNewClip}) {
    this.draggingClip = {
      ...clip,
      clipId: createNewClip ? this.rootStore.NextId() : clip.clipId,
    };

    if(showDragShadow) {
      this.showDragShadow = true;

      document.body.addEventListener("dragover", this.SetMousePosition.bind(this), true);
      document.body.addEventListener("drop", this.EndDrag.bind(this));
    }
  }

  EndDrag() {
    this.draggingClip = undefined;
    this.showDragShadow = false;

    this.ClearDropIndicator();

    document.body.removeEventListener("dragover", this.SetMousePosition.bind(this), true);
    document.body.removeEventListener("drop", this.EndDrag.bind(this));

    this.mousePositionX = 0;
    this.mousePositionY = 0;
  }

  Reset() {
    this.videoStore = new VideoStore(this.rootStore, {tags: false, channel: true});
    this.videoStore.id = "Composition Store";
    this.saved = false;

    this.clipStores = {};
    this.clips = {};
    this.clipIdList = [];
    this.aiClipIds = [];
    this.selectedClipId = undefined;
    this.name = "";
    this.filter = "";
  }

  SetFilter(filter) {
    this.filter = filter;
  }

  SetVideo = flow(function * ({objectId, preferredOfferingKey}) {
    this.loading = true;
    yield this.videoStore.SetVideo({objectId, preferredOfferingKey});

    this.name = this.videoStore.name;

    this.loading = false;
  });

  ClipStore({objectId, offering, clipId}) {
    const key = this.clips[clipId]?.storeKey || `${objectId}-${offering}`;

    return this.clipStores[key];
  }

  SetSelectedClip(clipId) {
    this.selectedClipId = clipId;
  }

  ModifySelectedClip({...attrs}) {
    if(attrs.clipInFrame || attrs.clipOutFrame) {
      // Set clip points in store and use store check to ensure valid points
      const {clipInFrame, clipOutFrame} = this.selectedClipStore.SetClipMark({
        inFrame: attrs.clipInFrame || this.selectedClip.clipInFrame,
        outFrame: attrs.clipOutFrame || this.selectedClip.clipOutFrame
      });

      attrs.clipInFrame = clipInFrame;
      attrs.clipOutFrame = clipOutFrame;
    }

    this.clips[this.selectedClipId] = {
      ...this.clips[this.selectedClipId],
      ...attrs
    };
  }

  ClearSelectedClip() {
    this.selectedClipId = undefined;
  }

  InitializeClip = flow(function * ({objectId, offering="default", clipInFrame, clipOutFrame, source}) {
    const key = `${objectId}-${offering}`;
    if(!this.clipStores[key]) {
      this.clipLoading = true;

      const clipStore = new VideoStore(
        this.rootStore,
        {
          tags: false,
          clipKey: key
        }
      );

      clipStore.id = `Clip Store ${key}`;
      clipStore.sliderMarks = 20;
      clipStore.majorMarksEvery = 5;

      yield clipStore.SetVideo({objectId, preferredOfferingKey: offering, noTags: true});
      this.clipStores[key] = clipStore;
    }

    const store = this.clipStores[key];

    const clipId = "new";
    this.clips[clipId] = {
      clipId,
      name: `${store.name} Clip`,
      libraryId: store.videoObject.libraryId,
      objectId: store.videoObject.objectId,
      versionHash: store.videoObject.versionHash,
      offering: store.offeringKey,
      clipInFrame: clipInFrame || 0,
      clipOutFrame: clipOutFrame || store.totalFrames - 1,
      storeKey: `${store.videoObject.objectId}-${store.offeringKey}`,
      clipKey: `${store.videoObject.objectId}-${store.offeringKey}-${clipInFrame}-${clipOutFrame}`
      // TODO: Audio
      //audioRepresentation: store.audioRepresentation,
    };

    if(!store.totalFrames && source) {
      store.InitializeCallback = () => {
        this.clips[clipId].clipOutFrame = store.totalFrames - 2;
      };
    }

    this.clipLoading = false;

    return clipId;
  });

  CompositionProgressToSMPTE(progress) {
    return this.videoStore.TimeToSMPTE(this.compositionDuration * progress / 100);
  }

  // Create/update/load channel objects
  CreateComposition = flow(function * ({type, sourceObjectId, name, key, prompt}) {
    /*
    const contentTypes = yield this.client.ContentTypes();
    const channelType =
      Object.values(contentTypes).find(type => type.name?.toLowerCase()?.includes("- channel")) ||
      Object.values(contentTypes).find(type =>
        type.name?.toLowerCase()?.includes("- title") &&
        type.name?.toLowerCase()?.includes("master")
      );

     */

    const sourceLibraryId = yield this.client.ContentObjectLibraryId({objectId: sourceObjectId});
    const sourceMetadata = yield this.client.ContentObjectMetadata({
      libraryId: sourceLibraryId,
      objectId: sourceObjectId,
      select: [
        "offerings/*/playout",
        "offerings/*/media_struct/streams/*/rate",
        "/public"
      ]
    });

    const offerings = Object.keys(sourceMetadata.offerings);
    const offeringKey = offerings.includes("default") ? "default" : offerings[0];
    const playoutMetadata = sourceMetadata.offerings[offeringKey].playout;
    const offeringOptions = sourceMetadata.offerings?.[offeringKey]?.media_struct?.streams || {};

    let frameRate;
    if(offeringOptions.video) {
      frameRate = offeringOptions.video.rate;
    } else {
      const videoKey = Object.keys(offeringOptions).find(key => key.startsWith("video"));
      frameRate = offeringOptions[videoKey].rate;
    }

    const sourceWriteToken = yield this.WriteToken(sourceObjectId);

    let items = [];
    if(type === "ai") {
      const highlights = yield this.GenerateAIHighlights({objectId: sourceObjectId, prompt});
      const videoHandler = new FrameAccurateVideo({frameRateRat: frameRate});

      items = highlights.map(clip => {
        const clipInFrame = videoHandler.TimeToFrame(clip.start_time / 1000);
        const clipOutFrame = videoHandler.TimeToFrame(clip.end_time / 1000);

        return {
          display_name: clip.reason,
          source: {
            "/": UrlJoin("./", "rep", "playout", offeringKey)
          },
          slice_start_rat: videoHandler.FrameToRat(clipInFrame),
          slice_end_rat: videoHandler.FrameToRat(clipOutFrame),
          duration_rat: videoHandler.FrameToRat(clipOutFrame - clipInFrame),
          type: "mez_vod"
        };
      });
    }

    let channelMetadata = {
      name,
      key,
      playout_type: "ch_vod",
      playout: playoutMetadata,
      items,
      source_info: {
        libraryId: sourceLibraryId,
        objectId: sourceObjectId,
        name: sourceMetadata?.public?.name,
        offeringKey,
        frameRate
      }
    };

    yield this.client.ReplaceMetadata({
      libraryId: sourceLibraryId,
      objectId: sourceObjectId,
      writeToken: sourceWriteToken,
      metadataSubtree: UrlJoin("/channel", "offerings", key),
      metadata: Unproxy(channelMetadata)
    });
  });

  GetCompositionPlayoutUrl = flow(function * () {
    if(!this.compositionObject || this.clipIdList.length === 0) { return; }

    const {objectId, compositionKey} = this.compositionObject;
    const writeToken = yield this.WriteToken(objectId, false);

    const playoutOptions = (yield this.client.PlayoutOptions({
      objectId,
      writeToken,
      handler: "channel",
      offering: compositionKey
    }));

    const playoutUrl = new URL(
      playoutOptions.hls.playoutMethods.clear?.playoutUrl ||
      playoutOptions.hls.playoutMethods["aes-128"]?.playoutUrl
    );
    playoutUrl.searchParams.set("uid", Math.random());

    // TODO: Client should use write token in generated urls
    playoutUrl.pathname = playoutUrl.pathname.replace(
      this.compositionObject.versionHash,
      writeToken
    );

    this.compositionPlayoutUrl = playoutUrl.toString();

    return playoutUrl;
  });

  UpdateComposition = flow(function * () {
    if(!this.compositionObject) { return; }

    this.seekProgress = this.videoStore.seek;

    const {libraryId, objectId, sourceObjectId, sourceOfferingKey, compositionKey} = this.compositionObject;
    const writeToken = yield this.WriteToken(objectId);
    const sourceHash = yield this.client.LatestVersionHash({objectId: sourceObjectId});

    let sourceLink;
    if(objectId === sourceObjectId) {
      sourceLink = {
        "/": UrlJoin("./", "rep", "playout", sourceOfferingKey)
      };
    } else {
      sourceLink = {
        "/": UrlJoin("/qfab", sourceHash, "rep", "playout", sourceOfferingKey)
      };
    }

    const items = this.clipList.map(clip => {
      const store = this.clipStores[clip.storeKey];

      // Actual duration may be lower than what the video element projects
      const sourceEndFrame = store.videoHandler.RatToFrame(store.metadata.offerings[clip.offering].media_struct.duration_rat);

      let clipOutFrame = Math.min(clip.clipOutFrame, sourceEndFrame - 1);

      return {
        display_name: clip.name,
        source: sourceLink,
        slice_start_rat: store.videoHandler.FrameToRat(clip.clipInFrame || 0),
        slice_end_rat: store.videoHandler.FrameToRat(clipOutFrame || store.totalFrames - 1),
        duration_rat: store.videoHandler.FrameToRat((clipOutFrame || store.totalFrames - 1) - (clip.clipInFrame || 0)),
        type: "mez_vod"
      };
    });

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: UrlJoin("/channel", "offerings", compositionKey, "items"),
      metadata: Unproxy(items)
    });

    this.GetCompositionPlayoutUrl();
  });

  SaveComposition = flow(function * () {
    yield this.UpdateComposition();

    const {libraryId, objectId} = this.compositionObject;
    const writeToken = yield this.WriteToken(objectId);

    yield this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken,
      commitMessage: "EVIE Composition"
    });

    this.saved = true;

    delete this.writeTokenInfo[objectId];

    this.GetCompositionPlayoutUrl();
  });

  //TODO: Keyboard controls - handle overlapping clip points ] [

  SetCompositionObject = flow(function * ({objectId, compositionKey}) {
    yield this.LoadWriteTokens();

    const libraryId = yield this.client.ContentObjectLibraryId({objectId});
    const versionHash = yield this.client.LatestVersionHash({objectId});
    const writeToken = yield this.WriteToken(objectId);
    const metadata = yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: UrlJoin("/channel", "offerings", compositionKey)
    });

    this.sourceClipId = yield this.InitializeClip({objectId: metadata.source_info.objectId, source: true});
    this.SetSelectedClip(this.sourceClipId);

    yield this.videoStore.SetVideo({objectId, preferredOfferingKey: compositionKey, noTags: true});

    const videoHandler = new FrameAccurateVideo({frameRateRat: this.selectedClipStore.frameRateRat});

    this.videoStore.SetFrameRate({rateRat: this.selectedClipStore.frameRateRat});

    this.videoStore.videoHandler = videoHandler;

    this.clipIdList = yield Promise.all(
      (metadata.items || []).map(async item => {
        const clipId = this.rootStore.NextId();
        const clipVersionHash = ExtractHashFromLink(item.source) || versionHash;
        const objectId = this.client.utils.DecodeVersionHash(clipVersionHash).objectId;
        const libraryId = await this.client.ContentObjectLibraryId({objectId});
        const offeringKey = item.source["/"].split("/").slice(-1)[0];

        const clipInFrame = videoHandler.RatToFrame(item.slice_start_rat);
        const clipOutFrame = videoHandler.RatToFrame(item.slice_end_rat);

        this.clips[clipId] = {
          clipId,
          name: item.display_name,
          libraryId,
          objectId,
          versionHash: clipVersionHash,
          offering: offeringKey,
          clipInFrame,
          clipOutFrame,
          storeKey: `${objectId}-${offeringKey}`,
          clipKey: `${objectId}-${offeringKey}-${clipInFrame}-${clipOutFrame}`
          // TODO: Audio
          //audioRepresentation: store.audioRepresentation,
        };

        return clipId;
      })
    );

    this.compositionObject = {
      libraryId,
      objectId,
      versionHash,
      sourceObjectId: metadata.source_info.objectId,
      sourceOfferingKey: metadata.source_info.offeringKey || "default",
      sourceName: metadata.source_info.name,
      name: metadata.name,
      compositionKey,
      metadata
    };

    this.GetCompositionPlayoutUrl();

    try {
      const highlights = yield this.GenerateAIHighlights({objectId});

      let aiClipIds = [];
      for(const clip of highlights) {
        const clipInFrame = videoHandler.TimeToFrame(clip.start_time / 1000);
        const clipOutFrame = videoHandler.TimeToFrame(clip.end_time / 1000);
        const clipId = this.rootStore.NextId();
        this.clips[clipId] = {
          clipId,
          name: clip.reason,
          libraryId,
          objectId,
          versionHash,
          offering: "default",
          clipInFrame,
          clipOutFrame,
          storeKey: `${objectId}-default`,
          clipKey: `${objectId}-default-${clipInFrame}-${clipOutFrame}`
        };

        aiClipIds.push(clipId);
      }

      this.aiClipIds = aiClipIds;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  });

  Undo() {
    if(this._actionStack.length === 0) { return; }

    const action = this.nextUndoAction;
    this._actionStack = this._actionStack.filter(otherAction => otherAction.id !== action.id);

    action.Undo();

    this._redoStack.push(action);

    this._position--;

    if(!this.selectedClip) {
      this.ClearSelectedClip();
    }
  }

  Redo() {
    if(this._redoStack.length === 0) { return; }

    const action = this.nextRedoAction;
    this._redoStack = this._redoStack.filter(otherAction => otherAction.id !== action.id);

    this.PerformAction(action, true);

    if(!this.selectedClip) {
      this.ClearSelectedClip();
    }
  }

  WriteToken = flow(function * (objectId, create=true) {
    objectId = objectId || this.compositionObject.objectId;

    if(!this.writeTokenInfo[objectId] && create) {
      const libraryId = yield this.client.ContentObjectLibraryId({objectId});
      this.writeTokenInfo[objectId] = yield this.client.EditContentObject({libraryId, objectId});

      this.SaveWriteTokens();
    }

    return this.writeTokenInfo[objectId]?.write_token;
  });

  LoadWriteTokens = flow(function * () {
    const tokens = yield this.client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: "composition-write-tokens"
    });

    if(tokens) {
      this.writeTokenInfo = JSON.parse(this.client.utils.FromB64(tokens));
    }
  });

  GenerateAIHighlights = flow(function * ({objectId, prompt}) {
    // TODO: Actually deal with generating status
    const url = new URL(`https://ai.contentfabric.io/ml/highlight_composition/q/${objectId}`);

    if(prompt) {
      url.searchParams.set("customization", prompt);
    }

    const signedToken = yield this.rootStore.client.CreateSignedToken({objectId, duration: 24 * 60 * 60 * 1000});

    return (
      yield (
        yield fetch(
          url,
          {
            headers: {
              Authorization: `Bearer ${signedToken}`
            }
          }
        )
      ).json()
    ).clips;
  });

  async SaveWriteTokens() {
    await this.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: "composition-write-tokens",
      value: this.client.utils.B64(
        JSON.stringify(this.writeTokenInfo || {})
      )
    });
  }

  __UpdateVideoSettings(type, video) {
    if(type === "composition") {
      this.compositionMuted = video.muted;
      this.compositionVolume = video.volume;
    } else {
      this.clipMuted = video.muted;
      this.clipVolume = video.volume;
    }
  }

  async __CheckCompositionKeyExists({objectId, key}) {
    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    return (this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken: await this.WriteToken(objectId, false),
      metadataSubtree: UrlJoin("/channel", "offerings", key, "playout_type")
    }));
  }
}

export default CompositionStore;
