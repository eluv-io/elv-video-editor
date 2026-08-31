import {flow, makeAutoObservable, runInAction} from "mobx";
import UrlJoin from "url-join";
import {FormatFieldName, HashString, ParseSearchQuery, Slugify, Unproxy} from "@/utils/Utils.js";
import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";

const GLOBAL_PROFILE_OBJECT_ID = "iq__3MVS3kjshtnAodRv4qLebBvH3oXb";

class AIStore {
  searchIndexesLoading = false;
  searchIndexes = [];
  searchCollectionIndexes = [];
  searchIndexTemplateInfo;
  searchIndexCustomFields = {};
  selectedSearchIndexId;
  selectedCollectionSearchIndexId;
  searchIndexUpdateProgress = {};
  tagAggregationProgress = 0;
  highlightProfiles;
  defaultHighlightProfileKey;
  mcpExchangeSentinelId;
  mcpAuthToken;

  DEFAULT_SEARCH_SETTINGS = {
    objectIds: [],
    clipDuration: 0,
    minConfidence: 0,
    fields: [],
    cache: true,
    key: 0
  };

  previousSearchQueries = {};

  searchSettings = this.DEFAULT_SEARCH_SETTINGS;

  searchResults = {};
  selectedSearchResults = [];
  activePromptSearchId;
  searchImageFrame;
  searchImageFrameUrl;

  _authTokens = {};
  verticalVideoProcessingStatus = {};
  indexCreateProgress = {};

  titleIndex;
  titles = [];

  constructor(rootStore) {
    makeAutoObservable(
      this,
      { searchImageFrame: false }
    );
    this.rootStore = rootStore;
  }

  get client() {
    return this.rootStore.client;
  }

  get searchIndex() {
    return this.searchIndexes.find(index => index.id === this.selectedSearchIndexId);
  }

  get selectedTitleSearchIndexId() {
    if(this.searchIndex?.title_index) {
      return this.selectedSearchIndexId;
    }

    return this.searchIndexes.find(index => index.title_index)?.id;
  }

  get titleSearchIndex() {
    return this.searchIndexes.find(index => index.id === this.selectedTitleSearchIndexId);
  }

  get collectionSearchIndex() {
    return this.searchIndexes.find(index => index.id === this.selectedCollectionSearchIndexId);
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

  get customSearchSettingsActive() {
    return (
      HashString(JSON.stringify({...this.searchSettings, key: 0})) !==
      HashString(JSON.stringify({...this.DEFAULT_SEARCH_SETTINGS, key: 0}))
    );
  }

  SetSearchSettings(options) {
    const searchIndexId = options.searchIndexId || this.selectedSearchIndexId;
    const searchCollectionIndexId = options.imageCollectionId || this.selectedCollectionSearchIndexId;

    delete options.key;
    delete options.searchIndexId;
    delete options.imageCollectionId;

    this.SetSelectedSearchIndex(searchIndexId);
    this.SetSelectedCollectionSearchIndex(searchCollectionIndexId);

    this.titles = [];
    this.searchSettings = {
      ...options,
      key: HashString(JSON.stringify(options))
    };
  }

  // Load search indexes and highlight profiles
  Initialize = flow(function * () {
    yield this.LoadSearchIndexes();
    yield this.LoadMCPExchangeSentinel();
    this.LoadHighlightProfiles();
    this.LoadSearchQueries();
    this.StartSearchIndexUpdateStatusWatcher();
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
    authTokenInBody=false,
    authTokenInHeader=false,
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
        this._authTokens[objectId].signed = yield this.rootStore.client.CreateAuthorizationToken({
          objectId,
          duration: 24 * 60 * 60 * 1000
        });
      }

      authToken = this._authTokens[objectId].signed;
    }

    if(authTokenInBody) {
      body.append ?
        body.append("authorization", authToken) :
        body.authorization = authToken;
    }

    if(authTokenInHeader) {
      headers.Authorization = authToken;
    } else {
      url.searchParams.set("authorization", authToken);
    }

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

  GenerateImageSummary = (function * ({objectId, filePath, regenerate=false, cacheOnly=false}) {
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

  DeleteImageSummary = flow(function * ({objectId, filePath}) {
    yield this.rootStore.aiStore.QueryAIAPI({
      server: "ai",
      method: "DELETE",
      path: UrlJoin("mlcache", "summary", "q", objectId, "rep", "image_summarize"),
      objectId,
      channelAuth: true,
      queryParams: {
        path: filePath,
        engine: "summary"
      }
    });

    this.rootStore.ClearResource({key: "imageSummary", id: `${objectId}-${filePath}`});
  });

  GenerateClipSummary = flow(function * ({objectId, startTime, endTime, regenerate=false, cacheOnly=false, prompt}) {
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
            cache: cacheOnly ? "only" : undefined,
            engine: "summary_v3",
            personal_prompt: prompt
          }
        });
      })
    });
  });

  DeleteClipSummary = flow(function * ({objectId, startTime, endTime}) {
    yield this.QueryAIAPI({
      server: "ai",
      method: "DELETE",
      path: UrlJoin("mlcache", "summary", "q", objectId, "rep", "summarize"),
      objectId,
      channelAuth: true,
      queryParams: {
        start_time: parseInt(startTime * 1000),
        end_time: parseInt(endTime * 1000),
        engine: "summary_v3"
      }
    });

    this.rootStore.ClearResource({key: "clipSummary", id: `${objectId}-${startTime}-${endTime}`});
  });

  GenerateAIHighlights = flow(function * ({
    objectId,
    prompt,
    maxDuration,
    profile,
    regenerate=false,
    wait=true,
    StatusCallback
  }) {
    if(!this.highlightsAvailable) { return; }

    let options = { iq: objectId };
    if(prompt) {
      options.customization = prompt;
    }

    if(maxDuration) {
      options.max_length = maxDuration * 1000;
    }

    if(profile) {
      options.profile = Unproxy(profile);
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

      if(!indexerInfo) {
        // V2 - Get info from API
        let info = yield this.QueryAIAPI({
          server: "ai-04",
          path: UrlJoin("vector_search", "indexes", id),
          method: "GET",
          objectId: this.rootStore.tenantInfoObjectId,
          authTokenInHeader: true
        });

        let fields = {};
        info?.fields?.map(field =>
          fields[field.name] = {
            ...field,
            value: true
          }
        );

        return {
          fields,
          eventTracks: [],
          type: "index",
          musicSupported: true,
          versionHash,
          indexedTitles: (info?.qids || [])
            .map(objectId => ({objectId, name: objectId}))
        };
      }

      const indexedLinks = (yield this.client.ContentObjectMetadata({
        versionHash,
        metadataSubtree: "site_map/searchables"
      })) || {};

      const indexedTitleIds = Object.values(indexedLinks)
        .map(link => link["/"].split("/")[2])
        .filter(h => h)
        .map(versionHash => this.client.utils.DecodeVersionHash(versionHash).objectId);

      const indexedTitles = indexedTitleIds.map(objectId => ({objectId, name: objectId}));


      let musicSupported = false;
      const fuzzySearchFields = {};
      const eventTracks = [];
      const excludedFields = ["music", "action", "segment", "title_type", "asset_type"];
      Object.keys(indexerInfo.fields || {})
        .filter(field => {
          if(field === "music") {
            musicSupported = true;
          }

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
        musicSupported,
        versionHash,
        indexedTitles
      };
    } catch(error) {
      console.error("Unable to load search fields", id, error);
    }

    return {};
  });

  LoadSearchIndexes = flow(function * () {
    this.searchIndexesLoading = true;
    try {
      const metadata = (yield this.client.ContentObjectMetadata({
        versionHash: yield this.client.LatestVersionHash({objectId: this.rootStore.tenantInfoObjectId}),
        metadataSubtree: "public/search",
        select: [
          "indexes",
          "indexes_vectorstore",
          "image_collections"
        ]
      })) || {};

      this.searchCollectionIndexes = (metadata?.image_collections || []);
      this.selectedCollectionSearchIndexId = this.searchCollectionIndexes[0]?.id;

      let searchIndexes = [
        ...((metadata.indexes_vectorstore || []).map(index => ({...index, isV2: true}))),
        ...(metadata.indexes || [])
      ]
        .filter((x, i, a) => a.findIndex(other => x.id === other.id) === i);

      searchIndexes = (yield Promise.all(
        searchIndexes.map(async searchIndex => {
          try {
            return ({
              ...searchIndex,
              ...(await this.GetSearchFields(searchIndex)),
              canEdit: await this.client.CallContractMethod({
                contractAddress: this.client.utils.HashToAddress(searchIndex.id),
                methodName: "canEdit"
              })
            });
          } catch(error) {
            console.error(`Failed to load search index ${searchIndex.name} (${searchIndex.id})`);
            console.error(error);
          }
        })
      ))
        .filter(searchIndex => searchIndex && !!searchIndex.fields);

      this.searchIndexes = searchIndexes;

      const savedIndexId = localStorage.getItem(`search-index-${this.rootStore.tenantContractId}`);
      this.SetSelectedSearchIndex(
        savedIndexId && this.searchIndexes?.find(index => index.id === savedIndexId) ?
          savedIndexId :
          this.searchIndexes[0]?.id
      );

      const savedCollectionIndexId = localStorage.getItem(`search-collection-index-${this.rootStore.tenantContractId}`);
      this.SetSelectedCollectionSearchIndex(
        savedCollectionIndexId && this.searchCollectionIndexes?.find(index => index.id === savedCollectionIndexId) ?
          savedCollectionIndexId :
          this.searchCollectionIndexes[0]?.id
      );

      this.rootStore.compositionStore.selectedSearchIndexId = this.selectedSearchIndexId;
    } catch(error) {
      console.error("Error loading search indexes:");
      console.error(error);
    } finally {
      this.searchIndexesLoading = false;
    }
  });

  SetSelectedSearchIndex(id) {
    this.searchSettings = this.DEFAULT_SEARCH_SETTINGS;
    this.searchResults = {};
    this.selectedSearchIndexId = id;
    localStorage.setItem(`search-index-${this.rootStore.tenantContractId}`, id);
  }

  SetSelectedCollectionSearchIndex(id) {
    this.searchSettings = this.DEFAULT_SEARCH_SETTINGS;
    this.searchResults = {};
    this.selectedCollectionSearchIndexId = id;
    localStorage.setItem(`search-collection-index-${this.rootStore.tenantContractId}`, id);
  }

  AddSearchIndex = flow(function * ({objectId, isV2}) {
    const libraryId = yield this.client.ContentObjectLibraryId({objectId});
    isV2 = isV2 || !!(yield this.client.ContentObjectMetadata({libraryId, objectId, metadataSubtree: "indexer"}));
    const metadataKey = isV2 ? "indexes_vectorstore" : "indexes";

    const {name, description} = yield this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "public",
      select: ["name", "description"]
    });

    // Update index list in config object
    let existingIndexes = (yield this.client.ContentObjectMetadata({
      versionHash: yield this.client.LatestVersionHash({objectId: this.rootStore.tenantInfoObjectId}),
      metadataSubtree: UrlJoin("public/search", metadataKey)
    })) || [];

    // Remove existing record if present
    existingIndexes = existingIndexes.filter(index => index.id !== objectId);

    existingIndexes.push({
      name: name || objectId,
      description: description || "",
      id: objectId,
      type: "vector",
      version: 1,
      isV2
    });

    yield this.client.EditAndFinalizeContentObject({
      libraryId: yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId}),
      objectId: this.rootStore.tenantInfoObjectId,
      commitMessage: `EVIE - Add search index ${name} (${objectId})`,
      callback: async ({writeToken}) => {
        await this.client.ReplaceMetadata({
          libraryId: await this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId}),
          objectId: this.rootStore.tenantInfoObjectId,
          writeToken,
          metadataSubtree: UrlJoin("public/search", metadataKey),
          metadata: Unproxy(existingIndexes)
        });
      }
    });

    // Reload search indexes
    yield new Promise(resolve => setTimeout(resolve, 2000));
    yield this.LoadSearchIndexes();
  });

  RemoveSearchIndex = flow(function * ({objectId}) {
    const index = this.searchIndexes.find(index => index.id === objectId);

    if(!index) { return; }

    const libraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
    const indexes = (yield this.client.ContentObjectMetadata({
      libraryId,
      objectId: this.rootStore.tenantInfoObjectId,
      metadataSubtree: UrlJoin("public/search", index.isV2 ? "indexes_vectorstore" : "indexes")
    })) || [];

    if(indexes.find(index => index.id === objectId)) {
      // This search index is included in the config object, remove it

      const name = yield this.client.ContentObjectMetadata({
        libraryId: yield this.client.ContentObjectLibraryId({objectId}),
        objectId,
        metadataSubtree: "/public/name"
      });

      yield this.client.EditAndFinalizeContentObject({
        libraryId,
        objectId: this.rootStore.tenantInfoObjectId,
        commitMessage: `EVIE - Remove search index ${name} (${objectId})`,
        callback: async ({writeToken}) => {
          await this.client.ReplaceMetadata({
            libraryId,
            objectId: this.rootStore.tenantInfoObjectId,
            writeToken,
            metadataSubtree: UrlJoin("public/search", index.isV2 ? "indexes_vectorstore" : "indexes"),
            metadata: Unproxy(
              indexes.filter(index => index.id !== objectId)
            )
          });
        }
      });
    }

    // Reload search indexes
    yield new Promise(resolve => setTimeout(resolve, 2000));
    yield this.LoadSearchIndexes();


    /*
    this.searchIndexes = this.searchIndexes
      .filter(({id}) => id !== objectId);



    if(this.selectedSearchIndexId === objectId) {
      this.SetSelectedSearchIndex(this.searchIndexes[0]?.id);
    }

    if(this.rootStore.compositionStore.selectedSearchIndexId === objectId) {
      this.rootStore.compositionStore.SetSelectedSearchIndex(this.searchIndexes[0]?.id);
    }

     */
  });

  /* Search */

  SetSearchImageFrame(imageBlob) {
    this.searchImageFrame = imageBlob;
    this.searchImageFrameUrl = imageBlob ? URL.createObjectURL(imageBlob) : undefined;
  }

  Search = flow(function * ({query="", limit=10, initial}) {
    return yield this.rootStore.LoadResource({
      key: "search",
      id: `${query}-${limit}-${initial}`,
      ttl: 5,
      bind: this,
      Load: flow(function * () {
        let start = 0;

        const parsedQuery = ParseSearchQuery({query});

        const mode = parsedQuery.mode;
        query = parsedQuery.query;

        if(initial) {
          this.SaveSearchQuery({mode, query});
        }

        const resultsKey = `${this.searchSettings.key}-${query}-${mode}-${this.searchImageFrameUrl || ""}`;

        if(this.searchResults.key === resultsKey) {
          if(initial) {
            while(this.searchResults.loading) {
              yield new Promise(resolve => setTimeout(resolve, 250));
            }

            return this.searchResults;
          }

          // Continuation of same query
          if(
            (this.searchResults.pagination.start + this.searchResults.pagination.limit) >= this.searchResults.pagination.total
          ) {
            // Exhausted results
            return this.searchResults;
          }

          // Set start + limit to fetch next batch
          start = this.searchResults.pagination.start + this.searchResults.pagination.limit;
        } else {
          // New query - reset
          this.ClearSearchResults();
        }

        this.searchResults.key = resultsKey;
        this.searchResults.loading = true;

        try {
          const {results, pagination, ...extra} =
            mode === "prompt" ?
              yield this.PromptSearch({prompt: query}) :
              mode.startsWith("frame") ?
                yield this.CollectionSearch({mode, query, start, limit}) :
                yield this.ClipSearch({mode, query, start, limit});

          if(this.searchResults.key !== resultsKey) {
            // A different search has been performed while this query was made, throw away the result
            return;
          }

          const type = this.searchIndex.type?.includes("assets") ? "image" : "video";
          this.searchResults = {
            ...extra,
            key: resultsKey,
            query: mode ? `${mode}:${query}` : query,
            indexHash: this.searchIndex.versionHash,
            pagination: pagination || {},
            mode,
            type,
            loading: false,
            results: [
              ...(this.searchResults.results || []),
              ...results
            ]
          };
        } catch(error) {
          this.searchResults.loading = false;
          this.searchResults.error = error;
          throw error;
        }

        return this.searchResults;
      })
    });
  });

  GetTitles = flow(function * ({limit=10}) {
    if(this.titleIndex !== this.selectedTitleSearchIndexId) {
      this.titles = [];
    }

    this.titleIndex = this.selectedTitleSearchIndexId;
    const start = this.titles.length;
    const baseTitleImageUrl = yield this.client.FabricUrl({});

    this.titles = [
      ...this.titles,
      ...(yield Promise.all(
        this.titleSearchIndex.indexedTitles
          .sort((a, b) =>
            a.name === b.name ?
              (a.objectId < b.objectId ? -1 : 1) :
              a.name < b.name ? -1 : 1
          )
          .slice(start, start + limit)
          .map(async ({objectId}) => {
            const libraryId = await this.client.ContentObjectLibraryId({objectId});
            const imageUrl = new URL(baseTitleImageUrl);
            imageUrl.pathname = UrlJoin("qlibs", libraryId, "q", objectId, "meta/public/asset_metadata/images/poster_vertical/default");

            return {
              libraryId,
              objectId: objectId,
              imageUrl: imageUrl.toString(),
              name: await this.rootStore.GetObjectName({objectId})
            };
          })
      ))
    ]
      .sort((a, b) =>
        a.name === b.name ?
          (a.objectId < b.objectId ? -1 : 1) :
          a.name < b.name ? -1 : 1
      );
  });

  IsTitle({objectId}) {
    return !!this.searchIndexes
      .filter(index => index.title_index)
      .find(index => index.indexedTitles.find(title => title.objectId === objectId));
  }

  PerformClipSearch = flow(function * ({mode, searchIndex, searchSettings, query, start, limit}) {
    const type = searchIndex.type?.includes("assets") ? "image" : "video";

    return (yield this.QueryAIAPI({
      //update: true,
      server: searchIndex.isV2 ? "ai-04" : undefined,
      objectId: searchIndex.id,
      path:
        searchIndex.isV2 ?
          UrlJoin("vector_search", searchIndex.id, "clip_search") :
          UrlJoin(searchSettings.cache ? "mlcache" : "", "search", "q", searchIndex.versionHash, "rep", "search"),
      queryParams: {
        terms: query,
        search_fields:
          mode === "music" ? "f_music" :
            searchSettings.fields.length > 0 ?
              searchSettings.fields.join(",") :
              Object.keys(searchIndex.fields).join(","),
        sort: mode === "music" ? "f_music" : null,
        start,
        limit,
        display_fields:
          mode === "music" ? "f_music" : "all",
        clips: type === "video",
        clip_include_source_tags: true,
        get_chunks: true,
        max_total: 100,
        min_score: searchSettings.minConfidence / 100,
        filters: searchSettings.objectIds.map(objectId => `(id:${objectId})`).join("OR"),
        debug: !!searchIndex.isV2
      }
    })) || {};
  });

  ClipSearch = flow(function * ({mode, query, start, limit}) {
    let {contents, pagination} = yield this.PerformClipSearch({
      mode,
      searchIndex: this.searchIndex,
      searchSettings: this.searchSettings,
      query,
      start,
      limit
    });

    const baseUrl = yield this.client.Rep({
      versionHash: this.searchIndex.versionHash,
      rep: "frame",
      channelAuth: true,
      queryParams: {
        ignore_trimming: true
      }
    });

    contents = yield Promise.all(
      contents.map(async result => ({
        ...result,
        libraryId: result.qlib_id || await this.client.ContentObjectLibraryId({objectId: result.id})
      }))
    );

    const baseTitleImageUrl = yield this.client.FabricUrl({});
    const type = this.searchIndex.type?.includes("assets") ? "image" : "video";
    return {
      pagination,
      results: (contents || []).map(result => {
        let imageUrl, titleImageUrl;
        if(result.image_url || result.prefix) {
          imageUrl = new URL(baseUrl);

          if(type === "image") {
            imageUrl.pathname = UrlJoin("q", result.hash, "files", result.prefix);
          } else {
            imageUrl.pathname = result.image_url.split("?")[0];

            const params = new URLSearchParams(result.image_url.split("?")[1]);
            params.keys().forEach(key => imageUrl.searchParams.set(key, params.get(key)));
          }
        }

        let startTime, endTime, subtitle, chunkStartTime;
        if(type === "video") {
          startTime = (result.start_time || 0) / 1000;
          endTime = result.end_time ? result.end_time / 1000 : undefined;

          chunkStartTime = result.sources?.[0]?.chunks?.[0]?.start_time;

          if(startTime || endTime) {
            subtitle = FrameAccurateVideo.TimeToString({
              time: startTime,
              format: "smpte",
              includeFractionalSeconds: true
            });

            if(endTime) {
              subtitle += " - " + FrameAccurateVideo.TimeToString({
                time: endTime,
                format: "smpte",
                includeFractionalSeconds: true
              });
              subtitle = `${subtitle} (${FrameAccurateVideo.TimeToString({time: endTime - startTime})})`;
            }

            if(!imageUrl.searchParams.has("t")) {
              imageUrl.searchParams.set("t", startTime.toFixed(2));
            }
          }

          if(chunkStartTime && !imageUrl.searchParams.has("t")) {
            imageUrl.searchParams.set("t", (chunkStartTime / 1000).toFixed(2));
          }
        }

        titleImageUrl = new URL(baseTitleImageUrl);
        titleImageUrl.pathname = UrlJoin("qlibs", result.libraryId, "q", result.id, "meta/public/asset_metadata/images/poster_vertical/default");

        let score = result.score;
        // Score is provided as an array of scores
        if(!score) {
          score = Math.max(...(result?.sources?.map(source => source.score) || []));
        }

        return {
          libraryId: result.libraryId,
          objectId: result.id,
          versionHash: result.hash,
          imageUrl: imageUrl?.toString(),
          titleImageUrl: titleImageUrl?.toString(),
          filePath: type === "image" ? result.prefix : undefined,
          startTime,
          endTime,
          firstChunkStartTime: chunkStartTime,
          sources: result.sources,
          name: (
            result.name ||
            result.sources?.[0]?.fields?.f_zz_ui_name_1?.[0] ||
            result.sources?.[0]?.fields?.f_zz_ui_name_2?.[0] ||
              result.sources?.[0]?.fields?.f_display_title?.[0]
          ),
          subtitle,
          score: score ? (score * 100).toFixed(1) : "",
          type,
          result
        };
      })
    };
  });

  CollectionSearch = flow(function * ({mode, query, start, limit}) {
    let response;
    if(mode === "frame-image") {
      const body = new FormData();
      body.append("file", this.searchImageFrame, "dummy.jpg");

      response = (yield this.QueryAIAPI({
        method: "POST",
        objectId: this.searchIndex.id,
        path: UrlJoin("search-ng", "collections", this.selectedCollectionSearchIndexId, "search", "image"),
        queryParams: { start, limit },
        body,
        authTokenInBody: true,
        stringifyBody: false,
      })) || {};
    } else {
      response = (yield this.QueryAIAPI({
        method: "POST",
        objectId: this.searchIndex.id,
        path: UrlJoin("search-ng", "collections", this.selectedCollectionSearchIndexId, "search", "text"),
        queryParams: {
          start,
          limit
        },
        body: {query},
        authTokenInHeader: true,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
      })) || {};
    }

    let {meta, results} = response;

    const baseUrl = yield this.client.Rep({
      versionHash: this.searchIndex.versionHash,
      rep: "frame",
      channelAuth: true,
      queryParams: {
        ignore_trimming: true
      }
    });

    // TODO: Remove when server side filtering implemented
    results = results.filter(result =>
      (
        this.searchSettings.objectIds.length === 0 ||
        this.searchSettings.objectIds.includes(result.qid)
      ) &&
      (result.similarity || 0) * 100 > this.searchSettings.minConfidence
    );

    results = yield Promise.all(
      results.map(async result => {
        const objectId = result.qid;
        const libraryId = await this.client.ContentObjectLibraryId({objectId});
        const objectName = await this.rootStore.GetObjectName({objectId: result.qid});
        const versionHash = await this.client.LatestVersionHash({objectId});

        const frameRate = FrameAccurateVideo.ParseRat(result?.match_info?.fps || "24000/1001");
        const time = (result?.match_info?.frame_idx || 0) / frameRate;
        const imageUrl = new URL(baseUrl);
        imageUrl.searchParams.set("t", time);
        imageUrl.searchParams.set("exact", "true");
        imageUrl.pathname = UrlJoin("/q", versionHash, "rep", "frame_extract", result?.match_info?.offering || "default", "video");

        return {
          libraryId,
          objectId,
          imageUrl: imageUrl?.toString(),
          frame: result?.match_info?.frame_idx || 0,
          startTime: time,
          endTime: time,
          firstChunkStartTime: time,
          name: objectName,
          score: result.similarity ? (result.similarity * 100).toFixed(1) : "",
          type: "frame",
          result
        };
      })
    );

    return {
      pagination: meta,
      results
    };
  });

  PromptSearch = flow(function * ({prompt}) {
    const baseUrl = "https://ai-03.contentfabric.io/";
    const exchangeBaseUrl = "https://ai.contentfabric.io/";

    if(!this.mcpAuthToken) {
      const channelToken = new URL(yield this.client.FabricUrl({
        versionHash: yield this.client.LatestVersionHash({objectId: this.mcpExchangeSentinelId}),
        channelAuth: true
      })).searchParams.get("authorization");

      const tenantId = yield this.client.ContentObjectTenantId({objectId: this.mcpExchangeSentinelId});

      this.mcpAuthToken = (yield (
        yield fetch(
          UrlJoin(exchangeBaseUrl, "ml", "token_exchange", tenantId, "agent"),
          {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "Authorization": `Bearer ${channelToken}`
            },
          }
        )
      ).json()).token;
    }

    const response = yield (
      yield fetch(
        UrlJoin(baseUrl, "api", "agents", "chat"),
        {
          method: "POST",
          body: JSON.stringify({
            text: prompt,
            sender: "User",
            clientTimestamp: new Date().toISOString(),
            isCreatedByUser: true,
            parentMessageId: "00000000-0000-0000-0000-000000000000",
            messageId: this.rootStore.NextId(true),
            endpoint: "agents",
            agent_id: "agent_7Qv13l7K_6HqJ1C46dbYr",
            isTemporary: true
          }),
          headers: {
            "Authorization": `Bearer ${this.mcpAuthToken}`,
            "Accept": "application/json",
            "Content-Type": "application/json"
          }
        }
      )
    ).json();

    this.activePromptSearchId = response.streamId;

    const streamResponse = yield fetch(
      UrlJoin(baseUrl, "api", "agents", "chat", "stream", response.streamId),
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.mcpAuthToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        }
      }
    );

    if(!streamResponse.ok) {
      throw Error(streamResponse);
    }

    const reader = streamResponse.body.getReader();

    this.PromptSearchStreamHandler({reader, streamId: response.streamId})
      .then(fullText => {
        console.info("Full response from prompt:");
        console.info(fullText);

        setTimeout(() => {
          runInAction(() => {
            if(this.activePromptSearchId === response.streamId) {
              this.activePromptSearchId = undefined;

              if(
                this.searchResults.results.length === 0 ||
                fullText?.toLowerCase?.()?.includes("could you please clarify")
              ) {
                this.searchResults.clarify = true;
              }
            }
          });
        }, 1000);
      });

    return {
      prompt,
      pagination: {
        start: 0,
        total: 0,
        limit: 1,
        count: 0
      },
      results: []
    };
  });

  PromptSearchStreamHandler = flow(function * ({reader, streamId}) {
    const decoder = new TextDecoder();

    let lastUpdateLineCount = 0;

    let fullText = "";
    do {
      if(this.activePromptSearchId !== streamId) {
        console.warn("Another prompt search has been started - aborting");
        return;
      }

      const { done, value } = yield reader.read();

      if(done) {
        this.UpdatePromptSearchResults({message: fullText});
        return fullText;
      }

      const chunk = decoder.decode(value, { stream: true });

      // SSE chunks usually look like "data: {...}\n\n"
      const lines = chunk
        .split("\n")
        .filter(line => line.startsWith("data:"));

      for(const line of lines) {
        const jsonStr = line.replace("data: ", "").trim();

        // Final message often just says [DONE]
        if(jsonStr === "[DONE]") {
          this.UpdatePromptSearchResults({message: fullText});
          return fullText;
        }

        try {
          const payload = JSON.parse(jsonStr);

          if(payload.event !== "on_message_delta") {
            continue;
          }

          payload.data?.delta?.content
            ?.forEach(({type, text}) =>
              fullText += type === "text" ? text : ""
            );

          const lineCount = fullText.split("\n").slice(0, -1).length;

          if(lineCount > lastUpdateLineCount) {
            lastUpdateLineCount = lineCount;
            this.UpdatePromptSearchResults({message: fullText + "\n"});
          }
        } catch (e) {
          console.warn("malformed sse: " + jsonStr);
        }
      }
    } while(true);
  });

  UpdatePromptSearchResults = flow(function * ({message}) {
    /*
    if(!this.promptClient) {
      this.promptClient = new OpenAI({
        apiKey: EluvioConfiguration["open-ai-key"],
        baseURL: "https://ai-03.contentfabric.io/api/agents/v1",
        dangerouslyAllowBrowser: true
      });
    }

    const completion = yield this.promptClient.chat.completions.create({
      model: "agent_7Qv13l7K_6HqJ1C46dbYr",   // this is hardcoded for now to Eluvio Agent Andrea
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
    });

    if(!message) { return; }


     */
    const baseUrl = yield this.client.Rep({
      versionHash: this.searchIndex.versionHash,
      rep: "frame",
      channelAuth: true,
      queryParams: {
        ignore_trimming: true
      }
    });

    const ParseNumber = str => parseFloat(str.replace(/[^\d.-]/g, ""));

    let clips = yield Promise.all(
      message.split("\n")
        .filter(line => line.includes("CLIP:"))
        .map(async line => {
          try {
            const segments = line.split("CLIP:")[1].split(",");
            const objectId = segments[0].trim().match(/(iq__\w+)/)[0];
            const libraryId = await this.rootStore.LibraryId({objectId});
            const versionHash = await this.rootStore.VersionHash({objectId});

            const imageTime = ParseNumber(segments[3]);
            const imageUrl = new URL(baseUrl);
            imageUrl.searchParams.set("t", imageTime.toString());
            // TODO: This assumes default offering
            imageUrl.pathname = UrlJoin("/q", versionHash, "rep", "frame_extract", "default", "video");

            return {
              libraryId,
              objectId,
              versionHash,
              startTime: ParseNumber(segments[1]),
              endTime: ParseNumber(segments[2]),
              imageUrl: imageUrl.toString(),
              imageTime,
              name: segments.slice(4).join(",").trim(),
              type: "video"
            };
          } catch(error) {
            console.error("Error parsing clip result:");
            console.error(error);
          }
        })
        .filter(result => result)
    );

    let images = yield Promise.all(
      message.split("\n")
        .filter(segment => segment.includes("IMAGE:"))
        .map(async line => {
          try {
            const segments = line.split("IMAGE:")[1].split(",");
            const imageTime = ParseNumber(segments[1]);
            const objectId = segments[0].trim().match(/(iq__\w+)/)[0];
            const libraryId = await this.rootStore.LibraryId({objectId});
            const versionHash = await this.rootStore.VersionHash({objectId});

            const imageUrl = new URL(baseUrl);
            imageUrl.searchParams.set("t", imageTime.toString());
            imageUrl.searchParams.set("exact", "true");
            // TODO: This assumes default
            imageUrl.pathname = UrlJoin("/q", versionHash, "rep", "frame", "default", "video");

            return {
              libraryId,
              objectId,
              versionHash,
              name: segments.slice(2).join(",").trim(),
              imageUrl: imageUrl.toString(),
              imageTime,
              type: "frame"
            };
          } catch(error) {
            console.error("Error parsing image result:");
            console.error(error);
          }
        })
        .filter(result => result)
    );

    this.searchResults.pagination = {
      start: 0,
      limit: clips.length + images.length,
      total: clips.length + images.length,
      count: clips.length + images.length
    };

    this.searchResults.results = [
      ...clips,
      ...images
    ];

    this.searchResults.currentResponse = message;
  });

  ClearSearchResults() {
    this.searchResults = {};
  }

  ToggleSelectedSearchResult(index) {
    index = parseInt(index);
    if(this.selectedSearchResults.includes(index)) {
      this.selectedSearchResults = this.selectedSearchResults.filter(i => i !== index);
    } else {
      this.selectedSearchResults = [...this.selectedSearchResults, index];
    }
  }

  /* Updates */

  async StartSearchIndexUpdateStatusWatcher(period=10000) {
    clearInterval(window.searchIndexStatusWatcherInterval);

    let hasActiveJobs = true;
    const UpdateStatus = async () => {
      let progress = {};
      try {
        // V1 indexes
        let {jobs} = await this.QueryAIAPI({
          server: "ai",
          path: UrlJoin("/qmanager", "jobs"),
          method: "GET",
          objectId: this.rootStore.tenantInfoObjectId
        });

        jobs = jobs.filter(job =>
          !["succeeded", "failed", "cancelled"].includes(job?.status) &&
          !job?.stop_requested
        );

        for(const job of jobs) {
          progress[job.qid] = (100 * (job.status_details?.progress || 0)) || 1;
        }
      } catch(error) {
        console.error("Failed to get search index update status:");
        console.error(error);
      }

      const v2Indexes = this.searchIndexes.filter(index => index.isV2);
      await Promise.all(
        v2Indexes.map(async index => {
          try {
            let status = await this.QueryAIAPI({
              server: "ai-04",
              path: UrlJoin("elv-indexer", "indexes", index.id, "status"),
              method: "GET",
              objectId: this.rootStore.tenantInfoObjectId,
              authTokenInHeader: true
            });

            if(status?.progress > 0 && status?.progress < 0.99) {
              progress[index.id] = (100 * (status?.progress || 0)) || 1;
            }
          } catch(error) {
            console.error("Failed to get v2 search index update status:");
            console.error(error);
          }
        })
      );

      runInAction(() => this.searchIndexUpdateProgress = progress);
      if(Object.keys(progress).length === 0 && period < 60000) {
        if(!hasActiveJobs) {
          // No active jobs for the last two rounds - restart with slower interval
          return this.StartSearchIndexUpdateStatusWatcher(60000);
        }

        hasActiveJobs = false;
      } else {
        hasActiveJobs = true;
      }
    };

    await UpdateStatus();

    window.searchIndexStatusWatcherInterval = setInterval(UpdateStatus, period);
  }

  BuildSearchIndex = flow(function * ({indexId}) {
    const searchIndex = this.searchIndexes.find(index => index.id === indexId);

    if(searchIndex?.isV2) {
      console.warn(`BuildSearchIndex called on V2 index ${searchIndex.name} ${searchIndex.id} - skipping`);
      return;
    }

    yield this.QueryAIAPI({
      server: "ai",
      path: UrlJoin("/qmanager", "q", indexId, "jobs"),
      method: "POST",
      objectId: indexId,
      body: {
        type: "index_update"
      },
      update: true
    });

    this.StartSearchIndexUpdateStatusWatcher();
  });

  CancelSearchIndexBuild = flow(function * ({indexId}) {
    let {jobs} = yield this.QueryAIAPI({
      server: "ai",
      path: UrlJoin("/qmanager", "jobs"),
      method: "GET",
      objectId: this.rootStore.tenantInfoObjectId
    });

    jobs = jobs.filter(job =>
      job.qid === indexId &&
      !["succeeded", "failed", "cancelled"].includes(job?.status) &&
      !job?.stop_requested
    );

    yield Promise.all(
      jobs.map(async job =>
        await this.QueryAIAPI({
          server: "ai",
          path: UrlJoin("/qmanager", "jobs", job.id, "stop"),
          method: "POST",
          objectId: this.rootStore.tenantInfoObjectId
        })
      )
    );

    yield new Promise(resolve => setTimeout(resolve, 1000));

    yield this.StartSearchIndexUpdateStatusWatcher();
  });

  CreateSearchIndex = flow(function * ({
    name="Search Index",
    description="",
    contentIds=[],
    selectedFields=[],
    selectedCustomFields=[],
    configuration
  }) {
    yield this.LoadSearchIndexTemplateInfo();

    let libraryId;
    if(this.rootStore.tenantContractId.includes(this.rootStore.tenantInfoObjectId.slice(4))) {
      // No tenant info object, using tenant object. Must find a library;
      const libraryIds = yield this.client.ContentLibraries();
      for(const id of libraryIds) {
        const name = (yield this.client.ContentObjectMetadata({
          versionHash: yield this.client.LatestVersionHash({objectId: `iq__${id.slice(4)}`}),
          metadataSubtree: "public/name"
        })) || "";

        if(name.toLowerCase().includes("propert")) {
          libraryId = id;
          break;
        }
      }

      if(!libraryId) {
        libraryId = libraryIds[0];
      }
    } else {
      // Just use same library as tenant info object
      libraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
    }

    const metadata = Unproxy(this.searchIndexTemplateInfo.metadataTemplate);

    metadata.indexer.config.fabric.root.library = libraryId;

    // Copy selected / required fields into new map and set in template
    let fields = {};
    this.searchIndexTemplateInfo.requiredFields.forEach(field =>
      fields[field] = metadata.indexer.config.indexer.arguments.fields[field]
    );

    selectedFields.forEach(field => {
      fields[field] = metadata.indexer.config.indexer.arguments.fields[field];

      this.searchIndexTemplateInfo.associatedFieldMap[field]?.associatedFields?.map(associatedField =>
        fields[associatedField] = metadata.indexer.config.indexer.arguments.fields[associatedField]
      );
    });

    selectedCustomFields.forEach(field => {
      const label = this.searchIndexCustomFields.new?.[field]?.label || FormatFieldName(field);
      fields[field] = {
        "options": {},
        "paths": [
            `site_map.searchables.*.video_tags.metadata_tags.*.metadata_tags.shot_tags.tags.text.${label}.text`
        ],
        "type": "text"
      };
    });

    metadata.indexer.config.indexer.arguments.fields = fields;
    metadata.indexer.config.indexer.arguments.custom_fields = Unproxy(this.searchIndexCustomFields.new || {});

    if(configuration) {
      metadata.search = {
        config: {
          query: Unproxy(configuration)
        }
      };
    }

    let content = {};
    yield this.client.utils.LimitedMap(
      20,
      contentIds,
      async (objectId, index) => {
        content[index] = {
          "/": UrlJoin("/qfab", await this.client.LatestVersionHash({objectId}), "meta")
        };
      }
    );

    const type = Object.values(yield this.client.ContentTypes())
      .find(type => type.name.toLowerCase().includes("index"))?.id;

    let objectId;
    yield this.client.CreateAndFinalizeContentObject({
      libraryId,
      options: { type },
      commitMessage: "EVIE: Create search index",
      callback: async response => {
        objectId = response.objectId;

        metadata.indexer.config.fabric.root.content = objectId;

        await this.client.MergeMetadata({
          libraryId,
          objectId,
          writeToken: response.writeToken,
          metadata: Unproxy({
            ...metadata,
            site_map: {
              searchables: content
            },
            public: {
              name,
              description,
              asset_metadata: {
                display_title: name,
                title: name
              }
            }
          })
        });
      }
    });

    if(!objectId) {
      throw Error("Something went wrong");
    }

    yield this.client.SetPermission({
      libraryId,
      objectId,
      permission: "editable"
    });

    yield this.rootStore.AddGroupPermissions({objectId});

    yield this.AddSearchIndex({objectId});

    this.searchIndexCustomFields[objectId] = this.searchIndexCustomFields.new || {};
    delete this.searchIndexCustomFields.new;

    return objectId;
  });

  UpdateSearchIndex = flow(function * ({
    indexId,
    name="Search Index",
    contentIds=[],
    selectedFields=[],
    selectedCustomFields=[],
    configuration
  }) {
    yield this.LoadSearchIndexTemplateInfo();

    let libraryId = yield this.client.ContentObjectLibraryId({objectId: indexId});

    const indexFields = (yield this.client.ContentObjectMetadata({
      libraryId,
      objectId: indexId,
      metadataSubtree: "/indexer/config/indexer/arguments/fields"
    })) || {};
    const templateMetadata = Unproxy(this.searchIndexTemplateInfo.metadataTemplate);

    // Copy selected / required fields into new map and set in template
    let fields = indexFields;
    this.searchIndexTemplateInfo.requiredFields.forEach(field =>
      fields[field] = {
        ...(fields[field] || {}),
        ...templateMetadata.indexer.config.indexer.arguments.fields[field]
      }
    );

    selectedFields.forEach(field => {
      fields[field] = {
        ...(fields[field] || {}),
        ...templateMetadata.indexer.config.indexer.arguments.fields[field]
      };

      this.searchIndexTemplateInfo.associatedFieldMap[field]?.associatedFields
        ?.map(associatedField =>
          fields[associatedField] = {
            ...(fields[associatedField] || {}),
            ...templateMetadata.indexer.config.indexer.arguments.fields[associatedField]
          }
        );
    });

    selectedCustomFields.forEach(field => {
      const label = this.searchIndexCustomFields[indexId]?.[field] || FormatFieldName(field);
      fields[field] = {
        "options": {},
        "paths": [
          `site_map.searchables.*.video_tags.metadata_tags.*.metadata_tags.shot_tags.tags.text.${label}.text`
        ],
        "type": "text"
      };
    });

    // Remove unselected fields
    this.searchIndexTemplateInfo.optionalFields.forEach(field => {
      if(selectedFields.includes(field)) { return; }

      delete fields[field];
      this.searchIndexTemplateInfo.associatedFieldMap[field]?.associatedFields
        ?.forEach(associatedField =>
          delete fields[associatedField]
        );
    });

    Object.keys(this.searchIndexCustomFields[indexId] || {}).forEach(field => {
      if(selectedCustomFields.includes(field)) { return; }

      delete fields[field];
    });

    // Set content links
    const {contentHashes} = yield this.LoadSearchIndexInfo({indexId});
    let content = {};
    yield this.client.utils.LimitedMap(
      20,
      contentIds,
      async (objectId, index) => {
        content[index] = {
          "/": UrlJoin("/qfab", contentHashes[objectId] || await this.client.LatestVersionHash({objectId}), "meta")
        };
      }
    );

    yield this.client.EditAndFinalizeContentObject({
      libraryId,
      objectId: indexId,
      commitMessage: "EVIE: Update search index",
      callback: async response => {
        await Promise.all(
          [
            {field: "public/name", value: name},
            {field: "public/asset_metadata/display_title", value: name},
            {field: "public/asset_metadata/title", value: name},
            {field: "/indexer/config/indexer/arguments/fields", value: fields},
            {field: "/indexer/config/indexer/arguments/custom_fields", value: this.searchIndexCustomFields[indexId] || {}},
            {field: "/site_map/searchables", value: content},
            ...Object.keys(configuration).map(key => (
              {field: UrlJoin("/search/config/query", key), value: configuration[key]}
            ))
          ]
            .map(async ({field, value}) =>
              await this.client.ReplaceMetadata({
                libraryId,
                objectId: indexId,
                writeToken: response.writeToken,
                metadataSubtree: field,
                metadata: Unproxy(value)
              })
            )
        );
      }
    });

    const existingIndexRecord = this.searchIndexes.find(index => index.id === indexId);
    if(!existingIndexRecord || existingIndexRecord.name !== name) {
      // Add/update search index to config
      yield this.AddSearchIndex({objectId: indexId});
    } else {
      // Otherwise, update
      yield new Promise(resolve => setTimeout(resolve, 1000));
      yield this.LoadSearchIndexes();
    }
  });

  LoadSearchIndexTemplateInfo = flow(function * ({force=false}={}) {
    return yield this.rootStore.LoadResource({
      key: "searchTemplateInfo",
      id: "info",
      bind: this,
      force,
      Load: flow(function * () {
        const {
          metadata_template,
          user_field_regex,
          associated_field_regex
        } = yield this.client.ContentObjectMetadata({
          versionHash: yield this.client.LatestVersionHash({objectId: GLOBAL_PROFILE_OBJECT_ID}),
          metadataSubtree: "public/search/index-templates/tag"
        });

        const fieldList = Object.keys(metadata_template.indexer.config.indexer.arguments.fields);
        const userFieldRegex = new RegExp(user_field_regex);
        const associatedFieldRegex = new RegExp(associated_field_regex);
        const associatedFields = fieldList.filter(field => associatedFieldRegex.test(field));
        const optionalFields = fieldList.filter(field => !associatedFields.includes(field) && userFieldRegex.test(field));
        const requiredFields = fieldList.filter(field => !associatedFields.includes(field) && !optionalFields.includes(field));

        let associatedFieldMap = {};
        optionalFields.forEach(field =>
          associatedFieldMap[field] = {
            field,
            associatedFields: associatedFields.filter(associatedField =>
              associatedField.startsWith(field)
            )
          }
        );

        this.searchIndexTemplateInfo = {
          metadataTemplate: metadata_template,
          requiredFields,
          optionalFields,
          associatedFields,
          associatedFieldMap,
          allDefaultFields: [
            ...requiredFields,
            ...optionalFields,
            ...associatedFields
          ]
        };
      })
    });
  });

  LoadSearchIndexInfo = flow(function * ({indexId, force}) {
    return yield this.rootStore.LoadResource({
      key: "loadSearchIndexInfo",
      id: indexId,
      bind: this,
      ttl: 30,
      force,
      Load: flow(function* () {
        const metadata = yield this.client.ContentObjectMetadata({
          versionHash: yield this.client.LatestVersionHash({objectId: indexId}),
          select: [
            "/indexer/config/indexer/arguments/fields",
            "/indexer/config/indexer/arguments/custom_fields",
            "/search/config/query",
            "/site_map/searchables",
            "/public/name",
            "/public/asset_metadata/display_title",
            "/public/asset_metadata/title"
          ]
        });

        let contentHashes = {};
        const contentIds = Object.values(metadata.site_map.searchables || {})
          .map(link => {
            try {
              const versionHash = link["/"].split("/")[2];

              if(!versionHash) {
                return;
              }

              const objectId = this.client.utils.DecodeVersionHash(
                versionHash
              ).objectId;

              contentHashes[objectId] = versionHash;

              return objectId;
            } catch(error) {
              console.error("Error parsing link");
              console.error(link);
              console.error(error);
            }
          })
          .filter(id => id);

        const fields = Object.keys(metadata.indexer.config.indexer.arguments.fields || {});
        const customFieldInfo = metadata.indexer.config.indexer.arguments?.custom_fields || {};
        const customFields = fields.filter(field => customFieldInfo[field]);

        this.searchIndexCustomFields[indexId] = metadata.indexer.config.indexer.arguments?.custom_fields || {};

        return {
          name:
            metadata.public?.asset_metadata?.display_title ||
            metadata.public?.asset_metadata?.title ||
            metadata.public?.name || indexId,
          fields,
          customFields,
          customFieldInfo,
          configuration: metadata?.search?.config?.query || {},
          contentIds,
          contentHashes
        };
      })
    });
  });

  AddSearchIndexFields = flow(function * ({indexId, objectIds}) {
    yield this.LoadSearchIndexTemplateInfo();

    const excludedFields = [
      "focus",
      "vertical_video",
      "character",
      "pose",
      ...Object.keys(this.rootStore.aiTaggingStore.modelToTrackKeyMapping),
      ...Object.keys(this.rootStore.aiTaggingStore.trackKeyToModelMapping)
    ]
      .flat();

    const fields = {};
    yield this.client.utils.LimitedMap(
      10,
      objectIds,
      async objectId => {
        const {tracks} = await this.rootStore.aiStore.QueryAIAPI({
          objectId,
          path: UrlJoin("/tagstore", objectId, "tracks"),
          format: "JSON"
        });

        tracks
          .filter(track =>
            !this.searchIndexTemplateInfo.allDefaultFields.includes(track.name) &&
            !this.searchIndexCustomFields[indexId]?.[track.name] &&
            !excludedFields.includes(track.name)
          )
          .forEach(track => fields[track.name] = track);
      }
    );

    this.searchIndexCustomFields[indexId] = {
      ...(this.searchIndexCustomFields[indexId] || []),
      ...fields
    };
  });

  RemoveSearchIndexCustomField({indexId, field}) {
    if(this.searchIndexCustomFields[indexId]) {
      delete this.searchIndexCustomFields[indexId][field];
    }
  }

  LoadPoseInfo = flow(function * () {
    return yield this.client.ContentObjectMetadata({
      libraryId: yield this.client.ContentObjectLibraryId({objectId: GLOBAL_PROFILE_OBJECT_ID}),
      objectId: GLOBAL_PROFILE_OBJECT_ID,
      metadataSubtree: "public/track_metadata/pose/point_connections"
    });
  });

  LoadMCPExchangeSentinel = flow(function * () {
    this.mcpExchangeSentinelId = yield this.client.ContentObjectMetadata({
      libraryId: yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId}),
      objectId: this.rootStore.tenantInfoObjectId,
      metadataSubtree: "public/exchange_sentinels/agent",
    });
  });

  /* Highlights */

  LoadHighlightProfiles = flow(function * () {
    let highlightProfileInfo = (yield this.client.ContentObjectMetadata({
      libraryId: yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId}),
      objectId: this.rootStore.tenantInfoObjectId,
      metadataSubtree: "public",
      select: [
        "default_domain",
        "default_profile/highlight_composition",
        "profiles/highlight_composition"
      ]
    })) || {};

    const highlightProfiles = highlightProfileInfo.profiles?.highlight_composition || {};

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
          ...(highlightProfiles[key] || {})
        }
      );
    }

    Object.keys(highlightProfiles || {})
      .forEach(key =>
        highlightProfiles[key].key = key
      );

    this.highlightProfiles = highlightProfiles;

    const defaultProfileKey = highlightProfileInfo.default_profile?.highlight_composition || highlightProfileInfo.default_domain;

    if(highlightProfiles[defaultProfileKey]) {
      this.defaultHighlightProfileKey = defaultProfileKey;
    }
  });

  SaveHighlightProfile = flow(function * ({profile, originalProfileKey}) {
    let key = profile.key || originalProfileKey;
    if(!key.startsWith("user")) {
      // This is a new copy of an existing profile
      key = `user__${profile.type}__${profile.subtype}_${Slugify(profile.name)}`;
    }

    profile = Unproxy({...profile, key});

    profile.key = key;
    profile.original_profile_key = profile.original_profile_key || originalProfileKey;
    profile.created_at = profile.created_at || new Date().toISOString();
    profile.updated_at = new Date().toISOString();
    profile.author = yield this.client.CurrentAccountAddress();

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

  /* Vertical Video Handling */

  AwaitVerticalVideoJobs = flow(function * ({objectId, model}) {
    console.info(`Checking for ${model} jobs`);
    let progress = 0;
    while(progress < 100) {
      const activeJobs = (yield Promise.all(
        ["running", "queued"].map(async status => {
          try {
            return (await this.rootStore.aiTaggingStore.ListTaggingJobs({
              objectId,
              model,
              status
            })).jobs;
          } catch(error) {
            if(error.status === 404) {
              return [];
            }

            throw error;
          }
        })
      ))
        .flat();

      if(activeJobs.length === 0) {
        progress = 100;
      } else {
        progress = 100;
        activeJobs.forEach(job => progress = Math.min(progress, (job.progress || 0) * 100));
        this.verticalVideoProcessingStatus[objectId][`${model}_progress`] = progress;
      }

      yield new Promise(resolve => setTimeout(resolve, 2000));
    }
  });

 RetrieveVerticalVideoTags = flow(function * ({objectId, model}) {
    yield this.AwaitVerticalVideoJobs({objectId, model});

    let trackKey = this.rootStore.aiTaggingStore.modelToTrackKeyMapping[model];

    if(trackKey.length === 1) {
      trackKey = trackKey[0];
    } else {
      trackKey = trackKey.find(key =>
        key.toLowerCase().includes(model.toLowerCase()) ||
        model.toLowerCase().includes(key.toLowerCase())
      );
    }

    let tags = (yield this.rootStore.aiStore.QueryAIAPI({
      objectId,
      path: UrlJoin("/tagstore", objectId, "tags"),
      channelAuth: true,
      queryParams: {
        limit: 1000000,
        has_frame_info: model === "vertical_video",
        track: model === "vertical_video" ? "vertical_video" : trackKey
      },
      format: "JSON"
    }))?.tags || [];

    if(tags.length === 0) {
      // No tags, must submit and wait for vertical video job
      console.info(`No ${model} tags present, starting job`);
      yield this.rootStore.aiTaggingStore.SubmitTaggingJob({
        objectId,
        options: { [model]: true }
      });

      yield new Promise(resolve => setTimeout(resolve, 5000));

      yield this.AwaitVerticalVideoJobs({objectId, model});

      // Re-query tags
      tags = (yield this.rootStore.aiStore.QueryAIAPI({
        objectId,
        path: UrlJoin("/tagstore", objectId, "tags"),
        channelAuth: true,
        queryParams: {
          limit: 1000000,
          has_frame_info: model === "vertical_video",
          track: trackKey
        },
        format: "JSON"
      }))?.tags || [];

      if(tags.length === 0) {
        throw Error("Failed to generate tags");
      }
    }

    this.verticalVideoProcessingStatus[objectId][`${model}_progress`] = 100;

    return tags;
  });

  ProcessVerticalVideo = flow(function * ({objectId, offering="default", force=false}) {
    try {
      this.verticalVideoProcessingStatus[objectId] = {
        shot_progress: 0,
        vertical_video_progress: 0,
      };

      const libraryId = yield this.client.ContentObjectLibraryId({objectId});
      const defaultOfferings = Object.keys(
        (yield this.client.ContentObjectMetadata({
          libraryId,
          objectId,
          metadataSubtree: "offerings",
          select: [
            "*/ready",
            "*/media_struct/duration_rat"
          ]
        }) || {})
      ).filter(key => key.includes("default"));

      const hasVertical = !!(
        yield this.client.ContentObjectMetadata({
          libraryId,
          objectId,
          metadataSubtree: UrlJoin("/offerings", offering, "verticalize", "data")
        })
      );

      if(hasVertical && !force) {
        console.info("Content already has vertical.bin");
        return;
      }

      // Retrieve tags, generating if necessary
      let shotTags = yield this.RetrieveVerticalVideoTags({objectId, model: "shot"});
      let verticalVideoTags = yield this.RetrieveVerticalVideoTags({objectId, model: "vertical_video"});

      if(shotTags?.length !== verticalVideoTags?.length) {
        throw Error(`Mismatch between shot / vertical video tag count: Shot ${shotTags.length} Vertical ${verticalVideoTags.length}`);
      }

      console.info("Processing tags");

      // Sort both tag arrays by start_time and end_time to ensure chronological processing
      // (tagstore returns in order but not sure if that is guaranteed)
      shotTags = shotTags.sort((a, b) => {
        return ((a.start_time ?? 0) - (b.start_time ?? 0)) || ((a.end_time ?? 0) - (b.end_time ?? 0));
      });
      verticalVideoTags = verticalVideoTags.sort((a, b) => {
        return ((a.start_time ?? 0) - (b.start_time ?? 0)) || ((a.end_time ?? 0) - (b.end_time ?? 0));
      });

      console.info(`Found ${shotTags.length} shot tags and ${verticalVideoTags.length} vertical video tags`);

      // Verify start_times line up, because end_time for vertical is generated by the model's length measurement
      // of the generated shot-part, end_time can wobble
      for(let i = 0; i < shotTags.length; i++) {
        const shot = shotTags[i];
        const vt = verticalVideoTags[i];
        if(shot.start_time !== vt.start_time) {
          throw Error(
            `Mismatch between start times at index ${i}: ` +
            `shot: ${shot.start_time} vertical: ${vt.start_time})`
          );
        }
        if(Math.abs(vt.end_time - shot.end_time) > 500) {
          throw Error(
            `Difference between end_times at index ${i} is greater than 500ms: ` +
            `shot: ${shot.start_time} vertical: ${vt.start_time})`
          );

        }
      }

      // Build xValues, filling in missing frames:
      //   - frames before the first shot get 0.5
      //   - frames in gaps between shots get the last xValue of the preceding shot
      const xValues = [];

      verticalVideoTags.forEach(tag => {
        const currentFrameIdx = tag.frame_info?.frame_idx ?? 0;
        const coords = tag.additional_info?.["x-coordinates"] || [];

        if(xValues.length < currentFrameIdx) {
          const lastXValue = xValues.length ? xValues.slice(-1)[0] : Math.round(0.5 * 10000);
          while(xValues.length < currentFrameIdx) {
            xValues.push(lastXValue);
          }
        } else if(xValues.length > currentFrameIdx) {
          if (currentFrameIdx - xValues.length > 4) {
            throw Error(
              `Overlap in vertical video tag frame indices more than 4 frames, should never be more than 1. Tag ID: ${tag.id}. ` +
              `Current frame_idx ${currentFrameIdx} is more than 4 before already-populated frame ${xValues.length}.`
            );
          }
          xValues.length = currentFrameIdx;
        }

        coords.forEach(x => {
          xValues.push(Math.round(x * 10000));
        });
      });

      // 3. Pack into Buffer as 4-byte Little Endian integers
      const buffer = Buffer.alloc(xValues.length * 4);
      xValues.forEach((value, i) => {
        buffer.writeInt32LE(value, i * 4);
      });

      const editResponse = yield this.client.EditContentObject({
        libraryId,
        objectId
      });

      yield this.client.UploadFiles({
        libraryId,
        objectId,
        writeToken: editResponse.write_token,
        fileInfo: [
          {
            path: "vertical.bin",
            mime_type: "application/octet-stream",
            size: buffer.length,
            data: buffer,
          },
        ],
      });

      for(const offering of defaultOfferings) {
        yield this.client.ReplaceMetadata({
          libraryId,
          objectId,
          writeToken: editResponse.write_token,
          metadataSubtree: UrlJoin("/offerings", offering, "verticalize", "data"),
          metadata: {
            "/": "./files/vertical.bin"
          }
        });
      }

      yield this.client.FinalizeContentObject({
        libraryId,
        objectId,
        writeToken: editResponse.write_token,
        commitMessage: "EVIE: Upload vertical video information file"
      });
    } finally {
      delete this.verticalVideoProcessingStatus[objectId];
    }
  });

  LoadSearchQueries = flow(function * () {
    try {
      const queries = yield this.rootStore.client.walletClient.ProfileMetadata({
        type: "app",
        appId: "video-editor",
        mode: "private",
        key: `search-queries-${this.rootStore.tenantContractId}-${this.rootStore.localhost ? "-dev" : ""}`
      });

      if(queries) {
        this.previousSearchQueries = JSON.parse(this.client.utils.FromB64(queries));
      }
    } catch(error) {
      console.error("Failed loading previous search queries");
      console.error(error);
    }
  });

  SaveSearchQuery = flow(function * ({mode, query}) {
    if(!mode || !query) { return; }

    const initialQueries = JSON.stringify(this.previousSearchQueries);

    if(!this.previousSearchQueries[this.selectedSearchIndexId]) {
      this.previousSearchQueries[this.selectedSearchIndexId] = {};
    }

    this.previousSearchQueries[this.selectedSearchIndexId][mode] = [
      query,
      ...(this.previousSearchQueries[this.selectedSearchIndexId][mode] || [])
    ]
      .filter(q => q)
      .filter((x, i, a) => a.findIndex(q => q === x) === i)
      .slice(0, 10);

    if(JSON.stringify(this.previousSearchQueries) === initialQueries) {
      // No change
      return;
    }

    yield this.rootStore.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `search-queries-${this.rootStore.tenantContractId}-${this.rootStore.localhost ? "-dev" : ""}`,
      value: this.rootStore.client.utils.B64(
        JSON.stringify(this.previousSearchQueries || {})
      )
    });
  });

  V2SearchConfig({selectedFields, configuration}) {
    let config = {
      "indexer": {
        "document": {
          "aggregation": {
            "track": "shot_detection"
          }
        },
        "fields": {
          "title": {
            "source": {
              "fabric_paths": [
                "public.asset_metadata.display_title",
                "public.asset_metadata.title"
              ]
            }
          }
        }
      },
      "search": {
        "clip_search": {
          "defaults": {
            "rerank_level": "document",
            "rerank_user_query": true,
            "clips_min_duration": configuration?.clips_pad_duration || 10,
            "clips_max_duration": configuration?.clips_truncate_duration || 30
          }
        }
      }
    };

    selectedFields.forEach(field =>
      config.indexer.fields[field] = {
        source: {
          tag_tracks: [field]
        }
      }
    );

    return config;
  }

  // Search Index
  CreateSearchIndexV2 = flow(function * ({
    name="Search Index",
    description="",
    contentIds=[],
    selectedFields=[],
    selectedCustomFields=[],
    configuration
  }) {
    try {
      let libraryId;
      if(this.rootStore.tenantContractId.includes(this.rootStore.tenantInfoObjectId.slice(4))) {
        // No tenant info object, using tenant object. Must find a library;
        const libraryIds = yield this.client.ContentLibraries();
        for(const id of libraryIds) {
          const name = (yield this.client.ContentObjectMetadata({
            versionHash: yield this.client.LatestVersionHash({objectId: `iq__${id.slice(4)}`}),
            metadataSubtree: "public/name"
          })) || "";

          if(name.toLowerCase().includes("propert")) {
            libraryId = id;
            break;
          }
        }

        if(!libraryId) {
          libraryId = libraryIds[0];
        }
      } else {
        // Just use same library as tenant info object
        libraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
      }

      this.indexCreateProgress = 30;

      // Create the object and set permissions
      const type = Object.values(yield this.client.ContentTypes())
        .find(type => type.name.toLowerCase().includes("index"))?.id;
      this.indexCreateProgress = 35;

      let objectId;
      yield this.client.CreateAndFinalizeContentObject({
        libraryId,
        options: {type},
        commitMessage: "EVIE: Create search index",
        callback: async response => {
          objectId = response.objectId;

          runInAction(() => this.indexCreateProgress = 50);

          await this.client.MergeMetadata({
            libraryId,
            objectId,
            writeToken: response.writeToken,
            metadata: Unproxy({
              public: {
                name,
                description,
                asset_metadata: {
                  display_title: name,
                  title: name
                }
              }
            })
          });
        }
      });

      this.indexCreateProgress = 60;

      if(!objectId) {
        throw Error("Something went wrong");
      }

      yield this.client.SetPermission({
        libraryId,
        objectId,
        permission: "editable"
      });

      this.indexCreateProgress = 70;

      yield this.rootStore.AddGroupPermissions({objectId});

      // Create the collection
      const collectionResponse = yield this.rootStore.aiStore.QueryAIAPI({
        server: "ai-04",
        objectId,
        path: "/vector_store/collections",
        method: "POST",
        channelAuth: true,
        body: {
          name: `${name} Collection`,
          qids: [objectId],
          tenant: this.rootStore.tenantContractId
        },
        format: "JSON"
      });

      // Add contents to the collection
      yield this.rootStore.aiStore.QueryAIAPI({
        server: "ai-04",
        objectId,
        path: UrlJoin("/vector_store", "collections", collectionResponse.collection_id, "contents"),
        method: "POST",
        channelAuth: true,
        body: {
          qids: contentIds
        },
        format: "JSON"
      });

      this.indexCreateProgress = 80;

      // Create the index
      const config = this.V2SearchConfig({
        selectedFields: [...selectedFields, ...selectedCustomFields],
        configuration
      });

      yield this.rootStore.aiStore.QueryAIAPI({
        server: "ai-04",
        objectId,
        path: UrlJoin("/vector_store", "indexes", objectId),
        method: "POST",
        channelAuth: true,
        body: {
          collection_id: collectionResponse.collection_id,
          name: `${name} Index`,
          type: "clip-search",
          config
        },
        format: "JSON"
      });

      this.indexCreateProgress = 90;

      yield this.rootStore.aiStore.QueryAIAPI({
        server: "ai-04",
        objectId,
        path: UrlJoin("/elv-indexer", "indexes", objectId, "crawl"),
        method: "POST",
        authTokenInHeader: true,
        channelAuth: true,
        format: "JSON"
      });

      // TODO: Await crawl;
      /*
          const crawlStatus = yield this.rootStore.aiStore.QueryAIAPI({
        server: "ai-04",
        objectId,
        path: UrlJoin("/elv-indexer", "indexes", objectId, "crawl", crawlResponse.handle),
        method: "GET",
        authTokenInHeader: true,
        channelAuth: true,
        format: "JSON"
      });
       */

      yield this.AddSearchIndex({objectId, isV2: true});

      this.searchIndexCustomFields[objectId] = this.searchIndexCustomFields.new || {};
      delete this.searchIndexCustomFields.new;

      this.StartSearchIndexUpdateStatusWatcher();

      return objectId;
    } finally {
      this.indexCreateProgress = undefined;
    }
  });

  UpdateSearchIndexV2 = flow(function * ({
    indexId,
    name="Search Index",
    contentIds=[],
    selectedFields=[],
    selectedCustomFields=[],
    configuration
  }) {
    const objectId = indexId;
    const indexInfo = yield this.rootStore.aiStore.QueryAIAPI({
      server: "ai-04",
      objectId,
      path: UrlJoin("/vector_store", "indexes", objectId),
      method: "GET",
      channelAuth: true,
      format: "JSON"
    });

    const collectionId = indexInfo.collection_id;
    const collectionInfo = yield this.rootStore.aiStore.QueryAIAPI({
      server: "ai-04",
      objectId,
      path: UrlJoin("/vector_store", "collections", collectionId),
      method: "GET",
      channelAuth: true,
      format: "JSON"
    });

    // Update content
    const toAdd = contentIds.filter(id => !collectionInfo.qids.includes(id));
    const toRemove = collectionInfo.qids.filter(id => !contentIds.includes(id));

    if(toAdd) {
      yield this.rootStore.aiStore.QueryAIAPI({
        server: "ai-04",
        objectId,
        path: UrlJoin("/vector_store", "collections", collectionId, "contents"),
        method: "POST",
        channelAuth: true,
        format: "JSON",
        body: {
          qids: toAdd
        }
      });
    }

    if(toRemove) {
      yield this.rootStore.aiStore.QueryAIAPI({
        server: "ai-04",
        objectId,
        path: UrlJoin("/vector_store", "collections", collectionId, "contents"),
        method: "DELETE",
        channelAuth: true,
        format: "JSON",
        body: {
          qids: toRemove
        }
      });
    }

    this.indexCreateProgress = 60;

    // Update config
    let indexConfig = indexInfo.config;
    const updatedIndexConfig = this.V2SearchConfig({
      selectedFields: [...selectedFields, ...selectedCustomFields],
      configuration
    });

    // Change only the parts of the config we want to change
    indexConfig.indexer.fields = updatedIndexConfig.indexer.fields;

    if(!indexConfig.search) {
      indexConfig.search = {};
    }

    if(!indexConfig.search.clip_search) {
      indexConfig.search.clip_search = {};
    }

    indexConfig.search.clip_search.defaults = {
      ...indexConfig?.search?.clip_search.defaults || {},
      ...updatedIndexConfig?.search?.clip_search.defaults
    };

    yield this.rootStore.aiStore.QueryAIAPI({
      server: "ai-04",
      objectId,
      path: UrlJoin("/vector_store", "indexes", objectId),
      method: "PATCH",
      channelAuth: true,
      body: {
        name,
        config: indexConfig
      },
      format: "JSON"
    });

    this.indexCreateProgress = 80;

    if(toAdd.length > 0) {
      yield this.rootStore.aiStore.QueryAIAPI({
        server: "ai-04",
        objectId,
        path: UrlJoin("/elv-indexer", "indexes", objectId, "crawl"),
        method: "POST",
        channelAuth: true,
        authTokenInHeader: true,
        format: "JSON"
      });
    }

    this.StartSearchIndexUpdateStatusWatcher();
  });

  LoadSearchIndexInfoV2 = flow(function * ({indexId, force}) {
    return yield this.rootStore.LoadResource({
      key: "loadSearchIndexInfoV2",
      id: indexId,
      bind: this,
      ttl: 30,
      force,
      Load: flow(function* () {
        const metadata = yield this.client.ContentObjectMetadata({
          versionHash: yield this.client.LatestVersionHash({objectId: indexId}),
          select: [
            "custom_fields",
            "/public/name",
            "/public/asset_metadata/display_title",
            "/public/asset_metadata/title"
          ]
        });

        const indexInfo = yield this.rootStore.aiStore.QueryAIAPI({
          server: "ai-04",
          objectId: indexId,
          path: UrlJoin("/vector_store", "indexes", indexId),
          method: "GET",
          authTokenInHeader: true,
          format: "JSON"
        });

        const collectionInfo = yield this.rootStore.aiStore.QueryAIAPI({
          server: "ai-04",
          objectId: indexId,
          path: UrlJoin("/vector_store", "collections", indexInfo.collection_id),
          method: "GET",
          authTokenInHeader: true,
          format: "JSON"
        });

        let allSelectedFields = [];
        Object.keys(indexInfo?.config?.indexer?.fields || {}).forEach(field =>
          allSelectedFields = [
            ...allSelectedFields,
            ...(indexInfo.config.indexer.fields[field].source.tag_tracks || [])
          ]
        );

        allSelectedFields = allSelectedFields
          .filter((x, i, a) => a.findIndex(q => q === x) === i);

        const customFieldInfo = metadata?.custom_fields || {};
        const customFields = allSelectedFields.filter(field => customFieldInfo[field]);

        this.searchIndexCustomFields[indexId] = metadata?.custom_fields || {};

        let config = indexInfo?.config?.search?.clip_search?.defaults || {};
        if(config.clips_min_duration) {
          config.clips_pad_duration = config.clips_min_duration;
        }

        if(config.clips_max_duration) {
          config.clips_truncate_duration = config.clips_max_duration;
        }

        return {
          name:
            indexInfo.name ||
            metadata.public?.asset_metadata?.display_title ||
            metadata.public?.asset_metadata?.title ||
            metadata.public?.name || indexId,
          fields: allSelectedFields,
          customFields,
          customFieldInfo,
          configuration: config,
          contentIds: collectionInfo.qids
        };
      })
    });
  });
}

export default AIStore;
