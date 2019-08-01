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
    const { contents } = yield this.rootStore.client.ContentObjects({libraryId});

    this.objects[libraryId] = (yield Promise.all(
      contents.map(async object => {
        const latestVersion = object.versions[0];

        return {
          objectId: latestVersion.id,
          versionHash: latestVersion.hash,
          metadata: latestVersion.meta
        };
      })
    ))
      .filter(object => !!object.metadata.offerings);
  });
}

export default MenuStore;
