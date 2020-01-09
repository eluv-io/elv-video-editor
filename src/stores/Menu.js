import {observable, action, flow} from "mobx";
import UrlJoin from "url-join";

class MenuStore {
  @observable libraryId = "";
  @observable objectId = "";

  @observable showMenu = true;

  @observable libraries = {};
  @observable objects = {};

  @observable selectedObject;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  async FilterVideos(contents) {
    const videoTypes = [
      "ABR Master"
    ];

    const isVideoType = {};

    // Collect unique type hashes
    contents.forEach(object => isVideoType[object.versions[0].type] = false);

    // Determine whether or not each type is a video type
    await Promise.all(
      Object.keys(isVideoType).map(async typeHash => {
        if(!typeHash) { return; }

        const typeName = await this.rootStore.client.ContentObjectMetadata({
          versionHash: typeHash,
          metadataSubtree: "name"
        });

        isVideoType[typeHash] = videoTypes.includes(typeName);
      })
    );

    return contents.filter(object => isVideoType[object.versions[0].type]);
  }

  @action.bound
  ToggleMenu(open) {
    this.showMenu = open;
  }

  @action.bound
  UpdateVersionHash(versionHash) {
    this.selectedObject.versionHash = versionHash;
  }

  @action.bound
  SelectVideo = flow(function * ({libraryId, objectId, versionHash}) {
    this.rootStore.Reset();
    this.selectedObject = undefined;

    if(versionHash) {
      objectId = this.rootStore.client.utils.DecodeVersionHash(versionHash).objectId;
    }

    if(!libraryId) {
      libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});
    }

    if(window.self !== window.top) {
      this.rootStore.client.SendMessage({
        options: {
          operation: "SetFramePath",
          path: UrlJoin("#", versionHash ? versionHash : UrlJoin(libraryId, objectId))
        },
        noResponse: true
      });
    }

    const object = yield this.rootStore.client.ContentObject({libraryId, objectId, versionHash});

    if(!versionHash) {
      versionHash = object.hash;
    }

    const metadata = yield this.rootStore.client.ContentObjectMetadata({objectId, versionHash});

    this.selectedObject = {
      libraryId,
      objectId: object.id,
      versionHash,
      name: metadata.name || versionHash,
      metadata
    };

    this.rootStore.videoStore.SetVideo(this.selectedObject);
  });

  @action.bound
  ListLibraries = flow(function * () {
    const libraryIds = yield this.rootStore.client.ContentLibraries();

    this.libraries = {};

    (yield Promise.all(
      libraryIds.map(async libraryId => {
        try {
          const metadata = await this.rootStore.client.ContentObjectMetadata({
            libraryId,
            objectId: libraryId.replace("ilib", "iq__")
          });

          metadata.name = metadata.name || libraryId;

          this.libraries[libraryId] = {
            libraryId,
            metadata,
          };
        } catch(error) {
          return undefined;
        }
      })
    ));
  });

  @action.bound
  ListObjects = flow(function * ({libraryId, page=1, perPage=25, filter="", cacheId=""}) {
    const metadata = yield this.rootStore.client.ContentObjectMetadata({
      libraryId,
      objectId: libraryId.replace("ilib", "iq__")
    });

    metadata.name = metadata.name || libraryId;

    this.libraries[libraryId] = {
      libraryId,
      metadata,
    };

    let { contents, paging } = yield this.rootStore.client.ContentObjects({
      libraryId,
      filterOptions: {
        select: [
          "description",
          "image",
          "name",
          "player_background",
          "public"
        ],
        filter: filter ? {key: "name", type: "cnt", filter} : undefined,
        start: (page-1) * perPage,
        limit: perPage,
        sort: "name",
        cacheId
      }
    });

    // Filter non-video objects
    contents = yield this.FilterVideos(contents);

    this.objects[libraryId] = (yield Promise.all(
      contents.map(async object => {
        const latestVersion = object.versions[0];

        return {
          objectId: latestVersion.id,
          versionHash: latestVersion.hash,
          metadata: latestVersion.meta
        };
      })
    ));

    return paging;
  });

  @action.bound
  SetLibraryId(libraryId) {
    this.libraryId = libraryId;
  }

  @action.bound
  ClearLibraryId() {
    this.libraryId = "";
  }

  @action.bound
  SetObjectId(objectId) {
    this.objectId = objectId;
  }

  @action.bound
  ClearObjectId() {
    this.objectId = "";
  }
}

export default MenuStore;
