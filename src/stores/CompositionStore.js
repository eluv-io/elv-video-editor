import {flow, makeAutoObservable} from "mobx";
import VideoStore from "@/stores/VideoStore.js";
import {HashString, Unproxy} from "@/utils/Utils.js";
import UrlJoin from "url-join";
import {ExtractHashFromLink} from "@/stores/Helpers.js";
import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";
import Fraction from "fraction.js";

class CompositionStore {
  myCompositions = {};
  allMyClipIds = {};
  sources = {};
  searchResultSources = {};
  secondarySourceIds = [];
  primarySourceId;
  selectedSourceId;

  videoStore;
  initialized = false;
  loading = false;
  clipStores = {};

  filter = "";

  compositionObject;
  compositionPlayoutUrl;
  compositionFormOptions = {};
  compositionGenerationStatus;

  clips = {};
  clipIdList = [];
  originalClipIdList = [];
  selectedClipId;
  selectedClipSource;
  originalSelectedClipId;
  sourceClipIds = {};
  aiClipIds = [];
  searchClipIds = {};
  searchClipInfo = {};

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

  selectedSearchIndexId;
  searchSettings = {};

  _authTokens = {};

  _actionStack = [];
  _redoStack = [];
  _position = 0;

  get client() {
    return this.rootStore.client;
  }

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
    this.searchSettings = this.rootStore.aiStore.DEFAULT_SEARCH_SETTINGS;

    this.Reset();
  }

  Initialize = flow(function * () {
    yield this.LoadMyCompositions();
  });

  Reset() {
    this.videoStore = new VideoStore(this.rootStore, {tags: false, channel: true, thumbnails: true, id: "composition"});

    this.clips = {};
    this.secondarySourceIds = [];
    this.clipIdList = [];
    this.originalClipIdList = [];
    this.aiClipIds = [];
    this.allMyClipIds = {};
    this.searchClipIds = {};
    this.searchClipInfo = {};
    this.selectedClipId = undefined;
    this.originalSelectedClipId = undefined;
    this.sources = {};
    this.primarySourceId = undefined;
    this.selectedSourceId = undefined;
    this.sourceClipIds = {};
    this.filter = "";
    this.compositionObject = undefined;
    this.compositionPlayoutUrl = undefined;
    this.draggingClip = undefined;
    this.clipStores = {};
    this.saved = false;
    this.searchSettings = this.rootStore.aiStore.DEFAULT_SEARCH_SETTINGS;

    this.rootStore.ClearResource({key: "composition-video-store"});

    this.EndDrag();
    this.ClearSelectedClip();
    this.ClearDropIndicator();
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

  get ready() {
    return this.videoStore?.ready;
  }

  get videoObject() {
    return this.videoStore?.ready && this.videoStore.videoObject;
  }

  get compositionDurationFrames() {
    if(this.clipIdList.length === 0) {
      return (this.videoStore?.frameRate || 30) * 30;
    }

    return this.clipList.reduce((v, c) => v + (c.clipOutFrame - c.clipInFrame), 0);
  }

  get compositionDuration() {
    const duration = Fraction(this.compositionDurationFrames).div(this.videoStore?.frameRate || 30).valueOf();

    if(this.videoStore) {
      this.videoStore.duration = duration;
    }

    return duration;
  }

  get seek() {
    return 100 * this.videoStore?.frame / this.compositionDurationFrames;
  }

  get clipList() {
    // Any time the clip list gets re-rendered, update the playout url
    clearTimeout(this.playoutUrlTimeout);

    let startFrame = 0;
    return this.clipIdList
      .map((clipId, index) => {
        const clip = this.clips[clipId];

        if(!clip) { return; }

        const clipStartFrame = startFrame;
        const clipEndFrame = clipStartFrame + (clip.clipOutFrame - clip.clipInFrame);

        startFrame += clip.clipOutFrame - clip.clipInFrame;

        return {
          ...clip,
          listIndex: index,
          startFrame: clipStartFrame,
          endFrame: clipEndFrame
        };
      })
      .filter(clip => clip);
  }

  get selectedSource() {
    return this.sources[this.selectedSourceId];
  }

  get originalClips() {
    return this.originalClipIdList
      .map(clipId => this.clips[clipId])
      .filter(clip => clip);
  }

  get myClipIds() {
    if(this.rootStore.page === "compositions") {
      return this.allMyClipIds[this.selectedSourceId || this.compositionObject?.objectId] || [];
    } else {
      return this.allMyClipIds[this.rootStore.selectedObjectId] || [];
    }
  }

  get myClips() {
    return this.myClipIds
      .map(clipId => this.clips[clipId])
      .filter(clip =>
        (
          !this.filter ||
          clip.name?.toLowerCase()?.includes(this.filter)
        )
      )
      .sort((a, b) => a.addedAt < b.addedAt ? 1 : -1);
  }

  get selectedClipStore() {
    if(this.selectedClipId && !this.clipStores[this.selectedClip?.storeKey]) {
      // eslint-disable-next-line no-console
      console.warn("No store for selected clip");
      // eslint-disable-next-line no-console
      console.warn(this.selectedClipId, this.selectedClip);
    }

    return this.clipStores[this.selectedClip?.storeKey];
  }

  get selectedClip() {
    return this.clips[this.selectedClipId];
  }

  get sourceFullClipId() {
    return this.selectedSource?.fullClipId;
  }

  get sourceFullClip() {
    return this.clips[this.sourceFullClipId];
  }

  get primarySourceVideoStore() {
    return this.ClipStore({clipId: this.sources[this.primarySourceId]?.fullClipId});
  }

  get sourceVideoStore() {
    return this.ClipStore({clipId: this.sourceFullClipId});
  }

  get defaultSearchSettings() {
    return {
      ...this.rootStore?.aiStore?.DEFAULT_SEARCH_SETTINGS,
      objectIds: [
        this.primarySourceId,
        ...this.secondarySourceIds
      ]
    };
  }

  get customSearchSettingsActive() {
    return (
      HashString(JSON.stringify({...this.searchSettings, key: 0})) !==
      HashString(JSON.stringify({...this.defaultSearchSettings, key: 0}))
    );
  }

  SetSelectedSearchIndex(id) {
    this.searchSettings = this.rootStore.aiStore.DEFAULT_SEARCH_SETTINGS;
    this.selectedSearchIndexId = id;
  }

  SetSearchSettings(options) {
    const searchIndexId = options.searchIndexId || this.selectedSearchIndexId;

    delete options.key;
    delete options.searchIndexId;

    this.SetSelectedSearchIndex(searchIndexId);

    this.searchSettings = {
      ...options,
      key: HashString(JSON.stringify(options))
    };
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
          effects: clip.effects || [],
          clipId
        };

        this.clipIdList = this.clipIdList.toSpliced(index, 0, clipId);

        if(this.seek > progress) {
          // Clip inserted before playhead - push ahead
          this.videoStore.Seek(this.videoStore.frame + (clip.clipOutFrame - clip.clipInFrame));
        }
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

  SetClipOffering = flow(function * ({clipId, offering}) {
    const clip = this.clips[clipId];

    if(!clip) { return; }

    const storeId = yield this.InitializeVideoStore({objectId: clip.objectId, offering});

    this.ModifyClip({
      clipId,
      attrs: {
        offering,
        // Pass clip points so they are validated for the new offering
        clipInFrame: clip.clipInFrame,
        clipOutFrame: clip.clipOutFrame,
        storeKey: storeId,
        clipKey: `${clip.objectId}-${offering}-${clip.clipInFrame}-${clip.clipOutFrame}`
      },
      label: "Change Offering"
    });
  });

  RemoveClip(clipId) {
    this.PerformAction({
      label: "Remove Clip",
      Action: () => {
        const clip = this.clipList.find(clip => clip.clipId === clipId);

        this.clipIdList = this.clipIdList.filter(id => id !== clipId);
        delete this.clips[clipId];

        if(this.videoStore.frame > clip.startFrame) {
          // Clip deleted before playhead - pull back
          this.videoStore.Seek(this.videoStore.frame - (clip.clipOutFrame - clip.clipInFrame));
        }
      }
    });

    if(this.selectedClipId === clipId) {
      this.SetSelectedClip({clipId: this.sourceFullClipId, source: "source-content"});
    }
  }

  SortCompositionClips() {
    this.PerformAction({
      label: "Reorder Clips",
      Action: () => {
        const clipIdList = this.clipList
          .filter((objectId, index, list) => list.findIndex(otherId => objectId === otherId) === index)
          .sort((a, b) => a.clipInFrame < b.clipInFrame ? -1 : 1)
          .map(clip => clip.clipId);

        let combinedClipIdList = [];
        let deletedClips = [];
        for(let i = 0; i < clipIdList.length; i++) {
          const clip = this.clips[clipIdList[i]];
          const nextClip = this.clips[clipIdList[i + 1]];

          if(
            !nextClip ||
            clip.storeKey !== nextClip.storeKey ||
            clip.clipOutFrame <= nextClip.clipInFrame
          ) {
            combinedClipIdList.push(clip.clipId);
          } else {
            // Overlapping clips, combine
            const clipId = this.rootStore.NextId();
            this.clips[clipId] = {
              ...clip,
              ...nextClip,
              clipId,
              name: `${clip.name || ""} | ${nextClip.name || ""}`
            };

            combinedClipIdList.push(clipId);

            if(this.selectedClipId === clip.clipId || this.selectedClipId === nextClip.clipId) {
              this.SetSelectedClip({clipId});
            }

            deletedClips.push(clip.clipId);
            deletedClips.push(nextClip.clipId);
            delete this.clips[clip.clipId];
            delete this.clips[nextClip.clipId];

            i += 1;
          }
        }

        this.clipIdList = combinedClipIdList;

        deletedClips.forEach(clipId =>
          delete this.clips[clipId]
        );
      }
    });
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
      effects: (clip.effects || []).filter(effect => effect.position === "start"),
      clipId: this.rootStore.NextId(),
      clipOutFrame: clip.clipInFrame + clipSplitFrame
    };

    const clip2 = {
      ...clip,
      effects: (clip.effects || []).filter(effect => effect.position === "end"),
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

  ClipStore({objectId, offering, clipId, sourceId}) {
    let key = this.clips[clipId]?.storeKey || `${objectId}-${offering}`;

    if(sourceId) {
      key = this.clips[this.sources[sourceId].fullClipId]?.storeKey || key;
    }

    if(!this.clipStores[key]) {
      // eslint-disable-next-line no-console
      console.warn("No store for selected clip");
      // eslint-disable-next-line no-console
      console.warn(objectId, offering, clipId, sourceId, key, this.clips[clipId]);
    }

    return this.clipStores[key];
  }

  SetSelectedSource({objectId}) {
    this.selectedSourceId = objectId;
  }

  SetSelectedClip({clipId, source}) {
    if(source === "timeline") {
      // Clip is on timeline, changes should apply to it directly
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

    if(!this.clipStores[this.selectedClip.storeKey]?.thumbnails) {
      this.clipStores[this.selectedClip.storeKey]?.LoadThumbnails();
    }
  }

  ClearSelectedClip() {
    this.selectedClipId = undefined;
  }

  InitializeVideoStore = flow(function * ({objectId, offering="default", loadThumbnails=true}) {
    return yield this.rootStore.LoadResource({
      key: "composition-video-store",
      id: `${this.compositionObject?.objectId}-${objectId}-${offering}-${loadThumbnails}`,
      ttl: 30,
      bind: this,
      Load: flow(function * () {
        const storeId = `${objectId}-${offering}`;

        if(!this.clipStores[storeId]) {
          const videoStore = new VideoStore(
            this.rootStore,
            {
              tags: false,
              thumbnails: loadThumbnails,
              id: `composition-${objectId}`
            }
          );

          videoStore.id = storeId;
          videoStore.sliderMarks = 20;
          videoStore.majorMarksEvery = 5;

          yield videoStore.SetVideo({objectId, preferredOfferingKey: offering, noTags: true});
          this.clipStores[storeId] = videoStore;

          if(offering !== videoStore.offeringKey) {
            // Selected offering is different from requested offering - ensure expected key is set
            this.clipStores[`${objectId}-${this.clipStores[storeId].offeringKey}`] = videoStore;
          }
        }

        return storeId;
      })
    });
  });

  InitializeClip = flow(function * ({
    clipId,
    name,
    objectId,
    offering="default",
    clipInFrame,
    clipInTime,
    clipOutFrame,
    clipOutTime,
    source,
    loadThumbnails=true
  }) {
    const key = yield this.InitializeVideoStore({objectId, offering, loadThumbnails});

    const store = this.clipStores[key];

    if(clipInTime) {
      clipInFrame = store.TimeToFrame(clipInTime);
    }

    if(clipOutTime) {
      clipOutFrame = store.TimeToFrame(clipOutTime);
    }

    let imageUrl = store.baseImageUrl;
    if(imageUrl) {
      imageUrl = new URL(imageUrl);
      imageUrl.searchParams.set(
        "t",
        store.FrameToTime(source ? Math.floor(((clipOutFrame || store.totalFrames) - (clipInFrame || 0)) / 2) : clipInFrame).toFixed(2)
      );
    }

    clipId = clipId || this.rootStore.NextId();
    this.clips[clipId] = {
      clipId,
      name: name || `${store.videoObject?.name || store.name} (Full Content)`,
      libraryId: store.videoObject.libraryId,
      objectId: store.videoObject.objectId,
      versionHash: store.videoObject.versionHash,
      offering: store.offeringKey,
      imageUrl,
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

    return clipId;
  });

  CompositionProgressToSMPTE(progress) {
    return this.videoStore.TimeToSMPTE(this.compositionDuration * progress / 100);
  }

  GetCompositionPlayoutUrl = flow(function * (retry=0, noWriteToken) {
    if(!this.compositionObject || this.clipIdList.length === 0) {
      this.compositionPlayoutUrl = undefined;
      return;
    }

    try {
      const {objectId, compositionKey} = this.compositionObject;
      const writeToken = noWriteToken ? undefined :
        yield this.WriteToken({objectId, compositionKey, create: false});

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
      this.videoStore.duration = this.compositionDuration;

      return playoutUrl;
    } catch(error) {

      console.error("Error getting composition playout url:");

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
    profileKey,
    indexId,
    maxDuration,
    offeringKey,
    regenerate=false
  }) {
    this.compositionGenerationStatus = {};
    const sourceLibraryId = yield this.client.ContentObjectLibraryId({objectId: sourceObjectId});
    const sourceMetadata = yield this.client.ContentObjectMetadata({
      libraryId: sourceLibraryId,
      objectId: sourceObjectId,
      select: [
        "offerings/*/playout",
        "offerings/*/media_struct/streams/*/rate",
        "/public/name",
      ],
      resolveLinks: true,
      resolveIgnoreErrors: true
    });

    if(!offeringKey) {
      const offerings = Object.keys(sourceMetadata.offerings)
        .filter(offeringKey =>
          !!Object.keys(sourceMetadata.offerings[offeringKey]?.playout?.playout_formats || {})
            .find(playoutFormat => ["hls-clear", "hls-aes128"].includes(playoutFormat))
        );

      offeringKey = offerings.includes("default") ? "default" :
        offerings.find(offering => offering.includes("default")) || offerings[0];
    }

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
      offeringKey,
      compositionKey: key,
      label: name,
      saved: false,
      new: true,
      duration: 0,
      lastModified: new Date().toISOString()
    };

    let items = [];
    let profile;
    if(type === "ai") {
      if(profileKey) {
        profile = Unproxy(this.rootStore.aiStore.highlightProfiles[profileKey]);

        if(!profile.index) {
          profile.index = indexId;
        }
      }

      const highlights = (yield this.rootStore.aiStore.GenerateAIHighlights({
        objectId: sourceObjectId,
        prompt,
        maxDuration,
        regenerate,
        profile,
        StatusCallback: status => this.compositionGenerationStatus = status
      })).clips;

      const videoHandler = new FrameAccurateVideo({frameRateRat: frameRate});

      items = highlights.map(clip => {
        const clipInFrame = videoHandler.TimeToFrame(clip.start_time / 1000);
        const clipOutFrame = videoHandler.TimeToFrame(clip.end_time / 1000);

        return {
          display_name: clip.reason || "Clip",
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
      display_name: name || "Composition",
      key,
      playout_type: "ch_vod",
      playout: playoutMetadata,
      items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      offeringKey,
      source_info: {
        libraryId: sourceLibraryId,
        objectId: sourceObjectId,
        name: sourceMetadata?.public?.name,
        offeringKey,
        frameRate,
        type,
        prompt,
        promptDuration: maxDuration,
        profileKey,
        profile
      }
    };

    const sourceWriteToken = yield this.WriteToken({
      objectId: sourceObjectId,
      compositionKey: key,
      create: true
    });

    yield this.client.ReplaceMetadata({
      libraryId: sourceLibraryId,
      objectId: sourceObjectId,
      writeToken: sourceWriteToken,
      metadataSubtree: UrlJoin("/channel", "offerings", key),
      metadata: Unproxy(channelMetadata)
    });

    this.SaveMyCompositions();

    this.SetCompositionGenerationStatus({...(this.compositionGenerationStatus || {}), created: true});
  });

  UpdateComposition = flow(function * ({updatePlayoutUrl=true}={}) {
    if(!this.compositionObject?.objectId) { return; }

    try {
      this.loading = true;
      this.startFrame = this.videoStore.frame;

      const {name, libraryId, objectId, sourceObjectId, sourceOfferingKey, compositionKey} = this.compositionObject;
      const writeToken = yield this.WriteToken({objectId, compositionKey, create: true});

      let sourceHashes = {};
      yield Promise.all(
        this.clipList
          .map(clip => clip.objectId)
          .filter((objectId, index, list) => list.findIndex(otherId => objectId === otherId) === index)
          .map(async objectId =>
            sourceHashes[objectId] = await this.client.LatestVersionHash({objectId})
          )
      );

      const missingSourceIds = this.clipList
        .map(clip => clip.objectId)
        .filter(id => !this.sources[id])
        .filter((x, i, a) => a.indexOf(x) == i);

      yield Promise.all(
        missingSourceIds.map(async objectId => {
          await this.InitializeSource({objectId});

          this.clipStores[this.clips[this.sources[objectId].fullClipId].storeKey]?.LoadThumbnails();
        })
      );

      this.secondarySourceIds = [
        ...this.secondarySourceIds,
        ...missingSourceIds
      ]
        .filter((x, i, a) => a.indexOf(x) == i);

      const items = this.clipList.map(clip => {
        const store = this.clipStores[clip.storeKey];

        // Actual duration may be lower than what the video element projects
        const sourceEndFrame = store.RatToFrame(store.metadata.offerings[clip.offering].media_struct.duration_rat);

        let clipOutFrame = Math.min(clip.clipOutFrame, sourceEndFrame - 1);

        let sourceLink;
        if(clip.objectId === sourceObjectId) {
          sourceLink = {
            "/": UrlJoin("./", "rep", "playout", clip.offering || sourceOfferingKey)
          };
        } else {
          sourceLink = {
            "/": UrlJoin("/qfab", sourceHashes[clip.objectId], "rep", "playout", clip.offering || sourceOfferingKey)
          };
        }

        return {
          display_name: clip.name || "Clip",
          source: sourceLink,
          slice_start_rat: store.FrameToRat(clip.clipInFrame || 0),
          slice_end_rat: store.FrameToRat(clipOutFrame || store.totalFrames - 1),
          duration_rat: store.FrameToRat((clipOutFrame || store.totalFrames - 1) - (clip.clipInFrame || 0)),
          effects: clip.effects,
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

      /*
      const updatedFields = Unproxy(this.ToV2({items}));
      for(const key of Object.keys(updatedFields)) {
        yield this.client.ReplaceMetadata({
          libraryId,
          objectId,
          writeToken,
          metadataSubtree: UrlJoin("/channel", "offerings", compositionKey, key),
          metadata: updatedFields[key]
        });
      }

       */

      yield this.client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken,
        metadataSubtree: UrlJoin("/channel", "offerings", compositionKey, "display_name"),
        metadata: name || "Composition"
      });

      yield this.client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken,
        metadataSubtree: UrlJoin("/channel", "offerings", compositionKey, "updated_at"),
        metadata: new Date().toISOString()
      });

      yield this.client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken,
        metadataSubtree: UrlJoin("/channel", "offerings", compositionKey, "selected_sources"),
        metadata: Unproxy(this.secondarySourceIds)
      });

      if(updatePlayoutUrl) {
        yield this.GetCompositionPlayoutUrl();
      }

      this.myCompositions[objectId][compositionKey].duration = this.compositionDuration || 0;
      this.myCompositions[objectId][compositionKey].lastModified = new Date().toISOString();
      this.SaveMyCompositions();

      this.rootStore.browserStore.AddMyLibraryItem({
        objectId: this.compositionObject.objectId,
        compositionKey: this.compositionObject.compositionKey,
        name: this.compositionObject.name,
        duration: this.compositionDuration
      });
    } finally {
      this.loading = false;
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

    yield new Promise(resolve => setTimeout(resolve, 1000));
    yield this.SetCompositionObject({objectId, compositionKey});
  });

  FromV2(metadata) {
    /*
      Slices:
        0 - sourceIndex: 0-based index into the sources[] array
        1 - sliceStartNumerator: clip start
        2 - sliceStartDenominator: clip start
        3 - sliceEndNumerator: clip end
        4 - sliceEndDenominator: clip end

      Slice effects:
        0 - Effect type (1 = fade in audio and video at start , 2 = fade out audio and video at end)
        1 - Slice index - which item on timeline to apply effect to (0 = first item)
        2 - Effect duration numerator
        3 - Effect duration denominator
     */

    const effectTypes = {
      1: {type: "fade_in", position: "start"},
      2: {type: "fade_out", position: "end"}
    };

    const ParseEffect = effect => {
      const [type,,durationNum, durationDenom] = effect;

      if(!effectTypes[type]) {
        // eslint-disable-next-line no-console
        console.warn("Unknown effect:", effect);
        return;
      }

      return {
        type: effectTypes[type].type,
        position: effectTypes[type].position,
        duration: durationNum / durationDenom
      };
    };

    return (metadata.slices || []).map((slice, index) => {
      let [sourceIndex, startNum, startDenom, endNum, endDenom] = slice;

      const commonDenom = startDenom * endDenom;

      startNum *= endDenom;
      endNum *= startDenom;

      return {
        display_name: metadata.slice_info?.[index]?.display_name || `Clip ${index}`,
        duration_rat: `${endNum - startNum}/${commonDenom}`,
        slice_start_rat: `${startNum}/${commonDenom}`,
        slice_end_rat: `${endNum}/${commonDenom}`,
        effects: (metadata.slice_effects || [])
          .filter(effect => effect[1] === index)
          .map(effect => ParseEffect(effect))
          .filter(effect => effect),
        ...metadata.ch_sources[sourceIndex]
      };
    });
  }

  ToV2(metadata) {
    let slices = [];
    let ch_sources = [];
    let slice_effects = [];
    let slice_info = [];

    for(const item of metadata.items || []) {
      let sourceIndex = sources.findIndex(source => source.source["/"] === item.source["/"]);
      if(sourceIndex < 0) {
        sourceIndex = sources.length;
        ch_sources[sourceIndex] = {
          source: item.source,
          type: item.type
        };
      }

      const [startNum, startDenom] = ReduceRat(item.slice_start_rat);
      const [endNum, endDenom] = ReduceRat(item.slice_end_rat);

      const sliceIndex = slices.length;
      slices.push([
        sourceIndex,
        startNum,
        startDenom,
        endNum,
        endDenom
      ]);

      const effectTypes = {
        "fade_in": 1,
        "fade_out": 2
      };

      (item.effects || []).forEach(effect => {
        slice_effects.push([
          effectTypes[effect.type],
          sliceIndex,
          parseInt(effect.duration * 1000),
          1000
        ]);
      });

      slice_info[sliceIndex] = {
        display_name: item.display_name
      };
    }

    return {
      slices,
      ch_sources,
      slice_effects,
      slice_info
    };
  }

  SetCompositionObject = flow(function * ({objectId, compositionKey, addToMyLibrary=false}) {

    // TODO: REMOVE
    /*
    yield this.client.SetNodes({
      fabricURIs: [
        //"https://host-76-74-29-13.contentfabric.io",
        "https://host-76-74-29-9.contentfabric.io"
      ]
    });

     */

    console.time(`Load composition ${objectId} ${compositionKey}`);

    if(!this.myCompositions[objectId]) {
      yield this.LoadMyCompositions();
    }

    this.initialized = false;
    this.Reset();

    const libraryId = yield this.client.ContentObjectLibraryId({objectId});
    const versionHash = yield this.client.LatestVersionHash({objectId});
    const writeToken = yield this.WriteToken({objectId, compositionKey, create: false});

    let metadata = {};
    try {
      metadata = (yield this.client.ContentObjectMetadata({
        libraryId,
        objectId,
        writeToken,
        metadataSubtree: UrlJoin("/channel", "offerings", compositionKey)
      })) || {};

      if(metadata.slices) {
        metadata.items = this.FromV2(metadata);
      }
    } catch(error) {
      if(
        (error.status === 404 && error.message === "Not Found") ||
        (typeof error === "string" && (error.toLowerCase().includes("write token") && error.toLowerCase().includes("not found")))
      ) {
        console.error(`Error: Dead write token for composition ${objectId}/${compositionKey}, discarding draft`);
        this.DiscardDraft({objectId, compositionKey});

        return yield this.SetCompositionObject({objectId, compositionKey});
      }
    }

    const sourceOfferingKey = metadata?.source_info?.offeringKey || "default";

    const baseImageUrl = yield this.client.Rep({
      versionHash,
      rep: UrlJoin("frame", sourceOfferingKey, "video"),
      channelAuth: true,
      queryParams: {
        ignore_trimming: true
      }
    });

    this.compositionObject = {
      libraryId,
      objectId,
      versionHash,
      baseImageUrl,
      sourceObjectId: objectId,
      sourceOfferingKey,
      initialPrompt: metadata?.source_info?.prompt,
      initialPromptDuration: metadata?.source_info?.promptDuration,
      initialProfile: metadata?.source_info?.profile,
      name: metadata?.display_name || metadata?.name,
      compositionKey,
      metadata
    };

    const primarySource = yield this.InitializeSource({
      objectId,
      writeToken,
      primary: true
    });

    this.compositionObject.sourceName = primarySource.name;

    this.primarySourceId = primarySource.objectId;

    this.SetSelectedClip({clipId: primarySource.fullClipId, source: "source-content"});

    // Point channel video store to source video store for source info
    const primarySourceStore = this.ClipStore({clipId: primarySource.fullClipId});
    this.videoStore.sourceVideoStore = primarySourceStore;

    yield this.videoStore.SetVideo({
      objectId,
      writeToken,
      preferredOfferingKey: compositionKey,
      noTags: true
    });

    this.videoStore.SetFrameRate({rateRat: primarySourceStore.frameRateRat});
    this.videoStore.videoHandler = primarySource.videoHandler;

    // Determine secondary sources from explicit list in metadata and by looking at all item links
    let secondarySources = metadata.selected_sources || metadata.sources || [];
    let originalClipsList = {};
    let updatedClipList = {};
    this.clipIdList = yield Promise.all(
      (metadata?.items || []).map(async item => {
        const clipId = this.rootStore.NextId();
        const clipVersionHash = ExtractHashFromLink(item.source) || versionHash;
        const clipObjectId = this.client.utils.DecodeVersionHash(clipVersionHash).objectId;

        if(clipObjectId !== objectId && !secondarySources.includes(clipObjectId)) {
          secondarySources.push(clipObjectId);
        }

        const libraryId = await this.client.ContentObjectLibraryId({objectId: clipObjectId});
        const offeringKey = item.source["/"].split("/").slice(-1)[0];

        await this.InitializeVideoStore({
          objectId: clipObjectId,
          offering: offeringKey
        });

        const clipInFrame = primarySource.videoHandler.RatToFrame(item.slice_start_rat);
        const clipOutFrame = primarySource.videoHandler.RatToFrame(item.slice_end_rat);

        updatedClipList[clipId] = {
          clipId,
          name: item.display_name,
          libraryId,
          objectId: clipObjectId,
          versionHash: clipVersionHash,
          offering: offeringKey,
          clipInFrame,
          clipOutFrame,
          storeKey: `${clipObjectId}-${offeringKey}`,
          clipKey: `${clipObjectId}-${offeringKey}-${clipInFrame}-${clipOutFrame}`,
          effects: item.effects || [],
          // TODO: Audio
          //audioRepresentation: store.audioRepresentation,
        };

        const originalClipId = this.rootStore.NextId();
        originalClipsList[originalClipId] = {
          ...updatedClipList[clipId],
          //effects: [],
          clipId: originalClipId
        };

        if(clipObjectId !== objectId && !secondarySources.includes(clipObjectId)) {
          secondarySources.push(clipObjectId);
        }

        return clipId;
      })
    );

    this.originalClipIdList = Object.values(originalClipsList).map(clip => clip.clipId);

    // Initialize secondary sources
    yield Promise.all(
      secondarySources.map(async objectId =>
        this.InitializeSource({objectId})
      )
    );

    this.secondarySourceIds = secondarySources;
    this.selectedSourceId = objectId;

    this.clips = {
      ...this.clips,
      ...updatedClipList,
      ...originalClipsList
    };

    this.videoStore.name = this.compositionObject.name;

    // Add to my compositions
    if(!this.myCompositions[objectId]) {
      this.myCompositions[objectId] = {};
    }

    if(!this.myCompositions[objectId][compositionKey]) {
      this.myCompositions[objectId][compositionKey] = {
        objectId,
        key: compositionKey,
        label: this.compositionObject.name,
        writeToken,
        saved: true
      };
    }

    this.saved = !writeToken && this.myCompositions[objectId][compositionKey].saved;

    yield this.GetCompositionPlayoutUrl();

    this.initialized = true;
    this.SetSearchSettings(this.defaultSearchSettings);

    yield this.LoadMyClips({objectId});

    this.rootStore.downloadStore.LoadDownloadJobInfo();

    if(addToMyLibrary) {
      this.rootStore.browserStore.AddMyLibraryItem({
        objectId,
        compositionKey,
        name: this.compositionObject.name,
        duration: this.compositionDuration
      });
    }

    console.timeEnd(`Load composition ${objectId} ${compositionKey}`);
  });

  InitializeSource = flow(function * ({objectId, writeToken}) {
    const libraryId = yield this.client.ContentObjectLibraryId({objectId});
    const versionHash = yield this.client.LatestVersionHash({objectId});

    const sourceName = yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "/public/name"
    });

    // Load source clips
    const sourceFullClipId = yield this.InitializeClip({objectId, source: true});
    const store = this.ClipStore({clipId: sourceFullClipId});
    const videoHandler = new FrameAccurateVideo({frameRateRat: store.frameRateRat});

    // Load content clips
    let sourceClipIds = {};
    const sourceClips = store.videoObject.metadata?.clips?.metadata_tags || {};
    for(const category of Object.keys(sourceClips)) {
      if(sourceClips[category].tags.length > 0) {
        let clipIds = [];
        for(const clip of sourceClips[category].tags) {
          clipIds.push(yield this.InitializeClip({
            name: clip.text,
            objectId,
            clipInFrame: videoHandler.TimeToFrame(clip.start_time / 1000),
            clipOutFrame: videoHandler.TimeToFrame(clip.end_time / 1000)
          }));
        }

        sourceClipIds[category] = {
          label: sourceClips[category].label,
          clipIds
        };
      }
    }

    this.sources[objectId] = {
      libraryId,
      objectId,
      versionHash,
      videoHandler,
      name: sourceName,
      fullClipId: sourceFullClipId,
      clipIds: sourceClipIds
    };

    /*
    this.LoadHighlights({
      store,
      objectId,
      prompt: primary ? this.compositionObject?.initialPrompt : "",
      maxDuration: primary ? this.compositionObject.initialPromptDuration : undefined,
      profile: primary ? this.compositionObject.initialProfile : "",
    });

     */

    yield this.LoadMyClips({objectId});

    return this.sources[objectId];
  });

  InitializeSearchResultSource = flow(function * ({objectId}) {
    if(this.sources[objectId] || this.searchResultSources[objectId]) { return; }

    const libraryId = yield this.client.ContentObjectLibraryId({objectId});
    const versionHash = yield this.client.LatestVersionHash({objectId});

    // Load source clips
    const sourceFullClipId = yield this.InitializeClip({objectId, source: true, loadThumbnails: false});
    const store = this.ClipStore({clipId: sourceFullClipId});
    const videoHandler = new FrameAccurateVideo({frameRateRat: store.frameRateRat});

    this.searchResultSources[objectId] = {
      libraryId,
      objectId,
      versionHash,
      videoHandler,
      fullClipId: sourceFullClipId
    };
  });

  AddSource = flow(function * ({objectId}) {
    const hasDefaultTitleSearchSettings =
      [...this.defaultSearchSettings.objectIds].sort().toString() ===
      [...this.searchSettings.objectIds].sort().toString();

    yield this.InitializeSource({objectId});

    if(!this.secondarySourceIds.includes(objectId)) {
      this.secondarySourceIds = [...this.secondarySourceIds, objectId];

      this.UpdateComposition({updatePlayoutUrl: false});
    }

    this.SelectSource({objectId});

    if(hasDefaultTitleSearchSettings) {
      this.searchSettings.objectIds = [...this.searchSettings.objectIds, objectId];
    }
  });

  RemoveSource({objectId}) {
    const hasDefaultTitleSearchSettings =
      [...this.defaultSearchSettings.objectIds].sort().toString() ===
      [...this.searchSettings.objectIds].sort().toString();

    if(this.selectedSourceId === objectId) {
      this.selectedSourceId = this.primarySourceId;
    }

    delete this.sources[objectId];
    this.secondarySourceIds = this.secondarySourceIds.filter(id => id !== objectId);

    if(hasDefaultTitleSearchSettings) {
      this.searchSettings.objectIds = [...this.searchSettings.objectIds].filter(id => id !== objectId);
    }
  }

  SelectSource({objectId}) {
    if(!this.sources[objectId]) {
      return;
    }

    this.selectedSourceId = objectId;
  }

  LoadHighlights = flow(function * ({store, objectId, prompt, maxDuration, profile, wait=true}) {
    try {
      this.sources[objectId].highlightsLoading = true;
      const highlights = (yield this.rootStore.aiStore.GenerateAIHighlights({
        objectId,
        prompt,
        maxDuration,
        profile,
        wait
      }))?.clips || [];

      let aiClipIds = [];
      for(const clip of highlights) {
        const clipInFrame = store.TimeToFrame(clip.start_time / 1000);
        const clipOutFrame = store.TimeToFrame(clip.end_time / 1000);
        const clipId = this.rootStore.NextId();
        this.clips[clipId] = {
          clipId,
          name: clip.reason,
          libraryId: store.videoObject?.libraryId,
          objectId,
          versionHash: store.videoObject?.versionHash,
          offering: this.sourceFullClip?.offering || "default",
          clipInFrame,
          clipOutFrame,
          storeKey: `${objectId}-default`,
          clipKey: `${objectId}-default-${clipInFrame}-${clipOutFrame}`
        };

        aiClipIds.push(clipId);
      }

      this.sources[objectId].highlightClipIds = aiClipIds;

      return aiClipIds;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
    } finally {
      if(this.sources[objectId]) {
        this.sources[objectId].highlightsLoading = false;
      }
    }
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
        this.clips = {
          ...this.clips,
          ...originalData.clips
        };
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

      // Ensure it is removed from My Library
      if(removeComposition) {
        this.rootStore.browserStore.RemoveMyLibraryItem({objectId, compositionKey});
      }
    }
  }

  DeleteComposition = flow(function * ({objectId, compositionKey}) {
    // Check if composition is saved in metadata and needs to be removed
    const libraryId = yield this.client.ContentObjectLibraryId({objectId});
    const compositionSaved = !!(yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: UrlJoin("/channel", "offerings", compositionKey),
      remove: "playout"
    }));

    if(compositionSaved) {
      yield this.client.EditAndFinalizeContentObject({
        libraryId,
        objectId,
        callback: async ({writeToken}) => {
          await this.client.DeleteMetadata({
            libraryId,
            objectId,
            writeToken,
            metadataSubtree: UrlJoin("/channel", "offerings", compositionKey)
          });
        },
        commitMessage: `EVIE: Remove composition '${compositionKey}'`
      });

      this.rootStore.ClearResource({key: "object-details", id: objectId});
    }

    // Remove from my compositions
    yield this.DiscardDraft({objectId, compositionKey, removeComposition: true});
  });

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
    yield this.rootStore.LoadResource({
      key: "myCompositions",
      id: "myCompositions",
      bind: this,
      Load: flow(function * () {
        const compositions = yield this.client.walletClient.ProfileMetadata({
          type: "app",
          appId: "video-editor",
          mode: "private",
          key: `my-compositions${this.rootStore.localhost ? "-dev" : ""}`
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
      })
    });
  });

  async SaveMyCompositions() {
    await this.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `my-compositions${this.rootStore.localhost ? "-dev" : ""}`,
      value: this.client.utils.B64(
        JSON.stringify(this.myCompositions || {})
      )
    });
  }

  LoadMyClips = flow(function * ({objectId}) {
    const store = this.ClipStore({clipId: this.sources[objectId]?.fullClipId});

    if(!store) { return; }

    yield store.LoadMyClips({objectId});

    this.allMyClipIds[objectId] = yield Promise.all(
      store.myClips.map(async clip => {
        if(!this.clips[clip.clipId]) {
          await this.InitializeClip(clip);
        }

        return clip.clipId;
      })
    );
  });

  AddMyClip(clip) {
    clip = {
      addedAt: Date.now(),
      clipId: this.rootStore.NextId(),
      name: (clip.name || "Saved Clip").trim(),
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

    this.allMyClipIds[clip.objectId] = [
      ...(this.allMyClipIds[clip.objectId] || []),
      clip.clipId
    ]
      .sort((a, b) => this.clips[a].clipInFrame < this.clips[b].clipInFrame ? -1 : 1);

    this.clipStores[clip.storeKey]?.AddMyClip(clip);

    this.SetSelectedClip({clipId: clip.clipId, source: "side-panel"});

    return clip;
  }

  RemoveMyClip(clipId) {
    const clip = this.clips[clipId];

    if(!clip) { return; }

    this.allMyClipIds[clip.objectId] = this.allMyClipIds[clip.objectId]?.filter(id => id !== clipId) || [];

    if(this.selectedClipId === clipId) {
      this.SetSelectedClip({clipId: this.sourceFullClipId, source: "source-content"});
    }

    delete this.clips[clipId];

    this.clipStores[clip.storeKey]?.RemoveMyClip(clip.clipId);
  }

  SearchClips = flow(function * ({store, objectId, query}) {
    const index = this.rootStore.aiStore.searchIndexes.find(index => index.id === this.selectedSearchIndexId);
    store = store || this.sourceVideoStore;

    const searchClipInfo = this.searchClipInfo[objectId] || {};

    if(
      !index ||
      (
        searchClipInfo.indexId === index.id &&
        searchClipInfo.query === query &&
        searchClipInfo.searchSettingsKey === this.searchSettings.key
      )
    ) { return; }

    const clips = (yield this.rootStore.aiStore.QueryAIAPI({
      server: "ai",
      objectId: index.id,
      path: UrlJoin("search", "q", index.id, "rep", "search"),
      channelAuth: true,
      queryParams: {
        terms: query,
        search_fields:
          this.searchSettings.fields.length > 0 ?
            this.searchSettings.fields.join(",") :
            Object.keys(index.fields).join(","),
        display_fields: "all",
        clips: true,
        clips_include_source_tags: true,
        get_chunks: true,
        debug: true,
        max_total: 100,
        min_score: this.searchSettings.minConfidence / 100,
        start: 0,
        limit: 100,
        filters: this.searchSettings.objectIds.map(objectId => `(id:${objectId})`).join("OR")
      }
    }))?.contents || [];

    const sourceIdsToLoad = clips
      .map(clip => clip.id)
      .filter(id => !this.sources[id] && !this.searchResultSources[id])
      .filter((x, i, a) => a.indexOf(x) == i);

    yield Promise.all(
      sourceIdsToLoad.map(async objectId =>
        await this.InitializeSearchResultSource({objectId})
      )
    );

    let searchClipIds = [];
    for(const clip of clips) {
      const sourceClip = this.clips[
        this.sources[clip.id]?.fullClipId ||
        this.searchResultSources[clip.id]?.fullClipId
      ];

      if(!sourceClip) {
        // eslint-disable-next-line no-console
        console.warn("No source clip found for search result");
        // eslint-disable-next-line no-console
        console.warn(clip);
        continue;
      }

      const clipInFrame = store.TimeToFrame(clip.start_time / 1000);
      const clipOutFrame = store.TimeToFrame(clip.end_time / 1000);
      const clipId = this.rootStore.NextId();
      const storeKey = sourceClip.storeKey;

      let imageUrl = this.clipStores[storeKey]?.baseImageUrl;
      if(imageUrl) {
        imageUrl = new URL(imageUrl);
        imageUrl.pathname = clip.image_url.split("?")[0];

        const params = new URLSearchParams(clip.image_url.split("?")[1]);
        params.keys().forEach((key, value) => imageUrl.searchParams.set(key, value));
        imageUrl.searchParams.set("t", (clip.start_time / 1000).toFixed(2));
      }

      let startTime, endTime, subtitle, chunkStartTime;
      startTime = (clip.start_time || 0) / 1000;
      endTime = clip.end_time ? clip.end_time / 1000 : undefined;

      chunkStartTime = clip.sources?.[0]?.chunks?.[0]?.start_time;

      if(startTime || endTime) {
        subtitle = FrameAccurateVideo.TimeToString({
          time: startTime,
          format: "smpte",
          includeFractionalSeconds: true
        });

        if(endTime) {
          subtitle += " - " + FrameAccurateVideo.TimeToString({
            time: endTime,
            format: "smpte",
            includeFractionalSeconds: true
          });
          subtitle = `${subtitle} (${FrameAccurateVideo.TimeToString({time: endTime - startTime})})`;
        }

        imageUrl.searchParams.set("t", startTime.toFixed(2));
      }

      if(chunkStartTime) {
        chunkStartTime = chunkStartTime / 1000;
        imageUrl.searchParams.set("t", chunkStartTime.toFixed(2));
      }

      let score = clip.score;
      // Score is provided as an array of scores
      if(!score) {
        score = Math.max(...(clip?.sources?.map(source => source.score) || []));
      }

      const name = (
        clip.sources?.[0]?.fields?.f_zz_ui_name_1?.[0] ||
        clip.sources?.[0]?.fields?.f_zz_ui_name_2?.[0] ||
        clip.sources?.[0]?.fields?.f_display_title?.[0]
      );

      const description = (
        clip.sources?.[0]?.fields?.f_llava_as_string?.[0] ||
        clip.sources?.[0]?.fields?.f_llava?.[0]
      );

      this.clips[clipId] = {
        clipId,
        name: `${name}${description ? `: ${description}` : ""}`,
        libraryId: yield this.client.ContentObjectLibraryId({objectId: clip.id}),
        objectId: clip.id,
        versionHash: sourceClip.versionHash,
        offering: sourceClip.offering,
        clipInFrame,
        clipOutFrame,
        firstChunkStartTime: chunkStartTime,
        thumbnailFrame: chunkStartTime ? this.clipStores[storeKey]?.TimeToFrame(chunkStartTime) : undefined,
        score: score ? (score * 100).toFixed(1) : "",
        imageUrl,
        storeKey,
        clipKey: `${clip.id}-${sourceClip.offering}-${clipInFrame}-${clipOutFrame}`
      };

      searchClipIds.push(clipId);
    }

    // Clear old search results
    const oldClipIds = this.searchClipIds[objectId] || [];
    this.searchClipIds[objectId] = [];
    for(const clipId of oldClipIds) {
      delete this.clips[clipId];
    }

    this.searchClipIds[objectId] = searchClipIds;
    this.searchClipInfo[objectId] = {
      query,
      searchSettingsKey: this.searchSettings.key,
      indexId: this.selectedSearchIndexId
    };
  });

  SetCompositionFormOptions(options) {
    this.compositionFormOptions = options;

    if(!options) {
      this.SetCompositionGenerationStatus({});
    }
  }

  SetCompositionGenerationStatus(status) {
    this.compositionGenerationStatus = status;
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
