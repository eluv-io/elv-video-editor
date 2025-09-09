import {flow, makeAutoObservable, runInAction} from "mobx";
import UrlJoin from "url-join";
import {Slugify, Unproxy} from "@/utils/Utils.js";
import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";

const GLOBAL_PROFILE_OBJECT_ID = "iq__3MVS3kjshtnAodRv4qLebBvH3oXb";

class AIStore {
  searchIndexes = [];
  customSearchIndexIds = [];
  selectedSearchIndexId;
  searchIndexUpdateProgress = {};
  tagAggregationProgress = 0;
  highlightProfiles;

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

  get highlightsAvailable() {
    return this.searchIndexes.length > 0 && Object.keys(this.highlightProfiles || {}).length > 0;
  }

  get highlightProfileInfo() {
    if(!this.highlightProfiles) {
      return {};
    }

    let profiles = {};
    Object.keys(this.highlightProfiles || {})
      .filter(key => !this.highlightProfiles[key].hidden)
      .forEach(key => {
        const type = this.highlightProfiles[key].type;
        if(!profiles[type]) {
          profiles[type] = {};
        }

        const subtype = this.highlightProfiles[key].subtype;
        if(!profiles[type][subtype]) {
          profiles[type][subtype] = [];
        }

        profiles[type][subtype]
          .push({
            ...this.highlightProfiles[key],
            key
          });

        profiles[type][subtype].sort((a, b) =>
          a?.name?.toLowerCase()?.includes("default") ?
            b?.name?.toLowerCase()?.includes("default") ? 0 : -1 :
            b?.name?.toLowerCase()?.includes("default") ? 1 : 0
        );
      });

    return profiles;
  }

  // Load search indexes and highlight profiles
  Initialize = flow(function * () {
    yield this.LoadSearchIndexes();
    yield this.LoadHighlightProfiles();
  });

  QueryAIAPI = flow(function * ({
    server="ai",
    method="GET",
    path,
    objectId,
    channelAuth=false,
    update=false,
    queryParams={},
    body,
    stringifyBody=true,
    headers={},
    format="json",
    allowStatus=[],
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

    if(body && stringifyBody) {
      body = JSON.stringify(body);
    }

    const response = yield fetch(
      url,
      {
        method,
        headers,
        body
      }
    );

    if(response.status >= 400 && !allowStatus.includes(response.status)) {
      throw response;
    }

    if(response.status === 204) {
      return;
    }

    return !format ? response :
      yield this.client.utils.ResponseToFormat(format, response);
  });

  GenerateImageSummary = flow(function * ({objectId, filePath, regenerate=false, cacheOnly=false}) {
    return yield this.rootStore.LoadResource({
      key: "imageSummary",
      id: `${objectId}-${filePath}`,
      bind: this,
      force: !cacheOnly || regenerate,
      Load: flow(function * () {
        return yield this.rootStore.aiStore.QueryAIAPI({
          server: "ai",
          method: "GET",
          path: UrlJoin("mlcache", "summary", "q", objectId, "rep", "image_summarize"),
          objectId,
          channelAuth: true,
          queryParams: {
            path: filePath,
            engine: "summary",
            regenerate,
            cache: cacheOnly ? "only" : undefined
          }
        });
      })
    });
  });

  GenerateClipSummary = flow(function * ({objectId, startTime, endTime, regenerate=false, cacheOnly=false}) {
    return yield this.rootStore.LoadResource({
      key: "clipSummary",
      id: `${objectId}-${startTime}-${endTime}`,
      bind: this,
      force: !cacheOnly || regenerate,
      Load: flow(function * () {
        return yield this.rootStore.aiStore.QueryAIAPI({
          server: "ai",
          method: "GET",
          path: UrlJoin("mlcache", "summary", "q", objectId, "rep", "summarize"),
          objectId,
          channelAuth: true,
          queryParams: {
            start_time: parseInt(startTime * 1000),
            end_time: parseInt(endTime * 1000),
            regenerate,
            cache: cacheOnly ? "only" : undefined
          }
        });
      })
    });
  });

  GenerateAIHighlights = flow(function * ({objectId, prompt, maxDuration, regenerate=false, wait=true, StatusCallback}) {
    if(!this.highlightsAvailable) { return; }

    try {
      // TODO: Specify profile

      let options = { iq: objectId };
      if(prompt) {
        options.customization = prompt;
      }

      if(maxDuration) {
        options.max_length = maxDuration * 1000;
      }

      let initialStatus;
      if(!regenerate) {
        initialStatus = yield this.QueryAIAPI({
          method: "POST",
          path: UrlJoin("ml", "highlight_composition", "request"),
          objectId,
          allowStatus: [409],
          body: {
            cache: "only",
            job_details: options
          }
        });
      }

      if(!initialStatus || regenerate) {
        initialStatus = yield this.QueryAIAPI({
          method: "POST",
          path: UrlJoin("ml", "highlight_composition", "request"),
          objectId,
          allowStatus: [409],
          body: {
            cache: "refresh",
            job_details: options
          }
        });

        yield new Promise(resolve => setTimeout(resolve, 1000));
      }

      if(initialStatus?.status === "COMPLETE") {
        return initialStatus;
      }

      const jobId = initialStatus.job_id;

      let status;
      do {
        if(status) {
          StatusCallback?.(status);
          yield new Promise(resolve => setTimeout(resolve, 5000));
        }

        const response = yield this.QueryAIAPI({
          method: "GET",
          path: UrlJoin("ml", "highlight_composition", "request", jobId),
          objectId,
          format: ""
        });

        if(!response) {
          this.highlightsAvailable = false;
          return;
        }

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
    } catch(error) {
      if(error?.status === "ERROR" && error?.display_error?.includes("not configured")) {
        this.highlightsAvailable = false;
      }

      throw error;
    }
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

      const fuzzySearchFields = {};
      const eventTracks = [];
      const excludedFields = ["music", "action", "segment", "title_type", "asset_type"];
      Object.keys(indexerInfo.fields || {})
        .filter(field => {
          const isTextType = indexerInfo.fields[field].type === "text";
          const isNotExcluded = !excludedFields.some(exclusion => field.includes(exclusion));
          return isTextType && isNotExcluded;
        })
        .forEach(field => {
          (indexerInfo.fields[field]?.paths || [])
            .forEach(path => {
              const fieldEvent = path.match(/metadata_tags.shot_tags.tags.text.([^.]*)/)?.[1];

              if(fieldEvent && !eventTracks.includes(fieldEvent)) {
                eventTracks.push(fieldEvent);
              }
            });

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
        eventTracks,
        type: indexerInfo.document?.prefix,
        versionHash
      };
    } catch(error) {
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
        console.error("Error parsing custom search indexes");
      }
    }

    const savedIndexId = localStorage.getItem(`search-index-${this.rootStore.tenantContractId}`);
    this.SetSelectedSearchIndex(
      savedIndexId && this.searchIndexes?.find(index => index.id === savedIndexId) ?
        savedIndexId :
        this.searchIndexes[0]?.id
    );
  });

  SetSelectedSearchIndex(id) {
    this.selectedSearchIndexId = id;
    localStorage.setItem(`search-index-${this.rootStore.tenantContractId}`, id);
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
    const resultsKey = `${this.searchIndex.versionHash}-${this.client.utils.B58(query)}`;

    if(this.searchResults.key === resultsKey) {
      // Continuation of same query
      if((this.searchResults.pagination.start + this.searchResults.pagination.limit) >= this.searchResults.pagination.total) {
        // Exhausted results
        return this.searchResults;
      }

      // Set start + limit to fetch next batch
      start = this.searchResults.pagination.start + this.searchResults.pagination.limit;
    } else {
      // New query - reset
      this.ClearSearchResults();
    }

    const type = this.searchIndex.type?.includes("assets") ? "image" : "video";

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
        clips: type === "video",
        clip_include_source_tags: true,
        debug: true,
        max_total: 100,
        select: "/public/asset_metadata/title,/public/name,public/asset_metadata/display_title"
      }
    })) || {};

    results = results || contents;

    const baseUrl = yield this.client.Rep({
      versionHash: this.searchIndex.versionHash,
      rep: "frame",
      channelAuth: true
    });

    this.searchResults = {
      key: resultsKey,
      query,
      indexHash: this.searchIndex.versionHash,
      pagination: pagination || {},
      type,
      results: [
        ...(this.searchResults.results || []),
        ...(results || []).map(result => {
          let imageUrl;
          if(result.image_url || result.prefix) {
            imageUrl = new URL(baseUrl);

            if(type === "image") {
              imageUrl.pathname = UrlJoin("q", result.hash, "files", result.prefix);
            } else {
              imageUrl.pathname = result.image_url.split("?")[0];

              const params = new URLSearchParams(result.image_url.split("?")[1]);
              params.keys().forEach((key, value) => imageUrl.searchParams.set(key, value));
            }
          }

          let startTime, endTime, subtitle;
          if(type === "video") {
            startTime = (result.start_time || 0) / 1000;
            endTime = result.end_time ? result.end_time / 1000 : undefined;

            if(startTime || endTime) {
              subtitle = FrameAccurateVideo.TimeToString({time: startTime, format: "smpte", includeFractionalSeconds: true});

              if(endTime) {
                subtitle += " - " + FrameAccurateVideo.TimeToString({time: endTime, format: "smpte", includeFractionalSeconds: true});
                subtitle = `${subtitle} (${FrameAccurateVideo.TimeToString({time: endTime - startTime})})`;
              }

              imageUrl.searchParams.set("t", startTime.toFixed(2));
            }
          }

          let score = result.score;
          // Score is provided as an array of scores
          if(!score) {
            score = Math.max(...(result?.sources?.map(source => source.score) || []));
          }

          return {
            libraryId: result.qlib_id,
            objectId: result.id,
            versionHash: result.hash,
            imageUrl: imageUrl?.toString(),
            filePath: type === "image" ? result.prefix : undefined,
            startTime,
            endTime,
            sources: result.sources,
            name: result.meta?.public?.asset_metadata?.title || result.meta?.public?.name,
            subtitle,
            score: score ? (score * 100).toFixed(1) : "",
            type,
            result
          };
        })
      ]
    };

    return this.searchResults;
  });

  ClearSearchResults() {
    this.searchResults = {};
  }

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
      console.error("Tag aggregation failed:");
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
      console.error("Failed to update search index", indexId);
      console.error(error);
    }
  });

  LoadHighlightProfiles = flow(function * () {
    let highlightProfiles = (yield this.client.ContentObjectMetadata({
      libraryId: yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId}),
      objectId: this.rootStore.tenantInfoObjectId,
      metadataSubtree: "public/profiles/highlight_composition",
    })) || {};

    if(this.rootStore.network === "main") {
      const defaults = yield this.client.ContentObjectMetadata({
        libraryId: yield this.client.ContentObjectLibraryId({objectId: GLOBAL_PROFILE_OBJECT_ID}),
        objectId: GLOBAL_PROFILE_OBJECT_ID,
        metadataSubtree: "public/profiles/highlight_composition"
      });

      Object.keys(defaults || {}).forEach(key =>
        // Ensure no index is set for default
        delete defaults[key].index
      );

      Object.keys(defaults || {}).forEach(key =>
        highlightProfiles[key] = {
          ...defaults[key],
          ...(highlightProfiles[key] || {}),
          isDefault: !highlightProfiles[key],
          hasDefault: true
        }
      );
    }

    Object.keys(highlightProfiles || {})
      .forEach(key =>
        highlightProfiles[key].key = key
      );

    this.highlightProfiles = highlightProfiles;
  });

  SaveHighlightProfile = flow(function * ({profile, originalProfileKey}) {
    let key = profile.key || originalProfileKey;
    if(!key.startsWith("user")) {
      // This is a new copy of an existing profile
      key = `user__${profile.type}__${profile.subtype}_${Slugify(profile.name)}`;
    }

    profile = Unproxy({...profile, key});

    profile.created_at = profile.created_at || new Date().toISOString();
    profile.updated_at = new Date().toISOString();
    profile.author = yield this.client.CurrentAccountAddress();

    delete profile.isDefault;
    delete profile.hasDefault;
    delete profile.key;

    const libraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
    const objectId = this.rootStore.tenantInfoObjectId;
    const {writeToken} = yield this.client.EditContentObject({
      libraryId,
      objectId,
    });

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: UrlJoin("/public", "profiles", "highlight_composition", key),
      metadata: profile
    });

    yield this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken,
      commitMessage: `EVIE - ${key !== originalProfileKey ? "Create" : "Update"} highlight profile ${key}`
    });

    yield this.LoadHighlightProfiles();

    return key;
  });

  DeleteHighlightProfile = flow(function * ({profileKey}) {
    const profile = this.highlightProfiles[profileKey];

    const libraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
    const objectId = this.rootStore.tenantInfoObjectId;
    const {writeToken} = yield this.client.EditContentObject({
      libraryId,
      objectId,
    });

    yield this.client.DeleteMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: UrlJoin("/public", "profiles", "highlight_composition", profileKey),
    });

    yield this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken,
      commitMessage: `EVIE - Remove highlight profile ${profileKey}`
    });

    yield this.LoadHighlightProfiles();

    return this.highlightProfileInfo[profile.type][profile.subtype][0]?.key;
  });
}

export default AIStore;
