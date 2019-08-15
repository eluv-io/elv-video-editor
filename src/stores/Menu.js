import {observable, action, flow} from "mobx";

class MenuStore {
  @observable showMenu = true;

  @observable libraries = [];
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
  ToggleMenu() {
    this.showMenu = !this.showMenu;
  }

  @action.bound
  SelectVideo = flow(function * ({libraryId, objectId, versionHash}) {
    this.rootStore.Reset();

    this.rootStore.videoStore.IndicateLoading();

    if(versionHash) {
      objectId = this.rootStore.client.utils.DecodeVersionHash(versionHash).objectId;
    }

    if(!libraryId) {
      libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});
    }

    const object = yield this.rootStore.client.ContentObject({objectId, versionHash});

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

    this.libraries = (yield Promise.all(
      libraryIds.map(async libraryId => {
        try {
          const metadata = await this.rootStore.client.ContentObjectMetadata({
            libraryId,
            objectId: libraryId.replace("ilib", "iq__")
          });

          metadata.name = metadata.name || libraryId;

          return {
            libraryId,
            metadata,
          };
        } catch(error) {
          return undefined;
        }
      })
    ))
      .filter(library => library)
      .sort((a, b) => a.metadata.name.toLowerCase() > b.metadata.name.toLowerCase() ? 1 : -1);
  });

  @action.bound
  ListObjects = flow(function * (libraryId) {
    let { contents } = yield this.rootStore.client.ContentObjects({
      libraryId,
      filterOptions: {
        select: [
          "description",
          "image",
          "name",
          "player_background",
          "public"
        ],
        limit: 1000,
        sort: "name"
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
  });
}

export default MenuStore;
