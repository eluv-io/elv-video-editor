import {flow, makeAutoObservable} from "mobx";
import VideoStore from "@/stores/VideoStore.js";

class CompositionStore {
  videoStore;
  loading = false;
  clipStores = {};

  selectedClipKey;

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

  get selectedClipStore() {
    return this.clipStores[this.selectedClipKey];
  }

  get selectedClip() {
    const store = this.selectedClipStore;

    if(!store) {
      return undefined;
    }

    return {
      name: store.name,
      libraryId: store.videoObject.libraryId,
      objectId: store.videoObject.objectId,
      versionHash: store.videoObject.versionHash,
      offering: store.offeringKey,
      clipInFrame: store.clipInFrame,
      clipOutFrame: store.clipOutFrame,
      // TODO: Audio
      //audioRepresentation: store.audioRepresentation,
    };
  }

  Reset() {
    this.videoStore = new VideoStore(this.rootStore, {tags: false});

    this.clipStores = {};
  }

  SetVideo = flow(function * ({objectId, preferredOfferingKey}) {
    this.loading = true;
    yield this.videoStore.SetVideo({objectId, preferredOfferingKey});

    // TOdO :REmove
    this.SetSelectedClip({
      objectId: "iq__2yRdMBUdVgmX5A6CivWT56BZz6pz",
      offering: preferredOfferingKey,
      clipInTime: 400,
      clipOutTime: 500
    });

    this.loading = false;
  });

  ClipStore({objectId, offering}) {
    return this.clipStores[`${objectId}-${offering}`];
  }

  SetSelectedClip = flow(function * ({objectId, offering="default", clipInTime, clipOutTime}) {
    yield this.LoadClip({objectId, offering, clipInTime, clipOutTime});

    this.selectedClipKey = `${objectId}-${offering}`;
  });

  ClearSelectedClip() {
    this.selectedClipKey = undefined;
  }

  LoadClip = flow(function * ({objectId, offering="default", clipInTime, clipOutTime}) {
    const key = `${objectId}-${offering}`;
    if(!this.clipStores[key]) {
      this.clipLoading = true;

      const clipStore = new VideoStore(
        this.rootStore,
        {
          tags: false,
          clipKey: key,
          initialClipPoints: {
            inTime: clipInTime,
            outTime: clipOutTime
          }
        }
      );

      clipStore.sliderMarks = 20;
      clipStore.majorMarksEvery = 5;

      yield clipStore.SetVideo({objectId, preferredOfferingKey: offering, noTags: true});
      this.clipStores[key] = clipStore;
    }

    this.clipLoading = false;
  });
}

export default CompositionStore;
