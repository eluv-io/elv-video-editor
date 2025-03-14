import {flow, makeAutoObservable} from "mobx";
import VideoStore from "@/stores/VideoStore.js";
import {Unproxy} from "@/utils/Utils.js";

class CompositionStore {
  videoStore;
  name = "";
  loading = false;
  clipStores = {};

  clips = {};
  clipIdList = [];
  selectedClipId;

  draggingClip;
  showDragShadow = false;
  dropIndicatorIndex;

  mousePositionX = 0;
  mousePositionY = 0;

  _actionStack = [];
  _redoStack = [];
  _position = 0;

  constructor(rootStore) {
    makeAutoObservable(
      this,
      {
        videoStore: false,
        clipStores: false
      }
    );

    this.rootStore = rootStore;
    this.videoStore = new VideoStore(this.rootStore, {tags: false});
    this.videoStore.id = "Composition Store";
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

    return this.videoStore.FrameToTime(this.compositionDurationFrames);
  }

  get clipList() {
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

  get selectedClipStore() {
    return this.clipStores[this.selectedClip?.storeKey];
  }

  get selectedClip() {
    return this.clips[this.selectedClipId];
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

    return result;
  }


  SetCompositionName(name) {
    this.name = name;
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

    this.SetSelectedClip(clipId);
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
      this.ClearSelectedClip();
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
    this.videoStore = new VideoStore(this.rootStore, {tags: false});

    this.clipStores = {};
    this.clips = {};
    this.clipIdList = [];
    this.selectedClipId = undefined;
    this.name = "";
  }

  SetVideo = flow(function * ({objectId, preferredOfferingKey}) {
    this.loading = true;
    yield this.videoStore.SetVideo({objectId, preferredOfferingKey});

    this.name = this.videoStore.name;

    // TOdO :REmove
    const clipId = yield this.InitializeClip({
      objectId: "iq__2yRdMBUdVgmX5A6CivWT56BZz6pz",
      offering: preferredOfferingKey,
      clipInFrame: 24 * 400,
      clipOutFrame: 24 * 500
    });

    this.SetSelectedClip(clipId);

    this.loading = false;
  });

  ClipStore({objectId, offering}) {
    return this.clipStores[`${objectId}-${offering}`];
  }

  SetSelectedClip(clipId) {
    this.selectedClipId = clipId;
  }

  ModifySelectedClip({...attrs}) {
    this.clips[this.selectedClipId] = {
      ...this.clips[this.selectedClipId],
      ...attrs
    };
  }

  ClearSelectedClip() {
    this.selectedClipId = undefined;
  }

  InitializeClip = flow(function * ({objectId, offering="default", clipInFrame, clipOutFrame}) {
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
      clipInFrame,
      clipOutFrame,
      storeKey: `${store.videoObject.objectId}-${store.offeringKey}`,
      clipKey: `${store.videoObject.objectId}-${store.offeringKey}-${clipInFrame}-${clipOutFrame}`
      // TODO: Audio
      //audioRepresentation: store.audioRepresentation,
    };

    this.clipLoading = false;

    return clipId;
  });

  CompositionProgressToSMPTE(progress) {
    return this.videoStore.TimeToSMPTE(this.compositionDuration * progress / 100);
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
}

export default CompositionStore;
