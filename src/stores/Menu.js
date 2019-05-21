import {observable, action, flow} from "mobx";

class MenuStore {
  @observable showMenu = true;

  @observable libraries = [];
  @observable objects = {};

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  ToggleMenu() {
    this.showMenu = !this.showMenu;
  }

  async GetLibrary(libraryId) {
    let metadata = await this.rootStore.client.PublicLibraryMetadata({libraryId});
    metadata.name = metadata.name || libraryId;

    return {
      libraryId,
      ...(await this.rootStore.client.ContentLibrary({libraryId})),
      meta: metadata
    };
  }

  @action.bound
  ListLibraries = flow(function * () {
    const libraryIds = yield this.rootStore.client.ContentLibraries();

    this.libraries = (yield Promise.all(
      libraryIds.map(libraryId => this.GetLibrary(libraryId))
    ))
      .filter(library =>
        library.meta.class !== "elv-user-library" &&
        library.meta.class !== "elv-media-platform" &&
        !this.rootStore.client.utils.EqualHash(library.libraryId, this.rootStore.client.contentSpaceId)
      )
      .sort((a, b) => a.meta.name.toLowerCase() > b.meta.name.toLowerCase() ? 1 : -1);
  });

  IsVideo(object) {
    return !!object.meta.video;
  }

  @action.bound
  ListObjects = flow(function * (libraryId) {
    this.objects[libraryId] = (yield this.rootStore.client.ContentObjects({libraryId}))
      // Remove library objects
      .filter(object => !this.rootStore.client.utils.EqualHash(object.id, libraryId))
      // Pull out latest version info
      .map(object => {
        object = object.versions[0];
        object.objectId = object.id;
        object.meta.name = object.meta.name || object.id;
        return object;
      })
      // Only show video types
      .filter(object => this.IsVideo(object))
      .sort((a, b) => a.meta.name.toLowerCase() > b.meta.name.toLowerCase() ? 1 : -1);
  });
}

export default MenuStore;
