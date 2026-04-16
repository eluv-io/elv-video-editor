import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";

// Statuses: ("queued", "running", "cancelled", "failed", "succeeded")

class AITaggingStore {
  selectedContent = [];
  jobStatus = {};

  modelNames = {};
  trackKeyToModelMapping = {};
  segmentModels = [];
  frameModels = [];
  processorModels = [];

  audioTracks = {};

  constructor(rootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  get client() {
    return this.rootStore.client;
  }

  get selectedContentCommonAudioTracks() {
    if(this.selectedContent.length <= 1) {
      return this.audioTracks[this.selectedContent[0]?.objectId] || [];
    }

    return (this.audioTracks[this.selectedContent[0]?.objectId] || [])
      .filter(track =>
        !this.selectedContent.slice(1)
          .find(({objectId}) =>
            !this.audioTracks[objectId].find(otherTrack => otherTrack.value === track.value)
          )
      );
  }

  Initialize() {
    this.GetTaggingModels();
  }

  GetModelNameFromTrackKey(key) {
    return this.trackKeyToModelMapping[key];
  }

  AddSelectedContent({objectId, name}) {
    if(this.selectedContent.find(item => item.objectId === objectId)) {
      return;
    }

    this.selectedContent.push({objectId, name});

    // Preload audio track info
    this.GetAudioTracks({objectId});
  }

  RemoveSelectedContent({objectId}) {
    this.selectedContent = this.selectedContent
      .filter(item => item.objectId !== objectId);
  }

  ClearSelectedContent() {
    this.selectedContent = [];
  }

  GetTaggingModels = flow(function * () {
    let {models} = (yield this.rootStore.aiStore.QueryAIAPI({
      path: UrlJoin("tagging-live", "models")
    })) || {models: []};

    for(const model of models) {
      this.modelNames[model.name] = model.description;

      if(model.type === "frame") {
        this.frameModels.push(model.name);
      } else if(model.type === "processor") {
        this.processorModels.push(model.name);
      } else {
        this.segmentModels.push(model.name);
      }

      for(const track of model.tag_tracks || []) {
        this.trackKeyToModelMapping[track.name] = model.name;
      }
    }
  });

  GetAudioTracks = flow(function * ({objectId}) {
    this.audioTracks[objectId] = yield this.rootStore.LoadResource({
      key: "taggingAudioTracks",
      id: objectId,
      bind: this,
      Load: flow(function * () {
        const metadata = yield this.client.ContentObjectMetadata({
          libraryId: yield this.client.ContentObjectLibraryId({objectId}),
          objectId: objectId,
          metadataSubtree: "offerings",
          resolveLinks: true,
          linkDepthLimit: 1,
          select: [
            "*/playout/streams/*/representations/*/type",
            "*/media_struct/streams/*/label",
            "*/media_struct/streams/*/default_for_media_type"
          ]
        });

        const offering = metadata.default ? "default" :
          Object.keys(metadata).find(key => key.includes("default")) || Object.keys(metadata)[0];

        const audioTrackKeys = Object.keys(metadata[offering].playout.streams)
          .map(streamKey =>
            Object.keys(metadata[offering].playout.streams[streamKey].representations || {})
              .filter(repKey =>
                metadata[offering].playout.streams[streamKey].representations[repKey].type === "RepAudio"
              )
              .map(repKey => ({streamKey, repKey}))
          )
          .flat();

        return audioTrackKeys
          .map(({streamKey}) => ({
            value: streamKey.split("__")[0],
            streamKey,
            transcodeId: streamKey.split("__")[1],
            label: metadata[offering].media_struct.streams[streamKey].label,
            isDefault: !!metadata[offering].media_struct.streams[streamKey].default_for_media_type,
          }))
          .sort((a, b) => a.label < b.label ? -1 : 1);
      })
    });

    return this.audioTracks[objectId];
  });

  ListTaggingJobs = flow(function * ({start=0, limit=10, status, model, filter=""}={}) {
    const tenantId = yield this.rootStore.client.userProfileClient.TenantContractId();
    let {jobs, meta} = yield this.rootStore.aiStore.QueryAIAPI({
      path: UrlJoin("tagging-live", "job-status"),
      queryParams: {
        tenant: tenantId,
        start,
        limit,
        status,
        title: filter.toLowerCase(),
        model
      }
    });

    // Load object name
    jobs = jobs.map(job => ({
      ...job,
      objectId: job.qid,
    }));

    for(const job of jobs) {
      // Update job status
      this.jobStatus[job.job_id] = job;
    }

    return { jobs, meta };
  });

  GetObjectJobStatus = flow(function * ({objectId, force}) {
    return yield this.rootStore.LoadResource({
      key: "tagging-job-status",
      id: objectId,
      ttl: 10,
      force,
      Load: flow(function * () {
        const tenantId = yield this.client.ContentObjectTenantId({objectId});
        try {
          let {jobs} = (yield this.rootStore.aiStore.QueryAIAPI({
            objectId: objectId,
            path: UrlJoin("tagging-live", objectId, "job-status"),
            queryParams: {
              tenant: tenantId
            }
          })) || {jobs: []};

          return jobs.map(job => {
            job.objectId = objectId;
            this.jobStatus[job.job_id] = job;

            return job;
          });
        } catch(error) {
          if(error?.status === 404) {
            return [];
          }

          throw error;
        }
      }).bind(this)
    });
  });

  SubmitTaggingJobs = flow(function * ({options}) {
    let jobInfo = {};
    for(let i = 0; i < this.selectedContent.length; i++) {
      const {objectId} = this.selectedContent[i];

      jobInfo[objectId] = yield this.SubmitTaggingJob({objectId, options});
    }

    return jobInfo;
  });

  SubmitTaggingJob = flow(function * ({objectId, options}) {
    const params = [...this.segmentModels, ...this.frameModels, ...this.processorModels]
      .filter(key => options[key])
      .map(key => {
        let result = { model: key };

        // Determine proper audio track
        const stream = options?.options?.[key]?.stream;
        if(stream) {
          const streamKey = this.audioTracks[objectId].find(track => track.value === stream)?.streamKey;

          if(streamKey) {
            result.overrides = {
              scope: {
                stream: streamKey
              }
            };
          }
        }

        const groundTruthPool = options?.options?.[key]?.groundTruthPool;
        if(groundTruthPool) {
          result.model_params = {
            ground_truth: groundTruthPool
          };
        }

        return result;
      });

    const tenantId = yield this.client.ContentObjectTenantId({objectId});
    const {jobs} = yield this.rootStore.aiStore.QueryAIAPI({
      objectId,
      path: UrlJoin("tagging-live", objectId, "tag"),
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      queryParams: {
        tenant: tenantId
      },
      body: { jobs: params }
    });

    return jobs;
  });

  RestartTaggingJob = flow(function * ({objectId, model, options, jobId}) {
    if(options) {
      options = {
        model,
        model_params: {
          ...(options.run_config || {})
        },
        overrides: {
          ...options
        }
      };

      delete options.overrides.run_config;
      delete options.overrides.feature;
    }

    yield this.SubmitTaggingJob({
      objectId: objectId,
      options: {
        [model]: options || true
      }
    });

    if(jobId) {
      try {
        // Delete original job
        yield this.DeleteTaggingJob({objectId, jobId});
      } catch(error) {
        console.error("Failed to delete original job", jobId);
        console.error(error);
      }
    }

    yield new Promise(resolve => setTimeout(resolve, 1000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });

  PauseTaggingJob = flow(function * ({objectId, model}) {
    const tenantId = yield this.client.ContentObjectTenantId({objectId});
    yield this.rootStore.aiStore.QueryAIAPI({
      objectId: objectId,
      method: "POST",
      path: UrlJoin("tagging-live", objectId, "stop", model),
      queryParams: {
        tenant: tenantId
      }
    });

    yield new Promise(resolve => setTimeout(resolve, 5000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });

  DeleteTaggingJob = flow(function * ({objectId, jobId}) {
    const tenantId = yield this.client.ContentObjectTenantId({objectId});
    yield this.rootStore.aiStore.QueryAIAPI({
      objectId: objectId,
      method: "Delete",
      path: UrlJoin("tagging-live", "jobs", jobId),
      queryParams: {
        tenant: tenantId
      }
    });

    yield new Promise(resolve => setTimeout(resolve, 5000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });
}

export default AITaggingStore;
