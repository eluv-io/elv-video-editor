import {flow, makeAutoObservable} from "mobx";
import {CSVtoList, Unproxy} from "@/utils/Utils.js";

class GroundTruthStore {
  pools = {};
  domains = {};
  saveProgress = 0;

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
    yield this.LoadGroundTruthPools();

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
            "/public/description",
            "/ground_truth"
          ]
        }));

        const attributes = metadata?.ground_truth?.entity_data_schema?.properties || {};

        this.pools[poolId] = {
          libraryId,
          objectId: poolId,
          versionHash,
          name: metadata?.public?.name || metadata?.ground_truth?.model_domain || poolId,
          description: metadata?.public?.description,
          metadata: metadata.ground_truth || {},
          attributes: Object.keys(attributes)
            .sort((a, b) => attributes[a].order < attributes[b].order ? -1 : 1)
            .map(attributeKey => ({
              id: Math.random(),
              key: attributeKey,
              options: (attributes[attributeKey]?.options || [])
                .join(",")
            }))
        };

        this.rootStore.SetAuthToken({versionHash});
      })
    });
  });

  CreateGroundTruthPool = flow(function * ({libraryId, name, description, model, attributes}) {
    this.saveProgress = 0;

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
        this.saveProgress = 10;

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
      }
    });

    this.saveProgress = 40;

    const objectId = response.id;

    yield this.client.SetPermission({
      libraryId,
      objectId,
      permission: "editable"
    });

    this.saveProgress = 70;

    const infoLibraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
    const infoId = this.rootStore.tenantInfoObjectId;
    yield this.client.EditAndFinalizeContentObject({
      libraryId: infoLibraryId,
      objectId: infoId,
      commitMessage: `EVIE: Add ground truth pool '${name}'`,
      callback: async ({writeToken}) => {
        const pools = (await this.client.ContentObjectMetadata({
          libraryId: infoLibraryId,
          objectId: infoId,
          writeToken,
          metadataSubtree: "/public/tagging/ground_truth/pools"
        })) || [];

        await this.client.ReplaceMetadata({
          libraryId: infoLibraryId,
          objectId: infoId,
          writeToken,
          metadataSubtree: "/public/tagging/ground_truth/pools",
          metadata: [...pools, objectId]
        });

        this.saveProgress = 90;
      }
    });

    yield this.LoadGroundTruthPools({force: true});

    return objectId;
  });

  UpdateGroundTruthPool = flow(function * ({objectId, name, description, model, attributes}) {
    const libraryId = yield this.client.ContentObjectLibraryId({objectId});
    const {writeToken} = yield this.client.EditContentObject({
      libraryId,
      objectId,
    });

    this.saveProgress = 30;

    let schema = {};
    attributes.map((attribute, index) => {
      schema[attribute.key] = {
        type: "string",
        order: index
      };

      const options = CSVtoList(attribute.options);

      if(options.length > 0) {
        schema[attribute.key].options = options;
      }
    });

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "/public/name",
      metadata: name
    });

    this.saveProgress = 40;

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "/public/description",
      metadata: description
    });

    this.saveProgress = 50;

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "/ground_truth/model_domain",
      metadata: model
    });

    this.saveProgress = 60;

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "/ground_truth/entity_data_schema/properties",
      metadata: Unproxy(schema)
    });

    this.saveProgress = 80;

    yield this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken
    });

    yield this.LoadGroundTruthPool({poolId: objectId, force: true});
  });

  DeleteGroundTruthPool = flow(function * ({objectId}) {
    const name = yield this.client.ContentObjectMetadata({
      versionHash: yield this.client.LatestVersionHash({objectId}),
      metadataSubtree: "/public/name"
    });

    yield this.client.DeleteContentObject({
      libraryId: yield this.client.ContentObjectLibraryId({objectId}),
      objectId
    });

    const infoLibraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
    const infoId = this.rootStore.tenantInfoObjectId;
    yield this.client.EditAndFinalizeContentObject({
      libraryId: infoLibraryId,
      objectId: infoId,
      commitMessage: `EVIE: Remove ground truth pool '${name || objectId}'`,
      callback: async ({writeToken}) => {
        const pools = (await this.client.ContentObjectMetadata({
          libraryId: infoLibraryId,
          objectId: infoId,
          writeToken,
          metadataSubtree: "/public/tagging/ground_truth/pools"
        })) || [];

        await this.client.ReplaceMetadata({
          libraryId: infoLibraryId,
          objectId: infoId,
          writeToken,
          metadataSubtree: "/public/tagging/ground_truth/pools",
          metadata: pools.filter(id => id !== objectId)
        });

        this.saveProgress = 90;
      }
    });

    delete this.pools[objectId];
  });

  NextEntityId(poolId) {
    const key = Object.keys(this.pools[poolId]?.metadata?.entities || {}).sort().reverse()[0];
    const prefix = key?.replace(/\d+/, "");
    const count = key?.replace(/\D+/, "");

    if(!key || isNaN(parseInt(count))) {
      return "asset0000001";
    }

    return `${prefix}${(parseInt(count) + 1).toString().padStart(count.length, "0")}`;
  }

  /* Entities */
  AddEntity({poolId, ...entity}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    const entityId = this.NextEntityId(poolId);

    entity = {
      ...entity,
      id: entityId
    };

    this.rootStore.editStore.PerformAction({
      label: `Add Entity ${entity.label}`,
      type: "entity",
      action: "create",
      modifiedItem: entity,
      Action: () => {
        this.pools[poolId].metadata.entities[entityId] = entity;
      },
      Undo: () => {
        delete this.pools[poolId].metadata.entities[entityId];
      }
    });

    return entityId;
  }

  ModifyEntity({poolId, entityId, ...entity}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    entity = {
      ...entity,
      id: entityId
    };

    const originalEntity = pool.metadata.entities[entityId];

    this.rootStore.editStore.PerformAction({
      label: `Modify Entity ${entity.label}`,
      type: "entity",
      action: "modify",
      modifiedItem: entity,
      Action: () => {
        this.pools[poolId].metadata.entities[entityId] = entity;
      },
      Undo: () => {
        this.pools[poolId].metadata.entities[entityId] = originalEntity;
      }
    });

    return entityId;
  }

  DeleteEntity({poolId, entityId}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    const originalEntity = pool.metadata.entities[entityId];

    this.rootStore.editStore.PerformAction({
      label: `Delete Entity ${originalEntity?.label}`,
      type: "entity",
      action: "delete",
      modifiedItem: originalEntity,
      Action: () => {
        delete this.pools[poolId].metadata.entities[entityId];
      },
      Undo: () => {
        this.pools[poolId].metadata.entities[entityId] = originalEntity;
      }
    });

    return entityId;
  }
}

export default GroundTruthStore;
