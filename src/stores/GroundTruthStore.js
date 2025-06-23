import {flow, makeAutoObservable} from "mobx";
import {CSVtoList} from "@/utils/Utils.js";

class GroundTruthStore {
  pools = {};
  domains = {};

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
        const poolInfo = yield this.client.ContentObjectMetadata({
          versionHash: yield this.client.LatestVersionHash({objectId: this.rootStore.tenantInfoObjectId}),
          metadataSubtree: "/public/tagging/ground_truth"
        });

        if(!poolInfo) {
          return;
        }

        this.domains = poolInfo.domains;

        let pools = {};
        yield Promise.all(
          (poolInfo?.pools || []).map(async poolId => {
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

  CreateGroundTruthPool = flow(function * ({libraryId, name, description, model, attributes}) {
    const types = yield rootStore.client.ContentTypes();
    const type =
      Object.values(types).find(type => type.name?.toLowerCase()?.endsWith("title")) ||
      Object.values(types).find(type => type.name?.toLowerCase()?.includes("title")) ||
      Object.values(types)[0];

    const response = yield this.client.CreateAndFinalizeContentObject({
      libraryId,
      options: {
        type: type?.id,
      },
      callback: async ({objectId, writeToken}) => {
        await this.client.ReplaceMetadata({
          libraryId,
          objectId,
          writeToken,
          metadataSubtree: "/public",
          metadata: {
            name,
            description,
            asset_metadata: {}
          }
        });

        let schema = {};

        attributes.map(attribute => {
          schema[attribute.key] = {
            type: "string"
          };

          const options = CSVtoList(attribute.options);

          if(options.length > 0) {
            schema[attribute.key].options = options;
          }
        });

        await this.client.ReplaceMetadata({
          libraryId,
          objectId,
          writeToken,
          metadataSubtree: "/ground_truth",
          metadata: {
            entities: [],
            model_domain: model,
            entity_data_schema: {
              type: "object",
              properties: schema
            }
          }
        });

        await this.client.SetPermission({
          libraryId,
          objectId,
          writeToken,
          permission: "editable"
        });
      }
    });

    this.pools[response.objectId] = {
      objectId: response.objectId,
      name
    };

    yield this.LoadGroundTruthPool({poolId: response.objectId});

    // TODO: Add item to the tenant object
    return response.objectId;
  });
}

export default GroundTruthStore;
