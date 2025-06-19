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

  LoadGroundTruthPools = flow(function * ({force}={}) {
    return yield this.rootStore.LoadResource({
      key: "ground-truth-pools",
      id: "load",
      force,
      bind: this,
      Load: flow(function * () {
        // TODO: this should be loaded properly
        const poolIds = ["iq__3jxxA9MhGyeae8A1wKTtLEAzav6G"];

        let pools = {};
        yield Promise.all(
          poolIds.map(async poolId => {
            try {
              pools[poolId] = {
                ...(this.pools[poolId] || {}),
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

  LoadGroundTruthPool = flow(function * ({poolId, force}) {
    return yield this.rootStore.LoadResource({
      key: "ground-truth",
      id: poolId,
      force,
      bind: this,
      Load: flow(function * () {
        const libraryId = yield this.client.ContentObjectLibraryId({objectId: poolId});
        const versionHash = yield this.client.LatestVersionHash({objectId: poolId});

        const metadata = (yield this.client.ContentObjectMetadata({
          versionHash,
          metadataSubtree: "/",
          produceLinkUrls: true,
          select: [
            "/public/name",
            "/ground_truth"
          ]
        }));

        this.pools[poolId] = {
          libraryId,
          objectId: poolId,
          versionHash,
          name: metadata?.public?.name || metadata?.ground_truth?.model_domain || poolId,
          metadata: metadata.ground_truth || {}
        };
      })
    });
  });
}

export default GroundTruthStore;
