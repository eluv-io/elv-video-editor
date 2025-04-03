import {flow, makeAutoObservable} from "mobx";
import VideoStore from "@/stores/VideoStore.js";
import {Unproxy} from "@/utils/Utils.js";
import UrlJoin from "url-join";
import {ExtractHashFromLink} from "@/stores/Helpers.js";
import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";

class CompositionStore {
  myCompositions = {};
  myClipIds = [];

  videoStore;
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
  selectedClipSource;
  originalSelectedClipId;
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

  Initialize = flow(function * () {
    yield this.LoadMyCompositions();
  });

  Reset() {
    this.videoStore = new VideoStore(this.rootStore, {tags: false, channel: true});
    this.videoStore.id = "Composition Store";

    this.clipStores = {};
    this.clips = {};
    this.clipIdList = [];
    this.aiClipIds = [];
    this.selectedClipId = undefined;
    this.originalSelectedClipId = undefined;
    this.sourceClipId = undefined;
    this.filter = "";
    this.compositionObject = undefined;
    this.compositionPlayoutUrl = undefined;
    this.draggingClip = undefined;
    this.saved = false;

    this.ResetActions();
  }

  ResetActions() {
    this._actionStack = [];
    this._redoStack = [];
    this._position = 0;
  }

  get nextUndoAction() {
    return this._actionStack.slice(-1)[0];
  }

  get nextRedoAction() {
    return this._redoStack.slice(-1)[0];
  }

  get hasUnsavedChanges() {
    return this._position > 0 || (!this.saved && this.clipIdList.length > 0);
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
    clearTimeout(this.playoutUrlTimeout);

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

  get myClips() {
    return this.myClipIds
      .map(clipId => this.clips[clipId])
      .filter(clip =>
        !this.filter ||
        clip.name?.toLowerCase()?.includes(this.filter)
      );
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

  SetCompositionName(name) {
    this.compositionObject.name = name;
    this.videoStore.name = name;

    this.myCompositions[this.compositionObject.objectId][this.compositionObject.compositionKey].name = name;

    this.UpdateComposition({updatePlayoutUrl: false});
    this.SaveMyCompositions();
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

  ModifyClip({clipId, originalClipId, attrs={}, label}) {
    const clip = Unproxy(this.clips[clipId]);

    const store = this.clipStores[clip.storeKey];
    if(attrs.clipInFrame || attrs.clipOutFrame) {
      // Set clip points in store and use store check to ensure valid points
      const {clipInFrame, clipOutFrame} = store.SetClipMark({
        inFrame: attrs.clipInFrame || clip.clipInFrame,
        outFrame: attrs.clipOutFrame || clip.clipOutFrame
      });

      attrs.clipInFrame = clipInFrame;
      attrs.clipOutFrame = clipOutFrame;
    }

    const Modify = () => {
      this.clips[clipId] = {
        ...clip,
        ...attrs
      };

      if(originalClipId) {
        this.clips[originalClipId] = {
          ...this.clips[originalClipId],
          ...attrs
        };
      }
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
      this.SetSelectedClip({clipId: this.sourceClipId, source: "source-content"});
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
      this.SetSelectedClip({clipId: clip1.clipId, source: "timeline"});
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

  SetDragging({source, clip, showDragShadow, createNewClip}) {
    this.draggingClip = {
      ...clip,
      source,
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

  SetFilter(filter) {
    this.filter = filter;
  }

  SetVideo = flow(function * ({objectId, preferredOfferingKey}) {
    this.loading = true;
    yield this.videoStore.SetVideo({objectId, preferredOfferingKey});

    this.loading = false;
  });

  ClipStore({objectId, offering, clipId}) {
    const key = this.clips[clipId]?.storeKey || `${objectId}-${offering}`;

    return this.clipStores[key];
  }

  SetSelectedClip({clipId, source}) {
    if(source === "timeline" || (source === "side-panel" && this.myClipIds.includes(clipId))) {
      // Clip is on timeline or from my clips, changes should apply to it directly
      this.selectedClipId = clipId;
    } else {
      // Clip was selected from sidebar, do not change source clip
      if(this.clips[clipId]) {
        this.clips["new"] = {
          ...Unproxy(this.clips[clipId]),
          clipId: "new"
        };
        this.selectedClipId = "new";
      }
    }

    this.selectedClipSource = source;
    this.originalSelectedClipId = clipId;
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

    const clipId = this.rootStore.NextId();
    this.clips[clipId] = {
      clipId,
      name: `${store.videoObject?.name || store.name} Clip`,
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

  GetCompositionPlayoutUrl = flow(function * (retry=0) {
    if(!this.compositionObject || this.clipIdList.length === 0) { return; }

    try {
      const {objectId, compositionKey} = this.compositionObject;
      const writeToken = yield this.WriteToken({objectId, compositionKey, create: false});

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

      this.compositionPlayoutUrl = playoutUrl.toString();

      return playoutUrl;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Error getting composition playout url:");
      // eslint-disable-next-line no-console
      console.error(error);

      if(retry < 2) {
        yield new Promise(resolve => setTimeout(resolve, 2000));
        yield this.GetCompositionPlayoutUrl(retry + 1);
      }
    }
  });

  // Create/update/load channel objects
  CreateComposition = flow(function * ({
    type,
    sourceObjectId,
    name,
    key,
    prompt,
    regenerate=false,
    StatusCallback
  }) {
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

    if(!this.myCompositions[sourceObjectId]) {
      this.myCompositions[sourceObjectId] = {};
    }

    this.myCompositions[sourceObjectId][key] = {
      objectId: sourceObjectId,
      key,
      label: name,
      saved: false,
      new: true
    };

    const sourceWriteToken = yield this.WriteToken({
      objectId: sourceObjectId,
      compositionKey: key,
      create: true
    });

    let items = [];
    if(type === "ai") {
      const highlights = (yield this.GenerateAIHighlights({
        objectId: sourceObjectId,
        prompt,
        regenerate,
        StatusCallback
      })).clips;

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
      display_name: name,
      key,
      playout_type: "ch_vod",
      playout: playoutMetadata,
      items,
      source_info: {
        libraryId: sourceLibraryId,
        objectId: sourceObjectId,
        name: sourceMetadata?.public?.name,
        offeringKey,
        frameRate,
        type,
        prompt
      }
    };

    yield this.client.ReplaceMetadata({
      libraryId: sourceLibraryId,
      objectId: sourceObjectId,
      writeToken: sourceWriteToken,
      metadataSubtree: UrlJoin("/channel", "offerings", key),
      metadata: Unproxy(channelMetadata)
    });

    this.SaveMyCompositions();
  });

  UpdateComposition = flow(function * ({updatePlayoutUrl=true}={}) {
    if(!this.compositionObject?.objectId) { return; }

    this.seekProgress = this.videoStore.seek;

    const {name, libraryId, objectId, sourceObjectId, sourceOfferingKey, compositionKey} = this.compositionObject;
    const writeToken = yield this.WriteToken({objectId, compositionKey, create: true});
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

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: UrlJoin("/channel", "offerings", compositionKey, "display_name"),
      metadata: name
    });

    if(updatePlayoutUrl) {
      this.GetCompositionPlayoutUrl();
    }
  });

  SaveComposition = flow(function * () {
    const {libraryId, objectId, compositionKey} = this.compositionObject;
    const latestVersionHash = yield this.client.LatestVersionHash({objectId});

    // Ensure composition is up to date
    yield this.UpdateComposition({updatePlayoutUrl: false});

    const writeTokenInfo = this.myCompositions[objectId]?.[compositionKey]?.writeTokenInfo;
    let writeToken = yield this.WriteToken({objectId, compositionKey, create: true});

    if(writeTokenInfo && writeTokenInfo.versionHash !== latestVersionHash) {
      // Write token is based on old version. Discard and generate a new one

      // eslint-disable-next-line no-console
      console.warn("Write token for this composition is based on previous version. Retrieving new write token.");

      const compositionMetadata = yield this.client.ContentObjectMetadata({
        libraryId,
        objectId,
        writeToken,
        metadataSubtree: UrlJoin("/channel", "offerings", compositionKey)
      });

      this.DiscardDraft({objectId, compositionKey, removeComposition: false});

      writeToken = yield this.WriteToken({objectId, compositionKey, create: true});

      // Update new write token with composition metadata
      yield this.client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken,
        metadataSubtree: UrlJoin("/channel", "offerings", compositionKey),
        metadata: compositionMetadata
      });
    }

    this.compositionObject.versionHash = (
      yield this.client.FinalizeContentObject({
        libraryId,
        objectId,
        writeToken,
        commitMessage: "EVIE Composition"
      })
    ).hash;

    yield new Promise(resolve => setTimeout(resolve, 3000));

    this.saved = true;
    this.myCompositions[objectId][compositionKey].saved = true;
    this.SaveMyCompositions();

    this.ResetActions();

    this.DiscardDraft({objectId, compositionKey, removeComposition: false});

    this.GetCompositionPlayoutUrl();
  });

  SetCompositionObject = flow(function * ({objectId, compositionKey}) {
    const libraryId = yield this.client.ContentObjectLibraryId({objectId});
    const versionHash = yield this.client.LatestVersionHash({objectId});
    const writeToken = yield this.WriteToken({objectId, compositionKey, create: false});

    const sourceName = yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "/public/name"
    });

    const metadata = yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: UrlJoin("/channel", "offerings", compositionKey)
    });

    this.sourceClipId = yield this.InitializeClip({objectId, source: true});
    this.SetSelectedClip({clipId: this.sourceClipId, source: "source-content"});

    this.videoStore.sourceVideoStore = this.sourceVideoStore;

    yield this.videoStore.SetVideo({objectId, preferredOfferingKey: compositionKey, noTags: true});

    const videoHandler = new FrameAccurateVideo({frameRateRat: this.selectedClipStore.frameRateRat});

    this.videoStore.SetFrameRate({rateRat: this.selectedClipStore.frameRateRat});

    this.videoStore.videoHandler = videoHandler;

    let updatedClipList = {};
    this.clipIdList = yield Promise.all(
      (metadata?.items || []).map(async item => {
        const clipId = this.rootStore.NextId();
        const clipVersionHash = ExtractHashFromLink(item.source) || versionHash;
        const objectId = this.client.utils.DecodeVersionHash(clipVersionHash).objectId;
        const libraryId = await this.client.ContentObjectLibraryId({objectId});
        const offeringKey = item.source["/"].split("/").slice(-1)[0];

        const clipInFrame = videoHandler.RatToFrame(item.slice_start_rat);
        const clipOutFrame = videoHandler.RatToFrame(item.slice_end_rat);

        updatedClipList[clipId] = {
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

    this.clips = {
      ...this.clips,
      ...updatedClipList
    };

    this.compositionObject = {
      libraryId,
      objectId,
      versionHash,
      sourceObjectId: objectId,
      sourceOfferingKey: metadata?.source_info?.offeringKey || "default",
      sourceName,
      name: metadata?.display_name || metadata?.name,
      compositionKey,
      metadata
    };

    this.videoStore.name = this.compositionObject.name;

    // Add to my compositions
    if(!this.myCompositions[objectId][compositionKey]) {
      this.myCompositions[objectId][compositionKey] = {
        objectId,
        key: compositionKey,
        label: this.compositionObject.name,
        writeToken,
        saved: true
      };
    }

    this.saved = this.myCompositions[objectId][compositionKey].saved;

    this.GetCompositionPlayoutUrl();

    try {
      const highlights = (yield this.GenerateAIHighlights({objectId, wait: false}))?.clips || [];

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

  QueryAIAPI = flow(function * ({server="ai", method="GET", path, objectId, queryParams={}}) {
    const url = new URL(`https://${server}.contentfabric.io/`);
    url.pathname = path;

    Object.keys(queryParams).forEach(key =>
      queryParams[key] && url.searchParams.set(key, queryParams[key])
    );

    const signedToken = yield this.rootStore.client.CreateSignedToken({
      objectId,
      duration: 24 * 60 * 60 * 1000
    });

    return (
      yield (
        yield fetch(
          url,
          {
            method,
            headers: {
              Authorization: `Bearer ${signedToken}`
            }
          }
        )
      ).json()
    );
  });

  GenerateAIHighlights = flow(function * ({objectId, prompt, regenerate=false, wait=true, StatusCallback}) {
    if(regenerate) {
      yield this.QueryAIAPI({
        method: "POST",
        path: UrlJoin("ml", "highlight_composition", "q", objectId),
        objectId,
        queryParams: {customization: prompt, regenerate: true}
      });
      yield new Promise(resolve => setTimeout(resolve, 1000));
    }

    let status;
    do {
      if(status) {
        StatusCallback?.(status);
        yield new Promise(resolve => setTimeout(resolve, 5000));
      }

      status = yield this.QueryAIAPI({
        method: "GET",
        path: UrlJoin("ml", "highlight_composition", "q", objectId),
        objectId,
        queryParams: {customization: prompt}
      });

      if(!wait) {
        return status;
      }

      if(status?.status === "ERROR") {
        throw status;
      }
    } while(status?.status !== "COMPLETE");

    return status;
  });

  PerformAction({label, Action, ...attrs}, fromRedo=false) {
    clearTimeout(this.updateTimeout);

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

    this.updateTimeout = setTimeout(() => this.UpdateComposition(), 500);

    return result;
  }

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

    this.updateTimeout = setTimeout(() => this.UpdateComposition(), 500);
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

  DiscardDraft({objectId, compositionKey, removeComposition=false}) {
    if(this.myCompositions[objectId]?.[compositionKey]) {
      if(removeComposition && this.myCompositions[objectId]?.[compositionKey]?.new) {
        // Composition is new and not saved - remove entirely
        delete this.myCompositions[objectId][compositionKey];
      } else {
        // Remove write token info and revert saved state
        this.myCompositions[objectId][compositionKey] = {
          ...this.myCompositions[objectId][compositionKey],
          saved: true,
          writeTokenInfo: undefined
        };
      }

      this.SaveMyCompositions();
    }
  }

  WriteToken = flow(function * ({objectId, compositionKey, create=true}) {
    objectId = objectId || this.compositionObject?.objectId;
    compositionKey = compositionKey || this.compositionObject?.compositionKey;

    if(!objectId || !compositionKey) {
      // eslint-disable-next-line no-console
      console.log(new Error(`Attempting to retrieve write token without id or key ${objectId} ${compositionKey}`));
      return;
    }

    if(!this.myCompositions[objectId]) {
      this.myCompositions[objectId] = {};
    }

    if(!this.myCompositions[objectId][compositionKey]?.writeTokenInfo && create) {
      const libraryId = yield this.client.ContentObjectLibraryId({objectId});
      this.myCompositions[objectId][compositionKey].writeTokenInfo = {
        ...(yield this.client.EditContentObject({libraryId, objectId})),
        versionHash: yield this.client.LatestVersionHash({objectId})
      };

      this.SaveMyCompositions();
    }

    return this.myCompositions[objectId][compositionKey]?.writeTokenInfo?.write_token;
  });

  LoadMyCompositions = flow(function * () {
    const compositions = yield this.client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `my-compositions${window.location.hostname === "localhost" ? "-dev" : ""}`
    });

    if(compositions) {
      const myCompositions = JSON.parse(this.client.utils.FromB64(compositions));

      Object.keys(myCompositions).forEach(objectId => {
        Object.keys(myCompositions[objectId] || {}).forEach(compositionKey => {
          // Ensure nodes are set for write tokens
          const writeTokenInfo = myCompositions[objectId][compositionKey].writeTokenInfo;

          if(writeTokenInfo) {
            this.client.RecordWriteToken({
              writeToken: writeTokenInfo.write_token,
              fabricNodeUrl: writeTokenInfo.nodeUrl
            });
          }
        });
      });

      this.myCompositions = myCompositions;
    }
  });

  async SaveMyCompositions() {
    await this.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `my-compositions${window.location.hostname === "localhost" ? "-dev" : ""}`,
      value: this.client.utils.B64(
        JSON.stringify(this.myCompositions || {})
      )
    });
  }

  LoadMyClips = flow(function * ({objectId}) {
    const clips = yield this.client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `my-clips-${objectId}${window.location.hostname === "localhost" ? "-dev" : ""}`
    });

    if(clips) {
      this.myClipIds = JSON.parse(this.client.utils.FromB64(clips))
        // Update clip IDs
        .map(clip => {
          clip = {...clip, clipId: this.rootStore.NextId() };

          this.clips[clip.clipId] = clip;

          return clip.clipId;
        });
    }
  });

  AddMyClip({clip}) {
    clip = {
      clipId: this.rootStore.NextId(),
      name: clip.name || "Saved Clip",
      libraryId: clip.libraryId,
      objectId: clip.objectId,
      offering: clip.offering,
      versionHash: clip.versionHash,
      storeKey: `${clip.objectId}-${clip.offering}`,
      clipKey: `${clip.objectId}-${clip.offeringKey}-${clip.clipInFrame}-${clip.clipOutFrame}`,
      clipInFrame: clip.clipInFrame || 0,
      clipOutFrame: clip.clipOutFrame || this.ClipStore({...clip}).totalFrames - 1
    };

    this.clips[clip.clipId] = clip;

    this.myClipIds = [
      ...this.myClipIds,
      clip.clipId
    ]
      .sort((a, b) => this.clips[a].clipInFrame < this.clips[b].clipInFrame ? -1 : 1);

    this.SaveMyClips({objectId: clip.objectId});

    this.SetSelectedClip({clipId: clip.clipId, source: "side-panel"});
  }

  RemoveMyClip(clipId) {
    this.myClipIds = this.myClipIds.filter(id => id !== clipId);

    const clip = this.clips[clipId];

    if(this.selectedClipId === clipId) {
      this.SetSelectedClip({clipId: this.sourceClipId, source: "source-content"});
    }

    if(clip) {
      delete this.clips[clipId];
      this.SaveMyClips({objectId: clip.objectId});
    }
  }

  async SaveMyClips({objectId}) {
    await this.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `my-clips-${objectId}${window.location.hostname === "localhost" ? "-dev" : ""}`,
      value: this.client.utils.B64(
        JSON.stringify(this.myClips || {})
      )
    });
  }


  OpenFabricBrowserLink() {
    this.client.SendMessage({
      options: {
        operation: "OpenLink",
        libraryId: this.compositionObject.libraryId,
        objectId: this.compositionObject.objectId,
        params: {
          view: "display",
          channel: this.compositionObject.compositionKey
        }
      }
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
    if(key === "main") { return true; }

    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    return (this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: UrlJoin("/channel", "offerings", key, "playout_type")
    }));
  }
}

export default CompositionStore;
