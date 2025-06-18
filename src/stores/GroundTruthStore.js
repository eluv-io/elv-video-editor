import {flow, makeAutoObservable} from "mobx";

class GroundTruthStore {
  pools = {};

  constructor(rootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  get client() {
    return this.rootStore.client;
  }

  LoadGroundTruthPools = flow(function * ({noCache}={}) {
    return yield this.rootStore.LoadResource({
      key: "ground-truth-pools",
      id: "load",
      force: noCache,
      bind: this,
      Load: flow(function * () {
        // TODO: this should be loaded properly
        const poolIds = ["iq__3jxxA9MhGyeae8A1wKTtLEAzav6G"];

        let pools = {};
        yield Promise.all(
          poolIds.map(async poolId => {
            try {
              pools[poolId] = {
                objectId: poolId,
                name: (await this.client.ContentObjectMetadata({
                  libraryId: await this.client.ContentObjectLibraryId({objectId: poolId}),
                  objectId: poolId,
                  metadataSubtree: "/public/name"
                })) || poolId
              };
            } catch(error) {
              // eslint-disable-next-line no-console
              console.error("Failed to load ground truth pool:");
              // eslint-disable-next-line no-console
              console.error(error);
            }
          })
        );

        this.pools = pools;
      })
    });
  });
}

export default GroundTruthStore;
