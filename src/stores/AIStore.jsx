import {flow, makeAutoObservable, runInAction} from "mobx";
import UrlJoin from "url-join";

class AIStore {
  searchIndexes = [];
  selectedSearchIndexId;
  searchIndexUpdateStatus = {};

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

  LoadSearchIndexes = flow(function * () {
    let searchIndexes = ((yield this.client.ContentObjectMetadata({
      libraryId: this.rootStore.tenantContractId.replace(/^iten/, "ilib"),
      objectId: this.rootStore.tenantContractId.replace(/^iten/, "iq__"),
      metadataSubtree: "/public/search/indexes"
    })) || [])
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

    this.SetSelectedSearchIndex(this.searchIndexes[0]?.id);
  });

  SetSelectedSearchIndex(id) {
    this.selectedSearchIndexId = id;
  }

  GetSearchFields = flow(function * (searchIndex) {
    const indexId = searchIndex.id;

    if(!indexId) { return; }

    try {
      const versionHash = yield this.client.LatestVersionHash({objectId: indexId});

      const indexerFields = yield this.client.ContentObjectMetadata({
        versionHash,
        metadataSubtree: "indexer/config/indexer/arguments/fields"
      });

      if(!indexerFields) { return; }

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
        versionHash
      };
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Unable to load search fields", error);
    }

    return {};
  });

  AggregateUserTags = flow(function * ({objectId, writeToken}) {
    try {
      return yield this.QueryAIAPI({
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
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Tag aggregation failed:");
      // eslint-disable-next-line no-console
      console.error(error);
    }
  });

  UpdateSearchIndex = flow(function * (indexId) {
    try {
      this.searchIndexUpdateStatus[indexId] = 5;

      // Perform against a search node
      const searchURIs = (yield (
        yield fetch("https://main.net955305.contentfabric.io/config")
      ).json()).network.services.search_v2;

      yield this.client.SetNodes({fabricURIs: searchURIs});

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

      this.searchIndexUpdateStatus[indexId] = 12;

      yield this.client.FinalizeContentObject({
        libraryId: siteLibraryId,
        objectId: siteId,
        writeToken: siteUpdateWriteToken,
        commitMessage: "EVIE - Update search index"
      });

      this.searchIndexUpdateStatus[indexId] = 20;
      yield new Promise(resolve => setTimeout(resolve, 2000));
      this.searchIndexUpdateStatus[indexId] = 25;

      const crawlWriteToken = (yield this.client.EditContentObject({libraryId, objectId: indexId})).writeToken;

      this.searchIndexUpdateStatus[indexId] = 30;

      yield this.QueryAIAPI({
        server: "ai",
        path: UrlJoin("/search", "q", crawlWriteToken, "crawl"),
        method: "POST",
        objectId: indexId,
        update: true
      });

      this.searchIndexUpdateStatus[indexId] = 35;

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
      this.searchIndexUpdateStatus[indexId] = 40;

      yield this.client.FinalizeContentObject({
        libraryId,
        objectId: indexId,
        writeToken: crawlWriteToken,
        commitMessage: "EVIE - Recrawl search index"
      });

      this.searchIndexUpdateStatus[indexId] = 45;
      yield new Promise(resolve => setTimeout(resolve, 2000));
      this.searchIndexUpdateStatus[indexId] = 50;

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

            runInAction(() => this.searchIndexUpdateStatus[indexId] = 50 + updateProgress[0] + updateProgress[1]);
          } while(updateStatus?.status !== "finished");
        })
      );
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to update search index", indexId);
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      delete this.searchIndexUpdateStatus[indexId];
    }
  });
}

export default AIStore;
