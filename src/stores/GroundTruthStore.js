import {flow, makeAutoObservable, runInAction} from "mobx";
import {CSVtoList, StripFabricLinkUrls, Unproxy} from "@/utils/Utils.js";
import UrlJoin from "url-join";

class GroundTruthStore {
  pools = {};
  domains = {};
  saveProgress = 0;
  saveError = undefined;
  contentAdminsGroupAddress;

  constructor(rootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  get client() {
    return this.rootStore.client;
  }

  LoadGroundTruthPools = flow(function * ({force}={}) {
    return yield this.rootStore.LoadResource({
      key: "groundTruthPools",
      id: "load",
      force,
      bind: this,
      Load: flow(function * () {
        const poolInfo = yield this.client.ContentObjectMetadata({
          versionHash: yield this.client.LatestVersionHash({objectId: this.rootStore.tenantInfoObjectId}),
          metadataSubtree: "/public/tagging/ground_truth"
        });

        this.domains = {
          "celebrity_detection": "Celebrity Detection",
          ...(poolInfo?.domains || {}),
        };

        if(!poolInfo) {
          return;
        }

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

  FormatPoolAttributes(metadata) {
    const attributes = metadata?.entity_data_schema?.properties || {};

    return Object.keys(attributes)
      .sort((a, b) => attributes[a].order < attributes[b].order ? -1 : 1)
      .map(attributeKey => ({
        id: Math.random(),
        key: attributeKey,
        options: (attributes[attributeKey]?.options || [])
          .join(",")
      }));
  }

  LoadGroundTruthPool = flow(function * ({poolId, force}) {
    yield this.LoadGroundTruthPools();

    return yield this.rootStore.LoadResource({
      key: "groundTruth",
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

        this.pools[poolId] = {
          libraryId,
          objectId: poolId,
          versionHash,
          name: metadata?.public?.name || metadata?.ground_truth?.model_domain || poolId,
          description: metadata?.public?.description,
          metadata: metadata.ground_truth || {},
          attributes: this.FormatPoolAttributes(metadata.ground_truth || {})
        };

        this.rootStore.SetAuthToken({versionHash});
      })
    });
  });

  CreateGroundTruthPool = flow(function * ({libraryId, name, description, model, attributes}) {
    this.saveError = undefined;
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            entities: {},
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

    if(!this.contentAdminsGroupAddress) {
      try {
        this.contentAdminsGroupAddress = yield this.client.CallContractMethod({
          contractAddress: this.client.utils.HashToAddress(this.rootStore.tenantContractId),
          methodName: "groupsMapping",
          methodArgs: ["content_admin", 0],
          formatArguments: true,
        });
      } catch(error) {
        this.Log("Failed to load tenant admin group", true);
        this.Log(error, true);
      }
    }

    if(this.contentAdminsGroupAddress) {
      yield this.client.AddContentObjectGroupPermission({
        objectId,
        groupAddress: this.contentAdminsGroupAddress,
        permission: "manage"
      });
    }

    yield this.LoadGroundTruthPools({force: true});

    return objectId;
  });

  ModifyGroundTruthPool({objectId, name, description, model, attributes}) {
    if(!this.pools[objectId]) { throw Error("Unable to find pool " + objectId); }

    const originalPool = {
      ...this.pools[objectId],
      metadata: {
        ...this.pools[objectId].metadata,
        // Entities can be large, don't keep it around in action stack
        entities: {}
      }
    };

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

    schema = {
      type: "object",
      properties: schema
    };

    this.rootStore.editStore.PerformAction({
      label: `Modify Pool ${name || originalPool.name}`,
      type: "pool",
      action: "modify",
      modifiedItem: originalPool,
      Action: () => {
        const metadata = this.pools[objectId].metadata;
        this.pools[objectId] = {
          ...this.pools[objectId],
          name,
          description,
          model,
          attributes: this.FormatPoolAttributes({entity_data_schema: schema}),
          metadata: {
            ...metadata,
            model_domain: model,
            entity_data_schema: schema
          }
        };
      },
      Undo: () => {
        const metadata = this.pools[poolId].metadata;
        this.pools[objectId] = {
          ...this.pools[objectId],
          ...originalPool,
          metadata: {
            ...metadata,
            ...originalPool.metadata
          }
        };
      },
      Write: async (writeParams) => {
        await this.client.MergeMetadata({
          ...writeParams,
          metadataSubtree: "/public",
          metadata: {
            name: name || "",
            description: description || ""
          }
        });

        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: "/ground_truth/model_domain",
          metadata: model
        });

        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: "/ground_truth/entity_data_schema",
          metadata: schema
        });

        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: "/ground_truth/updated_at",
          metadata: new Date().toISOString()
        });
      }
    });
  }

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

  /* Entities */

  AddEntity({poolId, assetFiles=[], ...entity}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    const entityId = this.rootStore.NextId(true);

    entity = {
      ...entity,
      id: entityId
    };

    entity.sample_files = assetFiles.map(file => ({
      id: this.rootStore.NextId(true),
      link: {
        "/": UrlJoin("./", "files", file.fullPath),
        url: file.publicUrl || file.url
      },
      label: file.filename,
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const anchorIndex = assetFiles.findIndex(file => file.anchor);
    if(anchorIndex >= 0) {
      entity.sample_files[anchorIndex].anchor = true;
    }

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
      },
      Write: async writeParams => {
        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId),
          metadata: Unproxy(
            StripFabricLinkUrls({
              ...entity,
              added_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          )
        });
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
      },
      Write: async writeParams => {
        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId),
          metadata: Unproxy(
            StripFabricLinkUrls({
              ...entity,
              updated_at: new Date().toISOString()
            })
          )
        });
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
      },
      Write: async writeParams => {
        await this.client.DeleteMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId)
        });
      }
    });

    return entityId;
  }

  /* Assets */

  AddAssets({poolId, entityId, files}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    const entity = pool.metadata.entities[entityId];

    if(!entity) { throw Error("Unable to find entity " + poolId); }

    const originalFiles = entity.sample_files || [];

    const newFiles = [
      ...originalFiles,
      ...files.map(file => ({
        id: this.rootStore.NextId(true),
        link: {
          "/": UrlJoin("./", "files", file.fullPath),
          url: file.publicUrl || file.url
        },
        label: file.filename,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    ];

    this.rootStore.editStore.PerformAction({
      label: `Add Assets to ${entity?.label}`,
      type: "assets",
      action: "add",
      modifiedItem: originalFiles,
      Action: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files = newFiles;
      },
      Undo: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files = originalFiles;
      },
      Write: async writeParams => {
        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId, "sample_files"),
          metadata: Unproxy(StripFabricLinkUrls(newFiles))
        });
      }
    });
  }

  AddAssetFromUrl({poolId, entityId, image, label="", description="", source}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    const entity = pool.metadata.entities[entityId];

    if(!entity) { throw Error("Unable to find entity " + poolId); }

    const originalFiles = entity.sample_files || [];

    const newFiles = [
      ...originalFiles,
      {
        id: this.rootStore.NextId(true),
        link: {
          "/": UrlJoin("./", "files", "frames", image.filename),
          url: image.url
        },
        source,
        label: label || image.filename,
        description: description,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.rootStore.editStore.PerformAction({
      label: `Add Asset from URL to ${entity?.label}`,
      type: "assets",
      action: "add-url",
      modifiedItem: originalFiles,
      page: "groundTruth",
      subpage: poolId,
      Action: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files = newFiles;
      },
      Undo: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files = originalFiles;
      },
      Write: async writeParams => {
        const data = await image.blob.arrayBuffer();

        let filename = image.filename || "";
        if(!filename.toLowerCase().endsWith(".jpg") && !filename.toLowerCase().endsWith(".jpeg")) {
          filename = `${filename}.jpg`;
        }

        await this.client.UploadFiles({
          ...writeParams,
          fileInfo: [{
            path: UrlJoin("frames", filename),
            type: "file",
            mime_type: "image/jpg",
            size: data.byteLength,
            data
          }]
        });

        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId, "sample_files"),
          metadata: Unproxy(StripFabricLinkUrls(newFiles))
        });
      }
    });
  }

  ModifyAsset({poolId, entityId, assetIndexOrId, file, label, description}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    const entity = pool.metadata.entities[entityId];

    if(!entity) { throw Error("Unable to find entity " + poolId); }

    const originalAsset = this.GetGroundTruthAsset(entity, assetIndexOrId);

    const updatedAsset = {
      ...originalAsset,
      id: originalAsset.id || this.rootStore.NextId(true),
      link:
        !file ? originalAsset.link :
          {
            "/": UrlJoin("./", "files", file.fullPath),
            url: file.publicUrl || file.url
          },
      // If previous name was just filename of the asset, update name to new filename
      label: label || (originalAsset.label === originalAsset.filename ? file?.filename || originalAsset.label : originalAsset.label),
      description: description || originalAsset.description,
      updated_at: new Date().toISOString()
    };

    this.rootStore.editStore.PerformAction({
      label: `Modify asset ${originalAsset.label} in ${entity?.label}`,
      type: "assets",
      action: "modify",
      modifiedItem: originalAsset,
      Action: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files[originalAsset.index] = updatedAsset;
      },
      Undo: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files[originalAsset.index] = originalAsset;
      },
      Write: async writeParams => {
        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId, "sample_files", originalAsset.index.toString()),
          metadata: Unproxy(StripFabricLinkUrls(updatedAsset))
        });
      }
    });
  }

  DeleteAsset({poolId, entityId, assetIndexOrId}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    const entity = pool.metadata.entities[entityId];

    if(!entity) { throw Error("Unable to find entity " + poolId); }

    const originalFiles = entity.sample_files || [];

    const asset = this.GetGroundTruthAsset(entity, assetIndexOrId);

    this.rootStore.editStore.PerformAction({
      label: `Delete Asset ${asset.label} from ${entity.label}`,
      type: "asset",
      action: "delete",
      modifiedItem: asset,
      Action: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files =
          originalFiles.filter((_, index) => index !== asset.index);
      },
      Undo: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files = originalFiles;
      },
      Write: async writeParams => {
        const files = await this.client.ContentObjectMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId, "sample_files")
        });

        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId, "sample_files"),
          metadata: files.filter((_, index) => index !== asset.index)
        });
      }
    });
  }

  SetAnchorAsset({poolId, entityId, assetIndexOrId}) {
    const pool = this.pools[poolId];

    if(!pool) { throw Error("Unable to find pool " + poolId); }

    const entity = pool.metadata.entities[entityId];

    if(!entity) { throw Error("Unable to find entity " + poolId); }

    const originalAnchorIndex = (entity.sample_files || []).findIndex(file => file.anchor);

    const originalAsset = this.GetGroundTruthAsset(entity, assetIndexOrId);

    this.rootStore.editStore.PerformAction({
      label: `Set Asset Anchor ${originalAsset.label} for ${entity.label}`,
      type: "asset",
      action: "anchor",
      modifiedItem: originalAsset,
      Action: () => {
        this.pools[poolId].metadata.entities[entityId].sample_files[originalAsset.index].anchor = true;

        if(originalAnchorIndex >= 0) {
          delete this.pools[poolId].metadata.entities[entityId].sample_files[originalAnchorIndex].anchor;
        }
      },
      Undo: () => {
        delete this.pools[poolId].metadata.entities[entityId].sample_files[originalAsset.index].anchor;

        if(originalAnchorIndex >= 0) {
          this.pools[poolId].metadata.entities[entityId].sample_files[originalAnchorIndex].anchor = true;
        }
      },
      Write: async writeParams => {
        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/ground_truth", "entities", entityId, "sample_files", originalAsset.index.toString(), "anchor"),
          metadata: true
        });

        if(originalAnchorIndex >= 0) {
          await this.client.DeleteMetadata({
            ...writeParams,
            metadataSubtree: UrlJoin("/ground_truth", "entities", entityId, "sample_files", originalAnchorIndex.toString(), "anchor"),
          });
        }
      }
    });
  }

  SaveGroundTruthPool = flow(function * ({poolId}) {
    try {
      this.saveProgress = 0;
      const objectId = poolId;
      const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});
      const writeToken = yield this.rootStore.editStore.InitializeWrite({objectId});

      this.saveProgress = 20;

      const actions = this.rootStore.editStore.editInfo.groundTruth.actionStack
        .filter(action => action.subpage === poolId);

      const progressPerAction = 50 / actions.length;
      for(const action of actions) {
        try {
          yield action.Write({libraryId, objectId, writeToken});
          this.saveProgress += progressPerAction;
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error("Save action failed:");
          // eslint-disable-next-line no-console
          console.error(action);
          // eslint-disable-next-line no-console
          console.log(error);
          throw error;
        }
      }

      this.saveProgress = 80;

      yield this.rootStore.editStore.Finalize({objectId, commitMessage: "EVIE: Update ground truth pool"});

      this.rootStore.editStore.ResetSubpage("groundTruth", poolId);
      this.rootStore.fileBrowserStore.ClearCachedFiles(poolId);

      this.LoadGroundTruthPool({poolId, force: true});
    } catch(error) {
      this.rootStore.editStore.DiscardWriteToken({objectId: poolId});

      this.saveError = error;
    }
  });

  ClearSaveError() {
    this.saveError = undefined;
  }

  // Assets may or may not have ids
  GetGroundTruthAsset(entity, assetIndexOrId) {
    let assetIndex = (entity?.sample_files || []).findIndex(asset => asset.id && asset.id === assetIndexOrId);

    if(assetIndex < 0) {
      assetIndex = parseInt(assetIndexOrId);
    }

    const asset = entity?.sample_files[assetIndex];

    if(asset) {
      runInAction(() => {
        asset.index = assetIndex;
        asset.filename = asset.link?.["/"]?.split("/")?.slice(-1)[0];
        asset.label = asset.label || asset.filename;
      });
    }

    return asset;
  }
}

export default GroundTruthStore;
