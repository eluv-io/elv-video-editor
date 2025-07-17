import {flow, makeAutoObservable, runInAction} from "mobx";
import UrlJoin from "url-join";
import {Unproxy} from "@/utils/Utils.js";

class AIStore {
  searchIndexes = [];
  customSearchIndexIds = [];
  selectedSearchIndexId;
  searchIndexUpdateProgress = {};
  tagAggregationProgress = 0;

  searchResults = {};

  _authTokens = {};

  constructor(rootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  get client() {
    return this.rootStore.client;
  }

  get searchIndex() {
    return this.searchIndexes.find(index => index.id === this.selectedSearchIndexId);
  }

  QueryAIAPI = flow(function * ({
    server="ai",
    method="GET",
    path,
    objectId,
    channelAuth=false,
    update=false,
    queryParams={},
    format="json"
  }) {
    const url = new URL(`https://${server}.contentfabric.io/`);
    url.pathname = path;

    Object.keys(queryParams).forEach(key =>
      queryParams[key] && url.searchParams.set(key, queryParams[key])
    );

    if(!this._authTokens[objectId]) {
      this._authTokens[objectId] = {};
    }

    let authToken;
    if(update) {
      if(!this._authTokens[objectId].update) {
        this._authTokens[objectId].update = yield this.client.CreateAuthorizationToken({
          objectId,
          update: true
        });
      }

      authToken = this._authTokens[objectId].update;
    } else if(channelAuth) {
      if(!this._authTokens[objectId].channel) {
        this._authTokens[objectId].channel = new URL(yield this.client.FabricUrl({
          versionHash: yield this.client.LatestVersionHash({objectId: objectId}),
          channelAuth: true
        })).searchParams.get("authorization");
      }

      authToken = this._authTokens[objectId].channel;
    } else {
      if(!this._authTokens[objectId].signed) {
        this._authTokens[objectId].signed = yield this.rootStore.client.CreateSignedToken({
          objectId,
          duration: 24 * 60 * 60 * 1000
        });
      }

      authToken = this._authTokens[objectId].signed;
    }

    url.searchParams.set("authorization", authToken);

    const response = yield fetch(url, {method});

    if(response.status >= 400) {
      throw response;
    }

    return !format ? response :
      yield this.client.utils.ResponseToFormat(format, response);
  });

  GenerateAIHighlights = flow(function * ({objectId, prompt, maxDuration, regenerate=false, wait=true, StatusCallback}) {
    let options = {};
    if(prompt) { options.customization = prompt; }
    if(maxDuration) { options.max_length = maxDuration * 1000; }

    if(regenerate) {
      yield this.QueryAIAPI({
        method: "POST",
        path: UrlJoin("ml", "highlight_composition", "q", objectId),
        objectId,
        queryParams: {...options, regenerate: true}
      });

      yield new Promise(resolve => setTimeout(resolve, 1000));
    }

    let status;
    do {
      if(status) {
        StatusCallback?.(status);
        yield new Promise(resolve => setTimeout(resolve, 5000));
      }

      const response = yield this.QueryAIAPI({
        method: "GET",
        path: UrlJoin("ml", "highlight_composition", "q", objectId),
        objectId,
        queryParams: options,
        format: "none"
      });

      if(response.status === 204 && !regenerate) {
        return this.GenerateAIHighlights({...arguments[0], regenerate: true});
      }

      status = yield response.json();

      if(!wait) {
        return status;
      }

      if(status?.status === "ERROR") {
        throw status;
      }
    } while(status?.status !== "COMPLETE");

    return status;
  });

  // Search indexes
  GetSearchFields = flow(function * ({id}) {
    if(!id) { return; }

    try {
      const versionHash = yield this.client.LatestVersionHash({objectId: id});

      const indexerInfo = yield this.client.ContentObjectMetadata({
        versionHash,
        metadataSubtree: "indexer/config/indexer/arguments",
        select: [
          "fields",
          "document/prefix"
        ]
      });

      if(!indexerInfo) { return; }

      const indexerFields = indexerInfo.fields;
      const fuzzySearchFields = {};
      const excludedFields = ["music", "action", "segment", "title_type", "asset_type"];
      Object.keys(indexerFields || {})
        .filter(field => {
          const isTextType = indexerFields[field].type === "text";
          const isNotExcluded = !excludedFields.some(exclusion => field.includes(exclusion));
          return isTextType && isNotExcluded;
        })
        .forEach(field => {
          fuzzySearchFields[`f_${field}`] = {
            label: field,
            value: true
          };
        });

      // Fields for all tenants that are not configured in the meta
      ["movie_characters"].forEach(field => {
        fuzzySearchFields[`f_${field}`] = {
          label: field,
          value: true
        };
      });

      return {
        fields: fuzzySearchFields,
        type: indexerInfo.document?.prefix,
        versionHash
      };
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Unable to load search fields", error);
    }

    return {};
  });

  LoadSearchIndexes = flow(function * () {
    let searchIndexes = yield this.client.ContentObjectMetadata({
      versionHash: yield this.client.LatestVersionHash({objectId: this.rootStore.tenantInfoObjectId}),
      metadataSubtree: "public/search/indexes",
    });

    searchIndexes = (searchIndexes || [])
      .filter((x, i, a) => a.findIndex(other => x.id === other.id) === i);

    searchIndexes = (yield Promise.all(
      searchIndexes.map(async searchIndex => ({
        ...searchIndex,
        ...(await this.GetSearchFields(searchIndex)),
        canEdit: await this.client.CallContractMethod({
          contractAddress: this.client.utils.HashToAddress(searchIndex.id),
          methodName: "canEdit"
        })
      }))
    ))
      .filter(searchIndexes => !!searchIndexes.fields);

    this.searchIndexes = searchIndexes;

    let customSearchIndexIds = yield this.client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `custom-search-indexes${this.rootStore.localhost ? "-dev" : ""}`
    });

    if(customSearchIndexIds) {
      try {
        this.customSearchIndexIds = JSON.parse(customSearchIndexIds);

        yield Promise.all(
          this.customSearchIndexIds.map(async objectId =>
            await this.AddSearchIndex({objectId, add: false})
          )
        );
      } catch(error) {
        // eslint-disable-next-line no-console
        console.error("Error parsing custom search indexes");
      }
    }

    this.SetSelectedSearchIndex(this.searchIndexes[0]?.id);
  });

  SetSelectedSearchIndex(id) {
    this.selectedSearchIndexId = id;
  }

  AddSearchIndex = flow(function * ({objectId, add=true}) {
    const name = yield this.client.ContentObjectMetadata({
      libraryId: yield this.client.ContentObjectLibraryId({objectId}),
      objectId: objectId,
      metadataSubtree: "public/name"
    });

    this.searchIndexes.unshift({
      id: objectId,
      name,
      custom: true,
      ...(yield this.GetSearchFields({id: objectId})),
      canEdit: yield this.client.CallContractMethod({
        contractAddress: this.client.utils.HashToAddress(objectId),
        methodName: "canEdit"
      })
    });

    if(add) {
      this.customSearchIndexIds.push(objectId);

      yield this.client.walletClient.SetProfileMetadata({
        type: "app",
        appId: "video-editor",
        mode: "private",
        key: `custom-search-indexes${this.rootStore.localhost ? "-dev" : ""}`,
        value: Unproxy(this.customSearchIndexIds)
      });

      this.SetSelectedSearchIndex(objectId);
    }
  });

  RemoveSearchIndex = flow(function * ({objectId}) {
    this.searchIndexes = this.searchIndexes
      .filter(({id}) => id !== objectId);

    this.customSearchIndexIds = this.customSearchIndexIds
      .filter(id => id !== objectId);

    yield this.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `custom-search-indexes${this.rootStore.localhost ? "-dev" : ""}`,
      value: Unproxy(this.customSearchIndexIds)
    });

    if(this.selectedSearchIndexId === objectId) {
      this.selectedSearchIndexId = this.searchIndexes[0]?.id;
    }
  });

  /* Search */

  Search = flow(function * ({query, limit=10}) {
    let start = 0;

    if(
      typeof this.searchResults.pagination !== "undefined" &&
      this.searchResults.query === query &&
      this.searchResults.indexHash === this.searchIndex.versionHash
    ) {
      // Continuation of same query
      if((this.searchResults.pagination.start + this.searchResults.pagination.limit) >= this.searchResults.pagination.total) {
        // Exhausted results
        return this.searchResults;
      }

      // Set start + limit to fetch next batch
      start = this.searchResults.pagination.start + this.searchResults.pagination.limit;
    }

    const isAssetSearch = this.searchIndex.type.includes("assets");

    let {results, contents, pagination} = (yield this.QueryAIAPI({
      update: true,
      objectId: this.searchIndex.id,
      path: UrlJoin("search", "q", this.searchIndex.versionHash, "rep", "search"),
      queryParams: {
        terms: query,
        searchFields: Object.keys(this.searchIndex.fields).join(","),
        start,
        limit,
        display_fields: "all",
        clips: !isAssetSearch,
        clip_include_source_tags: true,
        debug: true,
        max_total: 100,
        select: "/public/asset_metadata/title,/public/name,public/asset_metadata/display_title"
      }
    })) || {};

    results = results || contents;

    const baseUrl = yield this.client.FabricUrl({versionHash: this.searchIndex.versionHash});

    this.searchResults = {
      query,
      indexHash: this.searchIndex.versionHash,
      pagination: pagination || {},
      results: [
        ...(this.searchResults.results || []),
        ...(results || []).map(result => {
          let imageUrl;
          if(result.image_url || result.prefix) {
            imageUrl = new URL(baseUrl);

            if(isAssetSearch) {
              imageUrl.pathname = UrlJoin("q", result.hash, "files", result.prefix);
            } else {
              imageUrl.pathname = result.image_url.split("?")[0];

              const params = new URLSearchParams(result.image_url.split("?")[1]);
              params.keys().forEach((key, value) => imageUrl.searchParams.set(key, value));
            }
          }

          return {
            libraryId: result.qlib_id,
            objectId: result.id,
            versionHash: result.hash,
            imageUrl: imageUrl?.toString(),
            startTime: (result.start_time || 0) / 1000,
            endTime: result.end_time ? result.end_time / 1000 : undefined,
            name: result.meta?.public?.asset_metadata?.title || result.meta?.public?.name,
            sources: result.sources,
            result
          };
        })
      ]
    };

    return this.searchResults;
  });

  /* Updates */

  AggregateUserTags = flow(function * ({objectId}) {
    this.searchIndexUpdateProgress = {};

    let progressInterval;
    try {
      this.tagAggregationProgress = 0;

      const libraryId = yield this.client.ContentObjectLibraryId({objectId: objectId});
      const {writeToken} = yield this.client.EditContentObject({libraryId, objectId});

      this.tagAggregationProgress = 15;

      progressInterval = setInterval(() =>
        runInAction(() =>
          this.tagAggregationProgress = Math.min(80, this.tagAggregationProgress + 10)
        ), 3000
      );

      yield this.QueryAIAPI({
        server: "ai",
        path: UrlJoin("/tagging", objectId, "aggregate"),
        queryParams: {
          write_token: writeToken
        },
        method: "POST",
        format: "none",
        objectId,
        update: true,
      });

      clearInterval(progressInterval);

      this.tagAggregationProgress = 90;

      yield this.client.FinalizeContentObject({libraryId, objectId, writeToken});
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Tag aggregation failed:");
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      clearInterval(progressInterval);
      this.tagAggregationProgress = 100;
    }
  });

  UpdateSearchIndex = flow(function * ({indexId, aggregate=false}) {
    try {
      const videoObjectId =
        this.rootStore.videoStore.videoObject?.objectId ||
        this.rootStore.compositionStore.primarySourceVideoStore?.videoObject?.objectId;

      if(videoObjectId && aggregate) {
        yield this.AggregateUserTags({objectId: videoObjectId});
      }

      this.searchIndexUpdateProgress[indexId] = 5;
      // Perform against a search node
      const searchURIs = (yield (
        yield fetch("https://main.net955305.contentfabric.io/config")
      ).json()).network.services.search_v2;

      yield this.client.SetNodes({fabricURIs: searchURIs});

      this.searchIndexUpdateProgress[indexId] = 12;

      const libraryId = yield this.client.ContentObjectLibraryId({objectId: indexId});
      const siteId = (yield this.client.ContentObjectMetadata({
        libraryId,
        objectId: indexId,
        metadataSubtree: "/indexer/config/fabric/root/content"
      })) || indexId;

      const siteLibraryId = yield this.client.ContentObjectLibraryId({objectId: siteId});

      const siteUpdateWriteToken = (yield this.client.EditContentObject({
        libraryId: siteLibraryId,
        objectId: siteId
      })).writeToken;

      yield this.QueryAIAPI({
        server: "ai",
        path: UrlJoin("/search", "q", siteUpdateWriteToken, "update_site"),
        method: "POST",
        format: "none",
        objectId: siteId,
        update: true,
      });

      this.searchIndexUpdateProgress[indexId] = 12;

      yield this.client.FinalizeContentObject({
        libraryId: siteLibraryId,
        objectId: siteId,
        writeToken: siteUpdateWriteToken,
        commitMessage: "EVIE - Update search index"
      });

      this.searchIndexUpdateProgress[indexId] = 20;
      yield new Promise(resolve => setTimeout(resolve, 2000));
      this.searchIndexUpdateProgress[indexId] = 25;

      const crawlWriteToken = (yield this.client.EditContentObject({libraryId, objectId: indexId})).writeToken;

      this.searchIndexUpdateProgress[indexId] = 30;

      yield this.QueryAIAPI({
        server: "ai",
        path: UrlJoin("/search", "q", crawlWriteToken, "crawl"),
        method: "POST",
        objectId: indexId,
        update: true
      });

      this.searchIndexUpdateProgress[indexId] = 35;

      let crawlStatus = {};
      do {
        yield new Promise(resolve => setTimeout(resolve, 5000));
        crawlStatus = yield this.QueryAIAPI({
          server: "ai",
          path: UrlJoin("/search", "q", crawlWriteToken, "crawl_status"),
          objectId: indexId,
          update: true
        });
      } while(crawlStatus.state !== "terminated");
      this.searchIndexUpdateProgress[indexId] = 40;

      yield this.client.FinalizeContentObject({
        libraryId,
        objectId: indexId,
        writeToken: crawlWriteToken,
        commitMessage: "EVIE - Recrawl search index"
      });

      this.searchIndexUpdateProgress[indexId] = 45;
      yield new Promise(resolve => setTimeout(resolve, 2000));
      this.searchIndexUpdateProgress[indexId] = 50;

      yield this.client.ResetRegion();

      let updateProgress = [0, 0];
      yield Promise.all(
        ["ai", "ai-02"].map(async (server, i) => {
          await this.QueryAIAPI({
            server,
            path: UrlJoin("/search", "q", indexId, "search_update"),
            method: "POST",
            objectId: indexId,
            update: true
          });

          let updateStatus;
          do {
            await new Promise(resolve => setTimeout(resolve, 5000));

            updateStatus = await this.QueryAIAPI({
              server,
              path: UrlJoin("/search", "q", indexId, "update_status"),
              objectId: indexId,
              update: true
            });

            updateProgress[i] = 25 * (updateStatus?.progress || 0);

            runInAction(() => this.searchIndexUpdateProgress[indexId] = 50 + updateProgress[0] + updateProgress[1]);
          } while(updateStatus?.status !== "finished");
        })
      );

      this.searchIndexUpdateProgress[indexId] = 100;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to update search index", indexId);
      // eslint-disable-next-line no-console
      console.error(error);
    }
  });
}

export default AIStore;
